import { useCallback } from 'react';

import { useLoad, useLoading } from '@/hooks/use-load';
import { useFarmStore } from '@/stores/farm.store';
import { useLotStore } from '@/stores/lot.store';
import { useRegistroStore } from '@/stores/registro.store';
import { useSowStore } from '@/stores/sow.store';
import { weekBounds } from '@/utilities/miscellaneous';

/** Metas por defecto de reproducción, hasta que el propietario fije las suyas. */
export const METAS = { tasaParto: 85, promNV: 12, mortLact: 5 };

/** Lo que casi toda pantalla de reproducción lee: lotes, cerdas, registros y la configuración. */
export function useRepro() {
  const farm = useFarmStore((s) => s.current);
  const rol = useFarmStore((s) => s.rol);
  const lots = useLotStore((s) => s.list);
  const sows = useSowStore((s) => s.list);
  const registros = useRegistroStore((s) => s.list);
  const refresh = useLoad(useLotStore, useSowStore, useRegistroStore);
  const loading = useLoading('listLot', 'listSow', 'listRegistro');
  const diaInicio = farm?.config?.weekConfig?.diaInicio ?? 1;
  const inicioSemana = useCallback((ymd: string) => weekBounds(ymd, diaInicio).start, [diaInicio]);
  const kpi = farm?.config?.kpiConfig;
  return {
    farm, rol, lots, sows, registros, refresh, loading, diaInicio, inicioSemana,
    // Una meta en 0 es una meta sin fijar: vale la de por defecto.
    metas: { ...METAS, ...Object.fromEntries(Object.entries(kpi?.targets ?? {}).filter(([, v]) => v > 0)) },
    edadDestete: kpi?.edadDestete || 21,
    /** True la primera vez, antes de tener nada que mostrar. */
    first: loading && !lots.length && !registros.length,
  };
}
