import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { dismissToast, useErrorState, type ToastItem } from '@/features/errors/store';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { glassTile } from './GlassCard';

/** Seconds a toast stays before it leaves by itself. */
export const TOAST_MS = 5000;

const ICON = { danger: 'alert-circle-outline', warning: 'warning-outline', info: 'information-circle-outline' } as const;

/**
 * Short, non-blocking problems with an optional Retry. Bottom of the screen on a phone, above the home indicator.
 * One shows at a time; the rest wait in the queue. It leaves after 5 s, on the close button, or on a sideways swipe,
 * and is announced politely to screen readers. With reduced motion it appears without sliding.
 */
export function ToastHost() {
  const { toasts } = useErrorState();
  const current = toasts[0];
  if (!current) return null;
  return <ToastView key={current.id} toast={current} />;
}

function ToastView({ toast }: { toast: ToastItem }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReducedMotion();
  const [slide] = useState(() => new Animated.Value(reduce ? 0 : 24));
  const [fade] = useState(() => new Animated.Value(reduce ? 1 : 0));
  const [drag] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!reduce) {
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_MS);
    return () => clearTimeout(timer);
  }, [fade, reduce, slide, toast.id]);

  const [pan] = useState(() =>
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => drag.setValue(g.dx),
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) > 80) dismissToast(toast.id);
        else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  );

  const tint = toast.tone === 'danger' ? colors.error : toast.tone === 'warning' ? colors.warning : colors.info;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, spacing.md) + spacing.sm }]}>
      <Animated.View
        {...pan.panHandlers}
        style={[styles.toast, glassTile(colors), { borderColor: tint, opacity: fade, transform: [{ translateY: slide }, { translateX: drag }] }]}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
      >
        <Ionicons name={ICON[toast.tone]} size={20} color={tint} importantForAccessibility="no" />
        <Text style={styles.text}>{toast.message}</Text>
        {toast.actionLabel && toast.onAction ? (
          <Pressable
            onPress={() => {
              dismissToast(toast.id);
              toast.onAction?.();
            }}
            accessibilityRole="button"
            style={styles.action}
            hitSlop={8}
          >
            <Text style={styles.actionText}>{toast.actionLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => dismissToast(toast.id)} accessibilityRole="button" accessibilityLabel="Dismiss" style={styles.close} hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center', zIndex: 1000 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: 520,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingLeft: spacing.lg,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 52,
  },
  text: { flex: 1, color: c.text, fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.medium },
  action: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.sm },
  actionText: { color: c.link, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
}));
