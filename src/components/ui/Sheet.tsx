import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { spacing, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

/**
 * Bottom sheet for forms and option lists, drawn from the app's tokens.
 *
 * Handle, title, a 48dp close control, a scrolling body that keeps taps on inputs working, keyboard avoidance and the
 * bottom safe area. `busy` blocks every way of dismissing it, so a request in flight cannot be orphaned by a Back press
 * or a backdrop tap. Dismissal otherwise calls `onClose`; the caller decides what that means for unsaved input.
 *
 * Dragging the handle or title area down closes it too: past a distance or a quick flick it calls `onClose`, otherwise
 * it springs back. The body keeps scrolling normally, and `busy` makes the drag inert (the sheet snaps back).
 */

/** Drag down this far (dp), or flick this fast (dp/ms), and the sheet closes. */
export const SWIPE_CLOSE_DISTANCE = 100;
export const SWIPE_CLOSE_VELOCITY = 0.8;

export function shouldSwipeClose(dy: number, vy: number): boolean {
  return dy > SWIPE_CLOSE_DISTANCE || (dy > 20 && vy > SWIPE_CLOSE_VELOCITY);
}
export function Sheet({
  visible = true,
  title,
  subtitle,
  onClose,
  busy,
  children,
  footer,
}: {
  visible?: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** A request is running: Back, the backdrop and the close button are all inert. */
  busy?: boolean;
  children: ReactNode;
  /** Pinned under the scrolling body (the primary action), so it is never pushed off screen by the keyboard. */
  footer?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const close = () => {
    if (!busy) onClose();
  };

  const [drag] = useState(() => new Animated.Value(0));
  // The gesture handlers are built once, so they read the current props through this box.
  const latest = useRef({ busy, onClose });
  useEffect(() => {
    latest.current = { busy, onClose };
  }, [busy, onClose]);
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);
  // The responder must keep one gesture state for the whole drag, so it is built once. Its handlers only touch `latest`
  // and `drag` when a touch event fires, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const springBack = () => Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
    return PanResponder.create({
      // Taps stay with the close button; only a mostly vertical downward move takes over.
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => {
        if (!latest.current.busy) drag.setValue(Math.max(0, g.dy));
      },
      onPanResponderRelease: (_e, g) => {
        if (!latest.current.busy && shouldSwipeClose(g.dy, g.vy)) latest.current.onClose();
        else springBack();
      },
      onPanResponderTerminate: springBack,
    });
  });
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <GlassScrim onPress={close} style={StyleSheet.absoluteFill} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: drag }] }]}>
          <GlassSheetHost style={[styles.host, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View {...pan.panHandlers} testID="sheet-drag-zone">
              <View style={styles.handle} />
              <View style={styles.head}>
                <View style={styles.headText}>
                  <Text style={styles.title} accessibilityRole="header" numberOfLines={2}>
                    {title}
                  </Text>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
                <Pressable
                  onPress={close}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  accessibilityState={{ disabled: !!busy }}
                  style={styles.close}
                >
                  <Ionicons name="close" size={22} color={colors.text} />
                </Pressable>
              </View>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </GlassSheetHost>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%' },
  host: { flexShrink: 1 },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginTop: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingTop: spacing.xs },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  subtitle: { color: c.textMuted, fontSize: fontSize.sm },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderSoft },
}));
