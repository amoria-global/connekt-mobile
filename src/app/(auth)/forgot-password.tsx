import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthGlassLayout, useAuthLinkStyles } from '@/features/auth/AuthGlassLayout';
import { useLanguage } from '@/store/language';
import { forgotPassword } from '@/features/auth/api';
import { isApiError } from '@/store/auth';
import { spacing, radii, makeStyles, useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const links = useAuthLinkStyles();
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [resent, setResent] = useState(false);

  const onSubmit = async () => {
    setError(null);
    const value = email.trim();
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError('Enter a valid email.');
      return;
    }
    setSubmitting(true);
    try {
      await forgotPassword(value);
      setSent(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setResent(false);
    try {
      await forgotPassword(email.trim());
      setResent(true);
    } catch {
      // keep the success screen; a transient resend failure is non-blocking
    }
  };

  if (sent) {
    return (
      <AuthGlassLayout
        title={t('checkYourEmail')}
        subtitle={t('resetLinkSent', { email: email.trim() })}
        centered
        eyebrow={
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={28} color={colors.primary} />
          </View>
        }
      >
        <Button title={t('backToSignIn')} onPress={() => router.replace('/login')} />
        <Pressable onPress={onResend} style={links.linkRow} hitSlop={8}>
          <Text style={links.link}>{resent ? t('sentAgainCheck') : t('sendAgain')}</Text>
        </Pressable>
      </AuthGlassLayout>
    );
  }

  return (
    <AuthGlassLayout
      title={t('forgotPassword')}
      subtitle={t('forgotPasswordInstruction')}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/login'))}
    >
      <Input
        glass
        label={t('email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        error={error ?? undefined}
      />

      <Button title={t('sendResetLink')} onPress={onSubmit} loading={submitting} />

      <Pressable onPress={() => router.back()} style={links.linkRow} hitSlop={8}>
        <Text style={links.link}>{t('backToSignIn')}</Text>
      </Pressable>
    </AuthGlassLayout>
  );
}

const useStyles = makeStyles((c) => ({
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
}));
