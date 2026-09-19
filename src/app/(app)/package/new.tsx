import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { createPackage, updatePackage, type Package, type ServiceType } from '@/features/packages/api';
import { listCurrencies } from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

const TIERS = ['Silver', 'Gold', 'Diamond'];
const PRICE_UNITS = ['per event', 'per hour', 'per day'];

const schema = z.object({
  price: z.string().regex(/^\d+(\.\d+)?$/, 'Enter a price'),
  durationHours: z.string().optional(),
  includedPhotos: z.string().optional(),
  includedVideos: z.string().optional(),
  deliveryDays: z.string().optional(),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

const numStr = (v?: number) => (v != null ? String(v) : '');

export default function NewPackageScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const params = useLocalSearchParams<{ editId?: string; data?: string }>();
  const isEditing = !!params.editId;
  const edit = useMemo<Package | null>(() => {
    if (!params.data) return null;
    try {
      return JSON.parse(params.data) as Package;
    } catch {
      return null;
    }
  }, [params.data]);

  const [serverError, setServerError] = useState<string | null>(null);
  const [tier, setTier] = useState(edit?.name ?? 'Silver');
  const [serviceType, setServiceType] = useState<ServiceType>(edit?.serviceType ?? 'OUTDOOR');
  const [priceUnit, setPriceUnit] = useState(edit?.priceUnit ?? 'per event');
  const [hasLiveStream, setHasLiveStream] = useState(edit?.hasLiveStream ?? false);
  const [currencyId, setCurrencyId] = useState(edit?.currencyId ?? '');

  const currencies = useAsync(useCallback(() => listCurrencies(), []));
  useEffect(() => {
    if (!currencyId && currencies.data?.length) {
      const rwf = currencies.data.find((c) => c.code === 'RWF');
      setCurrencyId((rwf ?? currencies.data[0]).id);
    }
  }, [currencies.data, currencyId]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      price: numStr(edit?.price),
      durationHours: numStr(edit?.durationHours),
      includedPhotos: numStr(edit?.includedPhotos),
      includedVideos: numStr(edit?.includedVideos),
      deliveryDays: numStr(edit?.deliveryDays),
      description: edit?.description ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    if (!currencyId) {
      setServerError('Pick a currency');
      return;
    }
    const input = {
      packageName: tier,
      price: Number(values.price),
      currencyId,
      priceUnit,
      durationHours: values.durationHours ? Number(values.durationHours) : undefined,
      description: values.description || undefined,
      hasLiveStream,
      includedPhotos: values.includedPhotos ? Number(values.includedPhotos) : undefined,
      includedVideos: values.includedVideos ? Number(values.includedVideos) : undefined,
      deliveryDays: values.deliveryDays ? Number(values.deliveryDays) : undefined,
      serviceType,
    };
    try {
      if (isEditing && params.editId) {
        await updatePackage(params.editId, input);
      } else {
        await createPackage(input);
      }
      router.back();
    } catch (err) {
      setServerError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{isEditing ? 'Edit package' : 'New package'}</Text>

        {/* Tier */}
        <View style={styles.group}>
          <Text style={styles.label}>Tier</Text>
          <Segmented value={tier} onChange={setTier} options={TIERS.map((t) => ({ label: t, value: t }))} />
        </View>

        {/* Service type */}
        <View style={styles.group}>
          <Text style={styles.label}>Service type</Text>
          <Segmented
            value={serviceType}
            onChange={setServiceType}
            options={[
              { label: 'Outdoor', value: 'OUTDOOR' },
              { label: 'Studio', value: 'STUDIO' },
            ]}
          />
        </View>

        {/* Price + currency */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Controller
              control={control}
              name="price"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Price" placeholder="50000" keyboardType="numeric" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.price?.message} />
              )}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>Currency</Text>
            <View style={styles.chips}>
              {(currencies.data ?? []).map((c) => {
                const active = currencyId === c.id;
                return (
                  <Pressable key={c.id} onPress={() => setCurrencyId(c.id)} style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.code}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Price unit */}
        <View style={styles.group}>
          <Text style={styles.label}>Price unit</Text>
          <Segmented value={priceUnit} onChange={setPriceUnit} options={PRICE_UNITS.map((u) => ({ label: u, value: u }))} />
        </View>

        {/* Duration + delivery */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Controller control={control} name="durationHours" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Duration (hours)" placeholder="4" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} />
            )} />
          </View>
          <View style={styles.rowItem}>
            <Controller control={control} name="deliveryDays" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Delivery (days)" placeholder="7" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} />
            )} />
          </View>
        </View>

        {/* Included photos + videos */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Controller control={control} name="includedPhotos" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Included photos" placeholder="100" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} />
            )} />
          </View>
          <View style={styles.rowItem}>
            <Controller control={control} name="includedVideos" render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Included videos" placeholder="2" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} />
            )} />
          </View>
        </View>

        {/* Live stream */}
        <View style={styles.switchRow}>
          <Text style={styles.label}>Includes live stream</Text>
          <Switch
            value={hasLiveStream}
            onValueChange={setHasLiveStream}
            trackColor={{ true: colors.primary, false: colors.border }}
          />
        </View>

        <Controller control={control} name="description" render={({ field: { onChange, onBlur, value } }) => (
          <Input label="Description" placeholder="What's included" value={value} onChangeText={onChange} onBlur={onBlur} multiline style={styles.multiline} />
        )} />

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <Button title={isEditing ? 'Save changes' : 'Create package'} onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.lg },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  group: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1, gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  chipTextActive: { color: c.textOnPrimary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  multiline: { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  serverError: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },
}));
