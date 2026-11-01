import { create } from 'zustand';
import { useGlobalStore } from './global.store';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { router } from 'expo-router';
import { postRequest, patchRequest, errorResponse, getRequest, isSessionExpired } from '@/utilities/requests';
import { InvitationPreview, Join, SignIn, SignUp, User } from '@/types/user';

interface State {
  token: string;
  user: User | null;
  /** Who signed in last on this device; kept after sign-out to offer it again. */
  lastAccount: { name: string; identifier: string } | null;
}

type Actions = {
  resetStore: () => void;
  forgetAccount: () => void;
  signIn: (frm: SignIn) => Promise<User>;
  signUp: (frm: SignUp) => Promise<User>;
  previewInvitation: (code: string) => Promise<InvitationPreview>;
  join: (frm: Join) => Promise<User>;
  acceptInvitation: (code: string) => Promise<void>;
  fetchMe: () => Promise<User | null>;
  updateProfile: (data: { name?: string; pushToken?: string }) => Promise<User>;
  changePassword: (current: string, password: string) => Promise<void>;
};

const initialState: State = {
  token: '',
  user: null,
  lastAccount: null,
};

const global = useGlobalStore.getState();
const route = 'auth';

/** Callbacks run on sign-out, so stores holding a user's data can drop it. */
const onSignOut: (() => void)[] = [];
export const registerReset = (fn: () => void) => void onSignOut.push(fn);

export const useAuthStore = create<State & Actions>()(persist((set, get) => ({

  ...initialState,

  /**
   * Authenticates a user with an e-mail or phone and a password,
   * and stores the access token and the user.
   *
   * @param frm User sign-in form data
   */
  signIn: async (frm: SignIn): Promise<User> => {
    try {
      global.setLoading({ signIn: true });
      const { data } = await postRequest(`${route}/login`, frm);
      set({ token: data.token, user: data.user, lastAccount: { name: data.user.name, identifier: frm.identifier } });
      return data.user;
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ signIn: false });
    }
  },

  /**
   * Creates an account and signs it in.
   *
   * @param frm Registration form data
   */
  signUp: async (frm: SignUp): Promise<User> => {
    try {
      global.setLoading({ signUp: true });
      const { data } = await postRequest(`${route}/register`, frm);
      set({ token: data.token, user: data.user, lastAccount: { name: data.user.name, identifier: data.user.phone ?? data.user.email ?? '' } });
      return data.user;
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ signUp: false });
    }
  },

  /**
   * Tells which farm and role an invitation code is for.
   *
   * @param code 6-digit invitation code
   */
  previewInvitation: async (code: string): Promise<InvitationPreview> => {
    try {
      global.setLoading({ invitation: true });
      const { data } = await getRequest(`${route}/invitations/${encodeURIComponent(code)}`);
      return data;
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ invitation: false });
    }
  },

  /**
   * Creates the account of an invited worker, already inside the farm,
   * and signs it in.
   *
   * @param frm Code, password and optional phone
   */
  join: async (frm: Join): Promise<User> => {
    try {
      global.setLoading({ join: true });
      const { data } = await postRequest(`${route}/join`, frm);
      set({ token: data.token, user: data.user, lastAccount: { name: data.user.name, identifier: data.user.phone ?? data.user.email ?? '' } });
      return data.user;
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ join: false });
    }
  },

  /**
   * Attaches the signed-in account to the farm of an invitation code.
   *
   * @param code 6-digit invitation code
   */
  acceptInvitation: async (code: string): Promise<void> => {
    try {
      global.setLoading({ invitation: true });
      await postRequest(`invitations/${encodeURIComponent(code)}/accept`, {}, get().token);
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ invitation: false });
    }
  },

  /**
   * Retrieves the authenticated user's profile information.
   *
   * @returns The authenticated user or null if unavailable
   */
  fetchMe: async (): Promise<User | null> => {
    try {
      const { data } = await getRequest('me', get().token);
      set({ user: data });
      return data;
    } catch {
      return null;
    }
  },

  /**
   * Updates the authenticated user's profile information.
   *
   * @param body Profile update payload
   * @returns Updated user data
   */
  updateProfile: async (body): Promise<User> => {
    try {
      global.setLoading({ profileUpdate: true });
      const { data } = await patchRequest('me', body, get().token);
      set({ user: data });
      return data;
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ profileUpdate: false });
    }
  },

  /**
   * Changes the user's 4-digit PIN. The API checks the current one.
   *
   * @param current Current PIN
   * @param password New PIN
   */
  changePassword: async (current: string, password: string): Promise<void> => {
    try {
      global.setLoading({ changePassword: true });
      await patchRequest('me/password', { current, password }, get().token);
    } catch (error: any) {
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ changePassword: false });
    }
  },

  /**
   * Forgets the remembered account, to sign in as someone else.
   */
  forgetAccount: () => set({ lastAccount: null }),

  /**
   * Signs out: resets this store and every store holding the user's data.
   */
  resetStore: () => {
    delete axios.defaults.headers.common['Authorization'];
    onSignOut.forEach((fn) => fn());
    set({ ...initialState, lastAccount: get().lastAccount });
  },

}),
  {
    name: 'auth-store',
    storage: createJSONStorage(() => AsyncStorage)
  }
)
);

/**
 * Global interceptor: when the API reports the session as invalid,
 * clear it and send the user back to sign-in.
 */
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (isSessionExpired(error) && useAuthStore.getState().token) {
      useAuthStore.getState().resetStore();
      useGlobalStore.getState().showAlert({
        title: 'Sesión expirada',
        message: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
        type: 'error',
      });
      router.replace('/' as any);
    }
    return Promise.reject(error);
  }
);
