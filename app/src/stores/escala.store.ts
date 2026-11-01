import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MIN = 0.7;
const MAX = 1.3;
const PASO = 0.1;

type State = { escala: number; cambiar: (pasos: number) => void };

/** Tamaño de los botones elegido en este teléfono; sobrevive a cerrar sesión. */
export const useEscala = create<State>()(persist((set, get) => ({
  escala: 1,
  cambiar: (pasos) => set({ escala: Math.round(Math.min(MAX, Math.max(MIN, get().escala + pasos * PASO)) * 10) / 10 }),
}), {
  name: 'escala-botones',
  storage: createJSONStorage(() => AsyncStorage),
  partialize: (s) => ({ escala: s.escala }) as State,
}));

export const ESCALA_LIMITES = { MIN, MAX };

/** Convierte una medida de botón a la escala elegida. */
export const useEsc = () => {
  const escala = useEscala((s) => s.escala);
  return (px: number) => Math.round(px * escala);
};
