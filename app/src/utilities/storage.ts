import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StateStorage } from 'zustand/middleware';

const CHUNK = 400_000;
const WAIT_MS = 300;
const pending = new Map<string, string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const write = async (key: string) => {
  const value = pending.get(key);
  pending.delete(key);
  timers.delete(key);
  if (value === undefined) return;
  try {
    const before = Number(await AsyncStorage.getItem(`${key}#n`)) || 0;
    const parts: [string, string][] = [];
    for (let i = 0; i * CHUNK < value.length; i++) parts.push([`${key}#${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK)]);
    await AsyncStorage.multiSet([...parts, [`${key}#n`, String(parts.length)]]);
    if (before > parts.length) await AsyncStorage.multiRemove(Array.from({ length: before - parts.length }, (_, i) => `${key}#${parts.length + i}`));
  } catch {
    // The cache is best effort: a full disk only means reading again online.
  }
};

/**
 * Storage for the lists kept for offline use. A list of a few thousand rows
 * is a string of megabytes, and Android cannot read back a single value over
 * ~2 MB, so each value is split in pieces. Writes are debounced: a list that
 * changes several times in a row is written once.
 *
 * ponytail: AsyncStorage holds about 6 MB in total on Android by default.
 * Move the lists to expo-sqlite when a farm outgrows that.
 */
export const listStorage: StateStorage = {
  getItem: async (key) => {
    try {
      const n = Number(await AsyncStorage.getItem(`${key}#n`)) || 0;
      if (!n) return null;
      const parts = await AsyncStorage.multiGet(Array.from({ length: n }, (_, i) => `${key}#${i}`));
      return parts.map((p) => p[1] ?? '').join('');
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    pending.set(key, value);
    clearTimeout(timers.get(key));
    timers.set(key, setTimeout(() => void write(key), WAIT_MS));
  },
  removeItem: (key) => listStorage.setItem(key, ''),
};
