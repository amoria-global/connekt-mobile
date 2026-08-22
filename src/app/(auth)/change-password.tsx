import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { setNewPassword } from '@/features/auth/api';
import { PASSWORD_HINT, validatePassword } from '@/features/auth/passwordPolicy';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
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
      await setNewPassword({
        email: email.trim(),
        password,
        confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <Text style={styles.title}>Password Changed</Text>
          <Text style={styles.subtitle}>
            Your password has been successfully updated. You can now sign in with your new password.
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
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            You signed in with a temporary password from your invitation email.
            Choose your own password to continue.
          </Text>

          <Input
            label="Email"
            value={email}
            editable={false}
          />

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

          <Button title="Save and continue" onPress={onSubmit} loading={submitting} />

          <Button 
            title="Wrong account? Sign in as someone else" 
            variant="outline" 
            onPress={() => router.replace('/login')} 
            style={{ marginTop: spacing.sm }} 
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', gap: spacing.md },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.primary },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted, lineHeight: 22, marginBottom: spacing.sm },
  hint: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20 },
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
});
