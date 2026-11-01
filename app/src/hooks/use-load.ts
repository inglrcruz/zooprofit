import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { useFarmStore } from '@/stores/farm.store';
import { useGlobalStore } from '@/stores/global.store';

type Loader = { getState: () => { findAll: (force?: boolean) => Promise<unknown> } };

/**
 * Reads the lists a screen needs every time it gains focus, and returns
 * `refresh` to read them again on demand (pull to refresh, "sincronizar").
 * The stores show their own error alert, so a failed read is not re-thrown.
 *
 * @param stores Resource stores the screen reads from
 */
export function useLoad(...stores: Loader[]) {
  const farmId = useFarmStore((s) => s.current?.id);
  const load = useCallback(
    (force = false) => Promise.all(stores.map((s) => s.getState().findAll(force).catch(() => null))),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the stores are module constants
    [farmId],
  );
  useFocusEffect(useCallback(() => void load(), [load]));
  return useCallback(() => void load(true), [load]);
}

/** True while any of the given loading flags of the global store is raised. */
export const useLoading = (...keys: string[]) => useGlobalStore((s) => keys.some((k) => !!s.loading[k]));
