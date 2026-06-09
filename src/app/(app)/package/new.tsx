import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { createPackage } from '@/features/packages/api';
import { isApiError } from '@/store/auth';
import { colors, fontSize, spacing } from '@/theme';

const schema = z.object({
  name: z.string().min(1, 'Give the package a name'),
  price: z
    .string()
    .min(1, 'Enter a price')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Enter a valid number'),
  duration: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewPackageScreen() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', price: '', duration: '', description: '' },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await createPackage({
        name: values.name,
        price: Number(values.price),
        duration: values.duration || undefined,
        description: values.description || undefined,
      });
      router.back();
    } catch (err) {
      setServerError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Controller
              control={control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Package name" placeholder="e.g. Wedding Day" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.name?.message} />
              )}
            />
            <Controller
              control={control}
              name="price"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Price" placeholder="e.g. 50000" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.price?.message} keyboardType="numeric" />
              )}
            />
            <Controller
              control={control}
              name="duration"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Duration (optional)" placeholder="e.g. 4 hours" value={value} onChangeText={onChange} onBlur={onBlur} />
              )}
            />
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Description (optional)" placeholder="What's included" value={value} onChangeText={onChange} onBlur={onBlur} multiline style={styles.multiline} />
              )}
            />

            {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

            <Button title="Create package" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.xl },
  form: { gap: spacing.lg },
  multiline: { height: 100, paddingTop: spacing.md, textAlignVertical: 'top' },
  serverError: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },
});
