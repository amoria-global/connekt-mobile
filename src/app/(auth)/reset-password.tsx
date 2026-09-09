import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { exchangeRecoveryCode, setNewPassword } from '@/features/auth/api';
import { storage, StorageKeys } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { spacing, fontSize, fontWeight, makeStyles } from '@/theme';

export default function ResetPasswordScreen() {
  const styles = useStyles();
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
      let resetToken = match ? decodeURIComponent(match[1]) : pasted;

      /**
       * A short numeric value is the SMS OTP, not a reset token. The two
       * recovery channels hand back different things: email sends a LINK
       * carrying a PasswordResetToken, SMS sends a numeric code. But
       * /auth/set-new-password resolves `code` with findByToken(), so posting
       * the OTP straight there fails with "This reset link is invalid or has
       * expired" — the dead end phone-only users were hitting. Exchange it for
       * the real token first so both channels converge here.
       */
      if (/^\d{4,8}$/.test(resetToken)) {
        resetToken = await exchangeRecoveryCode(email.trim(), resetToken);
      }
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
            textContentType="emailAddress"
            keyboardType="email-address"
            editable={!params.email}
          />
          
          <Input
            label="Reset code or link"
            placeholder="Paste the link from your email, or the SMS code"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!params.code}
          />

          <Input
            label="New Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            autoCapitalize="none"
          />

          <Input
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            autoCapitalize="none"
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

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', gap: spacing.md },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.primary },
  subtitle: { fontSize: fontSize.md, color: c.textMuted, lineHeight: 22, marginBottom: spacing.sm },
  successWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl },
}));
