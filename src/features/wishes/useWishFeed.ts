/**
 * Loads the public wishes feed for an event, page by page, and the host's moderation queue. Failures leave the last
 * good list in place and set `state` to 'error' only when there is nothing to show.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { hideOwnWish, listHostWishes, listWishes, moderateWish } from './api';
import type { Wish } from './types';

type State = 'loading' | 'error' | 'ready';
const PAGE = 20;

export function useWishFeed(eventId: string) {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [state, setState] = useState<State>('loading');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const live = useRef(true);
  useEffect(() => {
    live.current = true; // set again on mount: a re-mounted effect (React strict mode) must not stay "gone"
    return () => void (live.current = false);
  }, []);

  const load = useCallback(async () => {
    if (!eventId) return;
    setState((s) => (s === 'ready' ? s : 'loading'));
    try {
      const p = await listWishes(eventId, 0, PAGE);
      if (!live.current) return;
      setWishes(p.items);
      setTotal(p.total);
      setPage(p.page);
      setTotalPages(p.totalPages);
      setState('ready');
    } catch {
      if (live.current) setState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [eventId]);

  useEffect(() => {
    // Fetch on mount: the state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    try {
      const p = await listWishes(eventId, page + 1, PAGE);
      if (!live.current) return;
      setWishes((w) => [...w, ...p.items.filter((n) => !w.some((o) => o.id === n.id))]);
      setPage(p.page);
      setTotalPages(p.totalPages);
    } catch {
      /* keep what is shown; the button stays for another try */
    }
  }, [eventId, page]);

  /** Hides the caller's own wish. Removed from the list at once, and put back if the server refuses. */
  const hideOwn = useCallback(
    async (wish: Wish) => {
      const before = wishes;
      setWishes((w) => w.filter((x) => x.id !== wish.id));
      setTotal((t) => Math.max(0, t - 1));
      try {
        await hideOwnWish(eventId, wish.id);
      } catch (e) {
        setWishes(before);
        setTotal((t) => t + 1);
        throw e;
      }
    },
    [eventId, wishes],
  );

  return { wishes, state, total, hasMore: page + 1 < totalPages, reload: load, loadMore, hideOwn };
}

export function useHostWishes(eventId: string) {
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [state, setState] = useState<State>('loading');
  const [busyId, setBusyId] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true; // set again on mount: a re-mounted effect (React strict mode) must not stay "gone"
    return () => void (live.current = false);
  }, []);

  const load = useCallback(async () => {
    if (!eventId) return;
    try {
      const list = await listHostWishes(eventId);
      if (!live.current) return;
      setWishes(list);
      setState('ready');
    } catch {
      if (live.current) setState((s) => (s === 'ready' ? s : 'error'));
    }
  }, [eventId]);

  useEffect(() => {
    // Fetch on mount: the state is set after the await, not synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const decide = useCallback(
    async (wish: Wish, status: 'approved' | 'hidden') => {
      setBusyId(wish.id);
      try {
        const next = await moderateWish(eventId, wish.id, status);
        if (live.current) setWishes((w) => w.map((x) => (x.id === wish.id ? next : x)));
      } finally {
        if (live.current) setBusyId(null);
      }
    },
    [eventId],
  );

  return { wishes, state, busyId, reload: load, approve: (w: Wish) => decide(w, 'approved'), hide: (w: Wish) => decide(w, 'hidden') };
}
