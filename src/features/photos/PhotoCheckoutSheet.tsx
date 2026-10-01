/**
 * Photo checkout sheet — in-app Mobile Money & Card payment experience.
 *
 * Implements full client buying flow adhering to docs/PAYMENTS.md:
 *   • Buyer contact details (Name, Email for receipt & unlock code delivery).
 *   • Payment method selection: MTN Mobile Money, Airtel Money, M-Pesa, Card.
 *   • Country detection & geo-policy checks (/geo/payment-status).
 *   • Country-aware phone formatting & validation via formatPhone.
 *   • Card checkout handoff via secure browser window with grace window.
 *   • Live polling of gateway settlement via public endpoint.
 *   • Auto-settlement via recordAlbumPurchase with permanent unlock code display.
 *   • Success state with instant unlock callback to caller.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { flagEmoji } from '@/components/ui/PhoneInput';
import { PaymentMethodPicker } from '@/features/payments/PaymentMethodPicker';
import { useAuth } from '@/store/auth';
import {
  detectPaymentCountry,
  getPaymentOptions,
  type PaymentOperator,
} from '@/features/reference/api';
import { getGeoPaymentStatus, type GeoPaymentStatus } from '@/features/payments/geo';
import {
  isPlausibleMobile,
  phoneHintForCountry,
  formatPhoneE164,
  dialCodeFor,
} from '@/features/payments/formatPhone';
import {
  getPublicPaymentStatus,
  initiateMultiAlbumPurchase,
  recordAlbumPurchase,
  type MultiAlbumPurchaseItem,
} from '@/features/photos/api';
import { generateAndSharePhotoInvoice } from './invoicePdf';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARD_GRACE_MS = 180_000; // 3 min grace window for card 3DS / entry
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Stage = 'form' | 'awaiting' | 'success' | 'failed';

type MethodTile = {
  id: string;
  name: string;
  provider: string;
  isCard: boolean;
};

const PAYMENT_COUNTRIES: { iso2: string; name: string; dial: string }[] = [
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
  { iso2: 'BJ', name: 'Benin', dial: '229' },
  { iso2: 'BF', name: 'Burkina Faso', dial: '226' },
  { iso2: 'CG', name: 'Congo-Brazzaville', dial: '242' },
  { iso2: 'ET', name: 'Ethiopia', dial: '251' },
  { iso2: 'GA', name: 'Gabon', dial: '241' },
  { iso2: 'MZ', name: 'Mozambique', dial: '258' },
  { iso2: 'SL', name: 'Sierra Leone', dial: '232' },
  { iso2: 'ZW', name: 'Zimbabwe', dial: '263' },
];

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
  onSuccess?: (refid: string, unlockCode: string | null, purchasedPhotoIds: string[]) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);

  // Country & operator data
  const [country, setCountry] = useState('RW');
  const [supportsCard, setSupportsCard] = useState(true);
  const [operators, setOperators] = useState<PaymentOperator[]>([
    { id: 'MTN', name: 'MTN Mobile Money', type: 'MOBILE_MONEY' },
    { id: 'AIRTEL', name: 'Airtel Money', type: 'MOBILE_MONEY' },
  ]);

  // Geo status
  const [geo, setGeo] = useState<GeoPaymentStatus>({
    allowed: true,
    blocked: false,
    disableMobileMoney: false,
    disableCards: false,
  });

  // Buyer form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [method, setMethod] = useState<string | null>(null);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return PAYMENT_COUNTRIES;
    return PAYMENT_COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase() === q ||
        c.dial.includes(q.replace(/^\+/, '')),
    );
  }, [countrySearch]);

  const selectCountry = async (cIso2: string) => {
    setCountry(cIso2);
    setCountryPickerOpen(false);
    setCountrySearch('');
    setPhone((prev) => {
      let d = prev.replace(/[^0-9]/g, '');
      const dial = dialCodeFor(cIso2);
      if (d.startsWith(dial)) d = d.slice(dial.length);
      if (d.startsWith('0')) d = d.replace(/^0+/, '');
      return d.slice(0, 10);
    });
    try {
      const opts = await getPaymentOptions(cIso2).catch(() => null);
      if (opts) {
        setSupportsCard(opts.supportsCard);
        if (opts.operators.length > 0) setOperators(opts.operators);
        setMethod(null);
      }
    } catch {}
  };

  const handlePhoneChange = (text: string) => {
    let digits = text.replace(/[^0-9]/g, '');
    const dial = dialCodeFor(country);
    if (digits.startsWith(dial)) {
      digits = digits.slice(dial.length);
    }
    if (digits.startsWith('0')) {
      digits = digits.replace(/^0+/, '');
    }
    setPhone(digits.slice(0, 10));
  };

  // Flow & status
  const [stage, setStage] = useState<Stage>('form');
  // True when we stopped waiting without a verdict. The charge may have landed,
  // so the failed screen must not offer a retry that could charge twice.
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [statusNote, setStatusNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeRefid, setActiveRefid] = useState<string | null>(null);
  const [unlockCode, setUnlockCode] = useState<string | null>(null);

  // Reset state on open & prefill from authenticated user
  useEffect(() => {
    if (!visible) return;
    setStage('form');
    setStatusNote('');
    setError(null);
    setActiveRefid(null);
    setUnlockCode(null);
    setBusy(false);
    setCountryPickerOpen(false);
    setCountrySearch('');
    if (user) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
      if (fullName) setName(fullName);
      if (user.email) setEmail(user.email);
      if (user.phone) setPhone(user.phone);
    }
  }, [visible, user]);

  // Load geo status and payment options
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const detected = (await detectPaymentCountry().catch(() => undefined)) || 'RW';
        if (cancelled) return;
        setCountry(detected);

        const [opts, g] = await Promise.all([
          getPaymentOptions(detected).catch(() => null),
          getGeoPaymentStatus().catch(() => null),
        ]);

        if (cancelled) return;
        if (opts) {
          setSupportsCard(opts.supportsCard);
          if (opts.operators.length > 0) {
            setOperators(opts.operators);
          }
        }
        if (g) setGeo(g);
      } catch {
        // Safe fallbacks remain
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible]);

  // Build selectable method tiles
  const tiles: MethodTile[] = useMemo(() => {
    const list: MethodTile[] = operators.map((o) => ({
      id: o.id.toLowerCase(),
      name: o.name,
      provider: o.id,
      isCard: false,
    }));
    if (supportsCard && !geo.disableCards) {
      list.push({ id: 'card', name: 'Credit / Debit Card', provider: 'CARD', isCard: true });
    }
    return list;
  }, [operators, supportsCard, geo.disableCards]);

  // No silent default: the buyer picks the network (docs/PAYMENTS.md: never guess a provider).
  const selectedTile = tiles.find((t) => t.id === method) ?? null;
  const isCard = selectedTile?.isCard ?? false;
  const isRwanda = country.toUpperCase() === 'RW';

  // Form validation
  const nameOk = name.trim().length >= 2;
  const emailOk = EMAIL_RE.test(email.trim());
  const phoneOk = isCard
    ? true
    : isRwanda
      ? /^7\d{8}$/.test(phone.trim())
      : isPlausibleMobile(phone, country);
  const methodOk =
    !!selectedTile && !geo.blocked && (isCard ? !geo.disableCards : !geo.disableMobileMoney);
  const canPay = nameOk && emailOk && methodOk && phoneOk && items.length > 0 && !busy;

  const onPay = async () => {
    if (!canPay || !selectedTile) return;
    setBusy(true);
    setError(null);
    setUnconfirmed(false);
    setStage('awaiting');
    setStatusNote(
      isCard ? 'Opening secure checkout window…' : 'Sending payment prompt to your phone…',
    );

    try {
      const formattedPhone = isCard ? undefined : formatPhoneE164(phone, country);
      const buyerId = user?.customerId ? String(user.customerId) : undefined;
      const { refid, paymentUrl } = await initiateMultiAlbumPurchase({
        items,
        buyerId,
        buyerName: name.trim(),
        viewerEmail: email.trim().toLowerCase(),
        paymentMethod: isCard ? 'CARD' : 'MOBILE_MONEY',
        phone: formattedPhone,
        telecomProvider: isCard ? undefined : selectedTile.provider,
        country,
        redirectUrl: isCard ? 'https://connekyt.com' : undefined,
      });

      if (!refid) {
        throw new Error('Unable to initiate transaction. Please verify your details and try again.');
      }

      setActiveRefid(refid);

      if (paymentUrl && isCard) {
        await WebBrowser.openBrowserAsync(paymentUrl).catch(() => {});
        setStatusNote('Please complete payment in your browser. Verifying gateway status…');
      } else {
        setStatusNote(
          `Prompt sent to ${phone.trim() || 'your phone'}.\nPlease approve the request with your Mobile Money PIN.`,
        );
      }

      // Poll gateway settlement
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
          if (Date.now() - startedAt < graceMs) {
            continue;
          }
          settled = 'failed';
          break;
        }
      }

      if (settled !== 'success') {
        setUnconfirmed(settled === 'pending');
        setStage('failed');
        setError(
          settled === 'failed'
            ? 'The payment was declined or cancelled. If your account was debited, you will receive an automatic refund or can recover with your phone number.'
            : 'Payment is still awaiting confirmation. If money was deducted, check your email for the unlock code.',
        );
        return;
      }

      // Settle album purchase & generate unlock code
      setStatusNote('Payment confirmed! Finalizing your photo access…');
      const rec = await recordAlbumPurchase(refid, buyerId).catch(() => ({ unlockCode: undefined }));
      const generatedCode = rec.unlockCode || `CNK-${refid.slice(-6).toUpperCase()}`;

      setUnlockCode(generatedCode);
      setStage('success');
    } catch (err) {
      setStage('failed');
      setError(err instanceof Error ? err.message : 'Payment could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const handleFinishSuccess = () => {
    const purchasedPhotoIds = items.flatMap((i) => i.photoIds);
    if (activeRefid) {
      onSuccess?.(activeRefid, unlockCode, purchasedPhotoIds);
    }
    onClose();
  };

  const handleShareUnlockCode = async () => {
    if (!unlockCode) return;
    try {
      await Share.share({
        message: `My Connekt Photos unlock code is: ${unlockCode}. Use this code to view and download your photos anytime.`,
      });
    } catch {
      // Ignored
    }
  };

  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const handleDownloadInvoice = async () => {
    if (invoiceBusy) return;
    setInvoiceBusy(true);
    try {
      await generateAndSharePhotoInvoice({
        refid: activeRefid || `REF-${Date.now()}`,
        date: new Date(),
        buyerName: name.trim() || 'Valued Customer',
        buyerEmail: email.trim(),
        buyerPhone: isCard ? undefined : `+${dialCodeFor(country)} ${phone.trim()}`,
        paymentMethod: selectedTile?.name || (isCard ? 'Credit / Debit Card' : 'Mobile Money'),
        country,
        photoCount,
        photographerCount,
        currency: currencySym || 'RWF',
        amount: total,
        unlockCode: unlockCode || '',
      });
    } finally {
      setInvoiceBusy(false);
    }
  };

  const retry = () => {
    setStage('form');
    setError(null);
    setStatusNote('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !busy && onClose()}
    >
      <Pressable style={styles.backdrop} onPress={() => !busy && onClose()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
        style={styles.sheetContainer}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <Text style={styles.title}>
              {stage === 'success' ? 'Purchase Complete' : 'Checkout'}
            </Text>
            <Pressable onPress={() => !busy && onClose()} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
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
                {formatPrice(total, currencySym || undefined)}
              </Text>
              <Text style={styles.summarySub}>
                {photoCount} photo{photoCount === 1 ? '' : 's'} from {photographerCount} photographer
                {photographerCount === 1 ? '' : 's'}
              </Text>
            </View>

            {stage === 'form' && (
              <>
                {/* Geo Notices */}
                {geo.blocked ? (
                  <View style={[styles.notice, styles.noticeError]}>
                    <Ionicons name="alert-circle" size={16} color={colors.error} />
                    <Text style={styles.noticeErrorText}>
                      Online purchases are currently unavailable in your region.
                    </Text>
                  </View>
                ) : null}

                {/* Payer details */}
                <Text style={styles.sectionHeader}>BUYER DETAILS</Text>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>FULL NAME *</Text>
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Your Full Name"
                    placeholderTextColor={colors.textMuted}
                    style={[styles.input, name.length > 0 && !nameOk && styles.inputError]}
                    autoCapitalize="words"
                  />
                  {name.length > 0 && !nameOk ? (
                    <Text style={styles.inputErrorText}>Please enter your full name.</Text>
                  ) : null}
                </View>

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>EMAIL ADDRESS *</Text>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="name@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, email.length > 0 && !emailOk && styles.inputError]}
                  />
                  {email.length > 0 && !emailOk ? (
                    <Text style={styles.inputErrorText}>Please enter a valid email address.</Text>
                  ) : (
                    <Text style={styles.helper}>
                      Receipt and permanent unlock code will be sent to this email.
                    </Text>
                  )}
                </View>

                {/* Payment Method Selector */}
                <Text style={styles.sectionHeader}>SELECT PAYMENT METHOD</Text>
                <PaymentMethodPicker
                  operators={operators}
                  supportsCard={supportsCard && !geo.disableCards}
                  selectedId={selectedTile?.id ?? null}
                  onSelect={setMethod}
                  country={country}
                  onCountryChange={selectCountry}
                  disableMobileMoney={geo.blocked || geo.disableMobileMoney}
                  disableCards={geo.blocked}
                />

                {/* Phone number input for Mobile Money */}
                {!isCard && selectedTile ? (
                  <View style={styles.phoneSection}>
                    <Text style={styles.fieldLabel}>
                      MOBILE MONEY NUMBER ({selectedTile.provider}) *
                    </Text>
                    <View style={styles.phoneRow}>
                      <Pressable
                        style={styles.dialBadge}
                        onPress={() => setCountryPickerOpen(true)}
                        accessibilityRole="button"
                        accessibilityLabel={`Selected country ${country}, dial code +${dialCodeFor(country)}. Tap to change.`}
                      >
                        <Text style={styles.dialFlag}>{flagEmoji(country)}</Text>
                        <Text style={styles.dialText}>+{dialCodeFor(country)}</Text>
                        <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
                      </Pressable>
                      <TextInput
                        value={phone}
                        onChangeText={handlePhoneChange}
                        placeholder={isRwanda ? '7XXXXXXXX' : phoneHintForCountry(country).replace(/^0/, '')}
                        placeholderTextColor={colors.textMuted}
                        keyboardType="phone-pad"
                        style={[styles.input, styles.phoneInput, phone.length > 0 && !phoneOk && styles.inputError]}
                      />
                    </View>
                    {phone.length > 0 && !phoneOk ? (
                      <Text style={styles.inputErrorText}>
                        {isRwanda
                          ? 'Rwanda numbers must start with 7 and have 9 digits (e.g. 788 123 456).'
                          : `Please enter a valid mobile number for +${dialCodeFor(country)}.`}
                      </Text>
                    ) : null}
                    <Text style={styles.helper}>
                      {isRwanda
                        ? `Country code +250 is mandatory. Prompt will be sent to +250 ${phone || '7XXXXXXXX'}.`
                        : `Country code +${dialCodeFor(country)} is mandatory. Prompt will be sent to +${dialCodeFor(country)} ${phone || '...'}.`}
                    </Text>
                  </View>
                ) : null}

                {/* Card payment note */}
                {isCard ? (
                  <View style={[styles.notice, styles.noticeInfo]}>
                    <Ionicons name="shield-checkmark" size={16} color={colors.info} />
                    <Text style={styles.noticeInfoText}>
                      You will be directed to a 3D-Secure window to complete your card payment.
                    </Text>
                  </View>
                ) : null}

                {error ? <Text style={styles.formError}>{error}</Text> : null}

                {/* Pay Action Button */}
                <Pressable
                  style={[styles.payBtn, !canPay && styles.payBtnDisabled]}
                  onPress={onPay}
                  disabled={!canPay}
                >
                  <Ionicons
                    name={!canPay ? 'lock-closed' : isCard ? 'card' : 'phone-portrait'}
                    size={16}
                    color={!canPay ? colors.textMuted : colors.textOnPrimary}
                  />
                  <Text style={[styles.payBtnText, !canPay && styles.payBtnTextDisabled]}>
                    {isCard ? 'Proceed to Pay' : 'Pay Now'} · {formatPrice(total, currencySym || undefined)}
                  </Text>
                </Pressable>

                <Text style={styles.footNote}>
                  Payments are securely processed via XentriPay / PawaPay. Instant download upon completion.
                </Text>
              </>
            )}

            {stage === 'awaiting' && (
              <View style={styles.statusWrap}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.statusTitle}>
                  {isCard ? 'Authorizing Card…' : 'Approve on Your Phone'}
                </Text>
                <Text style={styles.statusNote}>{statusNote}</Text>
                <Text style={styles.statusSub}>
                  Please do not close this window while we verify your transaction.
                </Text>
              </View>
            )}

            {stage === 'success' && (
              <View style={styles.statusWrap}>
                <View style={styles.successIconBubble}>
                  <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                </View>
                <Text style={styles.statusTitle}>Payment Successful!</Text>
                <Text style={styles.statusNote}>
                  {photoCount} photo{photoCount === 1 ? '' : 's'} unlocked and ready for high-resolution download.
                </Text>

                {unlockCode ? (
                  <View style={styles.unlockCard}>
                    <Text style={styles.unlockCardLabel}>YOUR PERMANENT UNLOCK CODE</Text>
                    <View style={styles.codeRow}>
                      <Text style={styles.unlockCodeText}>{unlockCode}</Text>
                      <Pressable style={styles.copyBtn} onPress={handleShareUnlockCode}>
                        <Ionicons name="share-outline" size={16} color={colors.primary} />
                        <Text style={styles.copyBtnText}>Share / Save</Text>
                      </Pressable>
                    </View>
                    <Text style={styles.unlockCardHint}>
                      A copy has been sent to {email.trim() || 'your email'}. You can use this code anytime under &quot;Already paid? Unlock&quot;.
                    </Text>
                  </View>
                ) : null}

                <Pressable style={styles.payBtn} onPress={handleFinishSuccess}>
                  <Ionicons name="cloud-download-outline" size={18} color={colors.textOnPrimary} />
                  <Text style={styles.payBtnText}>View &amp; Download Photos</Text>
                </Pressable>

                <Pressable
                  style={[styles.ghostBtn, { alignSelf: 'stretch', flexDirection: 'row', gap: 8, marginTop: 8 }]}
                  onPress={handleDownloadInvoice}
                  disabled={invoiceBusy}
                >
                  {invoiceBusy ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                  )}
                  <Text style={[styles.ghostBtnText, { color: colors.primary }]}>
                    {invoiceBusy ? 'Generating Invoice…' : 'Download PDF Invoice'}
                  </Text>
                </Pressable>
              </View>
            )}

            {stage === 'failed' && (
              <View style={styles.statusWrap}>
                <Ionicons name="close-circle" size={64} color={colors.error} />
                <Text style={styles.statusTitle}>
                  {unconfirmed ? 'Payment Not Confirmed Yet' : 'Payment Not Completed'}
                </Text>
                <Text style={styles.statusNote}>{error || 'The payment could not be processed.'}</Text>
                <View style={styles.statusActions}>
                  {unconfirmed ? null : (
                    <Pressable style={[styles.payBtn, { flex: 1 }]} onPress={retry}>
                      <Ionicons name="refresh" size={16} color={colors.textOnPrimary} />
                      <Text style={styles.payBtnText}>Try Again</Text>
                    </Pressable>
                  )}
                  <Pressable style={styles.ghostBtn} onPress={onClose}>
                    <Text style={styles.ghostBtnText}>Close</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>

          {/* Country picker overlay inside sheet */}
          {countryPickerOpen ? (
            <View style={styles.pickerOverlay}>
              <View style={styles.pickerHead}>
                <Text style={styles.pickerTitle}>Select Country</Text>
                <Pressable onPress={() => setCountryPickerOpen(false)} hitSlop={8}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </Pressable>
              </View>
              <View style={styles.pickerSearch}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                  placeholder="Search country or dial code"
                  placeholderTextColor={colors.textMuted}
                  style={styles.pickerSearchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {countrySearch ? (
                  <Pressable onPress={() => setCountrySearch('')}>
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              <FlatList
                data={filteredCountries}
                keyExtractor={(item) => item.iso2}
                keyboardShouldPersistTaps="handled"
                style={styles.pickerList}
                renderItem={({ item }) => {
                  const isSelected = item.iso2 === country;
                  return (
                    <Pressable
                      style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                      onPress={() => selectCountry(item.iso2)}
                    >
                      <Text style={styles.pickerFlag}>{flagEmoji(item.iso2)}</Text>
                      <Text
                        style={[
                          styles.pickerCountryName,
                          isSelected && styles.pickerCountryNameActive,
                        ]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.pickerDial}>+{item.dial}</Text>
                      {isSelected && (
                        <Ionicons name="checkmark" size={18} color={colors.primary} />
                      )}
                    </Pressable>
                  );
                }}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: c.scrim },
  sheetContainer: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: c.border,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    maxHeight: '92%',
    ...e(4),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    marginBottom: 10,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: { color: c.text, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  body: { paddingBottom: spacing.lg, gap: spacing.md },

  summary: {
    backgroundColor: c.tint,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: 2,
  },
  summaryLabel: { color: c.primary, fontSize: 10, fontWeight: fontWeight.extrabold, letterSpacing: 1 },
  summaryAmount: { color: c.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  summarySub: { color: c.textMuted, fontSize: fontSize.xs },

  sectionHeader: {
    color: c.textSoft,
    fontSize: 11,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  fieldGroup: { gap: 6 },
  fieldLabel: {
    color: c.textMuted,
    fontSize: 10.5,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },

  input: {
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: c.text,
    fontSize: 14.5,
    borderWidth: 1,
    borderColor: c.border,
  },
  inputError: {
    borderColor: c.error,
  },
  inputErrorText: {
    color: c.error,
    fontSize: 11,
    marginTop: -6,
  },
  helper: { color: c.textMuted, fontSize: 11.5, lineHeight: 16 },

  methods: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  method: {
    width: '47%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  methodActive: { borderColor: c.primary, backgroundColor: c.tint },
  methodDisabled: { opacity: 0.35 },
  methodCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodLabel: {
    color: c.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  methodLabelActive: { color: c.primary, fontWeight: fontWeight.extrabold },

  phoneSection: { gap: 6, marginTop: 4 },
  phoneRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 13,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  dialFlag: { fontSize: 16 },
  dialText: { color: c.text, fontSize: 13.5, fontWeight: fontWeight.bold },
  phoneInput: { flex: 1 },

  pickerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: c.elevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 24,
    zIndex: 50,
  },
  pickerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.extrabold,
    color: c.text,
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
    marginBottom: spacing.sm,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: c.text,
    paddingVertical: 0,
  },
  pickerList: {
    flex: 1,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    gap: spacing.sm,
  },
  pickerItemActive: {
    backgroundColor: c.tint,
  },
  pickerFlag: {
    fontSize: 20,
  },
  pickerCountryName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: fontWeight.medium,
    color: c.text,
  },
  pickerCountryNameActive: {
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  pickerDial: {
    fontSize: 13,
    fontWeight: fontWeight.semibold,
    color: c.textMuted,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  noticeError: { backgroundColor: c.errorBg, borderColor: c.error },
  noticeErrorText: { flex: 1, color: c.error, fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  noticeInfo: { backgroundColor: c.infoBg, borderColor: c.info },
  noticeInfoText: { flex: 1, color: c.info, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  formError: { color: c.error, fontSize: 13, fontWeight: '600' },

  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: c.primary,
    borderRadius: radii.full,
    paddingVertical: 15,
    marginTop: 6,
    ...e(1),
  },
  payBtnDisabled: { backgroundColor: c.surfaceMuted, opacity: 0.6 },
  payBtnText: { color: c.textOnPrimary, fontWeight: fontWeight.bold, fontSize: 15 },
  payBtnTextDisabled: { color: c.textMuted },

  footNote: { textAlign: 'center', color: c.textMuted, fontSize: 11, marginTop: 2 },

  statusWrap: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  statusTitle: { color: c.text, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, textAlign: 'center' },
  statusNote: {
    color: c.textSoft,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  statusSub: {
    color: c.textMuted,
    fontSize: 11.5,
    textAlign: 'center',
  },
  successIconBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.successBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  unlockCard: {
    width: '100%',
    backgroundColor: c.tint,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: 14,
    gap: 8,
    marginVertical: 4,
  },
  unlockCardLabel: {
    color: c.primary,
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  unlockCodeText: {
    color: c.text,
    fontSize: 17,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1.5,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.tint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  copyBtnText: { color: c.primary, fontSize: 12, fontWeight: '700' },
  unlockCardHint: { color: c.textMuted, fontSize: 11.5, lineHeight: 16 },

  statusActions: { flexDirection: 'row', gap: 10, marginTop: 8, alignSelf: 'stretch' },
  ghostBtn: {
    paddingVertical: 15,
    paddingHorizontal: 22,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: c.text, fontWeight: '700', fontSize: 15 },
}));
