import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { fonts } from '@/theme';
import { S } from './theme';

type ToastMessage = { id: number; text: string };

/** Lightweight snackbar state. One timer, cleaned up on unmount. */
export function useToast(durationMs = 1800) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const counter = useRef(0);

  const show = useCallback(
    (text: string) => {
      counter.current += 1;
      setToast({ id: counter.current, text });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { toast, show };
}

export function Toast({ message, top }: { message: ToastMessage | null; top: number }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }).start();
  }, [message, opacity]);

  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { top, opacity }]}
    >
      <Text style={styles.text}>{message.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: '84%',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.78)',
    zIndex: 50,
  },
  text: { fontFamily: fonts.bold, fontSize: 15, color: S.text, textAlign: 'center' },
});
