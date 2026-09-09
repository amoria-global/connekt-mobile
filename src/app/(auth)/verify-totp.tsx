import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { OtpInput } from '@/components/ui/OtpInput';
import { Screen } from '@/components/ui/Screen';
import { verifyTotp } from '@/features/auth/api';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, fontSize, fontWeight, makeStyles } from '@/theme';

export default function VerifyTotpScreen() {
  const styles = useStyles();
  const { customerId } = useLocalSearchParams<{ customerId: string }>();
  const applySession = useAuth((s) => s.applySession);

  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onVerify = async () => {
    if (!customerId) return;
    setError(null);
    setSubmitting(true);
    try {
      const session = await verifyTotp(customerId, otp.trim());
      applySession(session); // root guard redirects into the app
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Verification failed. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.title}>Two-Factor Authentication</Text>
        <Text style={styles.subtitle}>
          Open your authenticator app and enter the 6-digit code to sign in.
        </Text>

        <OtpInput
          label="Verification code"
          value={otp}
          onChange={setOtp}
          error={error ?? undefined}
        />

        <Button title="Verify Code" onPress={onVerify} loading={submitting} />
        
        <View style={styles.infoBox}>
           <Text style={styles.infoText}>
             Open Google Authenticator, Authy, or your preferred authenticator app to find your code. The code refreshes every 30 seconds.
           </Text>
        </View>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.primary },
  subtitle: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 22 },
  infoBox: {
    backgroundColor: '#f0f5ff',
    borderColor: '#dbeafe',
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  infoText: { color: '#1e40af', fontSize: fontSize.sm, lineHeight: 20 },
}));
