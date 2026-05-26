import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
}

/**
 * Generic data hook. Calls `fetcher` on mount and whenever `deps` change.
 * Cancels in-flight results from stale fetches so a quick prop change doesn't
 * race a slow request.
 */
export function useApi<T>(fetcher: () => Promise<T>, deps: ReadonlyArray<unknown> = []): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const reqId = useRef(0);

  // We hold the latest fetcher in a ref so deps drive re-fetching, not the
  // closure identity of the caller's fetcher. This avoids needing the
  // react-hooks/exhaustive-deps escape hatch.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const myId = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (myId !== reqId.current) return;
      setData(result);
    } catch (e) {
      if (myId !== reqId.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (myId === reqId.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run };
}
