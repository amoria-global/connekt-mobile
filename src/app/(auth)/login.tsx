import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
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
import { isNeedsVerification, isNeedsTotp, isNeedsPasswordChange } from '@/features/auth/api';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { RoleModal } from '@/features/auth/RoleModal';
import { FindPhotosBottomSheet } from '@/components/FindPhotosBottomSheet';
import type { CustomerType } from '@/features/auth/types';
import { isApiError, useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const schema = z.object({
  // Accept an email OR a phone number — phone-only accounts (registered on
  // mobile/TV) sign in with their number here. The backend resolves either.
  email: z
    .string()
    .min(1, 'Enter your email or phone')
    .refine(
      (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) || /^[+\d][\d\s-]{5,}$/.test(v.trim()),
      'Enter a valid email or phone number',
    ),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const login = useAuth((s) => s.login);
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);

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
    } catch (err) {
      if (isNeedsPasswordChange(err)) {
        router.push({ pathname: '/change-password', params: { email: err.email } });
        return;
      }
      if (isNeedsTotp(err)) {
        router.push({ pathname: '/verify-totp', params: { customerId: err.customerId } });
        return;
      }
      if (isNeedsVerification(err)) {
        router.push({
          pathname: '/verify-otp',
          params: { customerId: err.customerId, email: values.email },
        });
        return;
      }
      setServerError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.top}>
            <View style={styles.header}>
              <Image
                source={require('../../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to your account</Text>
            </View>

            <View style={styles.form}>
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Email or phone"
                    placeholder="you@example.com or 0788…"
                    autoCapitalize="none"
                    autoComplete="username"
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
                    placeholder="••••••••"
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
                hitSlop={8}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>

              {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

              <Button title="Sign in" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

              <Pressable
                style={styles.registerLine}
                onPress={() => setRoleModalVisible(true)}
                hitSlop={8}
              >
                <Text style={styles.registerText}>
                  Not a member? <Text style={styles.registerLink}>Register</Text>
                </Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.line} />
              </View>

              <GoogleButton label="Continue with Google" />
            </View>

            <View style={styles.guestRow}>
              <Pressable
                style={({ pressed }) => [styles.guestPill, pressed && styles.guestPillPressed]}
                onPress={() => setFindPhotosModalVisible(true)}
              >
                <Ionicons name="scan" size={16} color={colors.accent} />
                <Text style={styles.guestPillText}>Find my photos</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.guestPill, pressed && styles.guestPillPressed]}
                onPress={() => router.push('/explore-events')}
              >
                <Ionicons name="calendar" size={16} color={colors.primary} />
                <Text style={styles.guestPillText}>Explore events</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <RoleModal
        visible={roleModalVisible}
        onClose={() => setRoleModalVisible(false)}
        onSelect={onPickRole}
      />
      <FindPhotosBottomSheet
        visible={findPhotosModalVisible}
        onClose={() => setFindPhotosModalVisible(false)}
        getPhotosRoute="/find-photos"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // `flexGrow: 1` + `justifyContent: 'space-between'` lets the form sit in
  // the natural flow on tall devices and pin the signup link to the bottom
  // edge so guests don't hunt for it. On short devices the scroll view
  // still lets everything scroll into view.
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  top: { gap: spacing.md },

  header: { alignItems: 'center', gap: 2, marginBottom: spacing.sm },
  logo: { width: 88, height: 44, marginBottom: spacing.xs },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  subtitle: { fontSize: fontSize.sm, color: colors.textMuted },

  form: { gap: spacing.md },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -spacing.xs, marginBottom: spacing.xs },
  forgotText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  serverError: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },

  registerLine: { alignSelf: 'center', paddingVertical: spacing.xs },
  registerText: { color: colors.textMuted, fontSize: fontSize.sm },
  registerLink: { color: colors.primary, fontWeight: fontWeight.bold },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  dividerText: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  // Side-by-side guest pills so both options are equally weighted and the
  // section fits in a single row on every supported width (down to 320px:
  // the row uses `flex: 1` and shrinks the labels with `numberOfLines`).
  guestRow: { flexDirection: 'row', gap: spacing.sm },
  guestPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  guestPillPressed: { opacity: 0.6 },
  guestPillText: {
    color: colors.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
});
