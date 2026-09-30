/**
 * In-app checkout sheet for the JWT-gated payments: a booking's outstanding
 * balance and the archive unlock fee.
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
import { detectPaymentCountry, getPaymentOptions, type PaymentOperator } from '@/features/reference/api';
import { formatPhoneE164, isPlausibleMobile, phoneHintForCountry } from '@/features/payments/formatPhone';
import {
  initiateHandoffPayment,
  mintHandoffToken,
  pollHandoff,
  type HandoffRef,
} from '@/features/payments/nativeCheckout';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

type Stage = 'form' | 'starting' | 'awaiting' | 'success' | 'failed' | 'unknown';
type Tile = { id: string; name: string; provider: string; isCard: boolean };

const DEFAULT_OPERATORS: PaymentOperator[] = [
  { id: 'MTN', name: 'MTN Mobile Money', type: 'MOBILE_MONEY' },
  { id: 'AIRTEL', name: 'Airtel Money', type: 'MOBILE_MONEY' },
];

export function HandoffCheckoutSheet({
  visible,
  onClose,
  onSettled,
  handoff,
  title,
  subtitle,
  amountLabel,
}: {
  visible: boolean;
  onClose: () => void;
  /** Fires once when the payment is confirmed, so the caller can refresh. */
  onSettled?: () => void;
  handoff: HandoffRef | null;
  title: string;
  subtitle?: string;
  /** Display only. The server decides what is charged. */
  amountLabel?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [country, setCountry] = useState('RW');
  const [operators, setOperators] = useState<PaymentOperator[]>(DEFAULT_OPERATORS);
  const [supportsCard, setSupportsCard] = useState(true);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState<Stage>('form');
  const [error, setError] = useState<string | null>(null);

  const tokenRef = useRef<string | null>(null);
  const cancelPoll = useRef<(() => void) | null>(null);
  const settledRef = useRef(false);

  // Fresh state each time the sheet opens for a payment.
  useEffect(() => {
    if (!visible) return;
    setStage('form');
    setError(null);
    setPhone('');
    tokenRef.current = null;
    settledRef.current = false;
  }, [visible, handoff?.declarationId, handoff?.eventId]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const detected = (await detectPaymentCountry().catch(() => undefined)) || 'RW';
      if (cancelled) return;
      setCountry(detected);
      const opts = await getPaymentOptions(detected).catch(() => null);
      if (cancelled || !opts) return;
      setSupportsCard(opts.supportsCard);
      if (opts.operators.length > 0) setOperators(opts.operators);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  useEffect(() => () => cancelPoll.current?.(), []);

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

  const selected = tiles.find((t) => t.id === methodId) ?? tiles[0] ?? null;
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
    if (!handoff || !selected || !canPay) return;
    setError(null);
    setStage('starting');
    try {
      // Reuse the token across retries: it stays valid until expiry and the
      // server refuses a second charge once the declaration is settled.
      if (!tokenRef.current) tokenRef.current = await mintHandoffToken(handoff);
      const init = await initiateHandoffPayment(
        tokenRef.current,
        selected.isCard
          ? { card: true }
          : { card: false, phone: formatPhoneE164(phone, country), telecomProvider: selected.provider },
      );
      setStage('awaiting');
      const poll = pollHandoff(init.refid, selected.isCard);
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

  if (!handoff) return null;

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
            <Text style={styles.title}>Pay now</Text>
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
                <View style={styles.tiles}>
                  {tiles.map((t) => {
                    const active = t.id === selected?.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() => setMethodId(t.id)}
                        disabled={stage === 'starting'}
                        style={[styles.tile, active && styles.tileActive]}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                      >
                        <Ionicons
                          name={t.isCard ? 'card-outline' : 'phone-portrait-outline'}
                          size={18}
                          color={active ? colors.primary : colors.textMuted}
                        />
                        <Text style={[styles.tileText, active && { color: colors.primary }]}>{t.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {!isCard ? (
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
  tiles: { gap: spacing.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  tileActive: { borderColor: c.primary, backgroundColor: c.tint },
  tileText: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
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
