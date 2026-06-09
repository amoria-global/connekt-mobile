import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { resendOtp, verifyOtp } from '@/features/auth/api';
import { isApiError, useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export default function VerifyOtpScreen() {
  const { customerId, email } = useLocalSearchParams<{ customerId: string; email?: string }>();
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
      setInfo('A new code has been sent to your email.');
    } catch {
      setError('Could not resend the code. Please try again.');
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a code to {email ? <Text style={styles.email}>{email}</Text> : 'your email'}.
          Enter it below to activate your account.
        </Text>

        <Input
          label="Verification code"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          placeholder="123456"
          maxLength={6}
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

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.primary },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 22 },
  email: { color: colors.text, fontWeight: fontWeight.semibold },
  info: { color: colors.success, fontSize: fontSize.sm },
  resend: { alignItems: 'center', marginTop: spacing.sm },
  resendText: { color: colors.textMuted, fontSize: fontSize.sm },
  link: { color: colors.primary, fontWeight: fontWeight.bold },
});
