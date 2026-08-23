import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { setNewPassword } from '@/features/auth/api';
import { storage, StorageKeys } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; code?: string }>();
  
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState(params.code ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !code.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }
    // Same rule the server enforces, and the same one signup already states.
    if (!/^(?=.*[A-Za-z])(?=.*\d)(?=.*[@!#$%^&*=+]).{8,}$/.test(password)) {
      setError('Use at least 8 characters, including a letter, a number and one of @!#$%^&*=+');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      // The reset mail carries a link, not a short code, so people paste the
      // whole URL into this field. Accept either.
      const pasted = code.trim();
      const match = pasted.match(/[?&](?:token|code)=([^&\s]+)/i);
      const resetToken = match ? decodeURIComponent(match[1]) : pasted;
      // Make sure no unrelated parked token rides along on a recovery.
      await storage.remove(StorageKeys.authToken);
      await setNewPassword({
        email: email.trim(),
        code: resetToken,
        password,
        newPassword: password,
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
          <Text style={styles.title}>Password Reset</Text>
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
            Please create a new secure password for your account.
          </Text>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            editable={!params.email}
          />
          
          <Input
            label="Reset Code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            editable={!params.code}
          />

          <Input
            label="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            error={error ?? undefined}
          />

          <Button title="Reset Password" onPress={onSubmit} loading={submitting} />

          <Button 
            title="Cancel" 
            variant="outline" 
            onPress={() => router.back()} 
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
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
});
