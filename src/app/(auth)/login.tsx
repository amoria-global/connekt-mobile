import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { RoleModal } from '@/features/auth/RoleModal';
import type { CustomerType } from '@/features/auth/types';
import { isApiError, useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const login = useAuth((s) => s.login);
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);

  const onPickRole = (role: CustomerType) => {
    setRoleModalVisible(false);
    router.push({ pathname: '/signup', params: { role } });
  };

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await login(values);
      // Navigation is handled by the protected-route guard in the root layout.
    } catch (err) {
      setServerError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Image
              source={require('../../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to your Connekyt account</Text>
          </View>

          <View style={styles.form}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.email?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Password"
                  secureTextEntry
                  autoCapitalize="none"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={errors.password?.message}
                />
              )}
            />

            <Pressable
              style={styles.forgotWrap}
              onPress={() =>
                router.push({ pathname: '/forgot-password', params: { email: getValues('email') } })
              }
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

            <Button
              title="Sign in"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              style={styles.submit}
            />

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.line} />
            </View>

            <GoogleButton label="Continue with Google" />
          </View>

          <View style={styles.guestSection}>
            <Text style={styles.guestLabel}>Just looking? No account needed</Text>
            <Button
              title="Find my photos"
              variant="accent"
              onPress={() => router.push('/find-photos')}
              style={styles.guestBtn}
            />
            <Pressable onPress={() => router.push('/explore-events')}>
              <Text style={styles.guestLink}>or explore events</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => setRoleModalVisible(true)}>
            <Text style={styles.footer}>
              Don&apos;t have an account? <Text style={styles.link}>Create one</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <RoleModal
        visible={roleModalVisible}
        onClose={() => setRoleModalVisible(false)}
        onSelect={onPickRole}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing['3xl'],
    gap: spacing['2xl'],
  },
  header: { alignItems: 'center', gap: spacing.sm },
  logo: { width: 120, height: 64, marginBottom: spacing.sm },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted },
  form: { gap: spacing.lg },
  submit: { marginTop: spacing.sm },
  serverError: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -spacing.sm },
  forgotText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: fontSize.sm },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.sm },
  link: { color: colors.primary, fontWeight: fontWeight.bold },
  guestSection: { gap: spacing.sm, alignItems: 'center' },
  guestLabel: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.xs },
  guestBtn: { alignSelf: 'stretch', borderRadius: radii.full },
  guestLink: { color: colors.accent, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
