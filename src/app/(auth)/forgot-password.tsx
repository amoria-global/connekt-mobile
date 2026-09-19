import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { forgotPassword } from '@/features/auth/api';
import { isApiError } from '@/store/auth';
import { spacing, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
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
      <Screen>
        <View style={styles.successWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="mail-outline" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Check your email</Text>

          {/*
            The email carries a LINK, not a code, so the shortest honest path is:
            open it, set the password there, come back and sign in. That is the
            primary action below.

            Entering a code stays available but secondary, because phone-only
            accounts receive an SMS code instead of an email — and the endpoint
            is deliberately uniform (anti-enumeration), so this screen cannot
            know which channel was used and must serve both.
          */}
          <Text style={styles.subtitle}>
            If an account matches{'\n'}
            <Text style={styles.email}>{email.trim()}</Text>, we&apos;ve sent a
            password reset link.
          </Text>

          <Button
            title="Back to sign in"
            onPress={() => router.replace('/login')}
            style={{ width: '100%' }}
          />

          <Pressable onPress={onResend} style={styles.back}>
            <Text style={styles.backText}>
              {resent ? 'Sent again ✓' : "Didn't get it? Send again"}
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Forgot password?</Text>
          <Text style={styles.subtitle}>
            Enter your email and we&apos;ll send you a link to reset your password.
          </Text>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            error={error ?? undefined}
          />

          <Button title="Send reset link" onPress={onSubmit} loading={submitting} />

          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>Back to sign in</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.primary },
  subtitle: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 22 },
  email: { color: c.text, fontWeight: fontWeight.semibold },
  back: { alignItems: 'center', marginTop: spacing.sm },
  backText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
