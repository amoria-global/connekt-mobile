/**
 * Keeps a wallet balance current without the user asking. Every 10 seconds, while the screen is focused and the
 * app is open, the balance is fetched again, and `syncing` is true while that refresh runs so the screen can show
 * a loading placeholder in place of the amount and then the new figure. Backgrounding the app or leaving the screen
 * pauses it; coming back checks once straight away and carries on. A failed refresh keeps the last balance and stays
 * quiet, so the figure is never replaced by an error mid-glance.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAsync } from '@/hooks/useAsync';
import { useForegroundPolling } from '@/hooks/useForegroundPolling';
import { getWallet } from './api';

export const WALLET_POLL_MS = 10_000;

/** A refresh can finish in a blink; the placeholder stays long enough to be seen. */
export const WALLET_MIN_LOADING_MS = 700;

/** Drives the 10 second refresh for any screen that already loads a wallet; returns whether one is running. */
export function useWalletSync(refreshQuietly: () => Promise<void>, enabled = true): boolean {
  const [syncing, setSyncing] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useForegroundPolling(
    async () => {
      if (alive.current) setSyncing(true);
      const started = Date.now();
      try {
        await refreshQuietly();
      } finally {
        const wait = WALLET_MIN_LOADING_MS - (Date.now() - started);
        if (wait > 0) await new Promise<void>((resolve) => setTimeout(resolve, wait));
        if (alive.current) setSyncing(false);
      }
    },
    WALLET_POLL_MS,
    enabled,
  );

  return syncing;
}

type Refreshable = { refreshQuietly: () => Promise<void> };

/**
 * Refreshes several already-loaded sources together every 10 seconds (a wallet and the analytics beside it, say),
 * and says whether that refresh is running. Whatever shows money from any of them can then show its loading
 * mark and then the new figure, in step.
 */
export function useLiveMoney(sources: Refreshable[], enabled = true): boolean {
  const latest = useRef(sources);
  useEffect(() => {
    latest.current = sources;
  });
  return useWalletSync(
    () => Promise.all(latest.current.map((s) => s.refreshQuietly())).then(() => undefined),
    enabled,
  );
}

const DOT_FRAMES = ['•\u00A0\u00A0', '••\u00A0', '•••'] as const;

/**
 * Three dots that fill in one by one while `active`, for a figure that is being refreshed. Empty when not active.
 * Fixed width, so the figure does not jump when the dots give way to the amount.
 */
export function useLoadingDots(active: boolean, stepMs = 250): string {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setFrame((f) => (f + 1) % DOT_FRAMES.length), stepMs);
    return () => clearInterval(id);
  }, [active, stepMs]);
  return active ? DOT_FRAMES[frame] : '';
}

/** The wallet, loaded once and then refreshed every 10 seconds. */
export function useLiveWallet() {
  const wallet = useAsync(useCallback(() => getWallet(), []));
  const syncing = useWalletSync(wallet.refreshQuietly);
  return { ...wallet, syncing };
}
