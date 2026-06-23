/**
 * Pay-Now bottom sheet (web parity: salo-run UnlockModal / PayNowModal).
 *
 * Drives the client dashboard's "Pending payments" cards. Given a
 * `PendingPayment` it:
 *   1. Lets the user pick a method (Mobile Money / Card) — the card
 *      tile dims when the detected country doesn't support cards.
 *   2. For mobile money, picks an operator from the country's
 *      `/public/payments/options` list and collects a phone number.
 *   3. POSTs to /payments/xentripay/initiate with the declarationId.
 *   4. Opens the gateway URL in expo-web-browser when card returns a
 *      paymentUrl.
 *   5. Polls /payments/xentripay/status/{refid} (auth) until SUCCESS
 *      or FAILED, with a card grace window matching the web.
 *
 * The sheet is fully self-contained — pass `payment` + `onClose` +
 * `onSuccess` and the consumer (the dashboard, plus future
 * `/payments` list rows) only needs to handle visibility and refresh.
 */
import { useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  detectPaymentCountry,
  getPaymentOptions,
  listCurrencies,
  type PaymentOperator,
} from '@/features/reference/api';
import {
  initiateBookingPayment,
  pollBookingPaymentStatus,
  type PaymentStatus,
} from '@/features/payments/api';
import { type PendingPayment } from '@/features/analytics/api';
import { isApiError } from '@/store/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

type Method = 'MOBILE_MONEY' | 'CARD';
type Stage = 'form' | 'awaiting' | 'success' | 'failed';

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
  const insets = useSafeAreaInsets();
  const due = payment ? payment.amount - payment.paidAmount : 0;
  const currencyHint = (payment as { currency?: string } | null)?.currency ?? 'USD';

  // Country + operators
  const [country, setCountry] = useState('RW');
  const [supportsCard, setSupportsCard] = useState(true);
  const [operators, setOperators] = useState<PaymentOperator[]>([
    { id: 'MTN', name: 'MTN Mobile Money', type: 'MOBILE_MONEY' },
    { id: 'AIRTEL', name: 'Airtel Money', type: 'MOBILE_MONEY' },
  ]);

  // Selection
  const [method, setMethod] = useState<Method>('MOBILE_MONEY');
  const [operatorId, setOperatorId] = useState('MTN');
  const [phone, setPhone] = useState('');
  const [currencyId, setCurrencyId] = useState<string>('');

  // Flow state
  const [stage, setStage] = useState<Stage>('form');
  const [statusNote, setStatusNote] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset every time the modal opens for a fresh payment.
  useEffect(() => {
    if (!visible) return;
    setStage('form');
    setStatusNote('');
    setPhone('');
    setMethod('MOBILE_MONEY');
  }, [visible]);

  // Load the country's payment options + currency id once the sheet
  // opens. Defaults survive if either call fails — the form still
  // works with MTN / Airtel.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const c = (await detectPaymentCountry().catch(() => undefined)) || 'RW';
      if (cancelled) return;
      setCountry(c);
      const opts = await getPaymentOptions(c).catch(() => null);
      if (!cancelled && opts) {
        setSupportsCard(opts.supportsCard);
        if (opts.operators.length > 0) {
          setOperators(opts.operators);
          setOperatorId(opts.operators[0].id);
        }
      }
      const currencies = await listCurrencies().catch(() => []);
      if (cancelled) return;
      const match = currencies.find((cc) => cc.code.toUpperCase() === currencyHint.toUpperCase());
      if (match) setCurrencyId(match.id);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, currencyHint]);

  const phoneOk = method === 'CARD' ? true : /^\d{9,12}$/.test(phone.trim());
  const formOk = !!payment && phoneOk;

  const onPay = useMemo(
    () => async () => {
      if (!payment || !formOk) return;
      setBusy(true);
      setStage('awaiting');
      setStatusNote(
        method === 'CARD' ? 'Opening payment page…' : 'Sending payment prompt to your phone…',
      );
      try {
        const result = await initiateBookingPayment({
          declarationId: payment.id,
          phone: phone.trim() || undefined,
          telecomProvider: method === 'MOBILE_MONEY' ? operatorId : undefined,
          paymentMethod: method,
          currencyId: currencyId || undefined,
          country,
        });

        if (!result.refId) {
          setStage('failed');
          setStatusNote('Could not start the payment. Please try again.');
          return;
        }

        if (result.redirectUrl) {
          await WebBrowser.openBrowserAsync(result.redirectUrl);
        }

        setStatusNote('Confirming with the payment gateway…');
        const settled: PaymentStatus = await pollBookingPaymentStatus(result.refId, {
          graceMs: method === 'CARD' ? 25_000 : 0,
          maxAttempts: 60,
          intervalMs: 2500,
        });

        if (settled === 'success') {
          setStage('success');
          setStatusNote('Payment received. Your booking is updated.');
          onSuccess?.();
          setTimeout(onClose, 1200);
          return;
        }
        if (settled === 'failed') {
          setStage('failed');
          setStatusNote(
            'The payment was not completed. If you were charged you will be refunded automatically.',
          );
          return;
        }
        // pending — bow out
        setStage('failed');
        setStatusNote('The payment is still pending. We will email you when it confirms.');
      } catch (e) {
        setStage('failed');
        setStatusNote(isApiError(e) ? e.message : 'Something went wrong. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [payment, formOk, phone, method, operatorId, currencyId, country, onClose, onSuccess],
  );

  if (!payment) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={styles.sheetContainer}
      >
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

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
          >
            <View style={styles.summary}>
              <Text style={styles.summaryEvent} numberOfLines={1}>
                {payment.eventName}
              </Text>
              <Text style={styles.summarySub}>{payment.photographerName}</Text>
              <Text style={styles.summaryAmount}>{formatMoney(due, currencyHint)}</Text>
            </View>

            <Text style={styles.section}>Pay with</Text>
            <View style={styles.methods}>
              <MethodTile
                active={method === 'MOBILE_MONEY'}
                label="Mobile Money"
                icon="phone-portrait"
                onPress={() => setMethod('MOBILE_MONEY')}
              />
              <MethodTile
                active={method === 'CARD'}
                disabled={!supportsCard}
                label="Card"
                icon="card-outline"
                onPress={() => setMethod('CARD')}
              />
            </View>

            {method === 'MOBILE_MONEY' ? (
              <View style={{ gap: spacing.sm }}>
                <View style={styles.operators}>
                  {operators.map((o) => {
                    const active = o.id === operatorId;
                    return (
                      <Pressable
                        key={o.id}
                        style={[styles.operator, active && styles.operatorActive]}
                        onPress={() => setOperatorId(o.id)}
                      >
                        <Ionicons
                          name="phone-portrait-outline"
                          size={14}
                          color={active ? colors.primary : colors.textMuted}
                        />
                        <Text style={[styles.operatorText, active && styles.operatorTextActive]}>
                          {o.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Input
                  label="Phone"
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
                  placeholder="788000000"
                  keyboardType="phone-pad"
                />
              </View>
            ) : (
              <View style={styles.cardHint}>
                <Ionicons name="information-circle" size={14} color={colors.info} />
                <Text style={styles.cardHintText}>
                  Your card details are collected by the payment gateway on a secure page.
                </Text>
              </View>
            )}

            {stage !== 'form' ? (
              <View
                style={[
                  styles.statusBox,
                  stage === 'success' && styles.statusOk,
                  stage === 'failed' && styles.statusErr,
                ]}
              >
                {stage === 'awaiting' ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Ionicons
                    name={stage === 'success' ? 'checkmark-circle' : 'alert-circle'}
                    size={22}
                    color={stage === 'success' ? colors.success : colors.error}
                  />
                )}
                <Text style={styles.statusText}>{statusNote}</Text>
              </View>
            ) : null}

            <Button
              title={
                stage === 'awaiting'
                  ? 'Processing…'
                  : stage === 'failed'
                    ? 'Try again'
                    : `Pay ${formatMoney(due, currencyHint)}`
              }
              onPress={onPay}
              loading={busy}
              disabled={!formOk || busy || stage === 'success'}
            />
            <Text style={styles.note}>
              Payments are processed by XentriPay. We never see your full card details.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MethodTile({
  active,
  disabled,
  label,
  icon,
  onPress,
}: {
  active: boolean;
  disabled?: boolean;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.method, active && styles.methodActive, disabled && styles.methodDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={22} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,18,23,0.55)' },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },

  body: { paddingBottom: spacing.lg, gap: spacing.md },

  summary: { backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.lg, gap: 2 },
  summaryEvent: { color: colors.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  summarySub: { color: 'rgba(255,255,255,0.78)', fontSize: fontSize.xs },
  summaryAmount: {
    marginTop: spacing.sm,
    color: colors.textOnPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
  },

  section: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textSoft },

  methods: { flexDirection: 'row', gap: spacing.md },
  method: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  methodDisabled: { opacity: 0.4 },
  methodLabel: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  methodLabelActive: { color: colors.primary },

  operators: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  operator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  operatorActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  operatorText: { color: colors.textSoft, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  operatorTextActive: { color: colors.primary, fontWeight: fontWeight.bold },

  cardHint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.infoBg,
    borderRadius: radii.md,
  },
  cardHintText: { flex: 1, color: colors.info, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, lineHeight: 18 },

  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
  },
  statusOk: { backgroundColor: colors.successBg },
  statusErr: { backgroundColor: colors.errorBg },
  statusText: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  note: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs },
});
