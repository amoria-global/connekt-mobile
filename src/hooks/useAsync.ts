import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '@/store/auth';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the async function (e.g. pull-to-refresh). */
  refresh: () => Promise<void>;
  /**
   * Re-fetch without raising `loading` or clearing `error`. For background
   * polling, so a timer tick never drives a pull-to-refresh spinner. A failed
   * tick keeps the last good data and stays quiet.
   */
  refreshQuietly: () => Promise<void>;
};

/**
 * Runs an async function on mount and exposes loading/error/refresh state.
 * The latest `fn` is always used, so inline closures are safe.
 *
 * Only the newest request may write state. A slower, older request that
 * resolves after a newer one (a filter changed twice quickly) is dropped
 * instead of overwriting the newer answer, and nothing is written after unmount.
 */
export function useAsync<T>(fn: () => Promise<T>): AsyncState<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const latest = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (silent: boolean) => {
    const ticket = ++latest.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const next = await fnRef.current();
      if (!mounted.current || ticket !== latest.current) return;
      setData(next);
      if (silent) setError(null);
    } catch (e) {
      if (!mounted.current || ticket !== latest.current) return;
      // A failed background tick keeps the last good data and stays quiet; the
      // next foreground refresh reports the failure.
      if (!silent) setError(isApiError(e) ? e.message : 'Something went wrong. Please try again.');
    } finally {
      // A silent tick that supersedes a foreground request must still end its spinner.
      if (mounted.current && ticket === latest.current) setLoading(false);
    }
  }, []);

  // Wrapped so `onPress={refresh}` can never leak an event object into `silent`.
  const refresh = useCallback(() => run(false), [run]);
  const refreshQuietly = useCallback(() => run(true), [run]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh, refreshQuietly };
}
