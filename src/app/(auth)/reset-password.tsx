import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { resetPasswordWithToken, validateResetToken } from '@/features/auth/api';
import { PASSWORD_HINT, validatePassword } from '@/features/auth/passwordPolicy';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

/**
 * Completes a password reset started from the emailed link.
 *
 * The reset email carries a single-use token (`?token=`), never a short code,
 * so this screen is driven entirely by that token — it arrives via the
 * deep link. There is deliberately no "type your reset code" field: the
 * backend never issues one, and the earlier version of this screen demanded a
 * code the user could never obtain, which made mobile password reset a dead
 * end for every role.
 */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token ?? '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fail fast on a dead link rather than after the user fills the form.
  const [checking, setChecking] = useState(true);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setTokenError('This reset link is missing its security token. Open the link from your reset email again.');
      setChecking(false);
      return;
    }
    validateResetToken(token)
      .catch((err) => {
        if (active) {
          setTokenError(isApiError(err) ? err.message : 'This reset link is invalid or has expired.');
        }
      })
      .finally(() => active && setChecking(false));
    return () => {
      active = false;
    };
  }, [token]);

  const onSubmit = async () => {
    setError(null);

    const policyError = validatePassword(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordWithToken({ token, password, confirmPassword });
      setSuccess(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.subtitle}>Checking your reset link…</Text>
        </View>
      </Screen>
    );
  }

  if (tokenError) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <Text style={styles.title}>Link no longer valid</Text>
          <Text style={styles.subtitle}>{tokenError}</Text>
          <Button
            title="Request a new link"
            onPress={() => router.replace('/forgot-password')}
            style={{ width: '100%' }}
          />
          <Pressable onPress={() => router.replace('/login')} style={styles.back}>
            <Text style={styles.backText}>Back to sign in</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (success) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <Text style={styles.title}>Password reset</Text>
          <Text style={styles.subtitle}>
            Your password has been successfully reset. You can now sign in with your new password.
          </Text>
          <Button title="Sign In" onPress={() => router.replace('/login')} style={{ width: '100%' }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.title}>Create New Password</Text>
          <Text style={styles.subtitle}>
            Your identity has been verified. Please create a new secure password for your account.
          </Text>

          <Input
            label="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter a new password"
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Type it again"
            error={error ?? undefined}
          />

          <Text style={styles.hint}>{PASSWORD_HINT}</Text>

          <Button title="Reset Password" onPress={onSubmit} loading={submitting} />

          <Pressable onPress={() => router.replace('/login')} style={styles.back}>
            <Text style={styles.backText}>Back to sign in</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', gap: spacing.md },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.primary },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.sm },
  hint: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  back: { alignItems: 'center', marginTop: spacing.sm },
  backText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
});
