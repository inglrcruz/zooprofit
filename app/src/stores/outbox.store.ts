import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '@/constants/config';
import { errorMessage, isSessionExpired } from '@/utilities/requests';
import { useAuthStore } from './auth.store';

/** One change made on this device that the server has not confirmed yet. */
export type Op = {
  id: string;
  /** Who made it: it is only ever sent with that user's session. */
  userId: string;
  /** Store that receives the server's answer ("sow", "registro"…). */
  store: string;
  method: 'post' | 'patch' | 'delete';
  route: string;
  body?: object;
  /** What the user did, in their words, for the list of pending changes. */
  label: string;
  at: string;
  /** Set when the server rejected it: it waits for the user to decide. */
  error?: string;
};

interface State {
  queue: Op[];
  /** False after a request could not reach the server; true after one did. */
  online: boolean;
  sending: boolean;
}

type Actions = {
  enqueue: (op: Omit<Op, 'userId' | 'at'>) => void;
  flush: () => Promise<void>;
  discard: (id: string) => void;
  setOnline: (online: boolean) => void;
};

const sinks = new Map<string, (data: any) => void>();
/** Lets a store receive what the server answers to its queued creates and updates. */
export const registerSink = (store: string, upsert: (data: any) => void) => void sinks.set(store, upsert);

const stale: ((now: boolean) => void)[] = [];
/**
 * Run when what the device shows may differ from the server: changes that
 * had been waiting were sent, or one was discarded (`now`: read again at once).
 */
export const onStale = (fn: (now: boolean) => void) => void stale.push(fn);
/** A change sent this long after it was made had been waiting for a connection. */
const WAITED_MS = 5000;

let inFlight: Promise<void> | null = null;
const me = () => useAuthStore.getState().user?.id ?? '';

/**
 * The queue of changes made without a connection (or not yet confirmed).
 * They are sent in the order they were made. The API accepts ids chosen by
 * the client and answers 409 to a repeated create, so sending one twice is
 * harmless.
 */
export const useOutbox = create<State & Actions>()(persist((set, get) => ({
  queue: [],
  online: true,
  sending: false,

  enqueue: (op) => set({ queue: [...get().queue, { ...op, userId: me(), at: new Date().toISOString() }] }),

  /**
   * Sends every pending change of the signed-in user, oldest first. It stops
   * at the first one that cannot reach the server; one the server rejects is
   * kept with its error and the rest go on.
   */
  flush: (): Promise<void> => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const token = useAuthStore.getState().token;
      const mine = () => get().queue.filter((o) => o.userId === me() && !o.error);
      let waited = false;
      try {
        if (!token) return;
        if (!mine().length) {
          // Nothing to send, but "offline" must still clear once the server answers.
          if (get().online) return;
          try {
            await axios.get(API_BASE_URL);
          } catch (error: any) {
            if (!error?.response) return;
          }
          set({ online: true });
          stale.forEach((fn) => fn(true));
          return;
        }
        set({ sending: true });
        for (let op = mine()[0]; op; op = mine()[0]) {
          const drop = () => set({ queue: get().queue.filter((o) => o.id !== op.id) });
          try {
            const { data } = await axios.request({ method: op.method, url: API_BASE_URL + op.route, data: op.body, headers: { Authorization: `Bearer ${token}` } });
            if (op.method !== 'delete' && data) sinks.get(op.store)?.(data);
            waited ||= Date.now() - new Date(op.at).getTime() > WAITED_MS;
            drop();
            set({ online: true });
          } catch (error: any) {
            if (!error?.response) {
              set({ online: false });
              return;
            }
            set({ online: true });
            if (isSessionExpired(error)) return;
            // Already created by an earlier attempt, or already gone: done.
            if ((op.method === 'post' && error.response.status === 409) || (op.method === 'delete' && error.response.status === 404)) drop();
            else set({ queue: get().queue.map((o) => (o.id === op.id ? { ...o, error: errorMessage(error) } : o)) });
          }
        }
        // After working offline, the next read of each list comes from the server.
        if (waited && !mine().length) stale.forEach((fn) => fn(false));
      } finally {
        set({ sending: false });
      }
    })().finally(() => {
      // Released here, not inside: a run that ends without awaiting anything
      // would otherwise clear the lock before it is even assigned.
      inFlight = null;
    });
    return inFlight;
  },

  discard: (id) => {
    set({ queue: get().queue.filter((o) => o.id !== id) });
    // What it had changed on screen is no longer true: read the lists again.
    stale.forEach((fn) => fn(true));
  },

  setOnline: (online) => set({ online }),
}),
  {
    name: 'outbox-store',
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (s) => ({ queue: s.queue }),
  }
));

/** Pending changes of the signed-in user: [waiting to be sent, rejected by the server]. */
export const pendingOf = (queue: Op[], userId: string): [Op[], Op[]] => {
  const mine = queue.filter((o) => o.userId === userId);
  return [mine.filter((o) => !o.error), mine.filter((o) => o.error)];
};
