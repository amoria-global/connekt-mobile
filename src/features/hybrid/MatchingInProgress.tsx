/**
 * What a photographer sees after saying yes to an offer: "Matching in progress..." with three dots that
 * pulse in turn and a radiating ring, so it feels like the client is choosing right now. One host is mounted
 * for the whole app (see `(app)/_layout.tsx`) and every accept path calls `showMatchingInProgress()`, so the
 * wording and the effect are the same on Home, Bookings and the ringing screen.
 */
import React, { useEffect, useSyncExternalStore } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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
  const o = useSharedValue(still ? 1 : 0.25);
  useEffect(() => {
    if (still) {
      o.value = 1;
      return;
    }
    o.value = withDelay(
      index * (DOT_MS / 2),
      withRepeat(
        withSequence(
          withTiming(1, { duration: DOT_MS, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.25, { duration: DOT_MS, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(o);
  }, [index, still, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.7 + o.value * 0.3 }] }));
  return <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }, style]} />;
}

function Pulse({ still }: { still: boolean }) {
  const { colors } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.ease) }), -1);
    return () => cancelAnimation(p);
  }, [still, p]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - p.value), transform: [{ scale: 1 + p.value * 0.9 }] }));
  return (
    <View style={{ width: 72, height: 72, alignItems: 'center', justifyContent: 'center' }}>
      {still ? null : (
        <Animated.View
          style={[{ position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.primary }, ring]}
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
