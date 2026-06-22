import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
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
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    phone: z.string().min(6, 'Enter a valid phone number'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: string }>();
  const initialRole = (CUSTOMER_TYPES as string[]).includes(params.role ?? '')
    ? (params.role as CustomerType)
    : 'Client';
  const [role] = useState<CustomerType>(initialRole);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const { confirmPassword, ...restValues } = values;
      void confirmPassword;
      const { customerId } = await signup({ ...restValues, customerType: role });
      router.push({ pathname: '/verify-otp', params: { customerId, email: values.email } });
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
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{role}</Text>
            </View>
          </View>

          <View style={styles.form}>
            {/* First + last share one row so the form starts with two
                values per scroll height instead of one. */}
            <View style={styles.row}>
              <View style={styles.col}>
                <Field
                  control={control}
                  name="firstName"
                  label="First name"
                  error={errors.firstName?.message}
                />
              </View>
              <View style={styles.col}>
                <Field
                  control={control}
                  name="lastName"
                  label="Last name"
                  error={errors.lastName?.message}
                />
              </View>
            </View>

            <Field
              control={control}
              name="email"
              label="Email"
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              control={control}
              name="phone"
              label="Phone"
              error={errors.phone?.message}
              keyboardType="phone-pad"
              leftElement={
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+250</Text>
                </View>
              }
            />
            <Field
              control={control}
              name="password"
              label="Password"
              error={errors.password?.message}
              secureTextEntry
              autoCapitalize="none"
            />
            <Field
              control={control}
              name="confirmPassword"
              label="Confirm password"
              error={errors.confirmPassword?.message}
              secureTextEntry
              autoCapitalize="none"
            />

            {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

            <Button
              title="Create account"
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
            />

            <Pressable style={styles.signInLine} onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.signInText}>
                Already a member? <Text style={styles.signInLink}>Sign in</Text>
              </Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.line} />
            </View>

            <GoogleButton label="Sign up with Google" customerType={role} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// Small wrapper to cut Controller boilerplate.
type FieldProps = {
  control: ReturnType<typeof useForm<FormValues>>['control'];
  name: keyof FormValues;
  label: string;
  error?: string;
  keyboardType?: 'email-address' | 'phone-pad';
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences';
  leftElement?: React.ReactNode;
};

function Field({
  control,
  name,
  label,
  error,
  keyboardType,
  secureTextEntry,
  autoCapitalize,
  leftElement,
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
          leftElement={leftElement}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },

  // Header: title + a small role pill on its own line so it stays
  // unmistakably the user-chosen role without competing with the field
  // labels below.
  header: { alignItems: 'flex-start', gap: spacing.xs, marginBottom: spacing.xs },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    color: colors.primary,
  },
  rolePill: {
    alignSelf: 'flex-start',
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

  form: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  serverError: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },

  signInLine: { alignSelf: 'center', paddingVertical: spacing.xs },
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
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  phonePrefix: {
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    marginRight: spacing.xs,
    justifyContent: 'center',
    height: '100%',
  },
  phonePrefixText: { fontSize: fontSize.md, color: colors.textSoft },
});
