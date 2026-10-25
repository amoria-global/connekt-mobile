/**
 * Public donation flow (guest, in-app).
 *
 * Provides a native in-app donation experience with Mobile Money & Card:
 *   1. Event / Creator Cause Header (100% of proceeds reach the creator).
 *   2. Suggested & Custom Donation Tiers (GET /public/donation-tiers).
 *   3. Donor information (Name, Email for receipt, optional supportive message).
 *   4. Multi-country Mobile Money & Card selection.
 *   5. Seamless USSD push prompt and gateway polling (GET /public/payments/xentripay/status/{refid}).
 *   6. Celebration receipt with instant feedback.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
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
  createPublicDonation,
  getDonationTiers,
  initiatePublicDonationPayment,
  type InitiatePublicDonationPayload,
} from '@/features/donations/api';
import { pollStatus } from '@/features/payments/nativeCheckout';
import { getPublicPaymentStatus } from '@/features/photos/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError, useAuth } from '@/store/auth';
import { useCurrency } from '@/store/currency';
import { PaymentMethodPicker } from '@/features/payments/PaymentMethodPicker';
import { usePaymentEligibility } from '@/features/payments/usePaymentEligibility';
import { listCurrencies } from '@/features/reference/api';
import {
  dialCodeFor,
  formatPhoneE164,
  isPlausibleMobile,
  phoneHintForCountry,
} from '@/features/payments/formatPhone';
import { flagEmoji } from '@/components/ui/PhoneInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme, onFill } from '@/theme';

import { useLanguage } from '@/hooks/useLanguage';
import { translate, type TranslationKey } from '@/i18n/translations';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { glassTile } from '@/components/ui/GlassCard';
const tr = (k: TranslationKey) => translate(useLanguage.getState().language, k);

type Stage = 'form' | 'awaiting' | 'success' | 'unconfirmed';

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

const COUNTRY_TO_CURRENCY_CODE: Record<string, string> = {
  RW: 'RWF',
  KE: 'KES',
  UG: 'UGX',
  TZ: 'TZS',
  GH: 'GHS',
  NG: 'NGN',
  ZM: 'ZMW',
  MW: 'MWK',
  CI: 'XOF',
  SN: 'XOF',
  BJ: 'XOF',
  BF: 'XOF',
  CM: 'XAF',
  CG: 'XAF',
  GA: 'XAF',
  CD: 'CDF',
  ET: 'ETB',
  MZ: 'MZN',
  SL: 'SLE',
};

export default function PublicDonateScreen() {
  useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { eventId } = useLocalSearchParams<{ eventId?: string }>();

  // Fetch event details if an eventId was provided
  const event = useAsync(
    useCallback(async () => {
      if (!eventId) return null;
      return getPublicEventDetailed(eventId);
    }, [eventId]),
  );

  // Currency Selection
  // Starts on the currency the user already chose for the app; the list below comes from the backend, and if that
  // currency is not in it the first listed one is used. No currency is assumed here.
  const preferredCurrency = useCurrency((s) => s.currency);
  const [chosenCurrency, setChosenCurrency] = useState<string>(preferredCurrency);
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  const currenciesAsync = useAsync(useCallback(() => listCurrencies(), []));
  const availableCurrencies = useMemo(() => currenciesAsync.data ?? [], [currenciesAsync.data]);
  // The chosen currency if the backend lists it, otherwise the first listed one (derived, so no effect has to correct it).
  const currencyCode =
    availableCurrencies.length > 0 && !availableCurrencies.some((c) => c.code.toUpperCase() === chosenCurrency.toUpperCase())
      ? availableCurrencies[0].code
      : chosenCurrency;

  const tiersAsync = useAsync(
    useCallback(() => getDonationTiers(currencyCode), [currencyCode]),
  );

  // Preset amounts are the backend's tiers for the active currency. With none, there are no presets and the donor types an amount.
  const presetAmounts = useMemo(() => {
    if (tiersAsync.data && tiersAsync.data.length > 0) {
      return tiersAsync.data.slice(0, 4).map((t) => t.amount);
    }
    return [];
  }, [currencyCode, tiersAsync.data]);

  // Selected amount & custom amount
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [isCustom, setIsCustom] = useState(false);
  const [amountInputText, setAmountInputText] = useState('');
  const [isAmountFocused, setIsAmountFocused] = useState(false);
  const amountInputRef = useRef<TextInput>(null);

  const currenciesUnavailable = !currenciesAsync.loading && availableCurrencies.length === 0;

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return availableCurrencies;
    return availableCurrencies.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.symbol && c.symbol.toLowerCase().includes(q)),
    );
  }, [availableCurrencies, currencySearch]);

  const onSelectCurrency = (code: string) => {
    setChosenCurrency(code);
    setCurrencyModalOpen(false);
    setCurrencySearch('');
    // The new currency's backend tiers arrive in a moment and pick the default amount (see the effect below).
    setSelectedAmount(0);
    setIsCustom(false);
    setAmountInputText('');
  };

  // Whenever dynamic tiers arrive from backend for the selected currency, keep preset aligned if not custom
  useEffect(() => {
    if (!isCustom && tiersAsync.data && tiersAsync.data.length > 0) {
      const liveTiers = tiersAsync.data.slice(0, 4).map((t) => t.amount);
      if (liveTiers.length > 0 && !liveTiers.includes(selectedAmount)) {
        const def = liveTiers[1] || liveTiers[0];
        setSelectedAmount(def);
        setAmountInputText(def.toLocaleString());
      }
    }
  }, [tiersAsync.data, isCustom, selectedAmount]);

  // Donor identity
  const authUser = useAuth((s) => s.user);
  const [donorName, setDonorName] = useState(
    authUser ? [authUser.firstName, authUser.lastName].filter(Boolean).join(' ') : '',
  );
  const [donorEmail, setDonorEmail] = useState(authUser?.email ?? '');
  const [donorMessage, setDonorMessage] = useState('');
  const [showDonorDetails, setShowDonorDetails] = useState(false);

  // Country & Payment Method (Mirrors PhotoCheckoutSheet)
  const eligibility = usePaymentEligibility();
  const { operators, supportsCard } = eligibility;
  const country = eligibility.country ?? '';
  const [countryModalOpen, setCountryModalOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [method, setMethod] = useState<string | null>(null);
  const [phone, setPhone] = useState('');

  // Flow & Polling
  const [stage, setStage] = useState<Stage>('form');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refid, setRefid] = useState<string | null>(null);
  const pollCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      pollCancelRef.current?.();
    };
  }, []);

  // Filtered countries for country modal search
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

  // Method tiles (Same as PhotoCheckoutSheet)
  const tiles: MethodTile[] = useMemo(() => {
    const list: MethodTile[] = operators.map((o) => ({
      id: o.id.toLowerCase(),
      name: o.name,
      provider: o.id,
      isCard: false,
    }));
    if (supportsCard) {
      list.push({ id: 'card', name: 'Credit / Debit Card', provider: 'CARD', isCard: true });
    }
    return list;
  }, [operators, supportsCard]);

  // No silent default: the buyer picks the network (docs/PAYMENTS.md: never guess a provider).
  const selectedTile = tiles.find((t) => t.id === method) ?? null;
  const isCard = selectedTile?.isCard ?? false;
  const isRwanda = country.toUpperCase() === 'RW';

  const selectCountry = (cIso2: string) => {
    setMethod(null);
    void eligibility.changeCountry(cIso2);
    setCountryModalOpen(false);
    setCountrySearch('');
    const mappedCur = COUNTRY_TO_CURRENCY_CODE[cIso2];
    if (mappedCur && mappedCur !== currencyCode) {
      onSelectCurrency(mappedCur);
    }
    setPhone((prev) => {
      let d = prev.replace(/[^0-9]/g, '');
      const dial = dialCodeFor(cIso2);
      if (d.startsWith(dial)) d = d.slice(dial.length);
      if (d.startsWith('0')) d = d.replace(/^0+/, '');
      return d.slice(0, 10);
    });
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

  // Provider-aware placeholder: dynamically changes when user selects a different provider!
  const getProviderPlaceholder = (cIso2: string, providerId?: string) => {
    const c = cIso2.toUpperCase();
    const p = (providerId || '').toUpperCase();
    if (c === 'RW') {
      if (p.includes('AIRTEL')) return '728 123 456';
      return '788 123 456'; // MTN default
    }
    if (c === 'KE') {
      if (p.includes('AIRTEL')) return '733 123 456';
      return '712 345 678'; // Safaricom / M-Pesa
    }
    if (c === 'UG') {
      if (p.includes('AIRTEL')) return '701 234 567';
      return '772 123 456'; // MTN UG
    }
    if (c === 'TZ') {
      if (p.includes('AIRTEL')) return '784 123 456';
      if (p.includes('TIGO')) return '713 123 456';
      return '754 123 456'; // Vodacom M-Pesa
    }
    return phoneHintForCountry(c).replace(/^0/, '');
  };

  const phoneOk = isCard
    ? true
    : isRwanda
      ? /^7\d{8}$/.test(phone.trim())
      : isPlausibleMobile(phone, country);

  const activeAmount = isCustom
    ? parseInt(amountInputText.replace(/[^0-9]/g, ''), 10) || 0
    : selectedAmount;

  const onSelectPreset = (amount: number) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setAmountInputText(amount.toLocaleString());
    Keyboard.dismiss();
  };

  const onSelectCustom = () => {
    setIsCustom(true);
    if (!amountInputText || amountInputText === '0') {
      setAmountInputText(selectedAmount > 0 ? selectedAmount.toLocaleString() : '');
    }
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
  };

  const handleAmountChange = (text: string) => {
    setIsCustom(true);
    const digits = text.replace(/[^0-9]/g, '');
    if (!digits) {
      setAmountInputText('');
      return;
    }
    const val = parseInt(digits, 10);
    if (val > 100_000_000) return;
    setAmountInputText(val.toLocaleString());
    const matched = presetAmounts.includes(val);
    if (matched) {
      setSelectedAmount(val);
      setIsCustom(false);
    }
  };

  const onAmountFocus = () => {
    setIsAmountFocused(true);
    setIsCustom(true);
  };

  const onClearAmount = () => {
    setAmountInputText('');
    setIsCustom(true);
    amountInputRef.current?.focus();
  };

  const onInitiateDonation = async () => {
    if (activeAmount <= 0) {
      setError('Please select or enter a donation amount.');
      return;
    }

    if (!selectedTile) {
      setError('Please select a payment method.');
      return;
    }

    if (!isCard && !phoneOk) {
      setError(
        isRwanda
          ? `${selectedTile.provider === 'AIRTEL' ? 'Airtel' : 'MTN'} numbers must start with 7 and have 9 digits (e.g. ${getProviderPlaceholder(country, selectedTile.provider)}).`
          : `Please enter a valid mobile number for +${dialCodeFor(country)}.`,
      );
      return;
    }

    setError(null);
    setBusy(true);

    try {
      // 1. Create Public Donation Row
      const matchedCur = currenciesAsync.data?.find(
        (c) => c.code.toUpperCase() === currencyCode.toUpperCase(),
      );
      if (!matchedCur) throw { status: 400, message: 'Currencies could not be loaded. Please try again.' };
      const effectiveCurrencyId = matchedCur.id;

      const created = await createPublicDonation({
        amount: activeAmount,
        currencyId: effectiveCurrencyId,
        currencyCode,
        donorName: donorName.trim() || undefined,
        donorEmail: donorEmail.trim() || undefined,
        message: donorMessage.trim() || undefined,
        paymentMethod: isCard ? 'CARD' : 'MOBILE_MONEY',
        eventId,
      });

      if (!created.id) {
        throw new Error('Could not create donation record.');
      }

      // 2. Initiate Payment
      const formattedPhone = isCard ? '' : formatPhoneE164(phone, country);
      const telecom = isCard ? undefined : selectedTile.provider;

      const res = await initiatePublicDonationPayment({
        donationId: String(created.id),
        phone: formattedPhone,
        paymentMethod: isCard ? 'CARD' : 'MOBILE_MONEY',
        telecomProvider: telecom,
        country,
        redirectUrl: 'connekt://donation-callback',
      });

      if (isCard && res.paymentUrl) {
        // Lock the form while the card page is open so a second tap cannot
        // start a second charge; polling settles the result.
        setStage('awaiting');
        if (res.refid) startPolling(res.refid, true);
        await WebBrowser.openAuthSessionAsync(res.paymentUrl, 'connekt://donation-callback');
      } else if (res.refid) {
        setRefid(res.refid);
        setStage('awaiting');
        startPolling(res.refid, isCard);
      } else if (res.status === 'SUCCESS') {
        setStage('success');
      } else {
        throw new Error(res.message || 'Donation payment initiation failed.');
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not process donation. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const startPolling = (txRefid: string, card: boolean) => {
    pollCancelRef.current?.();
    // Shared poller: bounded, and it ends in `unconfirmed` rather than a failure
    // when it runs out of time. The charge may have landed, so that state never
    // offers a retry, which would create a second donation and charge again.
    const poll = pollStatus(() => getPublicPaymentStatus(txRefid), card);
    pollCancelRef.current = poll.cancel;
    void poll.done.then((outcome) => {
      if (outcome === 'success') {
        setStage('success');
      } else if (outcome === 'failed') {
        setError('Payment was declined or cancelled. You have not been charged.');
        setStage('form');
      } else {
        setStage('unconfirmed');
      }
    });
  };

  return (
    <Screen padded={false} edges={[]}>
      {/* Top Bar in head — full-width rounded floating bar matching ExploreEvents & FindMyPhotos */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.topBarPill}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore-events'))}
            hitSlop={12}
            style={({ pressed }) => [styles.topBarBackBtn, pressed && styles.topBarBackBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={tr('b4_goBack')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.topBarPillCenter}>
            <Text style={styles.topBarPillText}>Donate</Text>
          </View>

          <View style={styles.topBarSpacer} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Cause / Event Compact Summary Banner */}
        <View style={styles.compactHero}>
          <View style={styles.compactHeroLeft}>
            <View style={styles.compactHeartCircle}>
              <Ionicons name="heart" size={16} color="#E11D48" />
            </View>
            <View style={styles.compactHeroInfo}>
              <Text style={styles.compactHeroTitle} numberOfLines={2}>
                {event.data?.title ? event.data.title : 'Connekyt Community Cause'}
              </Text>
              <Text style={styles.compactHeroSub} numberOfLines={2}>
                {event.data?.eventOrganizer
                  ? `by ${event.data.eventOrganizer} · 100% reaches the cause`
                  : '100% of proceeds reach the creator'}
              </Text>
            </View>
          </View>
          <View style={styles.zeroFeeBadge}>
            <Text style={styles.zeroFeeBadgeText}>{tr('b4_zeroFeeBadge')}</Text>
          </View>
        </View>

        {stage === 'form' && (
          <View style={styles.formContent}>
            {/* Amount Selection */}
            <View style={styles.amountSection}>
              <View style={styles.amountHeaderRow}>
                <Text style={styles.sectionHeading}>DONATION AMOUNT ({currencyCode})</Text>
                {isCustom && <Text style={styles.customActiveBadge}>{tr('b4_custom')}</Text>}
              </View>

              {/* Big amount input field */}
              <View
                style={[
                  styles.amountInputContainer,
                  isAmountFocused && styles.amountInputContainerFocused,
                ]}
              >
                <Pressable
                  style={styles.currencyPrefixWrap}
                  onPress={() => setCurrencyModalOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Selected currency ${currencyCode}. Tap to change.`}
                >
                  <Text style={styles.currencyPrefixText}>{currencyCode}</Text>
                  <Ionicons name="chevron-down" size={13} color={colors.primary} />
                </Pressable>
                <TextInput
                  ref={amountInputRef}
                  style={styles.amountMainInput}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={amountInputText}
                  onChangeText={handleAmountChange}
                  onFocus={onAmountFocus}
                  onBlur={() => setIsAmountFocused(false)}
                  accessibilityLabel="Donation amount"
                />
                {amountInputText.length > 0 && (
                  <Pressable
                    onPress={onClearAmount}
                    hitSlop={10}
                    style={styles.clearAmountBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Clear amount"
                  >
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              </View>

              {/* Quick-select preset chips row (4 presets + Custom) */}
              <View style={styles.amountChipsRow}>
                {presetAmounts.map((amt) => {
                  const active = !isCustom && selectedAmount === amt;
                  return (
                    <Pressable
                      key={amt}
                      style={[styles.amountChip, active && styles.amountChipActive]}
                      onPress={() => onSelectPreset(amt)}
                      accessibilityRole="button"
                      accessibilityLabel={`${amt.toLocaleString()} ${currencyCode}`}
                    >
                      <Text
                        numberOfLines={1}
                        style={[styles.amountChipText, active && styles.amountChipTextActive]}
                      >
                        {amt.toLocaleString()}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  style={[styles.amountChip, isCustom && styles.amountChipActive]}
                  onPress={onSelectCustom}
                  accessibilityRole="button"
                  accessibilityLabel="Custom donation amount"
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.amountChipText, isCustom && styles.amountChipTextActive]}
                  >
                    {tr('b4_custom')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Payment Method */}
            <View style={styles.paymentSection}>
              <View style={styles.paymentHeader}>
                <Text style={styles.sectionHeading}>{tr('b4_selectPaymentMethodUpper')}</Text>
                <Pressable
                  style={styles.countryPill}
                  onPress={() => setCountryModalOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Change country"
                >
                  <Text style={styles.countryFlag}>{flagEmoji(country)}</Text>
                  <Text style={styles.countryCode}>{country}</Text>
                  <Ionicons name="chevron-down" size={13} color={colors.text} />
                </Pressable>
              </View>

              {/* Mobile Money / Cards, with the networks and their logos */}
              <PaymentMethodPicker
                operators={operators}
                supportsCard={supportsCard}
                selectedId={selectedTile?.id ?? null}
                onSelect={setMethod}
                country={country}
                onCountryChange={selectCountry}
                mobileMoneyState={eligibility.mobileMoney}
                onRetry={eligibility.retry}
                disabled={busy}
              />

              {/* Mobile Money Phone Input with dynamic provider-specific placeholder */}
              {!isCard && selectedTile && (
                <View style={styles.phoneSection}>
                  <Text style={styles.fieldLabel}>
                    MOBILE MONEY NUMBER ({selectedTile.provider}) *
                  </Text>
                  <View style={styles.phoneRow}>
                    <Pressable
                      style={styles.dialBadge}
                      onPress={() => setCountryModalOpen(true)}
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
                      placeholder={getProviderPlaceholder(country, selectedTile.provider)}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="phone-pad"
                      style={[
                        styles.phoneInputField,
                        phone.length > 0 && !phoneOk && styles.inputError,
                      ]}
                    />
                  </View>
                  {phone.length > 0 && !phoneOk && (
                    <Text style={styles.inputErrorText}>
                      {isRwanda
                        ? `${selectedTile.provider === 'AIRTEL' ? 'Airtel' : 'MTN'} numbers must start with 7 and have 9 digits (e.g. ${getProviderPlaceholder(country, selectedTile.provider)}).`
                        : `Please enter a valid mobile number for +${dialCodeFor(country)}.`}
                    </Text>
                  )}
                  <Text style={styles.helperText}>
                    {isRwanda
                      ? `Country code +250 is mandatory. Prompt will be sent to +250 ${phone || getProviderPlaceholder(country, selectedTile.provider)}.`
                      : `Country code +${dialCodeFor(country)} is mandatory. Prompt will be sent to +${dialCodeFor(country)} ${phone || '...'}.`}
                  </Text>
                </View>
              )}

              {/* Card Notice */}
              {isCard && (
                <View style={[styles.notice, styles.noticeInfo]}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.info} />
                  <Text style={styles.noticeInfoText}>
                    {tr('b4_card3dsNotice')}
                  </Text>
                </View>
              )}
            </View>

            {/* Optional Donor Note / Name (Collapsible accordion) */}
            <View style={styles.detailsAccordion}>
              <Pressable
                style={styles.detailsToggleRow}
                onPress={() => setShowDonorDetails((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel="Toggle donor note and details"
              >
                <View style={styles.detailsToggleLeft}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <Text style={styles.detailsToggleText}>
                    {donorName.trim() || donorMessage.trim()
                      ? 'Name & Message added'
                      : 'Add name or message (optional)'}
                  </Text>
                </View>
                <Ionicons
                  name={showDonorDetails ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.textMuted}
                />
              </Pressable>

              {showDonorDetails && (
                <View style={styles.detailsExpandBox}>
                  <TextInput
                    style={styles.compactInput}
                    placeholder={tr('b4_donorNamePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={donorName}
                    onChangeText={setDonorName}
                    autoCapitalize="words"
                  />
                  <TextInput
                    style={styles.compactInput}
                    placeholder={tr('b4_donorEmailPlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={donorEmail}
                    onChangeText={setDonorEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                  <TextInput
                    style={[styles.compactInput, styles.compactInputMultiline]}
                    placeholder={tr('b4_donorMessagePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={donorMessage}
                    onChangeText={setDonorMessage}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Button
              title={
                busy
                  ? 'Processing…'
                  : isCard
                    ? `Proceed to Pay · ${currencyCode} ${activeAmount.toLocaleString()}`
                    : `Donate ${currencyCode} ${activeAmount.toLocaleString()}`
              }
              onPress={onInitiateDonation}
              loading={busy}
              disabled={busy || activeAmount <= 0 || (!isCard && !phoneOk)}
            />
          </View>
        )}

        {stage === 'awaiting' && (
          <View style={styles.awaitingCard}>
            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: spacing.md }} />
            <Text style={styles.awaitingTitle}>Check Your Phone</Text>
            <Text style={styles.awaitingSub}>
              A USSD payment prompt of{' '}
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {currencyCode} {activeAmount.toLocaleString()}
              </Text>{' '}
              was sent to +{dialCodeFor(country)} {phone}. Please enter your PIN to complete the donation.
            </Text>

            <View style={styles.countdownBox}>
              <Ionicons name="time-outline" size={16} color={colors.textMuted} />
              <Text style={styles.countdownText}>Waiting for confirmation…</Text>
            </View>
          </View>
        )}

        {stage === 'unconfirmed' && (
          <View style={styles.awaitingCard}>
            <Ionicons name="time-outline" size={40} color={colors.textMuted} style={{ marginVertical: spacing.md }} />
            <Text style={styles.awaitingTitle}>{tr('b4_couldNotConfirmDonationYet')}</Text>
            <Text style={styles.awaitingSub}>
              If you approved the prompt, your donation may still go through. Please check your
              phone before donating again.
            </Text>
            <Button title={tr('b4_back')} variant="outline" onPress={() => router.back()} />
          </View>
        )}

        {stage === 'success' && (
          <View style={styles.successCard}>
            <View style={styles.heartSuccessCircle}>
              <Ionicons name="heart" size={36} color={onFill} />
            </View>
            <Text style={styles.successTitle}>{tr('b4_thankYouTitle')}</Text>
            <Text style={styles.successSub}>
              Your generous contribution of{' '}
              <Text style={{ fontWeight: '700' }}>
                {currencyCode} {activeAmount.toLocaleString()}
              </Text>{' '}
              has been confirmed and directly allocated to the event cause.
            </Text>

            <Button
              title={tr('b4_returnToEvent')}
              onPress={() => {
                if (eventId && router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/explore-events');
                }
              }}
            />
          </View>
        )}
      </ScrollView>

      {/* Country Modal */}
      <Modal
        visible={countryModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCountryModalOpen(false)}
      >
        <GlassScrim style={styles.modalBackdrop} onPress={() => setCountryModalOpen(false)}>
          <GlassSheetHost style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Payment Country</Text>
              <Pressable onPress={() => setCountryModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.pickerSearch}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={countrySearch}
                onChangeText={setCountrySearch}
                placeholder={tr('b4_searchCountryPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.pickerSearchInput}
                autoCorrect={false}
              />
              {countrySearch.length > 0 && (
                <Pressable onPress={() => setCountrySearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {filteredCountries.map((c) => (
                <Pressable
                  key={c.iso2}
                  style={[styles.countryRow, country === c.iso2 && styles.countryRowActive]}
                  onPress={() => selectCountry(c.iso2)}
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

      {/* Currency Selection Modal */}
      <Modal
        visible={currencyModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCurrencyModalOpen(false)}
      >
        <GlassScrim style={styles.modalBackdrop} onPress={() => setCurrencyModalOpen(false)}>
          <GlassSheetHost style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{tr('b4_selectDonationCurrency')}</Text>
              <Pressable onPress={() => setCurrencyModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.pickerSearch}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                value={currencySearch}
                onChangeText={setCurrencySearch}
                placeholder={tr('b4_searchCurrencyPlaceholder')}
                placeholderTextColor={colors.textMuted}
                style={styles.pickerSearchInput}
                autoCorrect={false}
              />
              {currencySearch.length > 0 && (
                <Pressable onPress={() => setCurrencySearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {currenciesUnavailable ? (
                <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                  <Text style={styles.countryRowName}>Currencies could not be loaded.</Text>
                  <Pressable onPress={currenciesAsync.refresh} accessibilityRole="button">
                    <Text style={styles.currencySubCode}>Try again</Text>
                  </Pressable>
                </View>
              ) : null}
              {filteredCurrencies.map((c) => (
                <Pressable
                  key={c.code}
                  style={[styles.countryRow, currencyCode === c.code && styles.countryRowActive]}
                  onPress={() => onSelectCurrency(c.code)}
                >
                  <View style={styles.currencySymbolBadge}>
                    <Text style={styles.currencySymbolBadgeText}>{c.symbol || c.code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.countryRowName}>{c.name}</Text>
                    <Text style={styles.currencySubCode}>{c.code}</Text>
                  </View>
                  {currencyCode === c.code && (
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

const useStyles = makeStyles((c, e) => ({
  // Top bar in head — full-width rounded floating bar matching ExploreEvents & FindMyPhotos
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: c.background,
  },
  topBarPill: {
    width: '100%',
    height: 52,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    ...e(2),
  },
  topBarBackBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarBackBtnPressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
  topBarPillCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarPillText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },
  scroll: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 40,
  },
  compactHero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  compactHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  compactHeartCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactHeroInfo: {
    flex: 1,
  },
  compactHeroTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  compactHeroSub: {
    fontSize: 11,
    color: c.textMuted,
    marginTop: 1,
  },
  zeroFeeBadge: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  zeroFeeBadgeText: {
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    color: c.primary,
    letterSpacing: 0.5,
  },

  formContent: {
    gap: spacing.md,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 0.7,
  },

  // Amount
  amountSection: {
    gap: spacing.sm,
  },
  amountHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customActiveBadge: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    color: c.primary,
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.border,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  amountInputContainerFocused: {
    borderColor: c.primary,
  },
  currencyPrefixWrap: {
    height: '100%',
    paddingHorizontal: spacing.sm + 4,
    backgroundColor: c.tint,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderRightWidth: 1,
    borderRightColor: c.borderSoft,
  },
  currencyPrefixText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  amountMainInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: spacing.md,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  clearAmountBtn: {
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    width: '100%',
  },
  amountChip: {
    flex: 1,
    height: 38,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  amountChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  amountChipText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  amountChipTextActive: {
    color: c.textOnPrimary,
  },

  // Payment
  paymentSection: {
    gap: spacing.xs + 2,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  countryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: c.surface,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  countryFlag: { fontSize: 14 },
  countryCode: { fontSize: 11, fontWeight: fontWeight.bold, color: c.text },
  methods: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
  },
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
  methodActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
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
  methodLabelActive: {
    color: c.primary,
    fontWeight: fontWeight.extrabold,
  },
  phoneSection: {
    gap: 6,
    marginTop: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
    letterSpacing: 0.5,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  dialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  dialFlag: {
    fontSize: 16,
  },
  dialText: {
    color: c.text,
    fontSize: 13.5,
    fontWeight: fontWeight.bold,
  },
  phoneInputField: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    fontSize: fontSize.sm,
    color: c.text,
    borderWidth: 1,
    borderColor: c.border,
  },
  inputError: {
    borderColor: c.error,
  },
  inputErrorText: {
    color: c.error,
    fontSize: 11,
    marginTop: 2,
  },
  helperText: {
    color: c.textMuted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: 4,
  },
  noticeInfo: {
    backgroundColor: c.infoBg,
    borderColor: c.info,
  },
  noticeInfoText: {
    flex: 1,
    color: c.info,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },

  // Accordion details
  detailsAccordion: {
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  detailsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  detailsToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailsToggleText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.textSoft,
  },
  detailsExpandBox: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingTop: spacing.sm,
  },
  compactInput: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    fontSize: fontSize.xs,
    color: c.text,
    backgroundColor: c.background,
  },
  compactInputMultiline: {
    minHeight: 48,
    textAlignVertical: 'top',
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
  heartSuccessCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.error,
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
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  pickerSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    ...glassTile(c),
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    gap: 8,
    marginBottom: spacing.xs,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: c.text,
    paddingVertical: 0,
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
  currencySymbolBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencySymbolBadgeText: {
    fontSize: 14,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  currencySubCode: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 1,
  },
}));
