import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { errorResponse, getRequest } from '@/utilities/requests';
import { newId } from '@/utilities/miscellaneous';
import { listStorage } from '@/utilities/storage';
import { useAuthStore } from './auth.store';
import { useGlobalStore } from './global.store';
import { onFarmChange, useFarmStore } from './farm.store';
import { onStale, registerSink, useOutbox } from './outbox.store';

const PAGE = 5000; // the API's maximum page size
const FRESH_MS = 30_000;

interface State<T> {
  list: T[];
  /** Farm the list belongs to, and when it was read from the server. */
  farmId: string;
  loadedAt: number;
}

export type ResourceStore<T, C = Partial<T>> = State<T> & {
  findAll: (force?: boolean) => Promise<T[]>;
  findOne: (id: string) => Promise<T>;
  create: (data: C) => Promise<T>;
  update: (id: string, data: Partial<T>) => Promise<T>;
  delete: (id: string) => Promise<void>;
  /** Puts an item the API just returned into the list. */
  upsert: (item: T) => void;
  reset: () => void;
};

export const farmRoute = () => `farms/${useFarmStore.getState().current?.id ?? ''}`;
const token = () => useAuthStore.getState().token;
const userId = () => useAuthStore.getState().user?.id ?? '';
/** True while this user has changes the server has not received. */
const hasUnsent = () => useOutbox.getState().queue.some((o) => o.userId === userId() && !o.error);

/**
 * Queues a change and tries to send it at once. Resolves "sent" or "queued"
 * (no connection: it will go later); rejects, after `undo`, when the server
 * refuses it.
 */
export const send = async (op: Parameters<ReturnType<typeof useOutbox.getState>['enqueue']>[0], undo: () => void): Promise<'sent' | 'queued'> => {
  const outbox = useOutbox.getState();
  outbox.enqueue(op);
  await outbox.flush();
  const left = useOutbox.getState().queue.find((o) => o.id === op.id);
  if (!left) return 'sent';
  if (!left.error) return 'queued';
  useOutbox.setState({ queue: useOutbox.getState().queue.filter((o) => o.id !== op.id) });
  undo();
  useGlobalStore.getState().showAlert({ title: 'Ups, algo salió mal', message: left.error, type: 'error' });
  throw new Error(left.error);
};

/**
 * Builds the store of a resource that lives inside the current farm
 * (GET list, POST, GET/PATCH/DELETE by id under /farms/:farmId/<path>).
 *
 * It works without a connection: the list is kept on the device, and a
 * create, update or delete shows at once and waits in the outbox until the
 * server can be reached.
 *
 * The loading flags it raises in the global store are `list<Name>`,
 * `<name>` (create/update) and `delete<Name>` (the id being deleted).
 *
 * @param name Singular camelCase name: "sow", "product"
 * @param path Path of the resource under the farm: "cerdas"
 * @param createPath Path to POST to when it differs from the list's
 * @param label What one of these is called (or how to call a given one), for the list of pending changes
 */
export function createResourceStore<T extends { id: string }, C = Partial<T>>(
  name: string,
  path: string,
  createPath?: (data: C) => string,
  label: string | ((data: Partial<T>) => string) = name,
) {
  const Name = name[0].toUpperCase() + name.slice(1);
  const global = useGlobalStore.getState();
  const initialState: State<T> = { list: [], farmId: '', loadedAt: 0 };
  let pending: Promise<T[]> | null = null;
  const what = (data: unknown) => (typeof label === 'function' ? label(data as Partial<T>) : label);

  const store = create<ResourceStore<T, C>>()(persist((set, get) => {
    /** The list as it must be for the current farm; another farm's is dropped. */
    const mine = () => {
      const farmId = useFarmStore.getState().current?.id ?? '';
      if (get().farmId !== farmId) set({ ...initialState, farmId });
      return farmId;
    };

    return {
      ...initialState,

      /**
       * Reads the whole list of the current farm. A list read less than 30 s
       * ago is reused unless `force`, and concurrent calls share one request.
       * Without a connection, or while changes wait to be sent, it answers
       * with what the device has.
       */
      findAll: async (force = false): Promise<T[]> => {
        await hydrated();
        const farmId = mine();
        if (!farmId) return [];
        if (!force && Date.now() - get().loadedAt < FRESH_MS) return get().list;
        if (pending) return pending;
        pending = (async () => {
          try {
            global.setLoading({ [`list${Name}`]: true });
            // Reading now would erase what is shown but not yet sent.
            await useOutbox.getState().flush();
            if (hasUnsent()) return get().list;
            // ponytail: reads every row, page by page. Filter by date on the
            // server (?from=&to=) once a farm outgrows a few thousand rows.
            const all: T[] = [];
            for (;;) {
              const { data } = await getRequest(`${farmRoute()}/${path}?limit=${PAGE}&offset=${all.length}`, token());
              all.push(...(data || []));
              if ((data || []).length < PAGE) break;
            }
            useOutbox.getState().setOnline(true);
            // The user may have switched farm while this was in flight.
            if (useFarmStore.getState().current?.id === farmId) set({ list: all, farmId, loadedAt: Date.now() });
            return all;
          } catch (error: any) {
            if (!error?.response) {
              // No connection: the saved list is the answer, without an alert.
              useOutbox.getState().setOnline(false);
              return get().list;
            }
            errorResponse(error);
            throw error;
          } finally {
            pending = null;
            global.setLoading({ [`list${Name}`]: false });
          }
        })();
        return pending;
      },

      findOne: async (id: string): Promise<T> => {
        try {
          const { data } = await getRequest(`${farmRoute()}/${path}/${id}`, token());
          get().upsert(data);
          return data;
        } catch (error: any) {
          const saved = get().list.find((i) => i.id === id);
          if (!error?.response && saved) return saved;
          errorResponse(error);
          throw error;
        }
      },

      create: async (body: C): Promise<T> => {
        try {
          global.setLoading({ [name]: true });
          await hydrated();
          const farmId = mine();
          const id = (body as { id?: string }).id || newId();
          const now = new Date().toISOString();
          // Shown at once, as the server will answer it; replaced when it does.
          const item = { ...body, id, farmId, createdAt: now, updatedAt: now } as unknown as T;
          get().upsert(item);
          await send(
            { id: newId(), store: name, method: 'post', route: `${farmRoute()}/${createPath ? createPath(body) : path}`, body: { ...body, id }, label: `Nuevo: ${what(body)}` },
            () => set({ list: get().list.filter((i) => i.id !== id) }),
          );
          return get().list.find((i) => i.id === id) ?? item;
        } finally {
          global.setLoading({ [name]: false });
        }
      },

      update: async (id: string, body: Partial<T>): Promise<T> => {
        try {
          global.setLoading({ [name]: true });
          await hydrated();
          mine();
          const before = get().list.find((i) => i.id === id);
          const item = { ...before, ...body, id } as T;
          get().upsert(item);
          await send(
            { id: newId(), store: name, method: 'patch', route: `${farmRoute()}/${path}/${id}`, body, label: `Cambio: ${what({ ...before, ...body })}` },
            () => before && get().upsert(before),
          );
          return get().list.find((i) => i.id === id) ?? item;
        } finally {
          global.setLoading({ [name]: false });
        }
      },

      delete: async (id: string): Promise<void> => {
        try {
          global.setLoading({ [`delete${Name}`]: id });
          await hydrated();
          mine();
          const before = get().list;
          set({ list: before.filter((item) => item.id !== id) });
          await send({ id: newId(), store: name, method: 'delete', route: `${farmRoute()}/${path}/${id}`, label: `Eliminado: ${what(before.find((i) => i.id === id))}` }, () => set({ list: before }));
        } finally {
          global.setLoading({ [`delete${Name}`]: false });
        }
      },

      upsert: (item: T) => {
        const list = get().list;
        set({ list: list.some((i) => i.id === item.id) ? list.map((i) => (i.id === item.id ? item : i)) : [item, ...list] });
      },

      reset: () => set(initialState),
    };
  },
    {
      name: `fp-${name}`,
      storage: createJSONStorage(() => listStorage),
      partialize: (s) => ({ list: s.list, farmId: s.farmId, loadedAt: 0 }) as ResourceStore<T, C>,
    }
  ));

  /**
   * Resolves once the saved list has been loaded. Reading the server before
   * that would be overwritten by the older saved copy when it arrives.
   */
  const hydrated = () =>
    store.persist.hasHydrated()
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          const off = store.persist.onFinishHydration(() => {
            off();
            resolve();
          });
        });

  // Emptied when the user switches farm or signs out.
  onFarmChange.push(() => store.getState().reset());
  // What the server answers to a queued change replaces the local copy…
  registerSink(name, (item: T) => useFarmStore.getState().current?.id === (item as { farmId?: string }).farmId && store.getState().upsert(item));
  // …and after working offline, or discarding a change, the list is read from the server again.
  onStale((now) => {
    store.setState({ loadedAt: 0 } as Partial<ResourceStore<T, C>>);
    if (now && store.getState().farmId) void store.getState().findAll(true).catch(() => null);
  });
  return store;
}
