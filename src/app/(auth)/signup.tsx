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
import type { CustomerType } from '@/features/auth/types';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  phone: z.string().min(6, 'Enter a valid phone number'),
  password: z.string().min(8, 'Use at least 8 characters'),
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
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', password: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const { customerId } = await signup({ ...values, customerType: role });
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
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>Creating your {role} account</Text>
          </View>

          <View style={styles.form}>
            <Field control={control} name="firstName" label="First name" error={errors.firstName?.message} />
            <Field control={control} name="lastName" label="Last name" error={errors.lastName?.message} />
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
            />
            <Field
              control={control}
              name="password"
              label="Password"
              error={errors.password?.message}
              secureTextEntry
              autoCapitalize="none"
            />

            {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

            <Button title="Create account" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
          </View>

          <Pressable onPress={() => router.back()}>
            <Text style={styles.footer}>
              Already have an account? <Text style={styles.link}>Sign in</Text>
            </Text>
          </Pressable>
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
};

function Field({ control, name, label, error, keyboardType, secureTextEntry, autoCapitalize }: FieldProps) {
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
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: spacing.xl, paddingVertical: spacing['2xl'], gap: spacing.xl },
  header: { gap: spacing.xs },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.primary },
  subtitle: { fontSize: fontSize.md, color: colors.textMuted },
  roleRow: { flexDirection: 'row', gap: spacing.sm },
  roleChip: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  roleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSoft },
  roleTextActive: { color: colors.textOnPrimary },
  form: { gap: spacing.lg },
  serverError: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
  footer: { textAlign: 'center', color: colors.textMuted, fontSize: fontSize.sm },
  link: { color: colors.primary, fontWeight: fontWeight.bold },
});
