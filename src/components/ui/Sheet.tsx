import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

/**
 * Bottom sheet for forms and option lists, drawn from the app's tokens.
 *
 * Handle, title, a 48dp close control, a scrolling body that keeps taps on inputs working, keyboard avoidance and the
 * bottom safe area. `busy` blocks every way of dismissing it, so a request in flight cannot be orphaned by a Back press
 * or a backdrop tap. Dismissal otherwise calls `onClose`; the caller decides what that means for unsaved input.
 */
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]} accessibilityViewIsModal>
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
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            {children}
          </ScrollView>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const), backgroundColor: c.scrim },
  sheet: {
    maxHeight: '92%',
    backgroundColor: c.elevated,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.border,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginTop: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.lg, paddingRight: spacing.sm, paddingTop: spacing.xs },
  headText: { flex: 1, minWidth: 0, gap: 2 },
  title: { color: c.text, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  subtitle: { color: c.textMuted, fontSize: fontSize.sm },
  close: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  body: { gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderSoft },
}));
