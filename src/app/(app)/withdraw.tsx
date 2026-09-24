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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
  DONATION_PRESETS_RWF,
  FALLBACK_CURRENCIES,
  floorTo,
  formatDisplay,
  parseAmount,
  rwfPresetToDisplay,
  usdToDisplay,
  verificationCopy,
  type Verification,
  type WithdrawSource,
} from '@/features/withdrawals/model';
import { useAsync } from '@/hooks/useAsync';
import { ensureWithdrawalFaceConsent } from '@/features/privacy/consent';
import { takeSelfieDataUrl } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

type Step = 'form' | 'verify' | 'done' | 'failed';
type Donation = { mode: 'unset' } | { mode: 'skip' } | { mode: 'preset'; value: number } | { mode: 'custom'; text: string };

const RESEND_COOLDOWN_S = 30;

export default function WithdrawScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { role } = useRole();

  const sources = useAsync(useCallback(() => listWithdrawableSources(role), [role]));
  const accounts = useAsync(useCallback(() => listPaymentAccounts(role), [role]));
  const currencies = useAsync(useCallback(() => getDisplayCurrencies(), []));

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
  const rwfRate = currencyList.find((c) => c.code === 'RWF')?.rate ?? 1460;

  const sourceList = sources.data ?? [];
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
      setVerifyError(isApiError(e) ? e.message : 'Network error. Please try again.');
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
      <Screen padded={false}>
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
      <Screen padded={false}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <ScreenHeader title={copy.title} subtitle={copy.body} />
          <View style={styles.body}>
            <View style={styles.card}>
              <Text style={styles.sectionLabel}>Summary</Text>
              <Row label="Withdrawal" value={formatDisplay(typed, currency)} />
              {fee && fee.totalFee > 0 ? (
                <Row
                  label={`Fee (${fee.feePercentage}%${fee.additionalCharge > 0 ? ' + flat' : ''})`}
                  value={`- ${formatDisplay(usdToDisplay(fee.totalFee, currency), currency)}`}
                />
              ) : null}
              {donationDisplay > 0 ? (
                <Row label="Donation" value={formatDisplay(donationDisplay, currency)} />
              ) : null}
              {fee ? (
                <Row strong label="You receive" value={formatDisplay(usdToDisplay(fee.netAmount, currency), currency)} />
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
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ScreenHeader title="Withdraw" subtitle="Send your earnings to your mobile money or bank account." />
        <View style={styles.body}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : sources.error ? (
            <View style={styles.card}>
              <Text style={styles.muted}>{sources.error}</Text>
              <Button title="Try again" variant="outline" onPress={sources.refresh} />
            </View>
          ) : (
            <>
              {/* Balance */}
              <View style={styles.hero}>
                <Text style={styles.heroLabel}>{source?.label ?? 'Available balance'}</Text>
                <Text style={styles.heroAmount}>{formatDisplay(available, currency)}</Text>
                {currency.code !== 'USD' && source ? (
                  <Text style={styles.heroSub}>
                    {formatDisplay(source.availableBalance, currencyList.find((c) => c.code === 'USD') ?? FALLBACK_CURRENCIES[1])}
                  </Text>
                ) : null}
              </View>

              {sourceList.length > 1 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Withdraw from</Text>
                  <View style={styles.chips}>
                    {sourceList.map((s) => (
                      <Chip
                        key={s.source}
                        label={s.label}
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
                  <Text style={styles.sectionLabel}>Amount</Text>
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
                        <Text style={[styles.toggleText, c.code === currency.code && styles.toggleTextActive]}>{c.code}</Text>
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
                <Text style={styles.sectionLabel}>Send to</Text>
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
                  <Text style={styles.muted}>No payment account saved yet.</Text>
                )}
                <Pressable
                  style={styles.linkRow}
                  onPress={() => router.push('/payment-accounts' as Href)}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>
                    {accountList.length ? 'Manage payment accounts' : '+ Add a payment account'}
                  </Text>
                </Pressable>
              </View>

              {/* Donation */}
              <View style={[styles.card, { backgroundColor: colors.tintAccent, borderColor: 'transparent' }]}>
                <View style={styles.donationHead}>
                  <Ionicons name="heart" size={18} color={colors.accent} />
                  <Text style={styles.donationTitle}>Give a little back?</Text>
                </View>
                <Text style={styles.muted}>Add a small donation to help fund community projects and initiatives.</Text>
                <View style={styles.chips}>
                  {DONATION_PRESETS_RWF.map((rwf) => {
                    const v = rwfPresetToDisplay(rwf, rwfRate, currency);
                    return (
                      <Chip
                        key={rwf}
                        accent
                        label={formatDisplay(v, currency)}
                        active={donation.mode === 'preset' && donation.value === v}
                        onPress={() => setDonation({ mode: 'preset', value: v })}
                      />
                    );
                  })}
                  <Chip
                    accent
                    label="Other"
                    active={donation.mode === 'custom'}
                    onPress={() => setDonation({ mode: 'custom', text: '' })}
                  />
                  <Chip
                    label="No thanks"
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
                      placeholder="Donation amount"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="decimal-pad"
                      style={styles.amountInputSmall}
                      autoFocus
                    />
                  </View>
                ) : null}
              </View>

              {formError ? <ErrorBox text={formError} /> : null}

              <Button title={busy ? 'Starting…' : 'Continue'} onPress={onContinue} loading={busy} disabled={busy} />
              <Text style={styles.footnote}>
                You will confirm with a code or a selfie next. Withdrawals are reviewed before they are paid out.
              </Text>
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
  hero: {
    backgroundColor: c.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: 4,
  },
  heroLabel: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  heroAmount: { color: '#fff', fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: fontSize.sm },
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
}));
