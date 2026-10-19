import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { glassTile } from '@/components/ui/GlassCard';
import { AuthGlassLayout } from '@/features/auth/AuthGlassLayout';
import { OtpInput } from '@/components/ui/OtpInput';
import { verifyTotp } from '@/features/auth/api';
import { isApiError, useAuth } from '@/store/auth';
import { useLanguage } from '@/store/language';
import { spacing, fontSize, makeStyles } from '@/theme';

export default function VerifyTotpScreen() {
  const styles = useStyles();
  const { t } = useLanguage();
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
      setError(isApiError(err) ? err.message : t('b1_verifyTotpFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthGlassLayout
      title={t('b1_verifyTotpTitle')}
      subtitle={t('b1_verifyTotpSubtitle')}
    >
      <OtpInput
        glass
        label={t('b1_verifyTotpCodeLabel')}
        value={otp}
        onChange={setOtp}
        error={error ?? undefined}
      />

      <Button title={t('b1_verifyTotpButton')} onPress={onVerify} loading={submitting} />

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          {t('b1_verifyTotpInfo')}
        </Text>
      </View>
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
}));
