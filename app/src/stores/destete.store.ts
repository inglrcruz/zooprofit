import { create } from 'zustand';
import { Lot, Registro } from '@/types/data';
import { errorResponse, getRequest } from '@/utilities/requests';
import { useAuthStore } from './auth.store';
import { onFarmChange } from './farm.store';
import { useGlobalStore } from './global.store';

interface State {
  /** Weaning registros and lots of the linked reproduction farm. */
  destetes: Registro[];
  lots: Lot[];
}

type Actions = {
  findAll: (reproFarmId: string) => Promise<void>;
  reset: () => void;
};

const initialState: State = { destetes: [], lots: [] };
const global = useGlobalStore.getState();

/**
 * What a production farm reads from the reproduction farm it is linked to.
 * It is another farm's data, so it goes through that farm's routes and the
 * API answers only if the user belongs to it too.
 */
export const useDesteteStore = create<State & Actions>()((set) => ({
  ...initialState,

  findAll: async (reproFarmId: string): Promise<void> => {
    try {
      global.setLoading({ listDestete: true });
      const token = useAuthStore.getState().token;
      const [destetes, lots] = await Promise.all([
        getRequest(`farms/${reproFarmId}/registros?tipo=destete&limit=5000`, token),
        getRequest(`farms/${reproFarmId}/lots?limit=5000`, token),
      ]);
      set({ destetes: destetes.data || [], lots: lots.data || [] });
    } catch (error: any) {
      set(initialState);
      errorResponse(error);
      throw error;
    } finally {
      global.setLoading({ listDestete: false });
    }
  },

  reset: () => set(initialState),
}));

onFarmChange.push(() => useDesteteStore.getState().reset());
