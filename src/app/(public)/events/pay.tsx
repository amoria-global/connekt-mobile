/**
 * Public event-stream registration (formerly the in-app payment screen).
 *
 * The app no longer collects payment details. This screen remains because
 * it's deep-linkable and it handles the FREE-event bypass:
 *   1. Collect viewer name/email (anonymous viewer)
 *   2. registerAnonymousViewer — free events (!needsPayment) go straight
 *      to the live stream, exactly as before
 *   3. Paid events show the fee and a single (policy-gated) "Buy access on
 *      connekyt.com" button that opens the web checkout. On Android
 *      nothing purchasable is shown (digitalPurchasesEnabled gate).
 *
 * The flow uses zero auth: the backend identifies the viewer by an
 * opaque per-install `deviceId` (SecureStore). This matches the web's
 * anonymous-viewer registration.
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { openWebCheckout, streamAccessUrl } from '@/features/payments/webCheckout';
import { registerAnonymousViewer } from '@/features/streams/api';
import { getEffectivePrice, type EffectivePrice } from '@/features/geopricing/api';
import { useAsync } from '@/hooks/useAsync';
import { storage } from '@/services/storage';
import { isApiError, useAuth } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

function feeLabel(fee: number, code: string | null | undefined, symbol?: string | null): string {
  if (!fee || fee <= 0) return 'Free';
  return `${fee.toLocaleString()} ${symbol || code || 'RWF'}`;
}

export default function EventPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const event = useAsync(useCallback(() => getPublicEventDetailed(id), [id]));

  // Viewer identity. A logged-in user registers with their session data — no
  // need to re-enter name/email; a guest gives name + email only.
  const authUser = useAuth((s) => s.user);
  const loggedIn = !!authUser;
  const [name, setName] = useState(
    authUser ? [authUser.firstName, authUser.lastName].filter(Boolean).join(' ') : '',
  );
  const [email, setEmail] = useState(authUser?.email ?? '');

  // Geo-priced effective amount for this viewer's location (display only —
  // the web checkout re-resolves and charges the server-fixed amount).
  const [effective, setEffective] = useState<EffectivePrice | null>(null);
  useEffect(() => {
    let cancelled = false;
    getEffectivePrice(String(id))
      .then((e) => {
        if (!cancelled) setEffective(e);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set once registration confirms the event actually needs payment; the
  // screen then shows the fee + web-checkout handoff instead of a form.
  const [needsPayment, setNeedsPayment] = useState(false);

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
  // Prefer the geo-resolved price for this viewer; fall back to the event default.
  const baseFee = effective?.price ?? data.streamFee ?? 0;
  const feeCurrencyCode = effective?.currencyAbbreviation ?? data.streamFeeCurrencyAbbreviation;
  const feeCurrencySymbol = effective?.currencySymbol ?? data.streamFeeCurrencySymbol;
  const totalLabel = feeLabel(baseFee, feeCurrencyCode, feeCurrencySymbol);

  const formOk = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email);

  const onRegister = async () => {
    if (!formOk) {
      Alert.alert('Check your info', 'Enter your name and email.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const deviceId = await getDeviceId();
      const reg = await registerAnonymousViewer(id, {
        name: name.trim(),
        email: email.trim(),
        // No phone is collected anymore (it was only ever needed for Mobile
        // Money). The register DTO still @NotBlank-requires one on older
        // backends, so send the same harmless placeholder live-stream uses.
        phone: '0000000000',
        deviceId,
      });
      if (!reg.viewerId) throw { status: 0, message: 'Could not register your viewer access.' };

      // Free stream (or already-paid record): skip payment and go straight to
      // the live screen. Persist the viewerId so the event detail's CTA shows
      // "Start watching" instead of "Watch live" on a later visit.
      if (!reg.needsPayment) {
        await storage.set(`anonymousViewer_${id}`, reg.viewerId).catch(() => {});
        router.replace(`/events/live-stream?id=${id}&viewerId=${reg.viewerId}` as unknown as Href);
        return;
      }

      // Paid stream — the app never collects the payment. Show the fee +
      // (gated) web-checkout handoff below.
      setNeedsPayment(true);
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onBuyOnWeb = () => {
    if (!digitalPurchasesEnabled) return;
    void openWebCheckout(streamAccessUrl(id));
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summary}>
          <Text style={styles.summaryEvent} numberOfLines={1}>
            {data.title}
          </Text>
          <Text style={styles.summarySub}>Stream access</Text>
          <Text style={styles.summaryAmount}>{totalLabel}</Text>
        </View>

        {!needsPayment ? (
          <>
            <Text style={styles.h2}>Your details</Text>
            {loggedIn ? (
              <View style={styles.signedInCard}>
                <Ionicons name="person-circle" size={22} color={colors.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.signedInName} numberOfLines={1}>{name || 'Your account'}</Text>
                  {email ? <Text style={styles.signedInEmail} numberOfLines={1}>{email}</Text> : null}
                </View>
              </View>
            ) : (
              <>
                <Input placeholder="Full name" value={name} onChangeText={setName} autoCapitalize="words" />
                <Input
                  placeholder="Email"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              title={busy ? 'Checking…' : 'Continue'}
              onPress={onRegister}
              loading={busy}
              disabled={!formOk || busy}
            />
            <Text style={styles.note}>
              {digitalPurchasesEnabled
                ? 'Free events start playing right away. Ticketed events are purchased on connekyt.com.'
                : 'Free events start playing right away.'}
            </Text>
          </>
        ) : digitalPurchasesEnabled ? (
          <>
            <View style={styles.feeCard}>
              <Text style={styles.feeLabel}>Access fee</Text>
              <Text style={styles.feeValue}>{totalLabel}</Text>
            </View>
            <Button title="Buy access on connekyt.com" onPress={onBuyOnWeb} />
            <Text style={styles.note}>
              Payment is completed securely on connekyt.com. Once you&apos;ve paid, come
              back and verify your access from the event page.
            </Text>
          </>
        ) : (
          // Nothing routes here on Android, but a paid stream must never
          // surface a purchase path from inside the app there.
          <View style={styles.errorBox}>
            <Ionicons name="information-circle" size={20} color={colors.textMuted} />
            <Text style={styles.mutedInline}>
              This event needs access that cannot be purchased in the app. If you
              already have access, use your invite code on the event page.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  mutedInline: { flex: 1, color: colors.textMuted, fontSize: fontSize.sm },
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
  signedInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.infoBg,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  signedInName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  signedInEmail: { fontSize: fontSize.xs, color: colors.textMuted },

  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  feeLabel: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  feeValue: { color: colors.primary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.errorBg,
    borderRadius: radii.lg,
  },
  errorText: { flex: 1, color: colors.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  note: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs },
});
