/**
 * Public donation flow (guest, no auth).
 *
 * Mirrors web `app/user/donations/page.tsx`:
 *   1. Pick a preset tier or enter a custom amount
 *   2. Optional message + donor info
 *   3. Pick Mobile Money / Card → backend creates Donation row → initiate
 *      XentriPay → poll status → success screen.
 *
 * When `eventId` is in the query the donation is attributed to that event.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { createPublicDonation, getDonationTiers } from '@/features/donations/api';
import {
  getPublicPaymentStatus,
  initiateXentriPayDonation,
  pollPublicPaymentStatus,
} from '@/features/payments/anonymous';
import { detectPaymentCountry, getPaymentOptions, listCurrencies } from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

type Method = 'MOBILE_MONEY' | 'CARD';

const FALLBACK_TIERS: { amount: number }[] = [
  { amount: 1000 },
  { amount: 5000 },
  { amount: 10000 },
  { amount: 25000 },
];

export default function PublicDonateScreen() {
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();
  const router = useRouter();

  const tiers = useAsync(useCallback(() => getDonationTiers(), []));
  const presetTiers = tiers.data?.length ? tiers.data : FALLBACK_TIERS;

  const [amount, setAmount] = useState<string>('');
  const [message, setMessage] = useState('');
  const [donorName, setDonorName] = useState('');
  const [donorEmail, setDonorEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [currency, setCurrency] = useState<{ id: string; code: string } | null>(null);
  const [country, setCountry] = useState('RW');
  const [method, setMethod] = useState<Method>('MOBILE_MONEY');
  const [providers, setProviders] = useState<{ id: string; name: string }[]>([
    { id: 'MTN', name: 'MTN Mobile Money' },
    { id: 'AIRTEL', name: 'Airtel Money' },
  ]);
  const [supportsCard, setSupportsCard] = useState(true);
  const [providerId, setProviderId] = useState('MTN');

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'awaiting' | 'success' | 'failed'>('idle');
  const [statusNote, setStatusNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const all = await listCurrencies().catch(() => []);
      if (!cancelled && all.length > 0) {
        const def = all.find((c) => c.code.toUpperCase() === 'RWF') ?? all[0];
        setCurrency({ id: def.id, code: def.code });
      }
      const c = (await detectPaymentCountry().catch(() => undefined)) || 'RW';
      if (cancelled) return;
      setCountry(c);
      const opts = await getPaymentOptions(c).catch(() => null);
      if (cancelled || !opts) return;
      setSupportsCard(opts.supportsCard);
      if (opts.operators.length > 0) {
        setProviders(opts.operators.map((o) => ({ id: o.id, name: o.name })));
        setProviderId(opts.operators[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const amountNum = Math.max(0, parseInt((amount || '0').replace(/[^0-9]/g, ''), 10) || 0);
  const formOk =
    amountNum > 0 &&
    donorName.trim().length > 0 &&
    /\S+@\S+\.\S+/.test(donorEmail) &&
    (method === 'CARD' || /^\d{9,12}$/.test(phone.trim())) &&
    !!currency;

  const onDonate = async () => {
    if (!formOk) {
      Alert.alert('Check your info', 'Amount, name, email and phone are required.');
      return;
    }
    setBusy(true);
    setStatus('awaiting');
    setStatusNote('Recording your donation…');
    try {
      const created = await createPublicDonation({
        amount: amountNum,
        currencyId: currency!.id,
        donorName: donorName.trim(),
        donorEmail: donorEmail.trim(),
        message: message.trim() || undefined,
        paymentMethod: method,
        eventId,
      });
      if (!created.id) throw { status: 0, message: 'Could not create the donation.' };

      setStatusNote(method === 'CARD' ? 'Opening payment page…' : 'Sending payment prompt…');
      const initiate = await initiateXentriPayDonation({
        donationId: created.id,
        phone: phone.trim() || undefined,
        telecomProvider: method === 'MOBILE_MONEY' ? providerId : undefined,
        paymentMethod: method,
        country,
      });
      if (!initiate.refid) {
        throw { status: 0, message: initiate.message || 'Could not start the payment.' };
      }
      if (initiate.paymentUrl) {
        await WebBrowser.openBrowserAsync(initiate.paymentUrl);
      }

      setStatusNote('Confirming with the payment gateway…');
      const grace = method === 'CARD' ? 25_000 : 0;
      const settled = await pollPublicPaymentStatus(initiate.refid, {
        graceMs: grace,
        maxAttempts: 60,
        intervalMs: 2500,
      });
      if (settled === 'success') {
        setStatus('success');
        setStatusNote('Thank you! Your donation has been received.');
        return;
      }
      if (settled === 'failed') {
        setStatus('failed');
        setStatusNote('The donation could not be charged. You can try again.');
        return;
      }
      // Pending: one last hopeful check.
      const last = await getPublicPaymentStatus(initiate.refid).catch(() => 'pending' as const);
      if (last === 'success') {
        setStatus('success');
        setStatusNote('Thank you! Your donation has been received.');
      } else {
        setStatus('failed');
        setStatusNote('Still pending — please check back in a minute.');
      }
    } catch (e) {
      setStatus('failed');
      setStatusNote(isApiError(e) ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'success') {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="heart" size={42} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Thank you!</Text>
          <Text style={styles.successMsg}>{statusNote}</Text>
          <Button title="Back to events" onPress={() => router.replace('/explore-events')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Ionicons name="heart" size={28} color={colors.accent} />
          <Text style={styles.heroTitle}>Support a Connekyt creator</Text>
          <Text style={styles.heroSub}>
            100% of every donation reaches the people behind the stream — no platform cut.
          </Text>
        </View>

        <Text style={styles.h2}>Amount</Text>
        <View style={styles.tiers}>
          {presetTiers.map((t) => (
            <Pressable
              key={t.amount}
              style={[styles.tier, amountNum === t.amount && styles.tierActive]}
              onPress={() => setAmount(String(t.amount))}
            >
              <Text style={[styles.tierAmount, amountNum === t.amount && styles.tierAmountActive]}>
                {t.amount.toLocaleString()}
              </Text>
              <Text style={[styles.tierCurrency, amountNum === t.amount && styles.tierCurrencyActive]}>
                {currency?.code ?? 'RWF'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.customRow}>
          <Text style={styles.customLabel}>Custom</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            style={styles.customInput}
            keyboardType="number-pad"
          />
          <Text style={styles.customCurrency}>{currency?.code ?? 'RWF'}</Text>
        </View>

        <Text style={styles.h2}>Your details</Text>
        <Input
          placeholder="Full name"
          value={donorName}
          onChangeText={setDonorName}
          autoCapitalize="words"
        />
        <Input
          placeholder="Email"
          value={donorEmail}
          onChangeText={setDonorEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          placeholder="Message (optional)"
          value={message}
          onChangeText={setMessage}
          multiline
          style={styles.messageInput}
        />

        <Text style={styles.h2}>Pay with</Text>
        <View style={styles.methods}>
          <Pressable
            style={[styles.method, method === 'MOBILE_MONEY' && styles.methodActive]}
            onPress={() => setMethod('MOBILE_MONEY')}
          >
            <Ionicons
              name="phone-portrait"
              size={22}
              color={method === 'MOBILE_MONEY' ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.methodLabel,
                method === 'MOBILE_MONEY' && styles.methodLabelActive,
              ]}
            >
              Mobile Money
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.method,
              method === 'CARD' && styles.methodActive,
              !supportsCard && styles.methodDisabled,
            ]}
            onPress={() => supportsCard && setMethod('CARD')}
            disabled={!supportsCard}
          >
            <Ionicons
              name="card-outline"
              size={22}
              color={method === 'CARD' ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.methodLabel, method === 'CARD' && styles.methodLabelActive]}>
              Card
            </Text>
          </Pressable>
        </View>

        {method === 'MOBILE_MONEY' ? (
          <View style={styles.providers}>
            {providers.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.provider, providerId === p.id && styles.providerActive]}
                onPress={() => setProviderId(p.id)}
              >
                <Text
                  style={[styles.providerLabel, providerId === p.id && styles.providerLabelActive]}
                >
                  {p.name}
                </Text>
              </Pressable>
            ))}
            <Input
              placeholder="Phone (e.g. 250788000000)"
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
              keyboardType="phone-pad"
            />
          </View>
        ) : null}

        {status === 'awaiting' || status === 'failed' ? (
          <View style={[styles.statusBox, status === 'failed' && styles.statusErr]}>
            {status === 'awaiting' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="alert-circle" size={22} color={colors.error} />
            )}
            <Text style={styles.statusText}>{statusNote}</Text>
          </View>
        ) : null}

        <Button
          title={
            busy
              ? 'Processing…'
              : status === 'failed'
              ? 'Try again'
              : `Donate ${amountNum > 0 ? amountNum.toLocaleString() : ''} ${currency?.code ?? 'RWF'}`
          }
          onPress={onDonate}
          loading={busy}
          disabled={!formOk || busy}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 },
  hero: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.xs,
  },
  heroTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  heroSub: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },

  h2: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },

  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tier: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  tierActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  tierAmount: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  tierAmountActive: { color: colors.primary },
  tierCurrency: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.semibold, marginTop: 2 },
  tierCurrencyActive: { color: colors.primary },

  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  customLabel: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  customInput: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.text,
    textAlign: 'right',
    padding: 0,
  },
  customCurrency: { color: colors.textSoft, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  messageInput: { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },

  methods: { flexDirection: 'row', gap: spacing.md },
  method: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
    backgroundColor: colors.surface,
    alignItems: 'center',
    gap: spacing.sm,
  },
  methodActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  methodDisabled: { opacity: 0.5 },
  methodLabel: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  methodLabelActive: { color: colors.primary },

  providers: { gap: spacing.sm },
  provider: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  providerActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  providerLabel: { color: colors.textSoft, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  providerLabelActive: { color: colors.primary, fontWeight: fontWeight.bold },

  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.infoBg,
    borderRadius: radii.lg,
  },
  statusErr: { backgroundColor: colors.errorBg },
  statusText: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  successMsg: { fontSize: fontSize.md, color: colors.textSoft, textAlign: 'center' },
});
