import { useCallback, useRef, useState } from 'react';
import { isApiError } from '@/store/auth';
import { listWalletMovementsPage, type Movement, type MovementPage } from './api';

const PAGE = 50;

type Extra = { base: MovementPage | null; items: Movement[]; nextPage: number; hasMore: boolean };

/**
 * Appends older ledger pages to the first page a screen already loaded. The first
 * page stays owned by the screen (so pull-to-refresh keeps working); a new first
 * page discards anything appended earlier, because it may have shifted.
 */
export function useMovementPages(first: MovementPage | null | undefined) {
  const [extra, setExtra] = useState<Extra | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const busy = useRef(false);

  const base = first ?? null;
  // Appended pages belong to one first page; a refreshed first page starts over.
  const cur: Extra | null = extra && extra.base === base ? extra : null;
  const items = base ? [...base.items, ...(cur?.items ?? [])] : [];
  const hasMore = base ? (cur ? cur.hasMore : base.hasMore) : false;
  const nextPage = cur ? cur.nextPage : 1;

  const loadMore = useCallback(async () => {
    if (!base || busy.current || !hasMore) return;
    busy.current = true;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await listWalletMovementsPage(nextPage, PAGE);
      const seen = new Set([...base.items, ...(cur?.items ?? [])].map((m) => m.id));
      const fresh = page.items.filter((m) => !seen.has(m.id));
      setExtra({
        base,
        items: [...(cur?.items ?? []), ...fresh],
        nextPage: nextPage + 1,
        // A page of only repeats means the ledger shifted under us; stop rather than loop.
        hasMore: page.hasMore && fresh.length > 0,
      });
    } catch (e) {
      setMoreError(isApiError(e) ? e.message : 'Could not load older transactions.');
    } finally {
      busy.current = false;
      setLoadingMore(false);
    }
  }, [base, cur, hasMore, nextPage]);

  return { items, hasMore, loadingMore, moreError, loadMore };
}
