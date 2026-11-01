import { create } from 'zustand';

interface State {
  visible: boolean;
}

type Actions = {
  show: () => void;
  hide: () => void;
};

/** Whether the side menu is open. It is opened from the tab bar or a screen's header. */
export const useMenu = create<State & Actions>()((set) => ({
  visible: false,
  show: () => set({ visible: true }),
  hide: () => set({ visible: false }),
}));
