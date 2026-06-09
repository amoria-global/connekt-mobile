import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Tracks the OS "Reduce Motion" accessibility setting so screens can skip or
 * soften non-essential animation (WCAG prefers-reduced-motion equivalent).
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
