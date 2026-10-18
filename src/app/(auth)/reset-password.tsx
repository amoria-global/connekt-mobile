import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { AuthGlassLayout, useAuthLinkStyles } from '@/features/auth/AuthGlassLayout';
import { Input } from '@/components/ui/Input';
import { exchangeRecoveryCode, setNewPassword } from '@/features/auth/api';
import { storage, StorageKeys } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';

export default function ResetPasswordScreen() {
  const links = useAuthLinkStyles();
  const router = useRouter();
  const { t } = useLanguage();
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
      <AuthGlassLayout
        title={t('passwordResetSuccessTitle')}
        subtitle={t('passwordResetSuccessSub')}
        centered
      >
        <Button title={t('signInBtn')} onPress={() => router.replace('/login')} />
      </AuthGlassLayout>
    );
  }

  return (
    <AuthGlassLayout
      title={t('resetPasswordTitle')}
      subtitle={t('newPasswordSubtitle')}
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
        editable={!params.email}
      />

      <Input
        glass
        label={t('codeOrToken')}
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
        glass
        label={t('newPassword')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        autoCapitalize="none"
      />

      <Input
        glass
        label={t('confirmPassword')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType="newPassword"
        autoComplete="new-password"
        autoCapitalize="none"
        error={error ?? undefined}
      />

      <Button title={t('saveAndContinue')} onPress={onSubmit} loading={submitting} />

      <Pressable onPress={() => router.back()} style={links.linkRow} hitSlop={8}>
        <Text style={links.link}>{t('cancel')}</Text>
      </Pressable>
    </AuthGlassLayout>
  );
}
