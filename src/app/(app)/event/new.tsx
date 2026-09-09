import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
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
import { createEvent, getEvent, listEventCategories, updateEvent, uploadEventPhoto } from '@/features/events/api';
import { mintHandoffUrl, openWebCheckout } from '@/features/payments/webCheckout';
import {
  getPhotographer,
  listPhotographers,
  type Photographer,
  type PhotographerPackage,
} from '@/features/photographers/api';
import { useAsync } from '@/hooks/useAsync';
import { pickFromLibrary, type PickedImage } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

/**
 * Required → optional split mirrors the web event form: title /
 * category / date / start time and the headline location + organizer +
 * description are required; the "more settings" reveal (price /
 * maxGuests / city / country / visibility / tags) keep their fields
 * optional so a quick draft is still possible.
 *
 * Previously the "more settings" group was entirely optional which let
 * users save half-empty events that needed re-editing later; now the
 * organizer name and description are required so the published event
 * is at least usable on the public site.
 */
const schema = z.object({
  title: z.string().min(1, 'Give your event a title'),
  category: z.string().min(1, 'Pick a category'),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  startTime: z.string().regex(/^\d{1,2}:\d{2}$/, 'Pick a start time'),
  endTime: z.string().optional(),
  venueName: z.string().min(1, 'Where is it happening?'),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  price: z.string().optional(),
  maxGuests: z.string().optional(),
  organizer: z.string().min(1, "Who's organizing this event?"),
  description: z.string().min(10, 'Add a short description (10+ characters)'),
});

type FormValues = z.infer<typeof schema>;

const MIN_RWF = 100;

export default function NewEventScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const params = useLocalSearchParams<{
    photographerId?: string;
    photographerName?: string;
    packageId?: string;
    amount?: string;
    currency?: string;
    editId?: string;
  }>();

  const amount = params.amount ? Number(params.amount) : undefined;
  const isBooking = !!params.photographerId;
  const isEditing = !!params.editId;

  const [serverError, setServerError] = useState<string | null>(null);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [existingCover, setExistingCover] = useState<string | null>(null);
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
    reset,
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

  // Prefill when editing an existing event.
  const hhmm = (t?: string) => {
    if (!t) return '';
    const m = t.match(/(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, '0')}:${m[2]}` : '';
  };
  useEffect(() => {
    if (!params.editId) return;
    let active = true;
    (async () => {
      try {
        const ev = await getEvent(params.editId!);
        if (!active) return;
        setExistingCover(ev.coverImage ?? null);
        // Pull every editable field from the server, not just title/
        // date/time/venue. Previously price, maxGuests, organizer, tags
        // and visibility were silently cleared on each edit — the user
        // had to retype them or lose them on save.
        reset({
          title: ev.title ?? '',
          category: ev.category ?? '',
          eventDate: (ev.eventDate ?? '').slice(0, 10),
          startTime: hhmm(ev.startTime),
          endTime: hhmm(ev.endTime),
          venueName: ev.location ?? '',
          address: '',
          city: '',
          country: '',
          price: ev.price != null ? String(ev.price) : '',
          maxGuests: ev.maxGuests != null ? String(ev.maxGuests) : '',
          organizer:
            ev.organizer ?? `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim(),
          description: ev.description ?? '',
        });
        if (ev.tags?.length) setTags(ev.tags);
        if (ev.eventVisibility === 'PRIVATE' || ev.eventVisibility === 'PUBLIC') {
          setVisibility(ev.eventVisibility);
        }
        // Open the "more settings" reveal automatically when the
        // existing event uses any of those values, so the user can see
        // (and edit) the data that's actually on the record.
        if (
          ev.price != null ||
          ev.maxGuests != null ||
          ev.eventVisibility ||
          (ev.tags?.length ?? 0) > 0
        ) {
          setShowMore(true);
        }
      } catch {
        // leave the form empty; the user can still edit
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.editId]);

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
    // A cover photo is required to create; on edit the existing one is kept.
    if (!cover && !(isEditing && existingCover)) {
      setCoverError('A cover photo is required');
      return;
    }

    const priceNum = values.price ? Number(values.price.replace(/[^\d]/g, '')) : 0;
    // A private event is self-streamed and paid — it must charge at least the
    // minimum. Public events may be free, but a non-zero fee still can't be
    // below the minimum.
    if (visibility === 'PRIVATE' && priceNum < MIN_RWF) {
      setServerError(`A private event needs a live stream fee of at least ${MIN_RWF} RWF.`);
      return;
    }
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

    const input = {
      title: values.title,
      description: values.description || undefined,
      category: values.category,
      eventDate: values.eventDate,
      startTime: values.startTime,
      endTime: values.endTime || undefined,
      location: location || undefined,
      organizer: values.organizer?.trim() || undefined,
      price: amount ?? (priceNum || undefined),
      // The "Live stream fee" field IS the stream fee (viewer paywall). Booking
      // events (amount param) carry no stream fee of their own.
      streamFee: priceNum || undefined,
      currency: params.currency,
      maxGuests: values.maxGuests ? Number(values.maxGuests.replace(/[^\d]/g, '')) : undefined,
      eventVisibility: visibility,
      tags: tags.length ? tags : undefined,
      photographerId,
      packageId,
      escrowPercentage: packageId ? Number(escrow) : undefined,
    };

    try {
      // --- Edit path -----------------------------------------------------
      if (isEditing && params.editId) {
        await updateEvent(params.editId, input);
        if (cover) {
          try {
            await uploadEventPhoto(params.editId, cover);
          } catch {
            // non-fatal
          }
        }
        router.replace(`/event/${params.editId}`);
        return;
      }

      // --- Create / book path -------------------------------------------
      const event = await createEvent(input);

      // The event exists at this point, so a failed cover isn't fatal — but it
      // must be said out loud. An event without a cover cannot be published,
      // and an unpublished event never appears on connekyt.com, so silently
      // ignoring this left people with an event that was invisible for reasons
      // they had no way to discover.
      let coverFailed: string | null = null;
      try {
        await uploadEventPhoto(event.id, cover!);
      } catch (e) {
        coverFailed = isApiError(e) ? e.message : 'The cover photo could not be uploaded.';
      }
      if (coverFailed) {
        Alert.alert(
          'Cover photo not uploaded',
          `${coverFailed}\n\nYour event was created, but it needs a cover photo before it can be published. Open the event and edit it to add one.`,
        );
      }

      // Booking payment is completed on the web — the app collects nothing.
      // Bookings are a real-world service (Play-exempt), so this redirect is
      // offered on every platform. Best-effort: if the declaration isn't ready
      // yet, the user can still pay from the event's Payments later.
      if (amount && amount > 0) {
        try {
          const url = await mintHandoffUrl('BOOKING_DECLARATION', { eventId: event.id });
          router.replace(`/event/${event.id}`);
          await openWebCheckout(url);
          return;
        } catch {
          Alert.alert(
            'Booking created',
            'Your booking is reserved. Complete the payment from the event page when you’re ready.',
          );
        }
      }

      router.replace(`/event/${event.id}`);
    } catch (err) {
      setServerError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const busy = isSubmitting;
  const cats = categories.data ?? [];

  return (
    <Screen padded={false}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
          {isBooking ? (
            <View style={styles.banner}>
              <Text style={styles.bannerLabel}>Booking</Text>
              <Text style={styles.bannerName}>{params.photographerName ?? 'Photographer'}</Text>
              {amount ? <Text style={styles.bannerPrice}>{formatMoney(amount, params.currency)}</Text> : null}
            </View>
          ) : (
            <Text style={styles.title}>{isEditing ? 'Edit event' : 'New event'}</Text>
          )}

          <View style={styles.form}>
            {/* Cover photo (required) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Cover photo</Text>
              <Pressable onPress={pickCover} style={[styles.cover, !!coverError && styles.coverError]}>
                {cover || existingCover ? (
                  <>
                    <Image source={{ uri: cover?.uri ?? existingCover! }} style={styles.coverImg} contentFit="cover" />
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

            {/* Visibility drives the whole model, so it's always visible. */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Who covers this event?</Text>
              <Segmented
                value={visibility}
                onChange={(v) => setVisibility(v)}
                options={[
                  { label: 'A photographer', value: 'PUBLIC' },
                  { label: 'I stream it myself', value: 'PRIVATE' },
                ]}
              />
              <Text style={styles.visibilityHint}>
                {visibility === 'PRIVATE'
                  ? 'You go live yourself — no photographer, no booking. Viewers pay to watch, so it needs a fee of at least 100 RWF.'
                  : 'A photographer covers your event and streams it. Published events appear on connekyt.com.'}
              </Text>
            </View>

            {visibility === 'PRIVATE' ? (
              <Controller
                control={control}
                name="price"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Live stream fee (RWF)"
                    placeholder="Minimum 100"
                    keyboardType="number-pad"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
            ) : null}

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

                {/* Price + max guests. The private stream fee is entered above,
                    so this fee field is only for public events. */}
                <View style={styles.row}>
                  {visibility === 'PUBLIC' ? (
                    <View style={styles.rowItem}>
                      <Controller control={control} name="price" render={({ field: { onChange, onBlur, value } }) => (
                        <Input label="Live stream fee (RWF)" placeholder="0" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} />
                      )} />
                    </View>
                  ) : null}
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

                {/* Assign photographer — public events only; a private event is
                    self-streamed and never takes a photographer. */}
                {!isBooking && visibility === 'PUBLIC' ? (
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
              title={
                isEditing
                  ? 'Save changes'
                  : amount
                    ? `Book & pay ${formatMoney(amount, params.currency)}`
                    : 'Create event'
              }
              onPress={handleSubmit(onSubmit)}
              loading={busy}
            />
          </View>
        </ScrollView>

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

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.xl },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  banner: { backgroundColor: c.primary, borderRadius: radii.lg, padding: spacing.lg, gap: 2 },
  bannerLabel: { color: c.accentLight, fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase' },
  bannerName: { color: c.textOnPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  bannerPrice: { color: '#C7D2FE', fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginTop: 2 },
  form: { gap: spacing.lg },

  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  visibilityHint: { fontSize: fontSize.xs, color: c.textMuted, lineHeight: 18, marginTop: 2 },
  hint: { fontSize: fontSize.xs, color: c.textMuted },
  errText: { fontSize: fontSize.xs, color: c.error },
  alignStart: { alignSelf: 'flex-start' },

  cover: { height: 170, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceMuted },
  coverError: { borderColor: c.error },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  coverHint: { fontSize: fontSize.sm, color: c.textSoft, fontWeight: fontWeight.semibold },
  coverEditBadge: { position: 'absolute', right: spacing.md, bottom: spacing.md, width: 32, height: 32, borderRadius: radii.full, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  chipTextActive: { color: c.textOnPrimary },

  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1 },

  moreToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs },
  moreToggleText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.primary },
  moreSection: { gap: spacing.lg },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tagInput: { flex: 1 },
  tagAdd: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, backgroundColor: c.surfaceMuted },
  tagChipText: { fontSize: fontSize.sm, color: c.textSoft, fontWeight: fontWeight.semibold },

  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, backgroundColor: c.surface },
  assignBtnText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.primary },
  assignCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: c.borderSoft, borderRadius: radii.md, padding: spacing.lg, backgroundColor: c.surface },
  assignName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  assignSub: { fontSize: fontSize.sm, color: c.textMuted },

  multiline: { height: 100, paddingTop: spacing.md, textAlignVertical: 'top' },
  serverError: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },

  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(17,24,39,0.45)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: c.surface, borderTopLeftRadius: radii['2xl'], borderTopRightRadius: radii['2xl'], maxHeight: '75%', paddingBottom: spacing.xl },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  pickerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  iconSpacer: { width: 22 },
  pickerLoader: { paddingVertical: spacing['2xl'] },
  pickerList: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  pickerEmpty: { textAlign: 'center', color: c.textMuted, paddingVertical: spacing['2xl'] },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  pickerName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  pickerSub: { fontSize: fontSize.sm, color: c.textMuted },
}));
