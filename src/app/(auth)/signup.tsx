/**
 * Signup screen — mirrors the web `pages/auth/login.tsx → renderSignupForm`
 * (knockout 1046-1252):
 *   • Logo (44×44) + gradient title + "Create your account to get started"
 *   • First + Last name (side by side)
 *   • Email
 *   • International phone input (emoji flag + dial code, auto country
 *     detection via @/lib/phoneKit) — submits full international digits
 *     ("250788123456") so non-Rwandan signups register correctly
 *   • Password with show/hide + 4-segment strength meter + criteria checklist
 *   • Confirm password with live match indicator
 *   • Terms-of-Service / Privacy-Policy disclaimer
 *   • Create Account (gradient submit)
 *   • "Already a member? Sign in" inline link
 *   • OR divider + "Sign up with Google" (always rendered; hidden only when
 *     the role is Photographer — matches the web's GoogleSignupButton gate)
 *
 * The "Continue with Google" button was getting pushed below the fold on
 * small Android devices because the form gaps and meter were eating
 * vertical space. This rewrite tightens every gap to match the web's
 * `isMobile` mode and pins Google at the natural bottom of the scroll
 * with a guaranteed `keyboardShouldPersistTaps`+`contentInsetAdjustmentBehavior`
 * so it's always reachable.
 */
import { useMemo, useState } from 'react';
import { Image as RNImage } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import {
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
import { PhoneInput, type PhoneValue } from '@/components/ui/PhoneInput';
import { Screen } from '@/components/ui/Screen';
import { CUSTOMER_TYPES, signup } from '@/features/auth/api';
import { GoogleButton } from '@/features/auth/GoogleButton';
import type { CustomerType } from '@/features/auth/types';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    // Email is optional — a phone number alone is enough to register (the OTP
    // is then sent by SMS). If provided, it must be a valid address.
    email: z
      .string()
      .trim()
      .email('Enter a valid email')
      .optional()
      .or(z.literal('')),
    // Phone lives OUTSIDE the schema: PhoneInput manages a PhoneValue in
    // local state (typed country-aware validation) and its digits are
    // injected at submit — see onSubmit.
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

// ────── Password strength rules (web parity: login.tsx:1156-1175) ──────

type Checks = {
  lengthOk: boolean;
  hasLetter: boolean;
  hasDigit: boolean;
  hasSpecial: boolean;
  mixedCase: boolean;
  longer: boolean;
  score: number;
  label: string;
  color: string;
  strongEnough: boolean;
};

function checkPassword(pwd: string): Checks {
  const lengthOk = pwd.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSpecial = /[@!#$%^&*=+]/.test(pwd);
  const mixedCase = /[a-z]/.test(pwd) && /[A-Z]/.test(pwd);
  const longer = pwd.length >= 12;
  // Score: count satisfied core rules + bonus for length/case.
  const core = [lengthOk, hasLetter, hasDigit, hasSpecial].filter(Boolean).length;
  const bonus = longer || mixedCase ? 1 : 0;
  const score = Math.min(4, core + bonus - (core === 4 ? 0 : 0));
  const label =
    score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const color =
    score <= 1 ? '#dc2626' : score === 2 ? '#f59e0b' : score === 3 ? '#0a4da3' : '#10b981';
  // Backend rejects unless all 4 core rules pass → gate submit on strongEnough.
  const strongEnough = lengthOk && hasLetter && hasDigit && hasSpecial;
  return { lengthOk, hasLetter, hasDigit, hasSpecial, mixedCase, longer, score, label, color, strongEnough };
}

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole = (CUSTOMER_TYPES as string[]).includes(params.role ?? '')
    ? (params.role as CustomerType)
    : 'Client';
  const [role] = useState<CustomerType>(initialRole);
  const [serverError, setServerError] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState<PhoneValue | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');
  const checks = useMemo(() => checkPassword(password ?? ''), [password]);
  const passwordsMatch =
    (confirmPassword?.length ?? 0) > 0 && password === confirmPassword;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    // Phone is validated by the country-aware kit, not the zod schema.
    if (!phoneValue?.isValid) {
      setPhoneError('Enter a valid phone number');
      return;
    }
    try {
      const { confirmPassword: _cp, ...restValues } = values;
      void _cp;
      const trimmedEmail = values.email?.trim() || undefined;
      // Wire format: full international digits, no '+' ("250788123456").
      // The old form sent bare national digits, which the backend assumed
      // were Rwandan — this fixes signups from every other country.
      const phoneDigits = phoneValue.digits;
      const { customerId } = await signup({
        ...restValues,
        phone: phoneDigits,
        email: trimmedEmail,
        customerType: role,
      });
      // Pass whichever channel the OTP was sent to so the verify screen can
      // show "sent to your email" vs "sent to your phone".
      router.push({
        pathname: '/verify-otp',
        params: { customerId, email: trimmedEmail ?? '', phone: phoneDigits },
      });
    } catch (err) {
      setServerError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    }
  };

  // Web parity: Google sign-up is hidden for Photographer accounts because
  // photographers complete a 6-step onboarding wizard that the OAuth shortcut
  // skips (login.tsx:1230 — `signupUserType !== 'Photographer'`).
  const showGoogle = role !== 'Photographer';

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
          {/* Header — small logo + gradient title + sub.
              Web parity: login.tsx:1049-1055 (logo 44×44, title 22px on mobile,
              subtitle "Create your account to get started"). */}
          <View style={styles.header}>
            <RNImage
              source={require('../../../assets/images/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Create your account to get started</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{role}</Text>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.row}>
              <View style={styles.col}>
                <Field
                  control={control}
                  name="firstName"
                  label="First name"
                  error={errors.firstName?.message}
                  placeholder="John"
                />
              </View>
              <View style={styles.col}>
                <Field
                  control={control}
                  name="lastName"
                  label="Last name"
                  error={errors.lastName?.message}
                  placeholder="Doe"
                />
              </View>
            </View>

            <Field
              control={control}
              name="email"
              label="Email (optional)"
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="you@example.com"
            />

            <PhoneInput
              label="Phone"
              defaultIso2="RW"
              onChange={(v) => {
                setPhoneValue(v);
                if (v.isValid) setPhoneError(null);
              }}
              error={phoneError ?? undefined}
            />

            <View>
              <Field
                control={control}
                name="password"
                label="Password"
                error={errors.password?.message}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
              />
              {password && password.length > 0 ? (
                <StrengthMeter checks={checks} />
              ) : (
                <Text style={styles.helper}>
                  At least 8 characters with a letter, number & special char (@!#$%^&*=+).
                </Text>
              )}
            </View>

            <View>
              <Field
                control={control}
                name="confirmPassword"
                label="Confirm password"
                error={errors.confirmPassword?.message}
                secureTextEntry
                autoCapitalize="none"
                placeholder="••••••••"
              />
              {confirmPassword && confirmPassword.length > 0 ? (
                <MatchIndicator matches={passwordsMatch} strongEnough={checks.strongEnough} />
              ) : null}
            </View>

            <Text style={styles.terms}>
              By creating an account, you agree to our{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/terms-of-service')}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.termsLink} onPress={() => router.push('/privacy-policy')}>
                Privacy Policy
              </Text>
              .
            </Text>

            {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

            <Button
              title="Create account"
              onPress={() => {
                // Surface the phone error alongside the schema errors even
                // when other fields fail RHF validation.
                setPhoneError(phoneValue?.isValid ? null : 'Enter a valid phone number');
                void handleSubmit(onSubmit)();
              }}
              loading={isSubmitting}
              disabled={!checks.strongEnough || !passwordsMatch}
            />

            <Pressable style={styles.signInLine} onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.signInText}>
                Already a member? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </Pressable>

            {showGoogle ? (
              <>
                <View style={styles.divider}>
                  <View style={styles.line} />
                  <Text style={styles.dividerText}>or sign up with</Text>
                  <View style={styles.line} />
                </View>
                <GoogleButton label="Continue with Google" customerType={role} />
              </>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// ────── Form field wrapper (Controller boilerplate) ─────────────────────

type FieldProps = {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  name: keyof FormValues;
  label: string;
  error?: string;
  keyboardType?: 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  placeholder?: string;
};

function Field({
  control,
  name,
  label,
  error,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  placeholder,
}: FieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          label={label}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          placeholder={placeholder}
        />
      )}
    />
  );
}

// ────── Strength meter (web parity: login.tsx:1137-1178) ────────────────

function StrengthMeter({ checks }: { checks: Checks }) {
  return (
    <View style={styles.strengthWrap}>
      <View style={styles.strengthBar}>
        {[1, 2, 3, 4].map((seg) => (
          <View
            key={seg}
            style={[
              styles.strengthSeg,
              {
                backgroundColor: checks.score >= seg ? checks.color : colors.surfaceMuted,
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.strengthLabel, { color: checks.color }]}>{checks.label}</Text>
      <View style={styles.checklist}>
        <Bullet ok={checks.lengthOk} label="At least 8 characters" />
        <Bullet ok={checks.hasLetter} label="Contains a letter" />
        <Bullet ok={checks.hasDigit} label="Contains a number" />
        <Bullet ok={checks.hasSpecial} label="Contains a special character (@!#$%^&*=+)" />
        <Bullet
          bonus
          ok={checks.longer || checks.mixedCase}
          label="12+ characters or mixed case (recommended)"
        />
      </View>
    </View>
  );
}

function Bullet({ ok, label, bonus }: { ok: boolean; label: string; bonus?: boolean }) {
  return (
    <View style={styles.bulletRow}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={12}
        color={ok ? '#10b981' : bonus ? colors.textMuted : colors.textSoft}
      />
      <Text
        style={[
          styles.bulletText,
          { color: ok ? '#10b981' : bonus ? colors.textMuted : colors.textSoft },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ────── Live password-match indicator (web parity: 1196-1207) ──────────

function MatchIndicator({ matches, strongEnough }: { matches: boolean; strongEnough: boolean }) {
  if (matches && strongEnough) {
    return (
      <View style={styles.matchRow}>
        <Ionicons name="checkmark-circle" size={12} color="#10b981" />
        <Text style={[styles.matchText, { color: '#10b981' }]}>Passwords match</Text>
      </View>
    );
  }
  if (!matches) {
    return (
      <View style={styles.matchRow}>
        <Ionicons name="alert-circle" size={12} color="#dc2626" />
        <Text style={[styles.matchText, { color: '#dc2626' }]}>Passwords don&apos;t match yet</Text>
      </View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },

  // Header — small logo + title centered (mobile mode of web auth page)
  header: { alignItems: 'center', gap: 2, marginBottom: spacing.xs },
  logo: { width: 40, height: 40, marginBottom: 4 },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
    textAlign: 'center',
  },
  subtitle: { fontSize: fontSize.xs, color: colors.textMuted, textAlign: 'center' },
  rolePill: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: colors.infoBg,
  },
  rolePillText: {
    color: colors.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },

  form: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },

  // Helper text shown under password when empty (web parity 1179-1181)
  helper: { fontSize: 11, color: colors.textMuted, marginTop: 3, lineHeight: 16 },

  // Strength meter
  strengthWrap: { marginTop: 6 },
  strengthBar: { flexDirection: 'row', gap: 4 },
  strengthSeg: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: fontWeight.bold, marginTop: 4 },
  checklist: { marginTop: 4, gap: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bulletText: { fontSize: 11 },

  // Confirm-password match
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  matchText: { fontSize: 11, fontWeight: fontWeight.semibold },

  // Terms (web parity 1213-1218)
  terms: { fontSize: 11, color: colors.textMuted, lineHeight: 16, marginTop: 2 },
  termsLink: { color: colors.primary, fontWeight: fontWeight.bold, textDecorationLine: 'underline' },

  serverError: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },

  signInLine: { alignSelf: 'center', paddingVertical: 2 },
  signInText: { color: colors.textMuted, fontSize: fontSize.sm },
  signInLink: { color: colors.primary, fontWeight: fontWeight.bold },

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
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
});
