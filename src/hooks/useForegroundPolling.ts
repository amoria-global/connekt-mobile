import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useFocusEffect } from 'expo-router';

/**
 * Calls `tick` every `intervalMs` while the screen is focused AND the app is in
 * the foreground. Leaving the screen or backgrounding the app stops the timer;
 * coming back fires one catch-up tick (not on the very first focus, where the
 * screen's own load has just run) and restarts it.
 *
 * Ticks never overlap: a tick that is still running makes the next one wait, so
 * a slow network cannot stack requests up.
 */
export function useForegroundPolling(tick: () => Promise<unknown> | void, intervalMs: number, enabled = true) {
  const tickRef = useRef(tick);
  useEffect(() => {
    tickRef.current = tick;
  });
  const seenFocus = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let timer: ReturnType<typeof setInterval> | null = null;
      let inFlight = false;

      const run = () => {
        if (inFlight) return;
        let result: Promise<unknown> | void;
        try {
          result = tickRef.current();
        } catch {
          return; // Polling is best effort; the caller decides what a failed tick means.
        }
        if (result && typeof result.then === 'function') {
          inFlight = true;
          const done = () => {
            inFlight = false;
          };
          result.then(done, done);
        }
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };
      const start = () => {
        stop();
        timer = setInterval(run, intervalMs);
      };

      if (seenFocus.current) run();
      seenFocus.current = true;
      if (AppState.currentState === 'active') start();

      const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
        if (state === 'active') {
          run();
          start();
        } else {
          stop();
        }
      });
      return () => {
        stop();
        sub.remove();
      };
    }, [enabled, intervalMs]),
  );
}

/**
 * Keeps the previous value when a poll returns the same data, so a background refresh
 * that found nothing new does not re-render the screen: `setX((prev) => keepIfSame(prev, next))`.
 */
export function keepIfSame<T>(prev: T, next: T): T {
  try {
    return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
  } catch {
    return next;
  }
}
