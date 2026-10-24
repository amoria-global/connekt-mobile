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
import { useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { AuthGlassLayout } from '@/features/auth/AuthGlassLayout';
import { Input } from '@/components/ui/Input';
import { PhoneInput, type PhoneValue } from '@/components/ui/PhoneInput';
import { useLanguage } from '@/store/language';
import { CUSTOMER_TYPES, signup } from '@/features/auth/api';
import { GoogleButton } from '@/features/auth/GoogleButton';
import { AppleButton } from '@/features/auth/AppleButton';
import type { CustomerType } from '@/features/auth/types';
import { InviteNotice } from '@/features/workspace/InviteNotice';
import { useInvitePlan } from '@/features/workspace/useInvitePlan';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

const schema = z
  .object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    // Email is REQUIRED at registration, matching the web client. The backend
    // and schema still permit phone-only accounts (customers.email is nullable,
    // and login/recovery both resolve a phone) so EXISTING phone-only accounts
    // keep working — but no NEW account is created without an email.
    email: z
      .string()
      .trim()
      .min(1, 'Email is required')
      .email('Enter a valid email address'),
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
  // Score, byte-for-byte the same model the web client uses
  // (knockout/app/pages/auth/login.tsx passwordChecks). They had drifted:
  // mobile summed `core + (longer || mixedCase)`, so a password with only 3 of
  // the 4 required rules could still show a full 4/4 bar, and mobile let it be
  // submitted while web refused it. Same input must score the same everywhere.
  //
  //   0 none -> 1 weak -> 2 fair -> 3 good -> 4 strong
  //   required gates the FLOOR (capped at 2 until all four pass);
  //   bonus tops it off. Submission needs all four AND at least one bonus.
  const requiredScore = [lengthOk, hasLetter, hasDigit, hasSpecial].filter(Boolean).length;
  const bonusScore = (longer ? 1 : 0) + (mixedCase ? 1 : 0);

  let score = 0;
  if (pwd.length === 0) score = 0;
  else if (requiredScore < 4) score = Math.min(2, requiredScore);
  else score = Math.min(4, 2 + bonusScore);

  // Web's exact labels/colours, including 'Too weak' at 1 and #3b82f6 at 3.
  const label = ['', 'Too weak', 'Fair', 'Good', 'Strong'][score];
  const color = ['#e5e7eb', '#dc2626', '#f59e0b', '#3b82f6', '#10b981'][score];

  const allRequiredMet = requiredScore === 4;
  const strongEnough = allRequiredMet && score >= 3;
  return { lengthOk, hasLetter, hasDigit, hasSpecial, mixedCase, longer, score, label, color, strongEnough };
}

export default function SignupScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { language, t } = useLanguage();
  const params = useLocalSearchParams<{
    role?: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    invite?: string;
  }>();
  // A workspace invitation the sign-up was opened for: it can only be claimed by an account with the invited address,
  // so that address is filled in and fixed. Only an invitation carried by the route counts, not one left in storage.
  const invite = useInvitePlan(params.invite, { useStored: false });

  /**
   * The role MUST arrive from `choose-role`. There is deliberately no fallback:
   * this used to default to 'Client', so any path that forgot to pass a role
   * silently created a Client account — invisible until the user could not find
   * their own features. A missing role now sends the user back to pick one.
   */
  /**
   * Arrives when Google authenticated someone with no account yet: the login
   * screen hands the verified profile to `choose-role`, which forwards it here
   * with the chosen role. Web does the same (`isGooglePreFilled`) and locks the
   * fields — Google already proved these, so retyping them invites typos and a
   * mismatched account.
   */
  const googlePrefill = Boolean(params.email);

  // An invitation is for photographers, so it sets the role itself when none was chosen.
  const role = (CUSTOMER_TYPES as string[]).includes(params.role ?? '')
    ? (params.role as CustomerType)
    : invite.id
      ? ('Photographer' as CustomerType)
      : null;
  const invitePlan = role === 'Photographer' ? invite.plan : null;
  const inviteLocksEmail = !!invitePlan?.lockEmail;

  useEffect(() => {
    if (role === null) router.replace('/login');
  }, [role, router]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState<PhoneValue | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  /**
   * Registration is a three-step wizard rather than one tall form:
   *   1. who you are  (names + email)
   *   2. phone number
   *   3. password
   *
   * All six fields on one screen meant a long scroll on a phone, with the
   * submit button below the fold and the keyboard covering whatever you were
   * typing. Each step now fits without scrolling, and a step only advances once
   * its own fields validate — so errors surface next to the field that caused
   * them instead of all at once at the end.
   */
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const TOTAL_STEPS = 3;

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: params.firstName ?? '',
      lastName: params.lastName ?? '',
      email: params.email ?? '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    if (!invitePlan || !invite.id) return;
    if (invitePlan.view === 'signup' && invitePlan.email) setValue('email', invitePlan.email);
    // The address already has a photographer account: sign in with it instead.
    else if (invitePlan.view === 'login') router.replace({ pathname: '/login', params: { invite: invite.id } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitePlan?.key]);

  const password = watch('password');
  const confirmPassword = watch('confirmPassword');
  const checks = useMemo(() => checkPassword(password ?? ''), [password]);
  const passwordsMatch =
    (confirmPassword?.length ?? 0) > 0 && password === confirmPassword;

  /** Advance only when THIS step's fields are valid. */
  const goNext = async () => {
    setServerError(null);
    if (step === 1) {
      const ok = await trigger(['firstName', 'lastName', 'email']);
      if (ok) setStep(2);
      return;
    }
    if (step === 2) {
      // Phone lives outside the zod schema — the country-aware kit owns it.
      if (!phoneValue?.isValid) {
        setPhoneError('Enter a valid phone number');
        return;
      }
      setPhoneError(null);
      setStep(3);
    }
  };

  const goBack = () => {
    setServerError(null);
    if (step === 1) {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/login');
      }
    } else {
      setStep((s) => (s === 3 ? 2 : 1));
    }
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    // Fail safe rather than guessing: without a chosen role there is nothing
    // valid to register as, and defaulting is what created wrong-role accounts.
    if (role === null) {
      router.replace('/login');
      return;
    }
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
  // Nothing renders without a role — the effect above is already redirecting to
  // role selection. This also narrows `role` to CustomerType for everything
  // below, so no downstream path can be reached with a missing role.
  if (role === null) return null;

  const showGoogle = role !== 'Photographer';

  return (
    <AuthGlassLayout
      title={t('createYourAccount')}
      onBack={goBack}
      bandRatio={0.26}
      eyebrow={
        <View style={styles.eyebrowRow}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{role}</Text>
          </View>
          {/* Step indicator — tells the user how much is left. */}
          <View
            style={styles.steps}
            accessibilityRole="progressbar"
            accessibilityLabel={t('stepCount', { current: step, total: TOTAL_STEPS })}
          >
            {[1, 2, 3].map((n) => (
              <View key={n} style={[styles.stepDot, n <= step && styles.stepDotOn]} />
            ))}
          </View>
        </View>
      }
    >
      {step === 1 ? (
      <>
      {invitePlan ? <InviteNotice plan={invitePlan} /> : null}
      <View style={styles.row}>
        <View style={styles.col}>
          <Field
            control={control}
            name="firstName"
            label={t('firstName')}
            editable={!googlePrefill}
            textContentType="givenName"
            autoComplete="given-name"
            error={errors.firstName?.message}
          />
        </View>
        <View style={styles.col}>
          <Field
            control={control}
            name="lastName"
            label={t('lastName')}
            editable={!googlePrefill}
            textContentType="familyName"
            autoComplete="family-name"
            error={errors.lastName?.message}
          />
        </View>
      </View>

      <Field
        control={control}
        name="email"
        label={t('yourEmail')}
        editable={!googlePrefill && !inviteLocksEmail}
        textContentType="emailAddress"
        autoComplete="email"
        error={errors.email?.message}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      </>
      ) : null}

      {step === 2 ? (
      <PhoneInput
        glass
        label={t('phone')}
        defaultIso2="RW"
        onChange={(v) => {
          setPhoneValue(v);
          if (v.isValid) setPhoneError(null);
        }}
        error={phoneError ?? undefined}
      />

      ) : null}

      {step === 3 ? (
      <>
      <View>
        <Field
          control={control}
          name="password"
          label={t('passwordLabel')}
          textContentType="newPassword"
          autoComplete="new-password"
          error={errors.password?.message}
          secureTextEntry
          autoCapitalize="none"
        />
        {password && password.length > 0 ? (
          <StrengthMeter checks={checks} />
        ) : (
          <Text style={styles.helper}>
            {t('passwordHelper')}
          </Text>
        )}
      </View>

      <View>
        <Field
          control={control}
          name="confirmPassword"
          label={t('confirmPassword')}
          textContentType="newPassword"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          secureTextEntry
          autoCapitalize="none"
        />
        {confirmPassword && confirmPassword.length > 0 ? (
          <MatchIndicator matches={passwordsMatch} strongEnough={checks.strongEnough} />
        ) : null}
      </View>

      {/* Terms sit on the final step, next to the button that accepts them. */}
      <Text style={styles.terms}>
        {t('termsNoticePrefix')}{' '}
        <Text style={styles.termsLink} onPress={() => router.push('/terms-of-service')}>
          {t('termsOfServiceText')}
        </Text>{' '}
        {t('andText')}{' '}
        <Text style={styles.termsLink} onPress={() => router.push('/privacy-policy')}>
          {t('privacyPolicyText')}
        </Text>
        .
      </Text>
      </>
      ) : null}

      {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

      {step < TOTAL_STEPS ? (
        <Button title={t('continueText')} onPress={goNext} />
      ) : (
        <Button
          title={t('createAccountBtn')}
          onPress={() => {
            // Surface the phone error alongside the schema errors even
            // when other fields fail RHF validation.
            setPhoneError(phoneValue?.isValid ? null : 'Enter a valid phone number');
            void handleSubmit(onSubmit)();
          }}
          loading={isSubmitting}
          disabled={!checks.strongEnough || !passwordsMatch}
        />
      )}

      {step === 1 && !invitePlan?.requireSignup ? (
        <Pressable
          style={styles.signInLine}
          onPress={() => router.replace('/login')}
          hitSlop={8}
        >
          <Text style={styles.signInText}>
            {t('alreadyMemberSignIn')}{' '}
            <Text style={styles.signInLink}>{t('logIn')}</Text>
          </Text>
        </Pressable>
      ) : null}

      {/* Social sign-up only on step 1: it replaces the whole form, so
          offering it later would discard what the user already typed. */}
      {step === 1 && showGoogle ? (
        <>
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>{t('orContinueWith')}</Text>
            <View style={styles.line} />
          </View>
          <GoogleButton mode="signup" label={t('continueWithGoogle')} customerType={role} />
          <AppleButton mode="signup" label={t('continueWithApple')} customerType={role} />
        </>
      ) : null}
    </AuthGlassLayout>
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
  /** iOS Keychain / Android autofill hints. Without these iOS neither offers
   *  saved credentials nor prompts to save a new one at signup. */
  textContentType?: React.ComponentProps<typeof Input>['textContentType'];
  autoComplete?: React.ComponentProps<typeof Input>['autoComplete'];
  /** Locked when Google already supplied and verified the value. */
  editable?: boolean;
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
  textContentType,
  autoComplete,
  editable,
}: FieldProps) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { onChange, onBlur, value } }) => (
        <Input
          glass
          label={label}
          value={value}
          onChangeText={onChange}
          onBlur={onBlur}
          error={error}
          keyboardType={keyboardType}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          placeholder={placeholder}
          textContentType={textContentType}
          autoComplete={autoComplete}
          editable={editable}
        />
      )}
    />
  );
}

// ────── Strength meter (web parity: login.tsx:1137-1178) ────────────────

function StrengthMeter({ checks }: { checks: Checks }) {
  const { colors } = useTheme();
  const styles = useStyles();
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
          label="12+ characters or mixed case (required)"
        />
      </View>
    </View>
  );
}

function Bullet({ ok, label, bonus }: { ok: boolean; label: string; bonus?: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
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
  const styles = useStyles();
  const { t } = useLanguage();
  if (matches && strongEnough) {
    return (
      <View style={styles.matchRow}>
        <Ionicons name="checkmark-circle" size={12} color="#10b981" />
        <Text style={[styles.matchText, { color: '#10b981' }]}>{t('passwordsMatch')}</Text>
      </View>
    );
  }
  if (!matches) {
    return (
      <View style={styles.matchRow}>
        <Ionicons name="alert-circle" size={12} color="#dc2626" />
        <Text style={[styles.matchText, { color: '#dc2626' }]}>{t('passwordsDontMatch')}</Text>
      </View>
    );
  }
  return null;
}

const useStyles = makeStyles((c) => ({
  rolePill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  rolePillText: {
    color: c.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },

  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },

  // Helper text shown under password when empty (web parity 1179-1181)
  helper: { fontSize: 11, color: c.textMuted, marginTop: 3, lineHeight: 16 },

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
  terms: { fontSize: 11, color: c.textMuted, lineHeight: 16, marginTop: 2 },
  termsLink: { color: c.primary, fontWeight: fontWeight.bold, textDecorationLine: 'underline' },

  serverError: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },

  // ── Wizard progress ──────────────────────────────────────────────────
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  steps: {
    flexDirection: 'row',
    gap: 6,
    width: 96,
  },
  stepDot: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: c.borderSoft,
  },
  stepDotOn: { backgroundColor: c.primary },
  signInLine: { alignSelf: 'center', paddingVertical: 2 },
  signInText: { color: c.textMuted, fontSize: fontSize.sm },
  signInLink: { color: c.primary, fontWeight: fontWeight.bold },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.sm,
  },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.border },
  dividerText: { color: c.textMuted, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
}));
