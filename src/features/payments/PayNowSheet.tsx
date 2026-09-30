/**
 * Pay-Now bottom sheet.
 *
 * Drives the "Pending payments" cards and the Payments screen. It shows the
 * event and the amount due, then completes the payment inside the app through
 * HandoffCheckoutSheet. The amount is fixed by the server to the booking
 * balance; nothing is sent from here.
 *
 * Only declarations the handoff accepts get a pay action (see
 * canPayDeclarationHere). Anything else is view-only.
 */
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type PendingPayment } from '@/features/analytics/api';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import { canPayDeclarationHere } from '@/features/payments/policy';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';

export function PayNowSheet({
  payment,
  visible,
  onClose,
  onSuccess,
}: {
  payment: PendingPayment | null;
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!payment) return null;

  const due = payment.amount - payment.paidAmount;
  const currencyHint = (payment as { currency?: string } | null)?.currency ?? 'USD';

  if (canPayDeclarationHere(payment.paymentType)) {
    return (
      <HandoffCheckoutSheet
        visible={visible}
        onClose={onClose}
        onSettled={onSuccess}
        handoff={{ type: 'BOOKING_DECLARATION', declarationId: payment.id }}
        title={payment.eventName}
        subtitle={payment.photographerName}
        amountLabel={formatPrice(due, currencyHint)}
      />
    );
  }

  // Not something the signed-in user owes: explain instead of offering a dead button.
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg) }]}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Text style={styles.title}>{payment.eventName}</Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <Text style={styles.note}>
            This is a purchase a viewer started and has not completed. There is nothing for you to
            pay.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15,18,23,0.55)' },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  note: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
}));
