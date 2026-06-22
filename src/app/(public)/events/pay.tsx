/**
 * Public event-stream payment.
 *
 * Mirrors the web `pages/events/join-event.tsx` payment section:
 *   1. Collect viewer name/email/phone (anonymous viewer)
 *   2. Pick MTN Mobile Money, Airtel Money, or Card
 *   3. Initiate XentriPay (public anonymous-viewer endpoint)
 *   4. Open the gateway in a browser (card) and poll status by refid
 *   5. On SUCCESS → confirm-payment + push to live-stream
 *
 * The flow uses zero auth: the backend identifies the viewer by an
 * opaque per-install `deviceId` (SecureStore). This matches the web's
 * anonymous-viewer registration.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import {
  getPublicPaymentStatus,
  initiateAnonymousStreamingPayment,
  pollPublicPaymentStatus,
} from '@/features/payments/anonymous';
import {
  confirmAnonymousPayment,
  registerAnonymousViewer,
} from '@/features/streams/api';
import { detectPaymentCountry, getPaymentOptions, listCurrencies } from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

type Method = 'MOBILE_MONEY' | 'CARD';

type IoniconName = keyof typeof Ionicons.glyphMap;
type ProviderOpt = { id: string; label: string; icon: IoniconName };

const PROVIDERS_FALLBACK: ProviderOpt[] = [
  { id: 'MTN', label: 'MTN Mobile Money', icon: 'phone-portrait-outline' },
  { id: 'AIRTEL', label: 'Airtel Money', icon: 'phone-portrait-outline' },
];

function feeLabel(fee: number, code: string | null | undefined, symbol?: string | null): string {
  if (!fee || fee <= 0) return 'Free';
  return `${fee.toLocaleString()} ${symbol || code || 'RWF'}`;
}

export default function EventPaymentScreen() {
  const { id, package: pkg, people } = useLocalSearchParams<{
    id: string;
    package?: string;
    people?: string;
  }>();
  const router = useRouter();

  const event = useAsync(useCallback(() => getPublicEventDetailed(id), [id]));
  const peopleNum = Math.max(1, parseInt(people || '1', 10) || 1);

  // Viewer identity
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Payment options
  const [country, setCountry] = useState<string>('RW');
  const [providers, setProviders] = useState<ProviderOpt[]>(PROVIDERS_FALLBACK);
  const [supportsCard, setSupportsCard] = useState(true);
  const [method, setMethod] = useState<Method>('MOBILE_MONEY');
  const [providerId, setProviderId] = useState<string>('MTN');

  // Currency id (needed by the public initiate endpoint)
  const [currencyId, setCurrencyId] = useState<string>('');

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'awaiting' | 'success' | 'failed'>('idle');
  const [statusNote, setStatusNote] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = (await detectPaymentCountry().catch(() => undefined)) || 'RW';
      if (cancelled) return;
      setCountry(c);
      const opts = await getPaymentOptions(c).catch(() => null);
      if (cancelled || !opts) return;
      setSupportsCard(opts.supportsCard);
      if (opts.operators.length > 0) {
        setProviders(
          opts.operators.map((o) => ({
            id: o.id,
            label: o.name,
            icon: 'phone-portrait-outline' as const,
          })),
        );
        setProviderId(opts.operators[0].id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When event loads, resolve currencyId from its currency code.
  useEffect(() => {
    if (!event.data || currencyId) return;
    listCurrencies()
      .then((all) => {
        const wanted = (event.data!.streamFeeCurrencyAbbreviation ?? 'RWF').toUpperCase();
        const match = all.find((c) => c.code.toUpperCase() === wanted);
        if (match) setCurrencyId(match.id);
      })
      .catch(() => {});
  }, [event.data, currencyId]);

  if (event.loading && !event.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (event.error || !event.data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{event.error ?? 'Could not load this event.'}</Text>
        </View>
      </Screen>
    );
  }

  const data = event.data;
  const baseFee = data.streamFee ?? 0;
  const groupDiscount = data.groupDiscountPercentage ?? 10;
  const totalFee =
    pkg === 'group'
      ? Math.round(baseFee * peopleNum * (1 - groupDiscount / 100))
      : baseFee;
  const totalLabel = feeLabel(
    totalFee,
    data.streamFeeCurrencyAbbreviation,
    data.streamFeeCurrencySymbol,
  );

  const phoneOk = method === 'CARD' ? true : /^\d{9,12}$/.test(phone.trim());
  const formOk = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && phoneOk;

  const onPay = async () => {
    if (!formOk) {
      Alert.alert('Check your info', 'Name, email and phone are required.');
      return;
    }
    if (!currencyId) {
      Alert.alert('Could not start payment', 'Currency information is still loading.');
      return;
    }
    setBusy(true);
    setStatus('awaiting');
    setStatusNote('Setting up your viewer access…');
    try {
      const deviceId = await getDeviceId();
      const reg = await registerAnonymousViewer(id, {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        deviceId,
      });
      if (!reg.viewerId) throw { status: 0, message: 'Could not register your viewer access.' };

      // Free stream: skip payment and go straight to the live screen.
      if (!reg.needsPayment) {
        router.replace(`/events/live-stream?id=${id}&viewerId=${reg.viewerId}` as unknown as Href);
        return;
      }

      setStatusNote(method === 'CARD' ? 'Opening payment page…' : 'Sending payment prompt to your phone…');
      const initiate = await initiateAnonymousStreamingPayment({
        eventId: id,
        viewerId: reg.viewerId,
        amount: totalFee,
        currencyId,
        viewerCount: peopleNum,
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
        await confirmAnonymousPayment(id, { viewerId: reg.viewerId, refid: initiate.refid }).catch(
          () => {},
        );
        setStatus('success');
        setStatusNote('Payment received. Taking you to the live stream…');
        setTimeout(
          () => router.replace(`/events/live-stream?id=${id}&viewerId=${reg.viewerId}` as unknown as Href),
          1200,
        );
        return;
      }
      if (settled === 'failed') {
        setStatus('failed');
        setStatusNote('Your bank or wallet declined the payment. You can try again.');
      } else {
        // pending — last hopeful check then bow out
        const last = await getPublicPaymentStatus(initiate.refid).catch(() => 'pending' as const);
        if (last === 'success') {
          setStatus('success');
          setStatusNote('Payment received. Taking you to the live stream…');
          setTimeout(
            () => router.replace(`/events/live-stream?id=${id}&viewerId=${reg.viewerId}` as unknown as Href),
            1200,
          );
          return;
        }
        setStatus('failed');
        setStatusNote('Payment is still pending. You can retry in a minute.');
      }
    } catch (e) {
      setStatus('failed');
      setStatusNote(isApiError(e) ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summary}>
          <Text style={styles.summaryEvent} numberOfLines={1}>
            {data.title}
          </Text>
          <Text style={styles.summarySub}>
            {pkg === 'group' ? `${peopleNum} viewers · 10% off` : 'Individual viewer'}
          </Text>
          <Text style={styles.summaryAmount}>{totalLabel}</Text>
        </View>

        <Text style={styles.h2}>Your details</Text>
        <Input
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Input
          placeholder="Phone (e.g. 250788000000)"
          value={phone}
          onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ''))}
          keyboardType="phone-pad"
        />

        <Text style={styles.h2}>Pay with</Text>
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
          <View style={styles.providers}>
            {providers.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.provider, providerId === p.id && styles.providerActive]}
                onPress={() => setProviderId(p.id)}
              >
                <Ionicons name={p.icon} size={18} color={providerId === p.id ? colors.primary : colors.textMuted} />
                <Text
                  style={[styles.providerLabel, providerId === p.id && styles.providerLabelActive]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {status !== 'idle' ? (
          <View
            style={[
              styles.statusBox,
              status === 'success' && styles.statusOk,
              status === 'failed' && styles.statusErr,
            ]}
          >
            {status === 'awaiting' ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons
                name={status === 'success' ? 'checkmark-circle' : 'alert-circle'}
                size={24}
                color={status === 'success' ? colors.success : colors.error}
              />
            )}
            <Text style={styles.statusText}>{statusNote}</Text>
          </View>
        ) : null}

        <Button
          title={
            status === 'awaiting'
              ? 'Processing…'
              : status === 'failed'
              ? 'Try again'
              : `Pay ${totalLabel}`
          }
          onPress={onPay}
          loading={busy}
          disabled={!formOk || busy}
        />
        <Text style={styles.note}>
          Payments are processed by XentriPay. We never see your full card details.
        </Text>
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
  icon: IoniconName;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.method, active && styles.methodActive, disabled && styles.methodDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={24} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.methodLabel, active && styles.methodLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 },

  summary: {
    padding: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radii.lg,
    gap: 2,
  },
  summaryEvent: { color: colors.textOnPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  summarySub: { color: 'rgba(255,255,255,0.78)', fontSize: fontSize.xs },
  summaryAmount: {
    marginTop: spacing.sm,
    color: colors.textOnPrimary,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.extrabold,
  },

  h2: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },

  methods: { flexDirection: 'row', gap: spacing.md },
  method: {
    flex: 1,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
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
  statusOk: { backgroundColor: colors.successBg },
  statusErr: { backgroundColor: colors.errorBg },
  statusText: { flex: 1, color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  note: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs },
});
