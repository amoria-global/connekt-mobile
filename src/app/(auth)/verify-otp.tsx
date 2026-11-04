import { Button } from '@/components/ui/Button';
import { OtpInput, OTP_LENGTH } from '@/components/ui/OtpInput';
import { AuthGlassLayout } from '@/features/auth/AuthGlassLayout';
import { resendOtp, verifyOtp } from '@/features/auth/api';
import { formatCountdown, isCodeError, localDeadline, type CodeError } from '@/features/auth/twoFactor';
import { useCountdown } from '@/hooks/useCountdown';
import { useSharedT } from '@/i18n/sharedStrings';
import { useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { fontSize, fontWeight, makeStyles, spacing } from '@/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';

/**
 * Verify a new account. The server decides everything: this screen sends the code and shows what comes
 * back (tries left, a lock with its time, a resend wait). Timers run off the server's timestamps and no
 * code is ever checked here.
 */
export default function VerifyOtpScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const { tr } = useSharedT();
  const { customerId, email, phone, resendAt: resendAtParam } = useLocalSearchParams<{
    customerId: string;
    email?: string;
    phone?: string;
    /** Epoch ms when Resend unlocks, from the answer that sent the first code. */
    resendAt?: string;
  }>();
  // The OTP is emailed when an email was given, otherwise texted to the phone.
  const channel = email || phone || 'you';
  const channelKind = email ? 'email' : 'phone';
  const applySession = useAuth((s) => s.applySession);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [resending, setResending] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const initialResend = Number(resendAtParam);
  const [resendAt, setResendAt] = useState<number | null>(Number.isFinite(initialResend) && initialResend > 0 ? initialResend : null);
  const submitting = useRef(false);

  const lockSeconds = useCountdown(lockedUntil);
  const resendSeconds = useCountdown(resendAt);
  const locked = lockSeconds > 0;

  // Without a customerId there is nothing to verify or resend. Say so rather
  // than leaving buttons that silently do nothing.
  const missingCustomer = !customerId;
  const missingMessage = 'This verification session has expired. Go back and sign in again to get a new code.';

  const refuse = useCallback((err: CodeError) => {
    if (err.retryAfterSeconds) {
      const until = Date.now() + err.retryAfterSeconds * 1000;
      if (err.errorCode === 'LOCKED') setLockedUntil(until);
      else setResendAt(until);
    }
    setAttemptsLeft(typeof err.attemptsLeft === 'number' ? err.attemptsLeft : null);
    setError(err.message);
  }, []);

  const onVerify = async (codeToVerify?: string) => {
    if (!customerId) {
      setError(missingMessage);
      return;
    }
    const code = (codeToVerify ?? otp).trim();
    if (code.length !== OTP_LENGTH || submitting.current || locked) return;
    submitting.current = true;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      const session = await verifyOtp(customerId, code);
      setDone(true);
      applySession(session); // root guard redirects into the app
    } catch (err) {
      setOtp('');
      setShakeKey((k) => k + 1);
      if (isCodeError(err)) refuse(err);
      else setError('Verification failed. Try again.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (!customerId) {
      setError(missingMessage);
      return;
    }
    if (resending || resendSeconds > 0 || locked) return;
    setError(null);
    setInfo(null);
    setResending(true);
    setOtp('');
    try {
      const sent = await resendOtp(customerId);
      setInfo(`A new code has been sent to your ${channelKind}. Use the newest code, earlier codes no longer work. Check your spam folder if it does not arrive.`);
      // Measured on the server clock; without timers (an older backend) fall back to the 3 minute gap.
      setResendAt(sent ? localDeadline(sent.resendAvailableAt, sent.serverTime, Date.now()) : Date.now() + 180_000);
    } catch (err) {
      if (isCodeError(err)) refuse(err);
      else setError('Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const shownError = locked
    ? `Too many wrong codes. Try again in ${formatCountdown(lockSeconds)}.`
    : (error ?? (missingCustomer ? missingMessage : undefined));
  const hint = !locked && error && attemptsLeft != null ? `${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left` : undefined;
  const resendBlocked = resending || resendSeconds > 0 || locked || missingCustomer;

  return (
    <AuthGlassLayout
      title={t('verifyYourAccount')}
      subtitle={t('verifyCodeSent', { channel })}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
    >
      <OtpInput
        glass
        label={t('verificationCode')}
        value={otp}
        onChange={(v) => {
          setOtp(v);
          if (error) setError(null);
        }}
        onComplete={(completedCode) => {
          void onVerify(completedCode);
        }}
        error={shownError}
        hint={hint}
        busy={busy}
        success={done}
        editable={!locked && !missingCustomer}
        shakeKey={shakeKey}
      />

      {info ? <Text style={styles.info}>{info}</Text> : null}

      <Button
        title={t('verifyBtn')}
        onPress={() => onVerify()}
        loading={busy}
        disabled={busy || locked || missingCustomer || otp.length !== OTP_LENGTH}
      />

      <Pressable
        onPress={onResend}
        disabled={resendBlocked}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityState={{ disabled: resendBlocked }}
        style={styles.resend}
      >
        <Text style={styles.resendText}>
          {t('didntGetCode')}{' '}
          {resending ? (
            <Text style={styles.muted}>{t('resendingText')}</Text>
          ) : resendSeconds > 0 ? (
            <Text style={styles.muted}>{`${tr('Resend code in')} ${formatCountdown(resendSeconds)}`}</Text>
          ) : (
            <Text style={styles.link}>{t('resendText')}</Text>
          )}
        </Text>
      </Pressable>
    </AuthGlassLayout>
  );
}

const useStyles = makeStyles((c) => ({
  info: {
    color: c.success,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  resend: {
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  resendText: {
    color: c.textMuted,
    fontSize: fontSize.sm,
  },
  link: {
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  muted: {
    color: c.textMuted,
    fontWeight: fontWeight.semibold,
  },
}));
