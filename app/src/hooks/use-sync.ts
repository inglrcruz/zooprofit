import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { useAuthStore } from '@/stores/auth.store';
import { useOutbox } from '@/stores/outbox.store';

const RETRY_MS = 20_000;

/**
 * Keeps trying to send what was saved without a connection: when the app
 * opens or comes back to the front, when the browser says it is online
 * again, and every 20 s while something is waiting. Mounted once, at the root.
 */
export function useSync() {
  const token = useAuthStore((s) => s.token);
  const waiting = useOutbox((s) => s.queue.some((o) => !o.error) || !s.online);

  useEffect(() => {
    if (!token) return;
    const flush = () => void useOutbox.getState().flush();
    flush();
    const sub = AppState.addEventListener('change', (state) => state === 'active' && flush());
    const timer = waiting ? setInterval(flush, RETRY_MS) : undefined;
    const web = Platform.OS === 'web' && typeof window !== 'undefined';
    if (web) window.addEventListener('online', flush);
    return () => {
      sub.remove();
      clearInterval(timer);
      if (web) window.removeEventListener('online', flush);
    };
  }, [token, waiting]);
}
