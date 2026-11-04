import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { glassTile } from '@/components/ui/GlassCard';
import { OtpInput, OTP_LENGTH } from '@/components/ui/OtpInput';
import { Segmented } from '@/components/ui/Segmented';
import { AuthGlassLayout } from '@/features/auth/AuthGlassLayout';
import { verifySecondFactor } from '@/features/auth/api';
import {
  challengeFromParams,
  formatCountdown,
  isCodeError,
  sendEmailCode,
  type CodeError,
  type TwoFactorMethod,
} from '@/features/auth/twoFactor';
import { useCountdown } from '@/hooks/useCountdown';
import { useSharedT } from '@/i18n/sharedStrings';
import { useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { fontSize, fontWeight, makeStyles, spacing } from '@/theme';

/**
 * Second step of sign-in. The server decides everything: the screen sends the code and shows
 * what comes back (attempts left, a lock with its time, a resend wait). Timers run off the
 * server's timestamps, never the device clock alone.
 */
export default function VerifyTotpScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
  const { tr } = useSharedT();
  const router = useRouter();
  const params = useLocalSearchParams<Record<string, string>>();
  const challenge = challengeFromParams(params);
  const applySession = useAuth((s) => s.applySession);

  const [method, setMethod] = useState<TwoFactorMethod>(challenge.defaultMethod);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  // The server locks each method on its own, so a lock on one must not block the other.
  const [locks, setLocks] = useState<Partial<Record<TwoFactorMethod, number>>>({});
  const lockedUntil = locks[method] ?? null;
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [maskedEmail, setMaskedEmail] = useState(challenge.maskedEmail);
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);

  const lockSeconds = useCountdown(lockedUntil);
  const resendSeconds = useCountdown(resendAt);
  const locked = lockSeconds > 0;

  const failure = useCallback(
    (err: CodeError) => {
      if (err.errorCode === 'SESSION_EXPIRED') {
        router.replace('/login');
        return;
      }
      if (err.retryAfterSeconds) {
        const until = Date.now() + err.retryAfterSeconds * 1000;
        if (err.errorCode === 'LOCKED') setLocks((l) => ({ ...l, [method]: until }));
        else setResendAt(until);
      }
      setAttemptsLeft(typeof err.attemptsLeft === 'number' ? err.attemptsLeft : null);
      setError(err.message);
    },
    [router, method],
  );

  const send = useCallback(async () => {
    if (!challenge.challengeId || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await sendEmailCode(challenge.challengeId);
      const receivedAt = Date.now();
      // The gap is measured on the server clock: the difference between it and this phone is removed.
      const skew = Date.parse(sent.serverTime) - receivedAt;
      setResendAt(Date.parse(sent.resendAvailableAt) - skew);
      setMaskedEmail(sent.maskedEmail ?? maskedEmail);
    } catch (err) {
      if (isCodeError(err)) failure(err);
      else setError(t('b1_verifyTotpFailed'));
    } finally {
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge.challengeId, sending, failure]);

  // Landing on the email method asks for its code once.
  const asked = useRef(false);
  useEffect(() => {
    if (method === 'EMAIL' && !asked.current) {
      asked.current = true;
      void send();
    }
  }, [method, send]);

  const onVerify = useCallback(
    async (code: string) => {
      if (submitting.current || locked || code.length !== OTP_LENGTH) return;
      submitting.current = true;
      setBusy(true);
      setError(null);
      try {
        const session = await verifySecondFactor(method, challenge, code);
        setDone(true);
        applySession(session); // the root guard moves into the app
      } catch (err) {
        setOtp('');
        setShakeKey((k) => k + 1);
        if (isCodeError(err)) failure(err);
        else setError(t('b1_verifyTotpFailed'));
      } finally {
        submitting.current = false;
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [method, challenge.challengeId, challenge.customerId, locked, failure, applySession],
  );

  const switchMethod = (next: TwoFactorMethod) => {
    setMethod(next);
    setOtp('');
    setError(null);
    setAttemptsLeft(null);
  };

  const hint = locked
    ? undefined
    : attemptsLeft != null && error
      ? `${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left`
      : undefined;
  const shownError = locked ? `Too many wrong codes. Try again in ${formatCountdown(lockSeconds)}.` : (error ?? undefined);

  const emailSubtitle = maskedEmail ? `We sent a 6-digit code to ${maskedEmail}.` : 'We sent a 6-digit code to your email.';

  return (
    <AuthGlassLayout
      title={t('b1_verifyTotpTitle')}
      subtitle={method === 'EMAIL' ? tr(emailSubtitle) : t('b1_verifyTotpSubtitle')}
    >
      {challenge.methods.length > 1 ? (
        <Segmented
          value={method}
          onChange={switchMethod}
          options={[
            { label: tr('Authenticator app'), value: 'TOTP' as const },
            { label: tr('Email code'), value: 'EMAIL' as const },
          ].filter((o) => challenge.methods.includes(o.value))}
        />
      ) : null}

      <OtpInput
        glass
        label={t('b1_verifyTotpCodeLabel')}
        value={otp}
        onChange={setOtp}
        onComplete={onVerify}
        error={shownError}
        hint={hint}
        busy={busy}
        success={done}
        editable={!locked}
        shakeKey={shakeKey}
      />

      <Button
        title={t('b1_verifyTotpButton')}
        onPress={() => onVerify(otp)}
        loading={busy}
        disabled={busy || locked || otp.length !== OTP_LENGTH}
      />

      {method === 'EMAIL' ? (
        <Pressable
          onPress={send}
          disabled={resendSeconds > 0 || sending || locked}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityState={{ disabled: resendSeconds > 0 || sending || locked }}
          style={styles.resend}
        >
          <Text style={[styles.resendText, (resendSeconds > 0 || locked) && styles.resendOff]}>
            {resendSeconds > 0 ? `${tr('Resend code in')} ${formatCountdown(resendSeconds)}` : tr('Resend code')}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{t('b1_verifyTotpInfo')}</Text>
        </View>
      )}
    </AuthGlassLayout>
  );
}

const useStyles = makeStyles((c) => ({
  // A tile on the glass; it was hardcoded light blue, which glared in dark mode.
  infoBox: {
    ...glassTile(c),
    borderWidth: 1,
    borderRadius: 14,
    padding: spacing.md,
  },
  infoText: { color: c.textSoft, fontSize: fontSize.sm, lineHeight: 20 },
  resend: { alignItems: 'center', paddingVertical: spacing.sm },
  resendText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  resendOff: { color: c.textMuted },
}));
