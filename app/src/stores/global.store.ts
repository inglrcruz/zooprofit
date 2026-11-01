import { create } from 'zustand'
import type { IconName } from '@/components/icon'

type AlertType = 'info' | 'success' | 'error'

interface State {
  loading: Record<string, any>
  alert: {
    visible: boolean
    title: string
    message: string
    type?: AlertType
  }
  confirm: {
    visible: boolean
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    destructive?: boolean
    icon?: IconName
    onConfirm?: () => void
  }
}

type Actions = {
  setLoading: (load: Record<string, any>) => void
  showAlert: (data: Omit<State['alert'], 'visible'>) => void
  hideAlert: () => void
  showConfirm: (data: Omit<State['confirm'], 'visible'>) => void
  hideConfirm: () => void
}

const initialState: State = {
  loading: {},
  alert: {
    visible: false,
    title: '',
    message: '',
    type: 'info'
  },
  confirm: {
    visible: false,
    title: '',
    message: ''
  }
}

export const useGlobalStore = create<State & Actions>((set) => ({

  ...initialState,

  /**
  * Updates the global loading state by merging
  * the new loading values with the current state.
  * 
  * @param load Loading state values to update.
  * @returns Updated loading state.
  */
  setLoading: (load) => set((state) => ({ loading: { ...state.loading, ...load } })),

  /**
   * Displays a global alert dialog.
   * 
   * @param data Alert configuration data.
   * @returns Updated alert state.
   */
  showAlert: (data) => set({ alert: { ...data, visible: true } }),

  /**
   * Hides the global alert dialog.
   * 
   * @returns Updated alert state.
   */
  hideAlert: () => set((state) => ({ alert: { ...state.alert, visible: false } })),

  /**
   * Displays a global confirmation dialog.
   * 
   * @param data Confirmation dialog configuration.
   * @returns Updated confirmation state.
   */
  showConfirm: (data) => set({ confirm: { ...data, visible: true } }),

  /**
   * Hides the global confirmation dialog.
   * 
   * @returns Updated confirmation state.
   */
  hideConfirm: () => set((state) => ({ confirm: { ...state.confirm, visible: false } }))

}))