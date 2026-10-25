/**
 * Midnight Glass motion: 180 to 260ms on one ease-out curve. Every animation reads
 * `useReducedMotion()` and skips the movement (not the state change) when it is on.
 */
import { Easing } from 'react-native';

export { useReducedMotion } from '@/hooks/useReducedMotion';

export const motion = {
  fast: 180,
  base: 220,
  slow: 260,
  /** Bento tiles stagger in this far apart. */
  stagger: 40,
  easing: Easing.bezier(0.2, 0.8, 0.2, 1),
} as const;
