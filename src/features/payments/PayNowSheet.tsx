/**
 * Pay-Now bottom sheet.
 *
 * Drives the client dashboard's "Pending payments" cards. The app no
 * longer collects payment details (phone numbers, telecom choice,
 * card/momo selection) or polls the gateway — the sheet shows the
 * event + amount due and hands the user off to the connekyt.com web
 * checkout, where the server-fixed balance is charged.
 *
 * The sheet is fully self-contained — pass `payment` + `onClose` +
 * `onSuccess` and the consumer only needs to handle visibility and
 * refresh (`onSuccess` fires when the user returns from the browser so
 * the dashboard can re-fetch).
 */
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { mintHandoffUrl, openWebCheckout } from '@/features/payments/webCheckout';
import { canPayDeclarationHere } from '@/features/payments/policy';
import { type PendingPayment } from '@/features/analytics/api';
import { isApiError } from '@/store/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

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
  const due = payment ? payment.amount - payment.paidAmount : 0;
  const currencyHint = (payment as { currency?: string } | null)?.currency ?? 'USD';

  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (!payment || busy || !canPayDeclarationHere(payment.paymentType)) return;
    setBusy(true);
    try {
      const url = await mintHandoffUrl('BOOKING_DECLARATION', { declarationId: payment.id });
      await openWebCheckout(url);
      // The browser has been dismissed — let the consumer refresh so a
      // completed payment disappears from the pending list.
      onSuccess?.();
    } catch (e) {
      Alert.alert(
        'Could not open checkout',
        isApiError(e) ? e.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!payment) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg) },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Text style={styles.title}>Pay now</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body}>
            <View style={styles.summary}>
              <Text style={styles.summaryEvent} numberOfLines={1}>
                {payment.eventName}
              </Text>
              <Text style={styles.summarySub}>{payment.photographerName}</Text>
              <Text style={styles.summaryAmount}>{formatMoney(due, currencyHint)}</Text>
            </View>

            <View style={styles.webHint}>
              <Ionicons name="globe-outline" size={16} color={colors.info} />
              <Text style={styles.webHintText}>
                You&apos;ll complete this payment securely on connekyt.com. The amount due is
                fixed to your booking balance.
              </Text>
            </View>

            {canPayDeclarationHere(payment.paymentType) ? (
              <>
                <Button
                  title="Complete payment on connekyt.com"
                  onPress={onContinue}
                  loading={busy}
                  disabled={busy}
                />
                <Text style={styles.note}>
                  Payments are processed on the connekyt.com secure checkout.
                </Text>
              </>
            ) : (
              <Text style={styles.note}>
                This charge isn&apos;t settled from here.
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,18,23,0.55)' },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '90%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: spacing.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },

  body: { paddingBottom: spacing.lg, gap: spacing.md },

  summary: { backgroundColor: c.primary, borderRadius: radii.lg, padding: spacing.lg, gap: 2 },
  summaryEvent: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  summarySub: { color: 'rgba(255,255,255,0.78)', fontSize: fontSize.xs },
  summaryAmount: {
    marginTop: spacing.sm,
    color: c.textOnPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
  },

  webHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: c.infoBg,
    borderRadius: radii.md,
  },
  webHintText: { flex: 1, color: c.info, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, lineHeight: 18 },

  note: { textAlign: 'center', color: c.textMuted, fontSize: fontSize.xs },
}));
