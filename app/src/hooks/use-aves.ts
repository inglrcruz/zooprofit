import { create } from 'zustand';

import { useLotes } from '@/hooks/use-lotes';
import { onFarmChange } from '@/stores/farm.store';

/** El lote de aves que se está viendo; lo comparten las pestañas del módulo. */
const useAvesLot = create<{ lotId: string; setLot: (id: string) => void }>()((set) => ({ lotId: '', setLot: (lotId) => set({ lotId }) }));
onFarmChange.push(() => useAvesLot.setState({ lotId: '' }));

/** Lotes de aves de la granja y el que está abierto (el primero activo si no se eligió). */
export function useAves() {
  const base = useLotes();
  const { lotId, setLot } = useAvesLot();
  // Un lote "padre" solo agrupa sus sublotes: los registros van en estos.
  const lots = base.lots.filter((l) => !l.archivado && !l.data?.esPadre);
  const lot = lots.find((l) => l.id === lotId) ?? lots[0];
  return { ...base, lots, lot, setLot, regs: lot ? base.registros.filter((r) => r.lotId === lot.id) : [] };
}
