/**
 * Generic in-app checkout sheet: method choice, mobile-money number, start,
 * wait, settle. Callers supply how the charge is started (`start`) and how its
 * status is read, so bookings, archive unlocks and gifts share one set of
 * terminal states and one poller.
 *
 * Collects a mobile-money number (or hands a card to the gateway page), starts
 * the charge through the handoff endpoints and waits for it to settle, all
 * without leaving the app. The amount shown is display only; the server
 * derives what is charged (see ./nativeCheckout).
 *
 * Terminal states are explicit. `failed` is the only one that offers another
 * attempt. `unknown` (we stopped waiting) never does: the charge may have
 * landed, so the buyer is told to check their phone and their payments.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { PaymentMethodPicker } from '@/features/payments/PaymentMethodPicker';
import { usePaymentEligibility } from '@/features/payments/usePaymentEligibility';
import { formatPhoneE164, isPlausibleMobile, phoneHintForCountry } from '@/features/payments/formatPhone';
import { getPublicPaymentStatus } from '@/features/photos/api';
import {
  pollStatus,
  type InitiatedHandoff,
  type StatusRead,
} from '@/features/payments/nativeCheckout';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

type Stage = 'form' | 'starting' | 'awaiting' | 'success' | 'failed' | 'unknown';
type Tile = { id: string; name: string; provider: string; isCard: boolean };

export type StartInput = { card: true } | { card: false; phone: string; telecomProvider: string };

export function CheckoutSheet({
  visible,
  onClose,
  onSettled,
  resetKey,
  start,
  readStatus,
  heading = 'Pay now',
  title,
  subtitle,
  amountLabel,
}: {
  visible: boolean;
  onClose: () => void;
  /** Fires once when the payment is confirmed, so the caller can refresh. */
  onSettled?: () => void;
  /** Changes when the sheet is opened for a different payment. */
  resetKey: string;
  /** Starts the charge. Throws { message } if nothing was charged. */
  start: (input: StartInput) => Promise<InitiatedHandoff>;
  /** Defaults to the public xentripay status read. */
  readStatus?: (refid: string) => StatusRead;
  heading?: string;
  title: string;
  subtitle?: string;
  /** Display only. The server decides what is charged. */
  amountLabel?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // Country and methods come from the backend only; nothing defaults to Rwanda.
  const eligibility = usePaymentEligibility(visible);
  const { operators, supportsCard } = eligibility;
  const country = eligibility.country ?? '';
  const [methodId, setMethodId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);

  const cancelPoll = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);

  // Fresh state each time the sheet opens for a payment.
  useEffect(() => {
    if (!visible) return;
    setStage('form');
    setError(null);
    setPhone('');
    settledRef.current = false;
  }, [visible, resetKey]);

  useEffect(() => () => cancelPoll.current?.(), []);

  // The buyer can pick another country; the method list follows it and a method
  // that is no longer offered cannot stay selected.
  const changeCountry = useCallback(
    (iso2: string) => {
      setMethodId(null);
      setPhone('');
      return eligibility.changeCountry(iso2);
    },
    [eligibility.changeCountry],
  );
  const tiles: Tile[] = useMemo(() => {
    const list: Tile[] = operators.map((o) => ({
      id: o.id.toLowerCase(),
      name: o.name,
      provider: o.id,
      isCard: false,
    }));
    if (supportsCard) list.push({ id: 'card', name: 'Credit / Debit Card', provider: 'CARD', isCard: true });
    return list;
  }, [operators, supportsCard]);

  // No silent default: a buyer picks the network themselves, so a charge never
  // goes to a guessed provider (docs/PAYMENTS.md: pass the operator id through).
  const selected = tiles.find((t) => t.id === methodId) ?? null;
  const isCard = selected?.isCard ?? false;
  const canPay = !!selected && stage === 'form' && (isCard || isPlausibleMobile(phone, country));

  const settle = useCallback(() => {
    if (settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [onSettled]);

  const close = () => {
    cancelPoll.current?.();
    onClose();
  };

  const onPay = async () => {
    if (!selected || !canPay) return;
    setError(null);
    setStage('starting');
    try {
      const init = await start(
        selected.isCard
          ? { card: true }
          : { card: false, phone: formatPhoneE164(phone, country), telecomProvider: selected.provider },
      );
      setStage('awaiting');
      const poll = pollStatus(
        readStatus ? readStatus(init.refid) : () => getPublicPaymentStatus(init.refid),
        selected.isCard,
      );
      cancelPoll.current = poll.cancel;
      if (selected.isCard && init.paymentUrl) {
        // The gateway page collects the card. Polling carries on underneath.
        await WebBrowser.openBrowserAsync(init.paymentUrl).catch(() => undefined);
      }
      const outcome = await poll.done;
      if (outcome === 'success') {
        setStage('success');
        settle();
      } else if (outcome === 'failed') {
        setError('The payment was declined or cancelled. You have not been charged.');
        setStage('failed');
      } else {
        setStage('unknown');
      }
    } catch (e) {
      // Nothing was charged if we never got a reference back.
      setError(isApiError(e) ? e.message : 'Could not start the payment. Please try again.');
      setStage('form');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={stage === 'awaiting' ? undefined : close} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.sheetContainer}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.lg) }]}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Text style={styles.title}>{heading}</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.summary}>
              <Text style={styles.summaryEvent} numberOfLines={1}>{title}</Text>
              {subtitle ? <Text style={styles.summarySub}>{subtitle}</Text> : null}
              {amountLabel ? <Text style={styles.summaryAmount}>{amountLabel}</Text> : null}
            </View>

            {stage === 'success' ? (
              <View style={[styles.notice, { backgroundColor: colors.successBg }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.noticeText, { color: colors.success }]}>
                  Payment received. Thank you.
                </Text>
              </View>
            ) : stage === 'unknown' ? (
              <View style={[styles.notice, { backgroundColor: colors.warningBg }]}>
                <Ionicons name="time-outline" size={20} color={colors.warning} />
                <Text style={[styles.noticeText, { color: colors.warning }]}>
                  We could not confirm this payment yet. If you approved it on your phone, it
                  may still go through. Check your payments in a few minutes before trying again.
                </Text>
              </View>
            ) : stage === 'awaiting' ? (
              <View style={styles.waiting}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.waitingText}>
                  {isCard
                    ? 'Complete the card payment in the window that opened, then return here.'
                    : 'Approve the payment prompt on your phone. Do not close this screen.'}
                </Text>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Pay with</Text>
                <PaymentMethodPicker
                  operators={operators}
                  supportsCard={supportsCard}
                  selectedId={selected?.id ?? null}
                  onSelect={setMethodId}
                  country={country}
                  onCountryChange={changeCountry}
                  mobileMoneyState={eligibility.mobileMoney}
                  onRetry={eligibility.retry}
                  disabled={stage === 'starting'}
                />

                {!selected ? null : !isCard ? (
                  <>
                    <Text style={styles.label}>Mobile money number</Text>
                    <TextInput
                      value={phone}
                      onChangeText={(v) => setPhone(v.replace(/[^0-9+ ]/g, ''))}
                      placeholder={phoneHintForCountry(country)}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      editable={stage === 'form' || stage === 'failed'}
                      style={styles.input}
                      accessibilityLabel="Mobile money number"
                    />
                  </>
                ) : (
                  <Text style={styles.note}>You will enter your card details on the secure gateway page.</Text>
                )}

                {error ? (
                  <View style={[styles.notice, { backgroundColor: colors.errorBg }]}>
                    <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                    <Text style={[styles.noticeText, { color: colors.error }]}>{error}</Text>
                  </View>
                ) : null}

                <Button
                  title={stage === 'failed' ? 'Try again' : 'Pay'}
                  onPress={() => {
                    if (stage === 'failed') setStage('form');
                    else void onPay();
                  }}
                  loading={stage === 'starting'}
                  disabled={stage === 'starting' || (stage === 'form' && !canPay)}
                />
              </>
            )}

            {stage === 'success' || stage === 'unknown' ? (
              <Button title="Done" variant="outline" onPress={close} />
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
    maxHeight: '92%',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: spacing.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  body: { paddingBottom: spacing.lg, gap: spacing.md },
  summary: { backgroundColor: c.primary, borderRadius: radii.lg, padding: spacing.lg, gap: 2 },
  summaryEvent: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  summarySub: { color: 'rgba(255,255,255,0.78)', fontSize: fontSize.xs },
  summaryAmount: { marginTop: spacing.sm, color: c.textOnPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  label: { color: c.textSoft, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  input: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
    paddingHorizontal: spacing.md,
    color: c.text,
    fontSize: fontSize.md,
  },
  note: { color: c.textMuted, fontSize: fontSize.xs, lineHeight: 18 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md },
  noticeText: { flex: 1, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, lineHeight: 18 },
  waiting: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  waitingText: { textAlign: 'center', color: c.textSoft, fontSize: fontSize.sm, lineHeight: 20 },
}));
