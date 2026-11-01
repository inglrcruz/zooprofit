import { useLoad, useLoading } from '@/hooks/use-load';
import { useFarmStore } from '@/stores/farm.store';
import { useLotStore } from '@/stores/lot.store';
import { useRegistroStore } from '@/stores/registro.store';

/** Lo que leen las pantallas de producción y de aves: la granja, sus lotes y sus registros. */
export function useLotes() {
  const farm = useFarmStore((s) => s.current);
  const rol = useFarmStore((s) => s.rol);
  const lots = useLotStore((s) => s.list);
  const registros = useRegistroStore((s) => s.list);
  const refresh = useLoad(useLotStore, useRegistroStore);
  const loading = useLoading('listLot', 'listRegistro');
  return { farm, rol, lots, registros, refresh, loading, first: loading && !lots.length };
}
