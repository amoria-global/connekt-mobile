import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { setNewPassword } from '@/features/auth/api';
import { storage, StorageKeys } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { spacing, fontSize, fontWeight, makeStyles } from '@/theme';

export default function ChangePasswordScreen() {
  const styles = useStyles();
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
      // No code: the proof for a forced first change is the session parked at
      // login, which setNewPassword attaches. The backend resolves the account
      // from it, so the email is advisory only.
      await setNewPassword({
        email: email.trim(),
        password,
        newPassword: password,
        confirmPassword,
      });
      // Sign in fresh with the new password rather than keeping the token that
      // was only ever meant to authorise this one change.
      await storage.remove(StorageKeys.authToken);
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
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            value={email}
            editable={false}
          />

          <Input
            label="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="8+ chars, a letter, a number and a symbol"
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            placeholder="Type it again"
            error={error ?? undefined}
          />

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

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', gap: spacing.md },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.primary },
  subtitle: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 22, marginBottom: spacing.sm },
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
}));
