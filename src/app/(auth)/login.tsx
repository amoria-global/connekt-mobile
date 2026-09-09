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
import { AppleButton } from '@/features/auth/AppleButton';
import { FindPhotosBottomSheet } from '@/components/FindPhotosBottomSheet';
import { parsePhone } from '@/lib/phoneKit';
import { isApiError, useAuth } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

const schema = z.object({
  // Still accepts an email OR a phone number — phone-only accounts (registered
  // on mobile/TV) sign in with their number here and the backend resolves
  // either. Only the USER-FACING COPY is email-only, by product decision: the
  // field is presented as an email field, and a phone quietly also works.
  email: z
    .string()
    .min(1, 'Email is required')
    .refine(
      (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.trim()) || /^[+\d][\d\s-]{5,}$/.test(v.trim()),
      'Enter a valid email address',
    ),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const login = useAuth((s) => s.login);
  const applySession = useAuth((s) => s.applySession);
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);

  /**
   * Registration is IN-APP and starts with role selection.
   *
   * It previously handed off to the web sign-up in a browser, on the reasoning
   * that the web owned the account-type picker. That left the app's own
   * role-aware `signup.tsx` unreachable, and it meant a user left the app to
   * create an account. Role selection now lives in `choose-role`, which is the
   * single source of truth every registration method downstream consumes.
   */
  const onRegister = () => {
    setServerError(null);
    router.push('/choose-role');
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
    // Phone-like identifiers ("0788…", "+254 712…") are normalized to full
    // international digits ("250788123456") so phone logins match the stored
    // wire format for every country, not just Rwanda. Emails pass through
    // untouched.
    const raw = values.email.trim();
    let identifier = raw;
    if (/^[+0-9][0-9\s-]{5,}$/.test(raw)) {
      const parsed = parsePhone(raw, 'RW');
      if (parsed.country && parsed.nsn) identifier = `${parsed.country.dial}${parsed.nsn}`;
    }
    try {
      await login({ email: identifier, password: values.password });
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
                    label="Your Email"
                    placeholder="example@gmail.com"
                    autoCapitalize="none"
                    autoComplete="username"
                    textContentType="username"
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
                    placeholder="Enter your Password"
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="current-password"
                    textContentType="password"
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
                <Text style={styles.forgotText}>Forgot your password?</Text>
              </Pressable>

              {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

              <Button title="Log in" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />

              <Pressable
                style={styles.registerLine}
                onPress={onRegister}
                hitSlop={8}
              >
                <Text style={styles.registerText}>
                  Not registered yet? <Text style={styles.registerLink}>Create an account</Text>
                </Text>
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>Or continue with</Text>
                <View style={styles.line} />
              </View>

              {/* SIGN-IN mode: no role is known here, so this must never create
                  an account. An unrecognised Google profile is routed to role
                  selection with its details carried over. */}
              <GoogleButton
                mode="login"
                label="Continue with Google"
                onNeedsRole={(profile) =>
                  router.push({
                    pathname: '/choose-role',
                    params: {
                      email: profile.email,
                      firstName: profile.firstName,
                      lastName: profile.lastName,
                    },
                  })
                }
              />
              {/* Same rule as Google: sign-in never creates an account. The
                  backend is asked not to register an unknown Apple ID and the
                  verified profile is carried into role selection. */}
              <AppleButton
                mode="login"
                onNeedsRole={(profile) =>
                  router.push({
                    pathname: '/choose-role',
                    params: {
                      email: profile.email,
                      firstName: profile.firstName,
                      lastName: profile.lastName,
                    },
                  })
                }
              />
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

      <FindPhotosBottomSheet
        visible={findPhotosModalVisible}
        onClose={() => setFindPhotosModalVisible(false)}
        getPhotosRoute="/find-photos"
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
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
    color: c.primary,
  },
  subtitle: { fontSize: fontSize.sm, color: c.textMuted },

  form: { gap: spacing.md },
  forgotWrap: { alignSelf: 'flex-end', marginTop: -spacing.xs, marginBottom: spacing.xs },
  forgotText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  serverError: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },

  registerLine: { alignSelf: 'center', paddingVertical: spacing.xs },
  registerText: { color: c.textMuted, fontSize: fontSize.sm },
  registerLink: { color: c.primary, fontWeight: fontWeight.bold },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  dividerText: {
    color: c.textMuted,
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
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  guestPillPressed: { opacity: 0.6 },
  guestPillText: {
    color: c.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
}));
