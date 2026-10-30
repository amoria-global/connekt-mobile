/**
 * What a photographer sees after saying yes to an offer: "Matching in progress..." with three dots that
 * pulse in turn and a radiating ring, so it feels like the client is choosing right now. One host is mounted
 * for the whole app (see `(app)/_layout.tsx`) and every accept path calls `showMatchingInProgress()`, so the
 * wording and the effect are the same on Home, Bookings and the ringing screen.
 */
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Animated, Easing, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

let visible = false;
const listeners = new Set<() => void>();
const set = (v: boolean) => {
  visible = v;
  listeners.forEach((fn) => fn());
};

/** Opens the dialog; it stays until the photographer taps OK. */
export function showMatchingInProgress(): void {
  set(true);
}

const DOT_MS = 420;

function Dot({ index, still }: { index: number; still: boolean }) {
  const { colors } = useTheme();
  const [o] = useState(() => new Animated.Value(still ? 1 : 0.25));
  useEffect(() => {
    if (still) {
      o.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * (DOT_MS / 2)),
        Animated.timing(o, { toValue: 1, duration: DOT_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.25, duration: DOT_MS, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [index, still, o]);
  const scale = o.interpolate({ inputRange: [0.25, 1], outputRange: [0.8, 1] });
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, opacity: o, transform: [{ scale }] }} />;
}

function Pulse({ still }: { still: boolean }) {
  const { colors } = useTheme();
  const [p] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(Animated.timing(p, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [still, p]);
  const opacity = p.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  const scale = p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] });
  return (
    <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
      {still ? null : (
        <Animated.View
          style={{ position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.primary, opacity, transform: [{ scale }] }}
        />
      )}
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.tint, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="radio-outline" size={28} color={colors.primary} />
      </View>
    </View>
  );
}

export function MatchingInProgressHost() {
  const open = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => visible,
    () => false,
  );
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const close = () => set(false);
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <GlassScrim style={styles.scrim} onPress={close}>
        <GlassSheetHost variant="dialog" style={styles.panel}>
          <Pulse still={reduceMotion} />
          <View
            style={styles.titleRow}
            accessible
            accessibilityRole="header"
            accessibilityLabel="Matching in progress"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.title}>Matching in progress</Text>
            <View style={styles.dots}>
              {[0, 1, 2].map((i) => <Dot key={i} index={i} still={reduceMotion} />)}
            </View>
          </View>
          <Pressable onPress={close} style={styles.ok} accessibilityRole="button" accessibilityLabel="OK">
            <Text style={styles.okText}>OK</Text>
          </Pressable>
        </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  scrim: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.lg },
  panel: { padding: spacing.lg, gap: spacing.md, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  ok: { alignSelf: 'stretch', minHeight: 48, borderRadius: radii.md, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  okText: { color: c.textOnPrimary, fontWeight: fontWeight.extrabold, fontSize: fontSize.sm },
}));
