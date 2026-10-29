/**
 * Withdraw: the web dashboard's WithdrawModal flow on mobile, on the same
 * endpoints (see features/withdrawals/model for the contract).
 *
 *   form     source, amount (RWF or USD, sent as USD), payout account and
 *            the optional donation the web asks about
 *   verify   fee summary, then the OTP and/or selfie the backend asked for
 *   done     the request is PENDING_APPROVAL; an admin approval pays it out
 *   failed   the backend's reason, with a way into KYC when that is it
 */
import { CurrencyLabel } from '@/features/currency/CurrencyFlag';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useRole } from '@/features/auth/role';
import { listPaymentAccounts } from '@/features/paymentAccounts/api';
import { maskAccountNumber } from '@/features/paymentAccounts/model';
import {
  getDisplayCurrencies,
  initiateWithdrawal,
  listWithdrawableSources,
  resendWithdrawalOtp,
  verifyWithdrawal,
} from '@/features/withdrawals/api';
import {
  amountError,
  displayToUsd,
  donationPresets,
  FALLBACK_CURRENCIES,
  floorTo,
  formatDisplay,
  orderSources,
  parseAmount,
  totalWithdrawable,
  usdToDisplay,
  verificationCopy,
  type Verification,
  type WithdrawSource,
} from '@/features/withdrawals/model';
import { BalanceHero } from '@/features/withdrawals/BalanceHero';
import { useAsync } from '@/hooks/useAsync';
import { ensureWithdrawalFaceConsent } from '@/features/privacy/consent';
import { listWalletMovements, type Movement } from '@/features/wallet/api';
import { takeSelfieDataUrl } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useSharedT } from '@/i18n/sharedStrings';

type Step = 'form' | 'verify' | 'done' | 'failed';
type Donation = { mode: 'unset' } | { mode: 'skip' } | { mode: 'preset'; value: number } | { mode: 'custom'; text: string };

const RESEND_COOLDOWN_S = 30;

export default function WithdrawScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const styles = useStyles();
  const { tr } = useSharedT();
  const router = useRouter();
  const { role } = useRole();

  const sources = useAsync(useCallback(() => listWithdrawableSources(role), [role]));
  const accounts = useAsync(useCallback(() => listPaymentAccounts(role), [role]));
  const currencies = useAsync(useCallback(() => getDisplayCurrencies(), []));
  const movements = useAsync(useCallback(() => listWalletMovements(0, 50), []));

  // Coming back from Payment accounts must show the account just added.
  const refreshAccounts = accounts.refresh;
  useFocusEffect(
    useCallback(() => {
      refreshAccounts();
    }, [refreshAccounts]),
  );

  const [step, setStep] = useState<Step>('form');
  const [sourceKey, setSourceKey] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState('RWF');
  const [amountText, setAmountText] = useState('');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [donation, setDonation] = useState<Donation>({ mode: 'unset' });
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [verification, setVerification] = useState<Verification | null>(null);
  const [otp, setOtp] = useState('');
  const [selfie, setSelfie] = useState<{ uri: string; dataUrl: string } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | undefined>(undefined);
  const [cooldown, setCooldown] = useState(0);

  const [failure, setFailure] = useState<{ message: string; kyc: boolean } | null>(null);

  const currencyList = currencies.data ?? FALLBACK_CURRENCIES;
  const currency = currencyList.find((c) => c.code === currencyCode) ?? currencyList[0];
  // 0 when the backend gave no RWF rate: no donation presets are offered then.
  const rwfRate = currencyList.find((c) => c.code === 'RWF')?.rate ?? 0;

  const sourceList = useMemo(() => orderSources(sources.data ?? []), [sources.data]);
  const allWithdrawable = totalWithdrawable(sourceList);
  const source: WithdrawSource | null =
    sourceList.find((s) => s.source === sourceKey) ?? sourceList[0] ?? null;

  const accountList = accounts.data ?? [];
  const selectedId =
    methodId && accountList.some((m) => m.id === methodId)
      ? methodId
      : (accountList.find((m) => m.isDefault)?.id ?? accountList[0]?.id ?? null);

  const available = source ? floorTo(usdToDisplay(source.availableBalance, currency), currency.decimals) : 0;
  const amountProblem = amountError(amountText, source, currency);
  const typed = parseAmount(amountText);

  const donationDisplay =
    donation.mode === 'preset' ? donation.value : donation.mode === 'custom' ? parseAmount(donation.text) || 0 : 0;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const quickAmounts = useMemo(() => {
    if (!(available > 0)) return [];
    return [
      { label: '25%', value: floorTo(available * 0.25, currency.decimals) },
      { label: '50%', value: floorTo(available * 0.5, currency.decimals) },
      { label: 'Max', value: available },
    ].filter((q) => q.value > 0);
  }, [available, currency.decimals]);

  // Activity feed state & pagination
  const [activityFilter, setActivityFilter] = useState<'all' | 'withdrawals' | 'credits'>('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 5;

  useEffect(() => {
    setActivityPage(1);
  }, [activityFilter, activitySearch]);

  const filteredMovements = useMemo(() => {
    const items = movements.data ?? [];
    return items.filter((m) => {
      if (activityFilter === 'withdrawals' && m.direction !== 'out') return false;
      if (activityFilter === 'credits' && m.direction !== 'in') return false;
      if (activitySearch.trim()) {
        const q = activitySearch.trim().toLowerCase();
        const matchTitle = (m.description ?? '').toLowerCase().includes(q);
        const matchCat = (m.category ?? '').toLowerCase().includes(q);
        const matchAmt = String(m.amount).includes(q);
        if (!matchTitle && !matchCat && !matchAmt) return false;
      }
      return true;
    });
  }, [movements.data, activityFilter, activitySearch]);

  const totalActivityPages = Math.max(1, Math.ceil(filteredMovements.length / ACTIVITY_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, totalActivityPages);
  const paginatedMovements = useMemo(() => {
    const start = (safeActivityPage - 1) * ACTIVITY_PAGE_SIZE;
    return filteredMovements.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [filteredMovements, safeActivityPage]);

  const resetVerification = () => {
    setVerification(null);
    setOtp('');
    setSelfie(null);
    setVerifyError(null);
    setRemaining(undefined);
    setCooldown(0);
  };

  const startOver = () => {
    resetVerification();
    setFailure(null);
    setStep('form');
    sources.refresh();
  };

  const onContinue = async () => {
    setFormError(null);
    if (!source) return setFormError('There is no balance to withdraw from yet.');
    if (!amountText.trim() || !(typed > 0)) return setFormError('Enter the amount to withdraw.');
    if (amountProblem) return setFormError(amountProblem);
    if (!selectedId) return setFormError('Add a payment account to receive the money.');
    if (donation.mode === 'unset') return setFormError('Choose a donation, or tap "No thanks".');
    if (donation.mode === 'custom' && !(donationDisplay > 0)) {
      return setFormError('Enter a donation amount, or tap "No thanks".');
    }

    setBusy(true);
    try {
      const out = await initiateWithdrawal(role, {
        amount: displayToUsd(typed, currency),
        withdrawalMethodId: selectedId,
        donationAmount: displayToUsd(donationDisplay, currency),
        source,
      });
      if (out.kind === 'verify') {
        resetVerification();
        setVerification(out.verification);
        setStep('verify');
      } else {
        setFailure({ message: out.message, kyc: out.kind === 'kyc' });
        setStep('failed');
      }
    } catch (e) {
      setFormError(isApiError(e) ? e.message : 'Network error. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const onCaptureSelfie = async () => {
    setVerifyError(null);
    if (!(await ensureWithdrawalFaceConsent())) return;
    try {
      const shot = await takeSelfieDataUrl();
      if (shot) setSelfie(shot);
    } catch {
      setVerifyError('Could not open the camera. Please try again.');
    }
  };

  const onVerify = async () => {
    if (!verification) return;
    setVerifyError(null);
    if (verification.requiresFaceScan && !selfie) return setVerifyError('Take your selfie first.');
    if (verification.requiresOtp && otp.length < 6) return setVerifyError('Enter the full 6-digit code.');

    setBusy(true);
    try {
      const out = await verifyWithdrawal(role, {
        verificationId: verification.verificationId,
        otp: verification.requiresOtp ? otp : undefined,
        selfie: verification.requiresFaceScan ? selfie?.dataUrl : undefined,
      });
      if (out.kind === 'submitted') {
        setStep('done');
      } else if (out.kind === 'restart') {
        setFailure({ message: out.message, kyc: false });
        setStep('failed');
      } else {
        setVerifyError(out.message);
        setRemaining(out.remainingAttempts);
        setOtp('');
        if (verification.requiresFaceScan) setSelfie(null);
      }
    } catch (e) {
      // A timeout or dropped connection is an unknown outcome, not a wrong
      // code: the withdrawal may have been submitted. Keep the code entered.
      const unknown = !isApiError(e) || e.status === 408 || e.status === 0;
      setVerifyError(unknown
        ? 'We could not confirm this. Check your withdrawal history before trying again.'
        : e.message);
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (!verification || cooldown > 0) return;
    setVerifyError(null);
    try {
      const masked = await resendWithdrawalOtp(role, verification.verificationId);
      setCooldown(RESEND_COOLDOWN_S);
      setOtp('');
      if (masked) setVerification({ ...verification, maskedDestination: masked });
    } catch (e) {
      setVerifyError(isApiError(e) ? e.message : 'Could not resend the code.');
    }
  };

  // ── Result screens ─────────────────────────────────────────────────────
  if (step === 'done' || step === 'failed') {
    const ok = step === 'done';
    const kyc = !ok && failure?.kyc;
    const tone = ok ? colors.success : kyc ? colors.warning : colors.error;
    const toneBg = ok ? colors.successBg : kyc ? colors.warningBg : colors.errorBg;
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.result}>
          <View style={[styles.resultIcon, { backgroundColor: toneBg }]}>
            <Ionicons
              name={ok ? 'checkmark-circle' : kyc ? 'shield-outline' : 'close-circle'}
              size={40}
              color={tone}
            />
          </View>
          <Text style={[styles.eyebrow, { color: tone }]}>
            {ok ? 'Request submitted' : kyc ? 'Verification required' : 'Withdrawal not sent'}
          </Text>
          <Text style={styles.resultTitle}>
            {ok ? 'You’re all set' : kyc ? 'Verify your identity first' : 'We couldn’t submit this withdrawal'}
          </Text>
          <Text style={styles.resultText}>
            {ok
              ? 'The amount is set aside from your balance. Our team reviews each withdrawal before it is paid out to your account, and we will notify you when it is sent.'
              : failure?.message}
          </Text>
          <View style={styles.resultActions}>
            {ok ? (
              <>
                <Button title="Done" onPress={() => router.back()} />
                <Button title="View transactions" variant="ghost" onPress={() => router.replace('/transactions' as Href)} />
              </>
            ) : kyc ? (
              <>
                <Button title="Verify identity" onPress={() => router.push('/kyc' as Href)} />
                <Button title="Back" variant="ghost" onPress={startOver} />
              </>
            ) : (
              <>
                <Button title="Try again" onPress={startOver} />
                <Button title="Close" variant="ghost" onPress={() => router.back()} />
              </>
            )}
          </View>
        </View>
      </Screen>
    );
  }

  // ── Verification ───────────────────────────────────────────────────────
  if (step === 'verify' && verification) {
    const copy = verificationCopy(verification);
    const fee = verification.fee;
    return (
      <Screen padded={false} edges={[]}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={tr(copy.title)} subtitle={tr(copy.body)} />
          <View style={styles.body}>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>{tr('Summary')}</Text>
              <Row label={tr('Withdrawal')} value={formatDisplay(typed, currency)} />
              {fee && fee.totalFee > 0 ? (
                <Row
                  label={`${tr('Fee')} (${fee.feePercentage}%${fee.additionalCharge > 0 ? ' + flat' : ''})`}
                  value={`- ${formatDisplay(usdToDisplay(fee.totalFee, currency), currency)}`}
                />
              ) : null}
              {donationDisplay > 0 ? (
                <Row label={tr('Donation')} value={formatDisplay(donationDisplay, currency)} />
              ) : null}
              {fee ? (
                <Row strong label={tr('You receive')} value={formatDisplay(usdToDisplay(fee.netAmount, currency), currency)} />
              ) : null}
            </View>

            {verification.requiresFaceScan ? (
              <View style={styles.card}>
                <Text style={styles.sectionLabel}>Selfie</Text>
                {selfie ? (
                  <View style={styles.selfieRow}>
                    <Image source={{ uri: selfie.uri }} style={styles.selfie} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text style={styles.okText}>Selfie captured</Text>
                      <Pressable onPress={onCaptureSelfie} accessibilityRole="button">
                        <Text style={styles.link}>Retake</Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <>
                    <Text style={styles.muted}>Good light, face centred, nothing covering it.</Text>
                    <Button title="Take selfie" variant="outline" onPress={onCaptureSelfie} />
                  </>
                )}
              </View>
            ) : null}

            {verification.requiresOtp ? (
              <View style={styles.card}>
                <OtpInput label="Verification code" value={otp} onChange={setOtp} editable={!busy} />
                <Pressable onPress={onResend} disabled={cooldown > 0} accessibilityRole="button">
                  <Text style={[styles.link, cooldown > 0 && { color: colors.textMuted }]}>
                    {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {verifyError ? (
              <ErrorBox
                text={remaining != null ? `${verifyError} ${remaining} attempt${remaining === 1 ? '' : 's'} left.` : verifyError}
              />
            ) : null}

            <Button title={busy ? 'Confirming…' : 'Confirm withdrawal'} onPress={onVerify} loading={busy} disabled={busy} />
            <Button title="Cancel" variant="ghost" onPress={startOver} disabled={busy} />
          </View>
        </ScrollView>
      </Screen>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────
  const loading = (sources.loading && !sources.data) || (accounts.loading && !accounts.data);
  return (
    <Screen padded={false} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title={tr('Withdraw')} subtitle={tr('Send your earnings to your mobile money or bank account.')} duplicatesHeader />
        <View style={styles.body}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : sources.error ? (
            <View style={styles.card}>
              <Text style={styles.muted}>{sources.error}</Text>
              <Button title={tr('Try again')} variant="outline" onPress={sources.refresh} />
            </View>
          ) : (
            <>
              {/* Balance */}
              <BalanceHero
                source={source}
                currency={currency}
                usd={currencyList.find((c) => c.code === 'USD') ?? FALLBACK_CURRENCIES[1]}
              />

              {sourceList.length > 1 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{tr('Withdraw from')}</Text>
                  <Text style={styles.muted}>
                    {tr('Available to withdraw')}: {formatDisplay(floorTo(usdToDisplay(allWithdrawable, currency), currency.decimals), currency)} {tr('across all sources')}
                  </Text>
                  <View style={styles.chips}>
                    {sourceList.map((s) => (
                      <Chip
                        key={s.source}
                        label={tr(s.label)}
                        active={source?.source === s.source}
                        onPress={() => {
                          setSourceKey(s.source);
                          setAmountText('');
                        }}
                      />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Amount */}
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionLabel}>{tr('Amount')}</Text>
                  <View style={styles.toggle} accessibilityRole="radiogroup">
                    {currencyList.map((c) => (
                      <Pressable
                        key={c.code}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: c.code === currency.code }}
                        onPress={() => {
                          setCurrencyCode(c.code);
                          setAmountText('');
                          setDonation({ mode: 'unset' });
                        }}
                        style={[styles.toggleSeg, c.code === currency.code && styles.toggleSegActive]}
                      >
                        <CurrencyLabel code={c.code} width={16} textStyle={[styles.toggleText, c.code === currency.code && styles.toggleTextActive]} />
                      </Pressable>
                    ))}
                  </View>
                </View>
                <View style={[styles.amountBox, amountProblem ? { borderColor: colors.error } : null]}>
                  <Text style={styles.amountPrefix}>{currency.symbol}</Text>
                  <TextInput
                    value={amountText}
                    onChangeText={(t) => setAmountText(t.replace(/[^0-9.,]/g, ''))}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                    style={styles.amountInput}
                    accessibilityLabel={`Amount in ${currency.code}`}
                  />
                </View>
                {amountProblem ? <Text style={styles.fieldError}>{amountProblem}</Text> : null}
                {quickAmounts.length ? (
                  <View style={styles.chips}>
                    {quickAmounts.map((q) => (
                      <Chip
                        key={q.label}
                        label={q.label}
                        active={typed === q.value}
                        onPress={() => setAmountText(String(q.value))}
                      />
                    ))}
                  </View>
                ) : null}
              </View>

              {/* Payout account */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{tr('Send to')}</Text>
                {accountList.length ? (
                  accountList.map((m) => {
                    const on = selectedId === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setMethodId(m.id)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        style={[styles.account, on && styles.accountActive]}
                      >
                        <Ionicons
                          name={m.kind === 'bank' ? 'business-outline' : 'phone-portrait-outline'}
                          size={20}
                          color={on ? colors.primary : colors.textMuted}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.accountName}>{m.label}</Text>
                          <Text style={styles.muted}>
                            {[maskAccountNumber(m.accountNumber), m.accountName].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <Ionicons
                          name={on ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={on ? colors.primary : colors.border}
                        />
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.muted}>{tr('No payment account saved yet.')}</Text>
                )}
                <Pressable
                  style={styles.linkRow}
                  onPress={() => router.push('/payment-accounts' as Href)}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>
                    {tr(accountList.length ? 'Manage payment accounts' : '+ Add a payment account')}
                  </Text>
                </Pressable>
              </View>

              {/* Donation */}
              <View style={[styles.card, { backgroundColor: colors.tintAccent, borderColor: 'transparent' }]}>
                <View style={styles.donationHead}>
                  <Ionicons name="heart" size={18} color={colors.accent} />
                  <Text style={styles.donationTitle}>{tr('Give a little back?')}</Text>
                </View>
                <Text style={styles.muted}>{tr('Add a small donation to help fund community projects and initiatives.')}</Text>
                <View style={styles.chips}>
                  {donationPresets(rwfRate, currency).map((v) => (
                    <Chip
                      key={v}
                      accent
                      label={formatDisplay(v, currency)}
                      active={donation.mode === 'preset' && donation.value === v}
                      onPress={() => setDonation({ mode: 'preset', value: v })}
                    />
                  ))}
                  <Chip
                    accent
                    label={tr('Other')}
                    active={donation.mode === 'custom'}
                    onPress={() => setDonation({ mode: 'custom', text: '' })}
                  />
                  <Chip
                    label={tr('No thanks')}
                    active={donation.mode === 'skip'}
                    onPress={() => setDonation({ mode: 'skip' })}
                  />
                </View>
                {donation.mode === 'custom' ? (
                  <View style={styles.amountBoxSmall}>
                    <Text style={styles.amountPrefixSmall}>{currency.symbol}</Text>
                    <TextInput
                      value={donation.text}
                      onChangeText={(t) => setDonation({ mode: 'custom', text: t.replace(/[^0-9.,]/g, '') })}
                      placeholder={tr('Donation amount')}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      style={styles.amountInputSmall}
                      autoFocus
                    />
                  </View>
                ) : null}
              </View>

              {formError ? <ErrorBox text={tr(formError)} /> : null}

              <Button title={tr(busy ? 'Starting…' : 'Continue')} onPress={onContinue} loading={busy} disabled={busy} />
              <Text style={styles.footnote}>
                {tr('You will confirm with a code or a selfie next. Withdrawals are reviewed before they are paid out.')}
              </Text>

              {/* Activity Section */}
              <View style={styles.activitySection}>
                <View style={styles.activityHeaderRow}>
                  <View style={styles.activityTitleWrap}>
                    <Ionicons name="receipt-outline" size={18} color={colors.primary} />
                    <Text style={styles.activitySectionTitle}>{tr('Recent Activity')}</Text>
                  </View>
                  <Pressable onPress={() => router.push('/transactions' as Href)} hitSlop={8}>
                    <Text style={styles.seeAllText}>{tr('View all')}</Text>
                  </Pressable>
                </View>

                {/* Filter Pills */}
                <View style={styles.activityFilterRow}>
                  {(
                    [
                      { label: 'All', value: 'all' },
                      { label: 'Withdrawals', value: 'withdrawals' },
                      { label: 'Credits', value: 'credits' },
                    ] as const
                  ).map((f) => {
                    const isSelected = activityFilter === f.value;
                    return (
                      <Pressable
                        key={f.value}
                        onPress={() => setActivityFilter(f.value)}
                        style={[styles.activityFilterPill, isSelected && styles.activityFilterPillActive]}
                      >
                        <Text
                          style={[
                            styles.activityFilterPillText,
                            isSelected && styles.activityFilterPillTextActive,
                          ]}
                        >
                          {tr(f.label)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Search */}
                <View style={styles.activitySearchWrap}>
                  <Ionicons name="search-outline" size={15} color={colors.textMuted} />
                  <TextInput
                    style={styles.activitySearchInput}
                    placeholder="Search activity..."
                    placeholderTextColor={colors.textMuted}
                    value={activitySearch}
                    onChangeText={setActivitySearch}
                  />
                  {activitySearch ? (
                    <Pressable onPress={() => setActivitySearch('')} hitSlop={6}>
                      <Ionicons name="close-circle" size={15} color={colors.textMuted} />
                    </Pressable>
                  ) : null}
                </View>

                {/* List / Empty State */}
                {movements.loading && !movements.data ? (
                  <View style={styles.activityLoading}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : filteredMovements.length === 0 ? (
                  <View style={styles.activityEmptyBox}>
                    <Ionicons name="swap-vertical-outline" size={24} color={colors.textMuted} />
                    <Text style={styles.activityEmptyText}>
                      {activitySearch ? 'No matching activity found' : 'No activity recorded yet'}
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.activityList}>
                      {paginatedMovements.map((item, idx) => {
                        const isIn = item.direction === 'in';
                        const sign = isIn ? '+' : '−';
                        const isLast = idx === paginatedMovements.length - 1;
                        return (
                          <View
                            key={item.id}
                            style={[styles.activityRow, !isLast && styles.activityRowDivider]}
                          >
                            <View
                              style={[
                                styles.activityIcon,
                                { backgroundColor: isIn ? colors.successBg : colors.errorBg },
                              ]}
                            >
                              <Ionicons
                                name={isIn ? 'arrow-down' : 'arrow-up'}
                                size={15}
                                color={isIn ? colors.success : colors.error}
                              />
                            </View>
                            <View style={styles.activityInfo}>
                              <Text style={styles.activityTitle} numberOfLines={2}>
                                {item.description || item.category || (isIn ? 'Credit' : 'Withdrawal')}
                              </Text>
                              {item.createdAt ? (
                                <Text style={styles.activityMeta}>{formatDate(item.createdAt)}</Text>
                              ) : null}
                            </View>
                            <Text
                              style={[
                                styles.activityAmount,
                                { color: isIn ? colors.success : colors.text },
                              ]}
                            >
                              {sign} {formatPrice(item.amount, item.currency)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>

                    {/* Pagination Bar */}
                    <View style={styles.paginationRow}>
                      <Text style={styles.paginationInfo}>
                        Showing {(safeActivityPage - 1) * ACTIVITY_PAGE_SIZE + 1}–
                        {Math.min(safeActivityPage * ACTIVITY_PAGE_SIZE, filteredMovements.length)} of{' '}
                        {filteredMovements.length}
                      </Text>
                      {totalActivityPages > 1 ? (
                        <View style={styles.paginationButtons}>
                          <Pressable
                            onPress={() => setActivityPage((p) => Math.max(1, p - 1))}
                            disabled={safeActivityPage <= 1}
                            style={[
                              styles.pageNavBtn,
                              safeActivityPage <= 1 && styles.pageNavBtnDisabled,
                            ]}
                            hitSlop={6}
                          >
                            <Ionicons
                              name="chevron-back"
                              size={14}
                              color={safeActivityPage <= 1 ? colors.textMuted : colors.text}
                            />
                            <Text
                              style={[
                                styles.pageNavBtnText,
                                safeActivityPage <= 1 && styles.pageNavBtnTextDisabled,
                              ]}
                            >
                              Prev
                            </Text>
                          </Pressable>

                          <View style={styles.pageIndicatorPill}>
                            <Text style={styles.pageIndicatorText}>
                              {safeActivityPage} / {totalActivityPages}
                            </Text>
                          </View>

                          <Pressable
                            onPress={() => setActivityPage((p) => Math.min(totalActivityPages, p + 1))}
                            disabled={safeActivityPage >= totalActivityPages}
                            style={[
                              styles.pageNavBtn,
                              safeActivityPage >= totalActivityPages && styles.pageNavBtnDisabled,
                            ]}
                            hitSlop={6}
                          >
                            <Text
                              style={[
                                styles.pageNavBtnText,
                                safeActivityPage >= totalActivityPages && styles.pageNavBtnTextDisabled,
                              ]}
                            >
                              Next
                            </Text>
                            <Ionicons
                              name="chevron-forward"
                              size={14}
                              color={safeActivityPage >= totalActivityPages ? colors.textMuted : colors.text}
                            />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );

}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.row, strong && styles.rowStrong]}>
      <Text style={strong ? styles.rowLabelStrong : styles.rowLabel}>{label}</Text>
      <Text style={strong ? styles.rowValueStrong : styles.rowValue}>{value}</Text>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
  accent,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = accent ? colors.accent : colors.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && { borderColor: tone, backgroundColor: accent ? colors.tintAccent : colors.tint }]}
    >
      <Text style={[styles.chipText, active && { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

function ErrorBox({ text }: { text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.errorBox} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={16} color={colors.error} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { paddingBottom: spacing['3xl'] },
  body: { paddingHorizontal: spacing.xl, gap: spacing.lg, paddingTop: spacing.sm },
  center: { paddingVertical: spacing['3xl'], alignItems: 'center' },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  toggle: { flexDirection: 'row', backgroundColor: c.surfaceMuted, borderRadius: radii.full, padding: 3 },
  toggleSeg: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radii.full, minWidth: 48, alignItems: 'center' },
  toggleSegActive: { backgroundColor: c.surface },
  toggleText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.textMuted },
  toggleTextActive: { color: c.primary },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.lg,
    minHeight: 64,
  },
  amountPrefix: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.textMuted },
  amountInput: { flex: 1, fontSize: fontSize['2xl'], fontWeight: fontWeight.bold, color: c.text, paddingVertical: spacing.sm },
  amountBoxSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  amountPrefixSmall: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.textMuted },
  amountInputSmall: { flex: 1, fontSize: fontSize.md, color: c.text },
  fieldError: { fontSize: fontSize.xs, color: c.error },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  accountActive: { borderColor: c.primary, backgroundColor: c.tint },
  accountName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  linkRow: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  link: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  donationHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  donationTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  muted: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },
  footnote: { fontSize: fontSize.xs, color: c.textMuted, textAlign: 'center', lineHeight: 18 },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.errorBg,
  },
  errorText: { flex: 1, fontSize: fontSize.sm, color: c.error },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  rowStrong: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: c.borderSoft },
  rowLabel: { fontSize: fontSize.sm, color: c.textMuted },
  rowValue: { fontSize: fontSize.sm, color: c.text, fontWeight: fontWeight.semibold },
  rowLabelStrong: { fontSize: fontSize.md, color: c.text, fontWeight: fontWeight.bold },
  rowValueStrong: { fontSize: fontSize.md, color: c.primary, fontWeight: fontWeight.extrabold },
  selfieRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selfie: { width: 64, height: 64, borderRadius: 32, backgroundColor: c.surfaceMuted },
  okText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.success },
  result: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm },
  resultIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  eyebrow: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.8 },
  resultTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text, textAlign: 'center' },
  resultText: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center', lineHeight: 21, maxWidth: 340 },
  resultActions: { alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg },

  // Activity Feed & Pagination
  activitySection: {
    marginTop: spacing.xl,
    gap: spacing.md,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activitySectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
  },
  seeAllText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.primary,
  },
  activityFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activityFilterPill: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityFilterPillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  activityFilterPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  activityFilterPillTextActive: {
    color: c.textOnPrimary,
  },
  activitySearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.sm,
    height: 38,
  },
  activitySearchInput: {
    flex: 1,
    fontSize: 13,
    color: c.text,
    paddingVertical: 0,
  },
  activityLoading: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityEmptyBox: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 6,
  },
  activityEmptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },
  activityList: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  activityRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  activityTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
  },
  activityMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  activityAmount: {
    fontFamily: fonts.bold,
    fontSize: 14,
    flexShrink: 0,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 2,
    gap: 8,
  },
  paginationInfo: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageNavBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.text,
  },
  pageNavBtnTextDisabled: {
    color: c.textMuted,
  },
  pageIndicatorPill: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.md,
    backgroundColor: c.tint,
  },
  pageIndicatorText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },
}));
