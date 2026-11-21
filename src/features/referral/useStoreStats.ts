/**
 * The store stats strip on the Milestones screen, from endpoints the app already calls: the wallet (available payout,
 * its currency) and the wallet movements (this month's photo sale credits and how many sales they were). The top-selling
 * album has no endpoint yet, so it stays null and the tile is not drawn.
 */
import { useEffect, useState } from 'react';
import { getWallet, listWalletMovementsPage, type Movement } from '@/features/wallet/api';

export interface StoreStats {
  currency: string | null;
  available: number | null;
  monthEarnings: number | null;
  photosSold: number | null;
  topAlbum: string | null;
}

const EMPTY: StoreStats = { currency: null, available: null, monthEarnings: null, photosSold: null, topAlbum: null };

/** This month's photo sale credits: total and count. Movements are newest first; older months are ignored. */
export function monthPhotoSales(movements: Movement[], now = new Date()): { total: number; count: number } {
  let total = 0;
  let count = 0;
  for (const mv of movements) {
    if (mv.direction !== 'in' || mv.category !== 'PHOTO_PURCHASE' || !mv.createdAt) continue;
    const d = new Date(mv.createdAt);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      total += mv.amount;
      count += 1;
    }
  }
  return { total, count };
}

export function useStoreStats(enabled = true): StoreStats & { loading: boolean } {
  const [state, setState] = useState<StoreStats>(EMPTY);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    Promise.allSettled([getWallet(), listWalletMovementsPage(0, 100)]).then(([w, mv]) => {
      if (!alive) return;
      const wallet = w.status === 'fulfilled' ? w.value : null;
      const sales = mv.status === 'fulfilled' ? monthPhotoSales(mv.value.items) : null;
      setState({
        currency: wallet?.currency ?? null,
        available: wallet ? wallet.balanceAvailable : null,
        monthEarnings: sales ? sales.total : null,
        photosSold: sales ? sales.count : null,
        topAlbum: null,
      });
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { ...state, loading };
}
