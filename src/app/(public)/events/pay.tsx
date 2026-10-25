/**
 * Public event-stream ticket & access checkout.
 *
 * Implements full in-app checkout aligned with the Backend Infrastructure specs:
 *   1. Identity & Registration:
 *      • Collect viewer Name + Email (normalized to lowercase as unique identity key).
 *      • Calls POST /anonymous-viewer/{id}/register.
 *      • Auto-bypasses payment for free events or pre-existing purchases.
 *   2. In-App Payment Selection:
 *      • Country-aware routing (RW, KE, UG, TZ, etc.) with flag selector.
 *      • Mobile Money (MTN / Airtel / M-Pesa) with country phone normalization.
 *      • Credit / Debit Card handoff via in-app browser session.
 *   3. USSD Push & Polling:
 *      • Calls POST /anonymous-viewer/{id}/initiate-payment.
 *      • Polls POST /anonymous-viewer/{id}/payment-status every 2 seconds.
 *   4. Instant Reconcile:
 *      • "Already paid? Verify access" calls POST /reconcile-by-fingerprint.
 *   5. Seamless Transition:
 *      • Auto-unlocks and navigates directly into /events/live-stream on success.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pollStatus } from '@/features/payments/nativeCheckout';
import { Redirect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { canBuyEventTicket, isInPersonEvent } from '@/features/payments/policy';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
import { getPublicEventDetailed } from '@/features/events/api';
import {
  checkAnonymousPaymentStatus,
  initiateAnonymousPayment,
  reconcileAnonymousByFingerprint,
  registerAnonymousViewer,
  type InitiateAnonymousPaymentPayload,
} from '@/features/streams/api';
import { getEffectivePrice, type EffectivePrice } from '@/features/geopricing/api';
import { useAsync } from '@/hooks/useAsync';
import { storage } from '@/services/storage';
import { isApiError, useAuth } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';
import { keepSelection, onlyOperators } from '@/features/payments/eligibility';
import { usePaymentEligibility } from '@/features/payments/usePaymentEligibility';
import {
  dialCodeFor,
  formatPhoneE164,
  isPlausibleMobile,
  phoneHintForCountry,
} from '@/features/payments/formatPhone';
import { flagEmoji } from '@/components/ui/PhoneInput';
import { PaymentMethodPicker } from '@/features/payments/PaymentMethodPicker';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme, onFill } from '@/theme';
import { formatPrice } from '@/utils/format';

import { useLanguage } from '@/hooks/useLanguage';
import { translate, type TranslationKey } from '@/i18n/translations';
import { useStackClearance } from '@/hooks/useScrollClearance';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { SheetCornerClose } from '@/components/ui/SheetCloseButton';
const tr = (k: TranslationKey) => translate(useLanguage.getState().language, k);

// The stream-ticket endpoint takes MTN or AIRTEL for mobile money, as before.
const STREAM_OPERATOR_IDS = ['MTN', 'AIRTEL'] as const;

type Stage = 'contact' | 'payment' | 'awaiting' | 'success' | 'unconfirmed';

const PAYMENT_COUNTRIES = [
  { iso2: 'RW', name: 'Rwanda', dial: '250' },
  { iso2: 'KE', name: 'Kenya', dial: '254' },
  { iso2: 'UG', name: 'Uganda', dial: '256' },
  { iso2: 'TZ', name: 'Tanzania', dial: '255' },
  { iso2: 'CD', name: 'DR Congo', dial: '243' },
  { iso2: 'GH', name: 'Ghana', dial: '233' },
  { iso2: 'NG', name: 'Nigeria', dial: '234' },
  { iso2: 'ZM', name: 'Zambia', dial: '260' },
  { iso2: 'CM', name: 'Cameroon', dial: '237' },
  { iso2: 'CI', name: "Côte d'Ivoire", dial: '225' },
  { iso2: 'SN', name: 'Senegal', dial: '221' },
  { iso2: 'MW', name: 'Malawi', dial: '265' },
];

function feeLabel(fee: number, code: string | null | undefined, symbol?: string | null): string {
  if (!fee || fee <= 0) return 'Free';
  return formatPrice(fee, code || 'RWF');
}

// Stream-only tickets are digital goods, absent in store builds (payments/policy).
// Tickets to in-person events are a real-world service and are allowed; that is
// decided once the event has loaded (see the guard in EventPaymentInner), which
// also stops a stale deep link to a stream-only event.
export default function EventPaymentScreen() {
  useLanguage();
  return <EventPaymentInner />;
}

function EventPaymentInner() {
  const { colors } = useTheme();
  const styles = useStyles();
  const clearance = useStackClearance();
  const { id, device: tvDevice } = useLocalSearchParams<{ id: string; device?: string }>();
  // Pay-on-TV: a phone pays for a TV. Access is bound to the TV's device id
  // (from its QR), never this phone's, and this phone must not remember the
  // resulting viewer as its own.
  const forTv = !!tvDevice;
  const accessDeviceId = async () => (tvDevice ? String(tvDevice) : getDeviceId());
  const rememberViewer = async (vId: string) => {
    if (!forTv) await storage.set(`anonymousViewer_${id}`, vId).catch(() => {});
  };
  const router = useRouter();

  const event = useAsync(useCallback(() => getPublicEventDetailed(id), [id]));

  // Viewer identity
  const authUser = useAuth((s) => s.user);
  const loggedIn = !!authUser;
  const [name, setName] = useState(
    authUser ? [authUser.firstName, authUser.lastName].filter(Boolean).join(' ') : '',
  );
  const [email, setEmail] = useState(authUser?.email ?? '');
  const [viewerId, setViewerId] = useState<string | null>(null);

  // Flow stages
  const [stage, setStage] = useState<Stage>('contact');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Geo-pricing
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

  // Country & phone payment state
  const eligibility = usePaymentEligibility();
  const country = eligibility.country ?? '';
  const streamOperators = useMemo(
    () => onlyOperators(eligibility.operators, STREAM_OPERATOR_IDS),
    [eligibility.operators],
  );
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  // No silent default: the buyer picks the method (docs/PAYMENTS.md: never guess a provider).
  const [pickedId, setPickedId] = useState<string | null>(null);
  // Derived, so a method that stops being offered (country change) can never be submitted.
  const methodId = keepSelection(pickedId, { ...eligibility, operators: streamOperators });
  const setMethodId = setPickedId;
  const paymentMethod: 'MOBILE_MONEY' | 'CARD' = methodId === 'card' ? 'CARD' : 'MOBILE_MONEY';
  const telecomProvider = (methodId === 'airtel' ? 'AIRTEL' : 'MTN') as 'MTN' | 'AIRTEL';
  const [phone, setPhone] = useState('');

  // Payment polling state
  const [refid, setRefid] = useState<string | null>(null);
  const pollCancelRef = useRef<(() => void) | null>(null);

  const eventRaw = event.data;
  const baseFee = effective?.price ?? eventRaw?.streamFee ?? eventRaw?.price ?? 0;
  const feeCurrencyCode = effective?.currencyAbbreviation ?? eventRaw?.streamFeeCurrencyAbbreviation ?? 'RWF';
  const feeCurrencySymbol = effective?.currencySymbol ?? eventRaw?.streamFeeCurrencySymbol;
  const totalLabel = feeLabel(baseFee, feeCurrencyCode, feeCurrencySymbol);

  const formOk = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email);

  // Clean up polling timer
  useEffect(() => {
    return () => {
      pollCancelRef.current?.();
    };
  }, []);

  // ── Step 1: Register Viewer ───────────────────────────────────────────────
  const onRegister = async () => {
    if (!formOk) {
      Alert.alert(tr('b4_checkDetailsTitle'), 'Please enter your name and a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const deviceId = await accessDeviceId();
      const normalizedEmail = email.trim().toLowerCase();
      const reg = await registerAnonymousViewer(id, {
        name: name.trim(),
        email: normalizedEmail,
        phone: phone ? formatPhoneE164(phone, country) : '0000000000',
        deviceId,
      });

      if (!reg.viewerId) {
        throw { status: 0, message: 'Could not register your viewer access.' };
      }

      setViewerId(reg.viewerId);
      await rememberViewer(reg.viewerId);

      // If already paid or event is free, immediately grant access
      if (!reg.needsPayment) {
        setStage('success');
        return;
      }

      // Paid event — transition to in-app payment selection
      setStage('payment');
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not proceed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 2: Instant Reconcile ("Already paid?") ───────────────────────────
  const onReconcileAccess = async () => {
    setBusy(true);
    setError(null);
    try {
      const deviceId = await accessDeviceId();
      const rec = await reconcileAnonymousByFingerprint(id, deviceId);
      if (rec.status === 'ACCESS_GRANTED' && rec.viewerId) {
        await rememberViewer(rec.viewerId);
        setViewerId(rec.viewerId);
        setStage('success');
        return;
      }
      Alert.alert(
        tr('b4_noPrevPurchaseTitle'),
        'We could not find an active pass for this device. Please complete payment or register with the email used at checkout.',
      );
    } catch {
      Alert.alert(tr('b4_errorTitle'), 'Could not verify access right now. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 3: Initiate Payment ──────────────────────────────────────────────
  const onInitiatePayment = async () => {
    if (!viewerId) return;
    setError(null);
    if (!methodId) {
      setError('Choose how you want to pay.');
      return;
    }

    const formattedPhone = formatPhoneE164(phone, country);
    if (paymentMethod === 'MOBILE_MONEY' && !isPlausibleMobile(phone, country)) {
      setError(`Please enter a valid ${country} phone number.`);
      return;
    }

    setBusy(true);
    try {
      const payload: InitiateAnonymousPaymentPayload = {
        viewerId,
        phone: formattedPhone,
        paymentMethod,
        telecomProvider: paymentMethod === 'MOBILE_MONEY' ? telecomProvider : undefined,
        currencyId: feeCurrencyCode,
      };

      const res = await initiateAnonymousPayment(id, payload);

      if (paymentMethod === 'CARD' && res.paymentUrl) {
        // Lock the form while the card page is open so a second tap cannot
        // start a second charge; polling settles the result.
        setStage('awaiting');
        if (res.refid) startPolling(res.refid, viewerId, true);
        await WebBrowser.openAuthSessionAsync(res.paymentUrl, 'connekt://payment-callback');
      } else if (res.refid) {
        // Mobile money: start polling USSD status
        setRefid(res.refid);
        setStage('awaiting');
        startPolling(res.refid, viewerId, paymentMethod === 'CARD');
      } else if (res.status === 'SUCCESS') {
        setStage('success');
      } else {
        throw new Error(res.message || 'Payment initiation failed.');
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not initiate payment. Please verify your phone number.');
    } finally {
      setBusy(false);
    }
  };

  // ── Step 4: Status Polling ────────────────────────────────────────────────
  const startPolling = (txRefid: string, vId: string, card: boolean) => {
    pollCancelRef.current?.();
    // Shared poller: bounded, keeps going through failed reads and the card's
    // early FAILED, and ends in `unconfirmed` rather than `failed` when it runs
    // out of time. The charge may have landed, so that state never offers a
    // retry (see docs/PAYMENTS.md).
    const poll = pollStatus(async () => {
      const check = await checkAnonymousPaymentStatus(id, txRefid, vId);
      if (check.status === 'SUCCESS') return 'success';
      if (check.status === 'FAILED') return 'failed';
      return 'pending';
    }, card);
    pollCancelRef.current = poll.cancel;
    void poll.done.then(async (outcome) => {
      if (outcome === 'success') {
        await rememberViewer(vId);
        setStage('success');
      } else if (outcome === 'failed') {
        setError('Payment was declined or cancelled. You have not been charged.');
        setStage('payment');
      } else {
        setStage('unconfirmed');
      }
    });
  };

  if (!event.loading && !canBuyEventTicket(event.data)) return <Redirect href="/" />;

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
          <Text style={styles.muted}>{event.error ?? 'Could not load event details.'}</Text>
        </View>
      </Screen>
    );
  }

  const data = event.data!;
  // In-person events sell an event ticket (the live stream is one way to attend);
  // the copy says so on every step so the receipt matches the listing.
  const isTicket = isInPersonEvent(data);

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: clearance }]} keyboardShouldPersistTaps="handled">
        {/* Header Summary */}
        <View style={styles.summary}>
          <Text style={styles.summaryEvent} numberOfLines={2}>
            {data.title}
          </Text>
          <Text style={styles.summarySub}>
            {data.eventOrganizer ? `Organized by ${data.eventOrganizer} · ` : ''}Live Stream Access
          </Text>
          <Text style={styles.summaryAmount}>{totalLabel}</Text>
        </View>

        {/* ── STAGE 1: Contact Information ── */}
        {stage === 'contact' && (
          <View style={styles.section}>
            <Text style={styles.h2}>{isTicket ? 'Your Event Ticket' : 'Your Access Pass'}</Text>
            <Text style={styles.subtext}>
              {isTicket ? 'Enter your name and email to link your event ticket and receive your receipt. Your ticket admits you to the event, and includes the live stream if you cannot attend in person.' : 'Enter your name and email to link your access pass and receive your receipt.'}
            </Text>

            {loggedIn ? (
              <View style={styles.signedInCard}>
                <Ionicons name="person-circle" size={24} color={colors.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.signedInName} numberOfLines={2}>
                    {name || 'Signed in'}
                  </Text>
                  {email ? <Text style={styles.signedInEmail} numberOfLines={2}>{email}</Text> : null}
                </View>
              </View>
            ) : (
              <>
                <Input
                  label="Full name"
                  placeholder="Jane Doe"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                />
                <Input
                  label={tr('b4_emailAddressLabel')}
                  placeholder="jane@example.com"
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
              title={busy ? 'Registering…' : 'Continue to Payment'}
              onPress={onRegister}
              loading={busy}
              disabled={!formOk || busy}
            />

            <Pressable style={styles.reconcileBtn} onPress={onReconcileAccess} disabled={busy}>
              <Ionicons name="sync-outline" size={16} color={colors.primary} />
              <Text style={styles.reconcileBtnText}>{tr('b4_alreadyPaidRestoreDevice')}</Text>
            </Pressable>
          </View>
        )}

        {/* ── STAGE 2: Payment Options ── */}
        {stage === 'payment' && (
          <View style={styles.section}>
            <View style={styles.feeBanner}>
              <View>
                <Text style={styles.feeBannerLabel}>{isTicket ? 'Event ticket' : 'Total to Pay'}</Text>
                <Text style={styles.feeBannerAmount}>{totalLabel}</Text>
              </View>
              <Pressable
                style={styles.countryPill}
                onPress={() => setCountryModalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel="Select payment country"
              >
                <Text style={styles.countryFlag}>{flagEmoji(country)}</Text>
                <Text style={styles.countryCode}>{country || 'Country'}</Text>
                <Ionicons name="chevron-down" size={14} color={colors.text} />
              </Pressable>
            </View>

            {/* Payment Method Selector */}
            <Text style={styles.sectionTitle}>{tr('b4_selectPaymentMethod')}</Text>
            <PaymentMethodPicker
              operators={streamOperators}
              supportsCard={eligibility.supportsCard}
              selectedId={methodId}
              onSelect={setMethodId}
              mobileMoneyState={eligibility.mobileMoney === 'loading' ? 'loading' : streamOperators.length > 0 ? 'ready' : 'unavailable'}
              onRetry={eligibility.retry}
              disabled={busy}
            />

            {/* Mobile Money Details */}
            {methodId && paymentMethod === 'MOBILE_MONEY' ? (
              <View style={styles.providerBox}>
                <Text style={styles.inputLabel}>{tr('b4_mobilePhoneNumberLabel')}</Text>
                <View style={styles.phoneInputRow}>
                  <View style={styles.dialPrefix}>
                    <Text style={styles.dialPrefixText}>+{dialCodeFor(country)}</Text>
                  </View>
                  <TextInput
                    style={styles.phoneInput}
                    placeholder={phoneHintForCountry(country)}
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
                <Text style={styles.hintText}>
                  {tr('b4_ussdPromptHint')}
                </Text>
              </View>
            ) : (
              <View style={styles.cardInfoBox}>
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
                <Text style={styles.cardInfoText}>
                  {tr('b4_cardSecurityHint')}
                </Text>
              </View>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              title={
                busy
                  ? 'Processing…'
                  : !methodId
                  ? 'Choose a payment method'
                  : paymentMethod === 'MOBILE_MONEY'
                  ? `Pay ${totalLabel} with Mobile Money`
                  : `Pay ${totalLabel} with Card`
              }
              onPress={onInitiatePayment}
              loading={busy}
              disabled={busy || !methodId}
            />

            <Pressable style={styles.backLink} onPress={() => setStage('contact')}>
              <Text style={styles.backLinkText}>{tr('b4_editContactDetails')}</Text>
            </Pressable>
          </View>
        )}

        {/* ── STAGE 3: Awaiting USSD PIN Approval ── */}
        {stage === 'awaiting' && (
          <View style={styles.awaitingCard}>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.md }} />
            <Text style={styles.awaitingTitle}>{tr('b4_checkYourPhone')}</Text>
            <Text style={styles.awaitingSub}>
              {paymentMethod === 'CARD' ? (
                'Complete the card payment in the secure window, then return here.'
              ) : (
                <>
                  A USSD payment prompt has been dispatched to{' '}
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    +{dialCodeFor(country)} {phone}
                  </Text>
                  {tr('b4_enterPinToApprove')}
                </>
              )}
            </Text>

            <View style={styles.countdownBox}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} />
              <Text style={styles.countdownText}>{tr('b4_waitingForConfirmation')}</Text>
            </View>

          </View>
        )}

        {/* ── Unconfirmed: we stopped waiting. No retry, the charge may have landed. ── */}
        {stage === 'unconfirmed' && (
          <View style={styles.awaitingCard}>
            <Ionicons name="time-outline" size={40} color={colors.textMuted} style={{ marginVertical: spacing.md }} />
            <Text style={styles.awaitingTitle}>{tr('b4_couldNotConfirmPaymentYet')}</Text>
            <Text style={styles.awaitingSub}>
              If you approved the prompt on your phone, your access may still activate. Check your
              phone and try &quot;Already paid? Verify access&quot; in a few minutes before paying again.
            </Text>
            <Button title={tr('b4_back')} variant="outline" onPress={() => router.back()} />
          </View>
        )}

        {/* ── STAGE 4: Success State ── */}
        {stage === 'success' && (
          <View style={styles.successCard}>
            <View style={styles.successIconCircle}>
              <Ionicons name="checkmark" size={32} color={onFill} />
            </View>
            <Text style={styles.successTitle}>{isTicket ? 'Event Ticket Confirmed!' : 'Access Pass Activated!'}</Text>
            <Text style={styles.successSub}>
              {isTicket ? 'Your event ticket for ' : 'Your live stream access for '}<Text style={{ fontWeight: '700' }}>{data.title}</Text>{isTicket ? ' is confirmed. The live stream is included and has' : ' has'}
              been unlocked and linked to {forTv ? 'your TV, which will start playing shortly' : 'this device'}.
            </Text>

            <Button
              title={tr('b4_watchLiveStreamNow')}
              onPress={() => {
                router.replace(
                  `/events/live-stream?id=${id}${viewerId ? `&viewerId=${viewerId}` : ''}` as unknown as Href,
                );
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Country Selector Modal */}
      <Modal
        visible={countryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryModalOpen(false)}
      >
        <GlassScrim style={styles.modalBackdrop} onPress={() => setCountryModalOpen(false)}>
          <GlassSheetHost style={styles.modalSheet}>
            <SheetCornerClose onPress={() => setCountryModalOpen(false)} />
            <Text style={styles.modalTitle}>{tr('b4_selectPaymentCountry')}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              {PAYMENT_COUNTRIES.map((c) => (
                <Pressable
                  key={c.iso2}
                  style={[styles.countryRow, country === c.iso2 && styles.countryRowActive]}
                  onPress={() => {
                    setMethodId(null);
                    setPhone('');
                    void eligibility.changeCountry(c.iso2);
                    setCountryModalOpen(false);
                  }}
                >
                  <Text style={styles.countryRowFlag}>{flagEmoji(c.iso2)}</Text>
                  <Text style={styles.countryRowName}>{c.name}</Text>
                  <Text style={styles.countryRowDial}>+{c.dial}</Text>
                  {country === c.iso2 && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </GlassSheetHost>
        </GlassScrim>
      </Modal>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  muted: {
    color: c.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  summary: {
    padding: spacing.lg,
    backgroundColor: c.primary,
    borderRadius: radii.xl,
    gap: 4,
  },
  summaryEvent: {
    color: c.textOnPrimary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
  },
  summarySub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: fontSize.xs,
  },
  summaryAmount: {
    marginTop: spacing.md,
    color: c.textOnPrimary,
    fontSize: fontSize['3xl'],
    fontWeight: fontWeight.extrabold,
  },
  section: {
    gap: spacing.md,
  },
  h2: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  subtext: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
  },
  signedInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.tint,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  signedInName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  signedInEmail: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: c.errorBg,
    borderRadius: radii.md,
  },
  errorText: {
    flex: 1,
    color: c.error,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  reconcileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  reconcileBtnText: {
    color: c.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  feeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  feeBannerLabel: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
  },
  feeBannerAmount: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: c.tint,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  countryFlag: {
    fontSize: 16,
  },
  countryCode: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  methodsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  methodCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
  methodCardActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  methodText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.textMuted,
  },
  methodTextActive: {
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  providerBox: {
    gap: spacing.sm,
  },
  providerToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  providerPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  providerPillActive: {
    backgroundColor: c.tint,
    borderColor: c.primary,
  },
  providerPillText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
  },
  providerPillTextActive: {
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  inputLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
    marginTop: 4,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  dialPrefix: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: c.tint,
    borderRightWidth: 1,
    borderRightColor: c.borderSoft,
  },
  dialPrefixText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: c.text,
  },
  hintText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 16,
  },
  cardInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: c.tint,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  cardInfoText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: c.text,
    lineHeight: 18,
  },
  backLink: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  backLinkText: {
    color: c.textMuted,
    fontSize: fontSize.xs,
  },
  awaitingCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.md,
  },
  awaitingTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  awaitingSub: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: spacing.sm,
  },
  countdownText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  successCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.md,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.sm,
  },
  successTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  successSub: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
    marginBottom: spacing.xs,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  countryRowActive: {
    backgroundColor: c.tint,
  },
  countryRowFlag: {
    fontSize: 20,
  },
  countryRowName: {
    flex: 1,
    fontSize: fontSize.sm,
    color: c.text,
    fontWeight: fontWeight.medium,
  },
  countryRowDial: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontWeight: fontWeight.bold,
  },
}));
