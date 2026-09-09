import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { Screen } from '@/components/ui/Screen';
import { resendOtp, verifyOtp } from '@/features/auth/api';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, fontSize, fontWeight, makeStyles } from '@/theme';

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

  const onVerify = async () => {
    if (!customerId) return;
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
    if (!customerId) return;
    setError(null);
    try {
      await resendOtp(customerId);
      setInfo(`A new code has been sent to your ${channelKind}.`);
    } catch {
      setError('Could not resend the code. Please try again.');
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
          error={error ?? undefined}
        />

        {info ? <Text style={styles.info}>{info}</Text> : null}

        <Button title="Verify" onPress={onVerify} loading={submitting} />

        <Pressable onPress={onResend} style={styles.resend}>
          <Text style={styles.resendText}>
            Didn&apos;t get a code? <Text style={styles.link}>Resend</Text>
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
}));
