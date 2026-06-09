import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '@/store/auth';

type AsyncState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-run the async function (e.g. pull-to-refresh). */
  refresh: () => Promise<void>;
};

/**
 * Runs an async function on mount and exposes loading/error/refresh state.
 * The latest `fn` is always used, so inline closures are safe.
 */
export function useAsync<T>(fn: () => Promise<T>): AsyncState<T> {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Something went wrong. Pull to retry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, refresh: run };
}
