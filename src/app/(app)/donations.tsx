/**
 * Donations screen.
 *
 * Mirrors the web client donate page (salo-run pages/donate.tsx):
 * collect an amount + optional message, pick a payment method (Mobile
 * Money / Card), then run the proper two-step authenticated donation
 * flow:
 *
 *   1. POST /donations?amount=&currencyId=&message=&paymentMethod=
 *      → returns the donationId.
 *   2. POST /payments/xentripay/initiate-donation
 *      { donationId, paymentMethod, phone?, telecomProvider?, country }
 *      → returns refid + paymentUrl (for card).
 *   3. Open paymentUrl in expo-web-browser when the user picked card.
 *   4. Poll /payments/xentripay/status/{refid} (auth) until
 *      SUCCESS / FAILED, with a card grace window matching the web.
 *
 * The previous screen short-circuited at step 1 — the donate button
 * recorded a row, showed "Thank you!" and never actually charged
 * anything. That's why the user said donations weren't really fine on
 * the dashboard.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  donate,
  getDonationTiers,
  listDonations,
  type Donation,
} from '@/features/donations/api';
import {
  initiateAuthenticatedDonationPayment,
  pollBookingPaymentStatus,
} from '@/features/payments/api';
import {
  detectPaymentCountry,
  getPaymentOptions,
  listCurrencies,
  type Currency,
  type PaymentOperator,
} from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

const FALLBACK_TIERS = [1000, 5000, 10000, 25000];

type Method = 'MOBILE_MONEY' | 'CARD';
type Stage = 'form' | 'awaiting' | 'success' | 'failed';

export default function DonationsScreen() {
  const history = useAsync(useCallback(() => listDonations(), []));

  // Form
  const [tiers, setTiers] = useState<number[]>(FALLBACK_TIERS);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currencyId, setCurrencyId] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  // Payment options
  const [country, setCountry] = useState('RW');
  const [supportsCard, setSupportsCard] = useState(true);
  const [operators, setOperators] = useState<PaymentOperator[]>([
    { id: 'MTN', name: 'MTN Mobile Money', type: 'MOBILE_MONEY' },
    { id: 'AIRTEL', name: 'Airtel Money', type: 'MOBILE_MONEY' },
  ]);
  const [method, setMethod] = useState<Method>('MOBILE_MONEY');
  const [operatorId, setOperatorId] = useState('MTN');
  const [phone, setPhone] = useState('');

  // Flow state
  const [stage, setStage] = useState<Stage>('form');
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [t, all, c] = await Promise.all([
        getDonationTiers().catch(() => []),
        listCurrencies().catch(() => []),
        detectPaymentCountry().catch(() => undefined),
      ]);
      if (cancelled) return;
      if (t.length) setTiers(t.map((x) => x.amount));
      if (all.length) {
        setCurrencies(all);
        // Default to RWF when present (most pots are RWF-priced), else
        // first currency in the list.
        const def = all.find((cc) => cc.code.toUpperCase() === 'RWF') ?? all[0];
        setCurrencyId(def.id);
      }
      const resolved = c || 'RW';
      setCountry(resolved);
      const opts = await getPaymentOptions(resolved).catch(() => null);
      if (!cancelled && opts) {
        setSupportsCard(opts.supportsCard);
        if (opts.operators.length > 0) {
          setOperators(opts.operators);
          setOperatorId(opts.operators[0].id);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const currency = useMemo(
    () => currencies.find((c) => c.id === currencyId) ?? currencies[0],
    [currencies, currencyId],
  );

  const valueNum = Number(amount.replace(/[^0-9.]/g, ''));
  const validAmount = !Number.isNaN(valueNum) && valueNum > 0;
  const phoneOk = method === 'CARD' ? true : /^\d{9,12}$/.test(phone.trim());
  const formOk = validAmount && !!currencyId && phoneOk;

  const onDonate = async () => {
    if (!formOk) {
      if (!validAmount) setError('Enter a valid amount.');
      else if (!phoneOk) setError('Enter a valid phone for mobile money.');
      else setError('Currencies unavailable. Try again shortly.');
      return;
    }
    setError(null);
    setSubmitting(true);
    setStage('awaiting');
    setStatusNote(
      method === 'CARD' ? 'Recording your donation…' : 'Sending payment prompt to your phone…',
    );
    try {
      // Step 1 — create the donation row.
      const created = await donate({
        amount: valueNum,
        currencyId,
        message: message || undefined,
        paymentMethod: method,
      });
      if (!created.id) {
        setStage('failed');
        setStatusNote('Could not start your donation. Please try again.');
        setSubmitting(false);
        return;
      }

      // Step 2 — kick off the payment.
      setStatusNote(method === 'CARD' ? 'Opening payment page…' : 'Sending payment prompt…');
      const initiate = await initiateAuthenticatedDonationPayment({
        donationId: created.id,
        paymentMethod: method,
        phone: phone.trim() || undefined,
        telecomProvider: method === 'MOBILE_MONEY' ? operatorId : undefined,
        country,
      });

      if (!initiate.refId) {
        setStage('failed');
        setStatusNote('Could not start the payment. Please try again.');
        setSubmitting(false);
        return;
      }

      if (initiate.redirectUrl) {
        await WebBrowser.openBrowserAsync(initiate.redirectUrl);
      }

      setStatusNote('Confirming with the payment gateway…');
      const settled = await pollBookingPaymentStatus(initiate.refId, {
        graceMs: method === 'CARD' ? 25_000 : 0,
        maxAttempts: 60,
        intervalMs: 2500,
      });

      if (settled === 'success') {
        setStage('success');
        setStatusNote('Thank you! Your donation has been received.');
        setAmount('');
        setMessage('');
        await history.refresh();
      } else if (settled === 'failed') {
        setStage('failed');
        setStatusNote(
          'The payment was not completed. If you were charged you will be refunded automatically.',
        );
      } else {
        setStage('failed');
        setStatusNote("Payment is still pending. We'll email you when it confirms.");
      }
    } catch (e) {
      setStage('failed');
      setStatusNote(isApiError(e) ? e.message : 'Could not submit your donation.');
    } finally {
      setSubmitting(false);
    }
  };

  const tryAgain = () => {
    setStage('form');
    setStatusNote(null);
    setError(null);
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Donate" subtitle="Support the Connekyt community" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Amount</Text>
        <View style={styles.tierRow}>
          {tiers.map((t) => {
            const active = amount === String(t);
            return (
              <Pressable
                key={t}
                onPress={() => setAmount(String(t))}
                style={[styles.tier, active && styles.tierActive]}
              >
                <Text style={[styles.tierText, active && styles.tierTextActive]}>
                  {currency?.symbol ?? currency?.code ?? ''} {t.toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label={`Custom amount ${currency ? `(${currency.code})` : ''}`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder="Enter an amount"
        />
        <Input
          label="Message (optional)"
          value={message}
          onChangeText={setMessage}
          placeholder="Say something nice"
          multiline
          style={styles.multiline}
        />

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
                      size={13}
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

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {stage !== 'form' && statusNote ? (
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

        {stage === 'success' || stage === 'failed' ? (
          <Button title="Donate again" variant="outline" onPress={tryAgain} />
        ) : (
          <Button
            title={
              stage === 'awaiting'
                ? 'Processing…'
                : `Donate ${currency?.symbol ?? currency?.code ?? ''} ${
                    validAmount ? valueNum.toLocaleString() : ''
                  }`.trim()
            }
            onPress={onDonate}
            loading={submitting}
            disabled={!formOk || submitting}
          />
        )}

        <Text style={styles.note}>
          Payments are processed by XentriPay. We never see your full card details.
        </Text>

        <Text style={styles.historyTitle}>Your donations</Text>
        {history.loading && !history.data ? (
          <ActivityIndicator color={colors.primary} />
        ) : history.data?.length ? (
          history.data.map((d) => <DonationRow key={d.id} donation={d} />)
        ) : (
          <Text style={styles.muted}>You haven&apos;t donated yet.</Text>
        )}
      </ScrollView>
    </Screen>
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

function DonationRow({ donation }: { donation: Donation }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowMsg} numberOfLines={1}>
          {donation.message || 'Donation'}
        </Text>
        {donation.createdAt ? <Text style={styles.rowDate}>{formatDate(donation.createdAt)}</Text> : null}
      </View>
      <Text style={styles.rowAmount}>{formatMoney(donation.amount, donation.currency)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.md, paddingBottom: 120 },
  section: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textSoft },
  tierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tier: {
    flexGrow: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tierActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tierText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.text },
  tierTextActive: { color: colors.textOnPrimary },
  multiline: { height: 80, paddingTop: spacing.md, textAlignVertical: 'top' },

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
  cardHintText: {
    flex: 1,
    color: colors.info,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    lineHeight: 18,
  },

  error: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },

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

  historyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, marginTop: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  rowMsg: { fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.semibold },
  rowDate: { fontSize: fontSize.xs, color: colors.textMuted },
  rowAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
});
