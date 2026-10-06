import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

const AUTO_HIDE_MS = 3500;

/**
 * Tap-to-reveal controls: visible on demand, auto-fade after inactivity,
 * and pinned visible while `pinned` (e.g. connecting / error states).
 */
export function useViewerChrome(pinned: boolean, reducedMotion: boolean) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [opacity] = useState(() => new Animated.Value(1));

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const scheduleHide = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }, [clear]);

  const show = useCallback(() => {
    setVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  const hide = useCallback(() => {
    clear();
    setVisible(false);
  }, [clear]);

  const toggle = useCallback(() => {
    setVisible((v) => {
      if (v) {
        clear();
        return false;
      }
      scheduleHide();
      return true;
    });
  }, [clear, scheduleHide]);

  const shown = pinned || visible;

  useEffect(() => {
    if (pinned) clear();
    else if (visible) scheduleHide();
    return clear;
  }, [pinned, visible, scheduleHide, clear]);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: shown ? 1 : 0,
      duration: reducedMotion ? 0 : 180,
      useNativeDriver: true,
    }).start();
  }, [shown, opacity, reducedMotion]);

  return { visible: shown, opacity, show, hide, toggle };
}
