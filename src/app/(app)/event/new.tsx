import { useCallback, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { TimeField } from '@/components/ui/TimeField';
import { createEvent, listEventCategories, uploadEventPhoto } from '@/features/events/api';
import { usePayment } from '@/features/payments/usePayment';
import {
  getPhotographer,
  listPhotographers,
  type Photographer,
  type PhotographerPackage,
} from '@/features/photographers/api';
import { useAsync } from '@/hooks/useAsync';
import { pickFromLibrary, type PickedImage } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

const schema = z.object({
  title: z.string().min(1, 'Give your event a title'),
  category: z.string().min(1, 'Pick a category'),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/, 'Pick a start time'),
  endTime: z.string().optional(),
  venueName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  price: z.string().optional(),
  maxGuests: z.string().optional(),
  organizer: z.string().optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const MIN_RWF = 100;

export default function NewEventScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const params = useLocalSearchParams<{
    photographerId?: string;
    photographerName?: string;
    packageId?: string;
    amount?: string;
    currency?: string;
  }>();

  const amount = params.amount ? Number(params.amount) : undefined;
  const isBooking = !!params.photographerId;
  const { pay, paying } = usePayment();

  const [serverError, setServerError] = useState<string | null>(null);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Optional, non-text controls
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [escrow, setEscrow] = useState<'50' | '70' | '100'>('50');

  // In-form photographer + package assignment (skipped when arriving via a booking link)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerStep, setPickerStep] = useState<'photographer' | 'package'>('photographer');
  const [selPhotog, setSelPhotog] = useState<{ id: string; name: string } | null>(null);
  const [selPackage, setSelPackage] = useState<PhotographerPackage | null>(null);
  const [pkgs, setPkgs] = useState<PhotographerPackage[]>([]);
  const [pkgLoading, setPkgLoading] = useState(false);

  const categories = useAsync(useCallback(() => listEventCategories(), []));
  const photographers = useAsync(
    useCallback(() => (isBooking ? Promise.resolve([] as Photographer[]) : listPhotographers()), [isBooking]),
  );

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      category: '',
      eventDate: '',
      startTime: '',
      endTime: '',
      venueName: '',
      address: '',
      city: '',
      country: 'Rwanda',
      price: '',
      maxGuests: '',
      organizer: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
      description: '',
    },
  });

  const pickCover = async () => {
    const img = await pickFromLibrary();
    if (img) {
      setCover(img);
      setCoverError(null);
    }
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const choosePhotographer = async (p: Photographer) => {
    setSelPhotog({ id: p.id, name: p.name });
    setSelPackage(null);
    setPickerStep('package');
    setPkgLoading(true);
    try {
      const detail = await getPhotographer(p.id);
      setPkgs(detail.packages ?? []);
    } catch {
      setPkgs([]);
    } finally {
      setPkgLoading(false);
    }
  };

  const clearAssignment = () => {
    setSelPhotog(null);
    setSelPackage(null);
    setPkgs([]);
  };

  const hasPackage = !!params.packageId || !!selPackage;

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    if (!cover) {
      setCoverError('A cover photo is required');
      return;
    }

    const priceNum = values.price ? Number(values.price.replace(/[^\d]/g, '')) : 0;
    if (priceNum > 0 && priceNum < MIN_RWF) {
      setServerError(`Live stream access fee must be at least ${MIN_RWF} RWF.`);
      return;
    }

    const location = [values.venueName, values.address, values.city, values.country]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(', ');

    const photographerId = params.photographerId ?? selPhotog?.id;
    const packageId = params.packageId ?? selPackage?.id;

    try {
      const event = await createEvent({
        title: values.title,
        description: values.description || undefined,
        category: values.category,
        eventDate: values.eventDate,
        startTime: values.startTime,
        endTime: values.endTime || undefined,
        location: location || undefined,
        organizer: values.organizer?.trim() || undefined,
        price: amount ?? (priceNum || undefined),
        currency: params.currency,
        maxGuests: values.maxGuests ? Number(values.maxGuests.replace(/[^\d]/g, '')) : undefined,
        eventVisibility: visibility,
        tags: tags.length ? tags : undefined,
        photographerId,
        packageId,
        escrowPercentage: packageId ? Number(escrow) : undefined,
      });

      try {
        await uploadEventPhoto(event.id, cover);
      } catch {
        // non-fatal
      }

      if (amount && amount > 0) {
        const status = await pay({
          amount,
          currency: params.currency,
          eventId: event.id,
          photographerId,
          packageId,
        });
        if (status === 'success') Alert.alert('Payment complete', 'Your booking is confirmed.');
        else if (status === 'pending') Alert.alert('Payment pending', 'We will confirm your booking once payment clears.');
        else if (status === 'failed') Alert.alert('Payment not completed', 'You can pay again from the event later.');
      }

      router.replace(`/event/${event.id}`);
    } catch (err) {
      setServerError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const busy = isSubmitting || paying;
  const cats = categories.data ?? [];

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {isBooking ? (
            <View style={styles.banner}>
              <Text style={styles.bannerLabel}>Booking</Text>
              <Text style={styles.bannerName}>{params.photographerName ?? 'Photographer'}</Text>
              {amount ? <Text style={styles.bannerPrice}>{formatMoney(amount, params.currency)}</Text> : null}
            </View>
          ) : (
            <Text style={styles.title}>New event</Text>
          )}

          <View style={styles.form}>
            {/* Cover photo (required) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Cover photo</Text>
              <Pressable onPress={pickCover} style={[styles.cover, !!coverError && styles.coverError]}>
                {cover ? (
                  <>
                    <Image source={{ uri: cover.uri }} style={styles.coverImg} contentFit="cover" />
                    <View style={styles.coverEditBadge}>
                      <Ionicons name="pencil" size={14} color={colors.textOnPrimary} />
                    </View>
                  </>
                ) : (
                  <View style={styles.coverPlaceholder}>
                    <Ionicons name="image-outline" size={28} color={colors.primary} />
                    <Text style={styles.coverHint}>Add a cover photo</Text>
                  </View>
                )}
              </Pressable>
              {coverError ? <Text style={styles.errText}>{coverError}</Text> : null}
            </View>

            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Event title" placeholder="e.g. Sarah's Wedding" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.title?.message} />
              )}
            />

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Category</Text>
              {categories.loading && !categories.data ? (
                <ActivityIndicator color={colors.primary} style={styles.alignStart} />
              ) : cats.length ? (
                <Controller
                  control={control}
                  name="category"
                  render={({ field: { value, onChange } }) => (
                    <View style={styles.chips}>
                      {cats.map((c) => {
                        const active = value === c;
                        return (
                          <Pressable key={c} onPress={() => onChange(c)} style={[styles.chip, active && styles.chipActive]}>
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                />
              ) : (
                <Controller
                  control={control}
                  name="category"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <Input placeholder="e.g. Wedding, Portrait" value={value} onChangeText={onChange} onBlur={onBlur} />
                  )}
                />
              )}
              {errors.category ? <Text style={styles.errText}>{errors.category.message}</Text> : null}
            </View>

            <Controller
              control={control}
              name="eventDate"
              render={({ field: { onChange, value } }) => (
                <DateField label="Date" value={value} onChange={onChange} error={errors.eventDate?.message} minimumDate={new Date()} />
              )}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Controller
                  control={control}
                  name="startTime"
                  render={({ field: { onChange, value } }) => (
                    <TimeField label="Start time" value={value} onChange={onChange} error={errors.startTime?.message} />
                  )}
                />
              </View>
              <View style={styles.rowItem}>
                <Controller
                  control={control}
                  name="endTime"
                  render={({ field: { onChange, value } }) => (
                    <TimeField label="End time (optional)" value={value ?? ''} onChange={onChange} />
                  )}
                />
              </View>
            </View>

            {/* More options */}
            <Pressable style={styles.moreToggle} onPress={() => setShowMore((v) => !v)}>
              <Text style={styles.moreToggleText}>More options (optional)</Text>
              <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
            </Pressable>

            {showMore ? (
              <View style={styles.moreSection}>
                {/* Location breakdown */}
                <Controller control={control} name="venueName" render={({ field: { onChange, onBlur, value } }) => (
                  <Input label="Venue name" placeholder="e.g. Kigali Convention Centre" value={value} onChangeText={onChange} onBlur={onBlur} />
                )} />
                <Controller control={control} name="address" render={({ field: { onChange, onBlur, value } }) => (
                  <Input label="Address" placeholder="Street / area" value={value} onChangeText={onChange} onBlur={onBlur} />
                )} />
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Controller control={control} name="city" render={({ field: { onChange, onBlur, value } }) => (
                      <Input label="City" placeholder="City" value={value} onChangeText={onChange} onBlur={onBlur} />
                    )} />
                  </View>
                  <View style={styles.rowItem}>
                    <Controller control={control} name="country" render={({ field: { onChange, onBlur, value } }) => (
                      <Input label="Country" placeholder="Country" value={value} onChangeText={onChange} onBlur={onBlur} />
                    )} />
                  </View>
                </View>

                {/* Visibility */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Visibility</Text>
                  <Segmented
                    value={visibility}
                    onChange={(v) => setVisibility(v)}
                    options={[
                      { label: 'Public', value: 'PUBLIC' },
                      { label: 'Private', value: 'PRIVATE' },
                    ]}
                  />
                </View>

                {/* Price + max guests */}
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Controller control={control} name="price" render={({ field: { onChange, onBlur, value } }) => (
                      <Input label="Live stream fee (RWF)" placeholder="0" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} />
                    )} />
                  </View>
                  <View style={styles.rowItem}>
                    <Controller control={control} name="maxGuests" render={({ field: { onChange, onBlur, value } }) => (
                      <Input label="Max guests" placeholder="0" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} />
                    )} />
                  </View>
                </View>

                {/* Tags */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Tags</Text>
                  <View style={styles.tagRow}>
                    <View style={styles.tagInput}>
                      <Input placeholder="Add a tag" value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} returnKeyType="done" />
                    </View>
                    <Pressable style={styles.tagAdd} onPress={addTag}>
                      <Ionicons name="add" size={20} color={colors.textOnPrimary} />
                    </Pressable>
                  </View>
                  {tags.length ? (
                    <View style={styles.chips}>
                      {tags.map((t) => (
                        <Pressable key={t} style={styles.tagChip} onPress={() => setTags(tags.filter((x) => x !== t))}>
                          <Text style={styles.tagChipText}>{t}</Text>
                          <Ionicons name="close" size={14} color={colors.textSoft} />
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>

                {/* Organizer */}
                <Controller control={control} name="organizer" render={({ field: { onChange, onBlur, value } }) => (
                  <Input label="Organizer" placeholder="Organizer name" value={value} onChangeText={onChange} onBlur={onBlur} />
                )} />

                {/* Assign photographer (only when not arriving via a booking link) */}
                {!isBooking ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Photographer (optional)</Text>
                    {selPhotog ? (
                      <View style={styles.assignCard}>
                        <View style={styles.flex}>
                          <Text style={styles.assignName}>{selPhotog.name}</Text>
                          {selPackage ? (
                            <Text style={styles.assignSub}>
                              {selPackage.name}
                              {selPackage.price != null ? ` · ${formatMoney(selPackage.price, selPackage.currency)}` : ''}
                            </Text>
                          ) : (
                            <Text style={styles.assignSub}>No package selected</Text>
                          )}
                        </View>
                        <Pressable onPress={clearAssignment} hitSlop={8}>
                          <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable
                        style={styles.assignBtn}
                        onPress={() => {
                          setPickerStep('photographer');
                          setPickerOpen(true);
                        }}
                      >
                        <Ionicons name="person-add-outline" size={18} color={colors.primary} />
                        <Text style={styles.assignBtnText}>Assign a photographer</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                {/* Escrow (only when a package is in play) */}
                {hasPackage ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Upfront payment (escrow)</Text>
                    <Text style={styles.hint}>Held in escrow, released on completion.</Text>
                    <Segmented
                      value={escrow}
                      onChange={(v) => setEscrow(v)}
                      options={[
                        { label: '50%', value: '50' },
                        { label: '70%', value: '70' },
                        { label: '100%', value: '100' },
                      ]}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}

            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Description" placeholder="Any details for the photographer" value={value} onChangeText={onChange} onBlur={onBlur} multiline style={styles.multiline} />
              )}
            />

            {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

            <Button
              title={amount ? `Book & pay ${formatMoney(amount, params.currency)}` : 'Create event'}
              onPress={handleSubmit(onSubmit)}
              loading={busy}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Photographer / package picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              {pickerStep === 'package' ? (
                <Pressable onPress={() => setPickerStep('photographer')} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color={colors.primary} />
                </Pressable>
              ) : (
                <View style={styles.iconSpacer} />
              )}
              <Text style={styles.pickerTitle}>{pickerStep === 'photographer' ? 'Choose photographer' : 'Choose package'}</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            </View>

            {pickerStep === 'photographer' ? (
              photographers.loading && !photographers.data ? (
                <ActivityIndicator color={colors.primary} style={styles.pickerLoader} />
              ) : (
                <FlatList
                  data={photographers.data ?? []}
                  keyExtractor={(p) => p.id}
                  contentContainerStyle={styles.pickerList}
                  ListEmptyComponent={<Text style={styles.pickerEmpty}>No photographers found.</Text>}
                  renderItem={({ item }) => (
                    <Pressable style={styles.pickerRow} onPress={() => choosePhotographer(item)}>
                      <View style={styles.flex}>
                        <Text style={styles.pickerName}>{item.name}</Text>
                        {item.category ? <Text style={styles.pickerSub}>{item.category}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  )}
                />
              )
            ) : pkgLoading ? (
              <ActivityIndicator color={colors.primary} style={styles.pickerLoader} />
            ) : (
              <FlatList
                data={pkgs}
                keyExtractor={(p) => p.id}
                contentContainerStyle={styles.pickerList}
                ListEmptyComponent={<Text style={styles.pickerEmpty}>This photographer has no packages.</Text>}
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.pickerRow}
                    onPress={() => {
                      setSelPackage(item);
                      setPickerOpen(false);
                    }}
                  >
                    <View style={styles.flex}>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      {item.price != null ? <Text style={styles.pickerSub}>{formatMoney(item.price, item.currency)}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, gap: spacing.xl },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  banner: { backgroundColor: colors.primary, borderRadius: radii.lg, padding: spacing.lg, gap: 2 },
  bannerLabel: { color: colors.accentLight, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  bannerName: { color: colors.textOnPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  bannerPrice: { color: '#C7D2FE', fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginTop: 2 },
  form: { gap: spacing.lg },

  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSoft },
  hint: { fontSize: fontSize.xs, color: colors.textMuted },
  errText: { fontSize: fontSize.xs, color: colors.error },
  alignStart: { alignSelf: 'flex-start' },

  cover: { height: 170, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  coverError: { borderColor: colors.error },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  coverHint: { fontSize: fontSize.sm, color: colors.textSoft, fontWeight: fontWeight.semibold },
  coverEditBadge: { position: 'absolute', right: spacing.md, bottom: spacing.md, width: 32, height: 32, borderRadius: radii.full, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSoft },
  chipTextActive: { color: colors.textOnPrimary },

  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1 },

  moreToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  moreToggleText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
  moreSection: { gap: spacing.lg },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tagInput: { flex: 1 },
  tagAdd: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, backgroundColor: colors.surfaceMuted },
  tagChipText: { fontSize: fontSize.sm, color: colors.textSoft, fontWeight: fontWeight.semibold },

  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: colors.surface },
  assignBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.primary },
  assignCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radii.md, padding: spacing.lg, backgroundColor: colors.surface },
  assignName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  assignSub: { fontSize: fontSize.sm, color: colors.textMuted },

  multiline: { height: 100, paddingTop: spacing.md, textAlignVertical: 'top' },
  serverError: { color: colors.error, fontSize: fontSize.sm, textAlign: 'center' },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], maxHeight: '75%', paddingBottom: spacing.xl },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  pickerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  iconSpacer: { width: 22 },
  pickerLoader: { paddingVertical: spacing['2xl'] },
  pickerList: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  pickerEmpty: { textAlign: 'center', color: colors.textMuted, paddingVertical: spacing['2xl'] },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  pickerName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  pickerSub: { fontSize: fontSize.sm, color: colors.textMuted },
});
