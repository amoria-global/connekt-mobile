import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Auto-hide for non-critical controls. UI-only state.
 *
 *  - `visible` flips to false after `delayMs` without `poke()`.
 *  - Never hides while `hold` is true (sheet open, dialog open, paused…).
 *  - `toggle()` is meant for tapping the camera surface.
 *
 * Opacity is animated by the consumer with the native driver; this hook only
 * decides *when*, so there is no render loop.
 */
export function useControlsAutoHide(hold: boolean, delayMs = 6000) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const arm = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setVisible(false), delayMs);
  }, [delayMs]);

  const poke = useCallback(() => {
    setVisible(true);
    arm();
  }, [arm]);

  const toggle = useCallback(() => {
    setVisible((v) => {
      if (v) {
        clear();
        return false;
      }
      arm();
      return true;
    });
  }, [arm]);

  useEffect(() => {
    if (hold) {
      clear();
      setVisible(true);
    } else {
      arm();
    }
    return clear;
  }, [hold, arm]);

  return { visible, poke, toggle };
}
