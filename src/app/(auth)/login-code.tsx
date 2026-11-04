import { useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OtpInput, OTP_LENGTH } from '@/components/ui/OtpInput';
import { AuthGlassLayout } from '@/features/auth/AuthGlassLayout';
import { isNeedsTotp, sendLoginCode, verifyLoginCode } from '@/features/auth/api';
import { challengeParams, formatCountdown, isCodeError } from '@/features/auth/twoFactor';
import { useCountdown } from '@/hooks/useCountdown';
import { isApiError, useAuth } from '@/store/auth';
import { fontSize, fontWeight, makeStyles, spacing } from '@/theme';

/**
 * "Email me a code instead": a collaborator signs in with a six-digit code sent to their email rather than a password.
 * The answer to "send" is the same whether or not the address can use this, so the screen never says who has an
 * account. The server decides everything about the code (expiry, tries left, lock); a second factor, if the login has
 * one, still follows on the ordinary sign-in code screen.
 */
export default function LoginCodeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const applySession = useAuth((s) => s.applySession);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [done, setDone] = useState(false);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const resendSeconds = useCountdown(resendAt);
  const submitting = useRef(false);

  const send = async () => {
    const address = email.trim();
    if (busy || !address) return;
    setBusy(true);
    setError(null);
    try {
      await sendLoginCode(address);
      setStep('code');
      setResendAt(Date.now() + 60_000);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    if (submitting.current || code.length !== OTP_LENGTH) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const session = await verifyLoginCode(email.trim(), code);
      setDone(true);
      applySession(session); // the root guard moves into the app
    } catch (err) {
      if (isNeedsTotp(err)) {
        router.push({ pathname: '/verify-totp', params: challengeParams(err.challenge) } as never);
        return;
      }
      setOtp('');
      setShakeKey((k) => k + 1);
      if (isCodeError(err)) {
        setAttemptsLeft(typeof err.attemptsLeft === 'number' ? err.attemptsLeft : null);
        setError(err.message);
      } else {
        setError(isApiError(err) ? err.message : 'That code did not work.');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  if (step === 'email') {
    return (
      <AuthGlassLayout title="Email me a code" subtitle="We will send a six-digit code to your email. It expires in 5 minutes.">
        <Input
          glass
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          placeholder="name@example.com"
          error={error ?? undefined}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Button title="Send code" onPress={send} loading={busy} disabled={busy || !email.trim()} />
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="link" style={styles.link}>
          <Text style={styles.linkText}>Use my password instead</Text>
        </Pressable>
      </AuthGlassLayout>
    );
  }

  return (
    <AuthGlassLayout title="Enter your code" subtitle={`If ${email.trim()} can sign in with a code, we sent one. Check your inbox.`}>
      <OtpInput
        glass
        label="Six-digit code"
        value={otp}
        onChange={setOtp}
        onComplete={verify}
        error={error ?? undefined}
        hint={attemptsLeft != null && error ? `${attemptsLeft} ${attemptsLeft === 1 ? 'attempt' : 'attempts'} left` : undefined}
        busy={busy}
        success={done}
        shakeKey={shakeKey}
      />
      <Button title="Sign in" onPress={() => verify(otp)} loading={busy} disabled={busy || otp.length !== OTP_LENGTH} />
      <Pressable onPress={send} disabled={resendSeconds > 0 || busy} hitSlop={12} accessibilityRole="button"
        accessibilityState={{ disabled: resendSeconds > 0 || busy }} style={styles.link}>
        <Text style={[styles.linkText, resendSeconds > 0 && styles.off]}>
          {resendSeconds > 0 ? `Send a new code in ${formatCountdown(resendSeconds)}` : 'Send a new code'}
        </Text>
      </Pressable>
    </AuthGlassLayout>
  );
}

const useStyles = makeStyles((c) => ({
  link: { alignItems: 'center', paddingVertical: spacing.sm },
  linkText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  off: { color: c.textMuted },
}));
