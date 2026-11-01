import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorResponse, getRequest, patchRequest, postRequest, removeRequest } from '@/utilities/requests';
import { registerReset, useAuthStore } from './auth.store';
import { useGlobalStore } from './global.store';
import { Farm, FarmConfig, FarmSpecies, FarmType, Invitation, Member, MemberRol, Rol } from '@/types/farm';

interface State {
  list: Farm[];
  /** The farm (módulo) the user is working in. */
  current: Farm | null;
  rol: Rol | null;
  /** Empty means every lot. */
  allowedLotIds: string[];
  members: Member[];
  invitations: Invitation[];
}

type Actions = {
  findAll: () => Promise<Farm[]>;
  select: (farm: Farm) => void;
  refresh: () => Promise<Farm | null>;
  create: (data: { name: string; species: FarmSpecies; type: FarmType }) => Promise<Farm>;
  update: (data: { name?: string; config?: FarmConfig }) => Promise<Farm>;
  delete: (id: string) => Promise<void>;
  findMembers: () => Promise<void>;
  updateMember: (userId: string, data: { rol?: MemberRol; allowedLotIds?: string[] }) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  invite: (data: { nombre: string; rol: MemberRol; lotIds?: string[]; telefono?: string }) => Promise<Invitation>;
  revokeInvitation: (id: string) => Promise<void>;
  resetStore: () => void;
};

const initialState: State = { list: [], current: null, rol: null, allowedLotIds: [], members: [], invitations: [] };
const global = useGlobalStore.getState();
const route = 'farms';
const token = () => useAuthStore.getState().token;

/** Run whenever the current farm changes, so farm-scoped stores drop their data. */
export const onFarmChange: (() => void)[] = [];

export const useFarmStore = create<State & Actions>()(persist((set, get) => ({
  ...initialState,

  /**
   * Lists the farms the user owns or is a member of, with their role.
   */
  findAll: async (): Promise<Farm[]> => {
    try {
      global.setLoading({ listFarm: true });
      const { data } = await getRequest(route, token());
      set({ list: data || [] });
      return data || [];
    } catch (error: any) {
      // Without a connection the farms saved on the device are the answer.
      if (!error?.response && get().list.length) return get().list;
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ listFarm: false });
    }
  },

  /**
   * Enters a farm: everything farm-scoped is emptied and read again for it.
   *
   * @param farm A farm from the list (it carries the user's role)
   */
  select: (farm: Farm) => {
    if (get().current?.id !== farm.id) onFarmChange.forEach((fn) => fn());
    set({ current: farm, rol: farm.rol ?? null, allowedLotIds: [], members: [], invitations: [] });
    void get().refresh();
  },

  /**
   * Reads the current farm again: its config, my role and my allowed lots.
   */
  refresh: async (): Promise<Farm | null> => {
    const id = get().current?.id;
    if (!id) return null;
    try {
      const { data } = await getRequest(`${route}/${id}`, token());
      if (get().current?.id !== id) return null;
      set({ current: data.farm, rol: data.rol, allowedLotIds: data.allowedLotIds || [] });
      return data.farm;
    } catch {
      return null;
    }
  },

  create: async (body): Promise<Farm> => {
    try {
      global.setLoading({ farm: true });
      const { data } = await postRequest(route, body, token());
      set({ list: [...get().list, { ...data, rol: 'admin' }] });
      return data;
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ farm: false });
    }
  },

  /**
   * Renames the current farm or saves part of its config. The API replaces
   * each top-level config key it receives and keeps the rest.
   */
  update: async (body): Promise<Farm> => {
    try {
      global.setLoading({ farm: true });
      const { data } = await patchRequest(`${route}/${get().current?.id}`, body, token());
      set({ current: data, list: get().list.map((f) => (f.id === data.id ? { ...f, ...data } : f)) });
      return data;
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ farm: false });
    }
  },

  delete: async (id: string): Promise<void> => {
    try {
      global.setLoading({ deleteFarm: id });
      await removeRequest(`${route}/${id}`, token());
      set({ list: get().list.filter((f) => f.id !== id) });
      if (get().current?.id === id) {
        onFarmChange.forEach((fn) => fn());
        set({ current: null, rol: null, allowedLotIds: [] });
      }
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ deleteFarm: false });
    }
  },

  /**
   * Reads the members and the invitations of the current farm (owner only).
   */
  findMembers: async (): Promise<void> => {
    try {
      global.setLoading({ listMember: true });
      const base = `${route}/${get().current?.id}`;
      const [members, invitations] = await Promise.all([getRequest(`${base}/members`, token()), getRequest(`${base}/invitations`, token())]);
      set({ members: members.data || [], invitations: invitations.data || [] });
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ listMember: false });
    }
  },

  updateMember: async (userId, body): Promise<void> => {
    try {
      global.setLoading({ member: true });
      const { data } = await patchRequest(`${route}/${get().current?.id}/members/${userId}`, body, token());
      set({ members: get().members.map((m) => (m.userId === userId ? { ...m, ...data } : m)) });
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ member: false });
    }
  },

  removeMember: async (userId: string): Promise<void> => {
    try {
      global.setLoading({ deleteMember: userId });
      await removeRequest(`${route}/${get().current?.id}/members/${userId}`, token());
      set({ members: get().members.filter((m) => m.userId !== userId) });
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ deleteMember: false });
    }
  },

  /**
   * Creates a 6-digit invitation code, valid for 48 hours.
   */
  invite: async (body): Promise<Invitation> => {
    try {
      global.setLoading({ invite: true });
      const { data } = await postRequest(`${route}/${get().current?.id}/invitations`, body, token());
      set({ invitations: [data, ...get().invitations] });
      return data;
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ invite: false });
    }
  },

  revokeInvitation: async (id: string): Promise<void> => {
    try {
      global.setLoading({ deleteInvitation: id });
      await removeRequest(`${route}/${get().current?.id}/invitations/${id}`, token());
      set({ invitations: get().invitations.filter((i) => i.id !== id) });
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ deleteInvitation: false });
    }
  },

  resetStore: () => {
    onFarmChange.forEach((fn) => fn());
    set(initialState);
  },
}),
  {
    name: 'farm-store',
    storage: createJSONStorage(() => AsyncStorage),
    // The farms and which one is open survive a restart, so the app opens offline.
    partialize: (s) => ({ list: s.list, current: s.current, rol: s.rol, allowedLotIds: s.allowedLotIds }),
  }
));

registerReset(() => useFarmStore.getState().resetStore());
