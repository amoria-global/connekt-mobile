/**
 * Photo checkout sheet — brings the browse-photos purchase flow to
 * parity with the web XentriPayModal (knockout/app/components/
 * XentriPayModal.tsx). The old mobile flow only collected an email and
 * bounced to the gateway's hosted page. This sheet adds everything the
 * web modal has:
 *
 *   • Email collection (receipt + unlock code destination).
 *   • Country detection → operator list + card support from
 *     /public/payments/options, rendered as selectable method tiles.
 *   • Geo "blocking lines": a hard region block hides the pay button;
 *     a mobile-money category disable dims the operator tiles and shows
 *     a "use card" hint (from /geo/payment-status).
 *   • Country-aware phone input for mobile money, digit-masked and
 *     validated with the same isPlausibleMobile rule the backend uses.
 *   • Card path: a "you'll be redirected to a secure page" note, then
 *     the gateway URL opened in-app, with a 3-minute grace window while
 *     polling (cards report FAILED on a fresh unpaid session — matching
 *     the web's 180s card grace, vs 0 for mobile money).
 *   • A pay button gated on the full validity of the form (the "valid
 *     blocking lines"): email + method + phone/card + not geo-blocked.
 *   • Processing / success / failed stages with retry.
 *
 * On success it records the purchase and hands the parent the refid +
 * unlock code so browse-photos can show the download grid.
 */
import { useEffect, useMemo, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  detectPaymentCountry,
  getPaymentOptions,
  type PaymentOperator,
} from '@/features/reference/api';
import { getGeoPaymentStatus, type GeoPaymentStatus } from '@/features/payments/geo';
import { isPlausibleMobile, phoneHintForCountry, formatPhoneE164 } from '@/features/payments/formatPhone';
import {
  getPublicPaymentStatus,
  initiateMultiAlbumPurchase,
  recordAlbumPurchase,
  type MultiAlbumPurchaseItem,
} from '@/features/photos/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARD_GRACE_MS = 180_000; // 3 min — matches web card grace
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Stage = 'form' | 'awaiting' | 'success' | 'failed';

type MethodTile = { id: string; name: string; provider: string; isCard: boolean };

export function PhotoCheckoutSheet({
  visible,
  onClose,
  items,
  photoCount,
  photographerCount,
  currencySym,
  total,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  items: MultiAlbumPurchaseItem[];
  photoCount: number;
  photographerCount: number;
  currencySym: string;
  total: number;
  onSuccess: (refid: string, unlockCode: string | null) => void;
}) {
  const insets = useSafeAreaInsets();

  // Country + operators + card support (from /public/payments/options).
  const [country, setCountry] = useState('RW');
  const [supportsCard, setSupportsCard] = useState(true);
  const [operators, setOperators] = useState<PaymentOperator[]>([
    { id: 'MTN', name: 'MTN Mobile Money', type: 'MOBILE_MONEY' },
    { id: 'AIRTEL', name: 'Airtel Money', type: 'MOBILE_MONEY' },
  ]);

  // Region geo status (blocking lines).
  const [geo, setGeo] = useState<GeoPaymentStatus>({
    allowed: true,
    blocked: false,
    disableMobileMoney: false,
    disableCards: false,
  });

  // Selection + inputs.
  const [email, setEmail] = useState('');
  const [method, setMethod] = useState<string | null>(null);
  const [phone, setPhone] = useState('');

  // Flow state.
  const [stage, setStage] = useState<Stage>('form');
  const [statusNote, setStatusNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Reset whenever the sheet re-opens.
  useEffect(() => {
    if (!visible) return;
    setStage('form');
    setStatusNote('');
    setError(null);
    setMethod(null);
    setPhone('');
  }, [visible]);

  // Load country options + geo status once the sheet opens. Defaults
  // (RW / MTN+Airtel / card) survive if either call fails.
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
        if (opts.operators.length > 0) setOperators(opts.operators);
      }
      const g = await getGeoPaymentStatus().catch(() => null);
      if (!cancelled && g) setGeo(g);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Method tiles: one per operator, plus a Card tile when supported and
  // not disabled for the region.
  const tiles: MethodTile[] = useMemo(() => {
    const list: MethodTile[] = operators.map((o) => ({
      id: o.id.toLowerCase(),
      name: o.name,
      provider: o.id,
      isCard: false,
    }));
    if (supportsCard && !geo.disableCards) {
      list.push({ id: 'card', name: 'VISA & Master Card', provider: 'CARD', isCard: true });
    }
    return list;
  }, [operators, supportsCard, geo.disableCards]);

  const selectedTile = tiles.find((t) => t.id === method) ?? null;
  const isCard = selectedTile?.isCard ?? false;

  // ── The "valid blocking lines" — the pay button unlocks only when the
  // whole form is good and the region isn't blocked. ──
  const emailOk = EMAIL_RE.test(email.trim());
  const phoneOk = isCard ? true : isPlausibleMobile(phone, country);
  const methodOk =
    !!selectedTile && !geo.blocked && (isCard ? !geo.disableCards : !geo.disableMobileMoney);
  const canPay = emailOk && methodOk && phoneOk && items.length > 0 && !busy;

  const onPay = async () => {
    if (!canPay || !selectedTile) return;
    setBusy(true);
    setError(null);
    setStage('awaiting');
    setStatusNote(
      isCard ? 'Opening secure payment page…' : 'Sending a payment prompt to your phone…',
    );
    try {
      const { refid, paymentUrl } = await initiateMultiAlbumPurchase({
        items,
        viewerEmail: email.trim().toLowerCase(),
        paymentMethod: isCard ? 'CARD' : 'MOBILE_MONEY',
        phone: isCard ? undefined : formatPhoneE164(phone, country),
        telecomProvider: isCard ? undefined : selectedTile.provider,
        country,
        redirectUrl: isCard ? 'https://connekyt.com' : undefined,
      });
      if (!refid) throw new Error('Could not start the payment. Please try again.');

      if (paymentUrl) {
        await WebBrowser.openBrowserAsync(paymentUrl).catch(() => {});
      }

      setStatusNote('Confirming with the payment gateway…');
      const graceMs = isCard ? CARD_GRACE_MS : 0;
      const startedAt = Date.now();
      let settled: 'success' | 'pending' | 'failed' = 'pending';
      for (let i = 0; i < 90 && settled === 'pending'; i++) {
        await sleep(2500);
        const s = await getPublicPaymentStatus(refid).catch(() => 'pending' as const);
        if (s === 'success') {
          settled = 'success';
          break;
        }
        if (s === 'failed') {
          // Card grace: XentriPay reports FAILED on a fresh, not-yet-paid
          // card session — keep polling until the buyer has had time to
          // complete the gateway page.
          if (Date.now() - startedAt < graceMs) continue;
          settled = 'failed';
          break;
        }
      }

      if (settled !== 'success') {
        setStage('failed');
        setError(
          settled === 'failed'
            ? 'The payment was declined or timed out. If you were charged you will be refunded automatically.'
            : 'The payment is still pending. If you were charged, recover it from the recover page.',
        );
        return;
      }

      const rec = await recordAlbumPurchase(refid).catch(() => ({ unlockCode: undefined }));
      setStage('success');
      setStatusNote('Payment received. Preparing your downloads…');
      onSuccess(refid, rec.unlockCode ?? null);
    } catch (e) {
      setStage('failed');
      setError(e instanceof Error ? e.message : 'Could not complete the purchase.');
    } finally {
      setBusy(false);
    }
  };

  const retry = () => {
    setStage('form');
    setError(null);
    setStatusNote('');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <Pressable style={styles.backdrop} onPress={() => !busy && onClose()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={styles.sheetContainer}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Text style={styles.title}>Checkout</Text>
            <Pressable onPress={() => !busy && onClose()} hitSlop={8}>
              <Ionicons name="close" size={22} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Amount summary */}
            <View style={styles.summary}>
              <Text style={styles.summaryLabel}>AMOUNT TO PAY</Text>
              <Text style={styles.summaryAmount}>
                {currencySym}
                {total.toFixed(2)}
              </Text>
              <Text style={styles.summarySub}>
                {photoCount} photo{photoCount === 1 ? '' : 's'} from {photographerCount} photographer
                {photographerCount === 1 ? '' : 's'}
              </Text>
            </View>

            {stage === 'form' ? (
              <>
                {/* Region hard-block (blocking line) */}
                {geo.blocked ? (
                  <View style={[styles.notice, styles.noticeError]}>
                    <Ionicons name="alert-circle" size={16} color="#FCA5A5" />
                    <Text style={styles.noticeErrorText}>
                      {geo.message || 'Payments are not available in your region.'}
                      {geo.country ? `\nDetected location: ${geo.country}` : ''}
                    </Text>
                  </View>
                ) : null}

                {/* Mobile-money category disable (blocking line) */}
                {!geo.blocked && geo.disableMobileMoney ? (
                  <View style={[styles.notice, styles.noticeWarn]}>
                    <Ionicons name="warning" size={16} color="#FBBF24" />
                    <Text style={styles.noticeWarnText}>
                      Mobile money is unavailable in your region. Please use card payment.
                    </Text>
                  </View>
                ) : null}

                {/* Email */}
                <Text style={styles.section}>Email address</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
                <Text style={styles.helper}>
                  We&apos;ll email your receipt and an unlock code to re-download anytime.
                </Text>

                {/* Method tiles */}
                <Text style={styles.section}>Select payment method</Text>
                <View style={styles.methods}>
                  {tiles.map((t) => {
                    const active = t.id === method;
                    const disabled =
                      geo.blocked || (!t.isCard && geo.disableMobileMoney) || (t.isCard && geo.disableCards);
                    return (
                      <Pressable
                        key={t.id}
                        style={[
                          styles.method,
                          active && styles.methodActive,
                          disabled && styles.methodDisabled,
                        ]}
                        onPress={() => !disabled && setMethod(t.id)}
                        disabled={disabled}
                      >
                        {active ? (
                          <View style={styles.methodCheck}>
                            <Ionicons name="checkmark" size={11} color="#fff" />
                          </View>
                        ) : null}
                        <Ionicons
                          name={t.isCard ? 'card' : 'phone-portrait'}
                          size={22}
                          color={active ? '#fff' : 'rgba(255,255,255,0.6)'}
                        />
                        <Text
                          style={[styles.methodLabel, active && styles.methodLabelActive]}
                          numberOfLines={2}
                        >
                          {t.name}
                        </Text>
                        {disabled ? <Text style={styles.methodUnavailable}>Unavailable</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>

                {/* Phone (mobile money) or card note */}
                {selectedTile && !isCard ? (
                  <>
                    <Text style={styles.section}>Phone number</Text>
                    <TextInput
                      value={phone}
                      onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, '').slice(0, 12))}
                      placeholder={phoneHintForCountry(country)}
                      placeholderTextColor="rgba(255,255,255,0.4)"
                      keyboardType="phone-pad"
                      style={styles.input}
                    />
                    <Text style={styles.helper}>You&apos;ll receive a payment prompt on this number.</Text>
                  </>
                ) : null}

                {isCard ? (
                  <View style={[styles.notice, styles.noticeInfo]}>
                    <Ionicons name="information-circle" size={16} color="#93C5FD" />
                    <Text style={styles.noticeInfoText}>
                      You&apos;ll be redirected to a secure page to enter your card details.
                    </Text>
                  </View>
                ) : null}

                {error ? <Text style={styles.formError}>{error}</Text> : null}

                {/* Pay button — the valid blocking line */}
                {!geo.blocked ? (
                  <Pressable
                    style={[styles.payBtn, !canPay && styles.payBtnDisabled]}
                    onPress={onPay}
                    disabled={!canPay}
                  >
                    <Ionicons
                      name={!canPay ? 'lock-closed' : isCard ? 'card' : 'phone-portrait'}
                      size={16}
                      color={!canPay ? 'rgba(255,255,255,0.5)' : '#fff'}
                    />
                    <Text style={[styles.payBtnText, !canPay && styles.payBtnTextDisabled]}>
                      {isCard ? 'Proceed to pay' : 'Pay'} · {currencySym}
                      {total.toFixed(2)}
                    </Text>
                  </Pressable>
                ) : null}

                <Text style={styles.footNote}>
                  Payments are processed by XentriPay. We never see your full card details.
                </Text>
              </>
            ) : (
              <View style={styles.statusWrap}>
                {stage === 'awaiting' ? (
                  <ActivityIndicator size="large" color="#F20C8F" />
                ) : (
                  <Ionicons
                    name={stage === 'success' ? 'checkmark-circle' : 'close-circle'}
                    size={64}
                    color={stage === 'success' ? '#10B981' : '#F87171'}
                  />
                )}
                <Text style={styles.statusTitle}>
                  {stage === 'awaiting'
                    ? isCard
                      ? 'Complete payment'
                      : 'Payment initiated'
                    : stage === 'success'
                      ? 'Payment successful'
                      : 'Payment failed'}
                </Text>
                <Text style={styles.statusNote}>{error || statusNote}</Text>
                {stage === 'failed' ? (
                  <View style={styles.statusActions}>
                    <Pressable style={[styles.payBtn, { flex: 1 }]} onPress={retry}>
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <Text style={styles.payBtnText}>Try again</Text>
                    </Pressable>
                    <Pressable style={styles.ghostBtn} onPress={onClose}>
                      <Text style={styles.ghostBtnText}>Close</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0B2A57',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '92%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },

  body: { paddingBottom: 16, gap: 12 },

  summary: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
    gap: 2,
  },
  summaryLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  summaryAmount: { color: '#fff', fontSize: 28, fontWeight: '800' },
  summarySub: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  section: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700', marginTop: 4 },

  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  helper: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17 },

  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  method: {
    width: '31%',
    minWidth: 92,
    flexGrow: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  methodActive: { borderColor: '#F20C8F', backgroundColor: 'rgba(242,12,143,0.12)' },
  methodDisabled: { opacity: 0.4 },
  methodCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F20C8F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  methodLabelActive: { color: '#fff', fontWeight: '700' },
  methodUnavailable: { color: '#F87171', fontSize: 9, fontWeight: '700' },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  noticeError: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(248,113,113,0.4)' },
  noticeErrorText: { flex: 1, color: '#FCA5A5', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  noticeWarn: { backgroundColor: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.4)' },
  noticeWarnText: { flex: 1, color: '#FDE68A', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  noticeInfo: { backgroundColor: 'rgba(59,130,246,0.12)', borderColor: 'rgba(147,197,253,0.4)' },
  noticeInfoText: { flex: 1, color: '#BFDBFE', fontSize: 12.5, fontWeight: '600', lineHeight: 18 },

  formError: { color: '#FCA5A5', fontSize: 13, fontWeight: '600' },

  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F20C8F',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 4,
  },
  payBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.10)' },
  payBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  payBtnTextDisabled: { color: 'rgba(255,255,255,0.5)' },

  footNote: { textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 2 },

  statusWrap: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  statusTitle: { color: '#fff', fontSize: 19, fontWeight: '800' },
  statusNote: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  statusActions: { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  ghostBtn: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: 'rgba(255,255,255,0.85)', fontWeight: '700', fontSize: 15 },
});
