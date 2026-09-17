import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { Screen } from '@/components/ui/Screen';
import { resendOtp, verifyOtp } from '@/features/auth/api';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, fontSize, fontWeight, makeStyles } from '@/theme';

const RESEND_COOLDOWN_S = 30;

export default function VerifyOtpScreen() {
  const styles = useStyles();
  const { customerId, email, phone } = useLocalSearchParams<{
    customerId: string;
    email?: string;
    phone?: string;
  }>();
  // The OTP is emailed when an email was given, otherwise texted to the phone.
  const channel = email || phone || 'you';
  const channelKind = email ? 'email' : 'phone';
  const applySession = useAuth((s) => s.applySession);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Seconds until Resend is allowed again. Starts at the cooldown because a
  // code was just sent by signup or login before this screen opened.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Without a customerId there is nothing to verify or resend. Say so rather
  // than leaving buttons that silently do nothing.
  const missingCustomer = !customerId;
  const missingMessage = 'This verification session has expired. Go back and sign in again to get a new code.';

  const onVerify = async () => {
    if (!customerId) {
      setError(missingMessage);
      return;
    }
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const session = await verifyOtp(customerId, otp.trim());
      applySession(session); // root guard redirects into the app
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Verification failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    if (!customerId) {
      setError(missingMessage);
      return;
    }
    if (resending || cooldown > 0) return;
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await resendOtp(customerId);
      setOtp('');
      setInfo(`A new code has been sent to your ${channelKind}. Use the newest code, earlier codes no longer work. Check your spam folder if it does not arrive.`);
      setCooldown(RESEND_COOLDOWN_S);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not resend the code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Verify your account</Text>
        <Text style={styles.subtitle}>
          We sent a code to <Text style={styles.email}>{channel}</Text>.
          Enter it below to activate your account.
        </Text>

        <OtpInput
          label="Verification code"
          value={otp}
          onChange={setOtp}
          error={error ?? (missingCustomer ? missingMessage : undefined)}
        />

        {info ? <Text style={styles.info}>{info}</Text> : null}

        <Button title="Verify" onPress={onVerify} loading={submitting} />

        <Pressable
          onPress={onResend}
          disabled={resending || cooldown > 0 || missingCustomer}
          accessibilityRole="button"
          accessibilityState={{ disabled: resending || cooldown > 0 || missingCustomer }}
          style={styles.resend}
        >
          <Text style={styles.resendText}>
            Didn&apos;t get a code?{' '}
            {resending ? (
              <Text style={styles.muted}>Sending...</Text>
            ) : cooldown > 0 ? (
              <Text style={styles.muted}>Resend in {cooldown}s</Text>
            ) : (
              <Text style={styles.link}>Resend</Text>
            )}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.primary },
  subtitle: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 22 },
  email: { color: c.text, fontWeight: fontWeight.semibold },
  info: { color: c.success, fontSize: fontSize.sm },
  resend: { alignItems: 'center', marginTop: spacing.sm },
  resendText: { color: c.textMuted, fontSize: fontSize.sm },
  link: { color: c.primary, fontWeight: fontWeight.bold },
  muted: { color: c.textMuted, fontWeight: fontWeight.semibold },
}));
