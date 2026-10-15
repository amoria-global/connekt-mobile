import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import type { IconName } from '../types';
import { getReactionVisual } from '../utils';

/** Hard cap on simultaneous floating reactions (low-end Android safety). */
const MAX_FLOATING = 10;
const DURATION_MS = 1800;

export type FloatingReaction = {
  id: number;
  icon: IconName;
  color: string;
  /** 0..1 horizontal drift position */
  lane: number;
  anim: Animated.Value;
};

/** Lightweight floating reactions: native-driver one-shot timings, capped. */
export function useFloatingReactions(reducedMotion: boolean) {
  const [items, setItems] = useState<FloatingReaction[]>([]);
  const seq = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const burst = useCallback(
    (key: string) => {
      if (reducedMotion) return;
      const { icon, color } = getReactionVisual(key);
      const anim = new Animated.Value(0);
      const id = ++seq.current;
      setItems((prev) => [...prev.slice(-(MAX_FLOATING - 1)), { id, icon, color, lane: Math.random(), anim }]);
      Animated.timing(anim, {
        toValue: 1,
        duration: DURATION_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(() => {
        if (mounted.current) setItems((prev) => prev.filter((x) => x.id !== id));
      });
    },
    [reducedMotion],
  );

  return { items, burst };
}
