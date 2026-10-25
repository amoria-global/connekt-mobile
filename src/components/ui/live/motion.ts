/**
 * Motion helpers for the live-event styling (pulse, ripple, twinkle).
 *
 * Everything animates transform and opacity on the native driver, so a list full of
 * live cards stays smooth. When the person has "reduce motion" switched on, loops do
 * not run and the static look (red fill, white dot, solid border, steady glow) is what they see.
 */
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';
import { liveFill } from '@/theme';

/** Broadcast red (design/live.png), from the theme. The names stay for the call sites. */
export const LIVE_RED = liveFill.mid;
export const LIVE_RED_LIGHT = liveFill.top;
export const LIVE_RED_GLOW = liveFill.glow;

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((v) => alive && setReduced(!!v))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v) => setReduced(!!v));
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
}

/**
 * A looping 0..1 value. `delay` staggers several loops (ripples, sparkles).
 * Returns a value frozen at `rest` while motion is reduced or `active` is false.
 */
export function useLoop(opts: {
  duration: number;
  delay?: number;
  easing?: (v: number) => number;
  /** Go 0 -> 1 -> 0 (breathing) instead of 0 -> 1 then jump back (ripple). */
  yoyo?: boolean;
  active?: boolean;
  rest?: number;
}): Animated.Value {
  const { duration, delay = 0, easing = Easing.out(Easing.quad), yoyo = false, active = true, rest = 0 } = opts;
  const reduced = useReducedMotion();
  const value = useMemo(() => new Animated.Value(rest), [rest]);
  useEffect(() => {
    if (reduced || !active) {
      value.setValue(rest);
      return;
    }
    value.setValue(0);
    const run = yoyo
      ? Animated.sequence([
          Animated.timing(value, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      : Animated.sequence([
          Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]);
    const loop = Animated.loop(delay ? Animated.sequence([Animated.delay(delay), run]) : run);
    loop.start();
    return () => loop.stop();
  }, [value, reduced, active, duration, delay, easing, yoyo, rest]);
  return value;
}
