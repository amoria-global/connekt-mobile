import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { Button } from '@/components/ui/Button';
import { AuthGlassLayout, useAuthLinkStyles } from '@/features/auth/AuthGlassLayout';
import { Input } from '@/components/ui/Input';
import { setNewPassword } from '@/features/auth/api';
import { storage, StorageKeys } from '@/services/storage';
import { isApiError } from '@/store/auth';
import { useLanguage } from '@/store/language';

export default function ChangePasswordScreen() {
  const links = useAuthLinkStyles();
  const router = useRouter();
  const { t } = useLanguage();
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
      <AuthGlassLayout
        title={t('passwordChangedTitle')}
        subtitle={t('passwordChangedSubtitle')}
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
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        editable={false}
      />

      <Input
        glass
        label={t('newPassword')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="8+ chars, a letter, a number and a symbol"
      />

      <Input
        glass
        label={t('confirmPassword')}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Type it again"
        error={error ?? undefined}
      />

      <Button title={t('saveAndContinue')} onPress={onSubmit} loading={submitting} />

      <Pressable onPress={() => router.replace('/login')} style={links.linkRow} hitSlop={8}>
        <Text style={links.link}>{t('wrongAccount')}</Text>
      </Pressable>
    </AuthGlassLayout>
  );
}
