import { useCallback, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
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
import { Alert } from '@/components/ui/dialog';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { DateField } from '@/components/ui/DateField';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { TimeField } from '@/components/ui/TimeField';
import { createEvent, getEvent, listEventCategories, updateEvent, uploadEventPhoto } from '@/features/events/api';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import {
  getPhotographer,
  listPhotographers,
  type Photographer,
  type PhotographerPackage,
} from '@/features/photographers/api';
import { useAsync } from '@/hooks/useAsync';
import { pickFromLibrary, type PickedImage } from '@/services/imagePicker';
import { isApiError, useAuth } from '@/store/auth';
import { useRole } from '@/features/auth/role';
import { listCurrencies, type Currency } from '@/features/reference/api';
import {
  deleteGeoPrice,
  getGeoPricing,
  upsertGeoPrice,
  type GeoPriceRule,
  type GeoScope,
} from '@/features/geopricing/api';
import {
  CONTINENTS,
  COUNTRIES,
  ALL_REGIONS,
  continentLabel,
  countryLabel,
  regionLabel,
  type GeoRegionItem,
} from '@/features/geopricing/regions';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';

import { useLanguage } from '@/hooks/useLanguage';
import { translate, type TranslationKey } from '@/i18n/translations';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
const tr = (k: TranslationKey) => translate(useLanguage.getState().language, k);

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
  useLanguage();
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { isCoordinator, isPhotographer } = useRole();
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
  const [payEventId, setPayEventId] = useState<string | null>(null);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  const [existingCover, setExistingCover] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  // Optional, non-text controls
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [escrow, setEscrow] = useState<'50' | '70' | '100'>('50');
  // Organizer attestation for app-store purposes: guests can physically attend
  // at the venue. On by default; untick for a stream-only event.
  const [inPerson, setInPerson] = useState(true);

  // Currencies & Geo-pricing (Coordinator role parity)
  const currencies = useAsync(useCallback(() => listCurrencies(), []));
  const [selectedCurrency, setSelectedCurrency] = useState<string>(params.currency || 'RWF');
  const [currencyId, setCurrencyId] = useState<string>('');

  type FormGeoRule = {
    id?: string;
    scopeType: GeoScope;
    scopeValue: string;
    price: number;
    currencyId?: string;
    currencyCode?: string;
  };
  const [geoRules, setGeoRules] = useState<FormGeoRule[]>([]);
  const [deletedGeoRuleIds, setDeletedGeoRuleIds] = useState<string[]>([]);
  type GeoFilterTab = 'ALL' | 'CONTINENT' | 'COUNTRY';
  const [geoFilterTab, setGeoFilterTab] = useState<GeoFilterTab>('ALL');
  const [geoSearchQuery, setGeoSearchQuery] = useState<string>('');
  const [selectedGeoLocations, setSelectedGeoLocations] = useState<GeoRegionItem[]>([]);
  const [geoPriceInput, setGeoPriceInput] = useState<string>('');
  const [geoCurrencyId, setGeoCurrencyId] = useState<string>('');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [showGeoPricing, setShowGeoPricing] = useState<boolean>(true);

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
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      category: isCoordinator ? 'Entertainment' : '',
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

  const serverEntertainment = (categories.data ?? []).find(
    (c) => c.toLowerCase() === 'entertainment',
  );
  const entertainmentCategory = serverEntertainment || 'Entertainment';

  useEffect(() => {
    if (isCoordinator && !params.editId) {
      setValue('category', entertainmentCategory);
    }
  }, [isCoordinator, params.editId, entertainmentCategory, setValue]);

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
        const ev = await getEvent(params.editId!, isCoordinator);
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
        setInPerson(ev.attendanceMode !== 'STREAM_ONLY');
        if (ev.currency) {
          setSelectedCurrency(ev.currency);
        }
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

        // Fetch existing geo-pricing rules if coordinator
        if (isCoordinator && params.editId) {
          try {
            const geoConfig = await getGeoPricing(params.editId);
            if (active && geoConfig?.rules) {
              setGeoRules(
                geoConfig.rules.map((r) => ({
                  id: r.id,
                  scopeType: r.scopeType,
                  scopeValue: r.scopeValue,
                  price: r.price,
                  currencyId: r.currencyId,
                  currencyCode: r.currencyAbbreviation,
                })),
              );
            }
          } catch {
            // Non-fatal, geo pricing might not be configured
          }
        }
      } catch {
        // leave the form empty; the user can still edit
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.editId, isCoordinator]);

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

  const currenciesList: { id: string; code: string; name?: string }[] =
    currencies.data && currencies.data.length > 0
      ? currencies.data
      : [
          { id: 'cur-rwf', code: 'RWF' },
          { id: 'cur-usd', code: 'USD' },
          { id: 'cur-eur', code: 'EUR' },
        ];

  const toggleGeoLocation = (item: GeoRegionItem) => {
    setGeoError(null);
    setSelectedGeoLocations((prev) => {
      const exists = prev.some((x) => x.scopeType === item.scopeType && x.code === item.code);
      if (exists) {
        return prev.filter((x) => !(x.scopeType === item.scopeType && x.code === item.code));
      }
      return [...prev, item];
    });
  };

  const removeSelectedGeoLocation = (item: GeoRegionItem) => {
    setSelectedGeoLocations((prev) =>
      prev.filter((x) => !(x.scopeType === item.scopeType && x.code === item.code)),
    );
  };

  const clearSelectedGeoLocations = () => {
    setSelectedGeoLocations([]);
    setGeoError(null);
  };

  const filteredGeoRegions: GeoRegionItem[] = useMemo(() => {
    const q = geoSearchQuery.trim().toLowerCase();
    let list: GeoRegionItem[] = [];
    if (geoFilterTab === 'CONTINENT') {
      list = CONTINENTS.map((c) => ({ scopeType: 'CONTINENT' as const, code: c.code, label: c.label }));
    } else if (geoFilterTab === 'COUNTRY') {
      list = COUNTRIES.map((c) => ({ scopeType: 'COUNTRY' as const, code: c.code, label: c.label }));
    } else {
      list = ALL_REGIONS;
    }
    if (!q) return list;
    return list.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.scopeType === 'CONTINENT' ? 'continent' : 'country').includes(q),
    );
  }, [geoFilterTab, geoSearchQuery]);

  const selectAllMatching = () => {
    setSelectedGeoLocations((prev) => {
      const merged = [...prev];
      for (const item of filteredGeoRegions) {
        if (!merged.some((m) => m.scopeType === item.scopeType && m.code === item.code)) {
          merged.push(item);
        }
      }
      return merged;
    });
  };

  const addGeoRules = () => {
    setGeoError(null);
    if (selectedGeoLocations.length === 0) {
      setGeoError('Please select at least one continent or country.');
      return;
    }
    const p = parseFloat(geoPriceInput);
    if (!geoPriceInput || Number.isNaN(p) || p < 0) {
      setGeoError('Please enter a valid price (0 or greater).');
      return;
    }

    const cur = currenciesList.find((c) => (geoCurrencyId ? c.id === geoCurrencyId : c.code === selectedCurrency));
    const effectiveCurrencyCode = cur?.code || selectedCurrency;
    const effectiveCurrencyId = cur?.id;

    setGeoRules((prev) => {
      const next = [...prev];
      for (const loc of selectedGeoLocations) {
        const existingIdx = next.findIndex(
          (r) => r.scopeType === loc.scopeType && r.scopeValue === loc.code,
        );
        if (existingIdx >= 0) {
          next[existingIdx] = {
            ...next[existingIdx],
            price: p,
            currencyId: effectiveCurrencyId,
            currencyCode: effectiveCurrencyCode,
          };
        } else {
          next.push({
            scopeType: loc.scopeType,
            scopeValue: loc.code,
            price: p,
            currencyId: effectiveCurrencyId,
            currencyCode: effectiveCurrencyCode,
          });
        }
      }
      return next;
    });

    setSelectedGeoLocations([]);
    setGeoPriceInput('');
    setGeoSearchQuery('');
  };

  const removeGeoRule = (index: number) => {
    const rule = geoRules[index];
    if (rule?.id) {
      setDeletedGeoRuleIds((prev) => [...prev, rule.id!]);
    }
    setGeoRules((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllGeoRules = () => {
    Alert.alert(
      tr('b3_evnew_geo_clear_title'),
      'Are you sure you want to remove all custom location prices? Viewers will pay the default stream price.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove all',
          style: 'destructive',
          onPress: () => {
            const existingWithId = geoRules.filter((r) => r.id).map((r) => r.id!);
            if (existingWithId.length) {
              setDeletedGeoRuleIds((prev) => [...prev, ...existingWithId]);
            }
            setGeoRules([]);
          },
        },
      ],
    );
  };

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
    // below the minimum. Non-coordinators ("the rest") have digital purchases disabled.
    if (!isCoordinator) {
      if (visibility === 'PRIVATE' && priceNum < MIN_RWF) {
        setServerError(`A private event needs a live stream fee of at least ${MIN_RWF} RWF.`);
        return;
      }
      if (priceNum > 0 && priceNum < MIN_RWF) {
        setServerError(`Live stream access fee must be at least ${MIN_RWF} RWF.`);
        return;
      }
    }

    // Clients create free events only. The fee field is hidden for them unless
    // they stream a PRIVATE event themselves, so a stale value (edit prefill,
    // a draft, or a fee typed before switching back to a photographer) must
    // never reach the server for a public client event.
    const feeNum = isCoordinator || visibility === 'PRIVATE' ? priceNum : 0;

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
      attendanceMode: inPerson ? ('IN_PERSON' as const) : ('STREAM_ONLY' as const),
      organizer: values.organizer?.trim() || undefined,
      price: amount ?? (feeNum || undefined),
      // The "Live stream fee" field IS the stream fee (viewer paywall). Booking
      // events (amount param) carry no stream fee of their own.
      streamFee: feeNum || undefined,
      currency: isCoordinator ? selectedCurrency : params.currency,
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
        await updateEvent(params.editId, input, isCoordinator);
        if (cover) {
          try {
            await uploadEventPhoto(params.editId, cover, isCoordinator);
          } catch {
            // non-fatal
          }
        }
        if (isCoordinator) {
          for (const rule of geoRules) {
            try {
              await upsertGeoPrice(params.editId, {
                scopeType: rule.scopeType,
                scopeValue: rule.scopeValue,
                price: rule.price,
                currencyId: rule.currencyId,
              });
            } catch (err) {
              console.warn('Could not save geo price rule:', err);
            }
          }
          for (const ruleId of deletedGeoRuleIds) {
            try {
              await deleteGeoPrice(params.editId, ruleId);
            } catch (err) {
              console.warn('Could not delete geo price rule:', err);
            }
          }
        }
        router.replace(`/event/${params.editId}`);
        return;
      }

      // --- Create / book path -------------------------------------------
      const event = await createEvent(input, isCoordinator);

      // Persist coordinator geo-pricing rules if configured
      if (isCoordinator && event.id) {
        for (const rule of geoRules) {
          try {
            await upsertGeoPrice(event.id, {
              scopeType: rule.scopeType,
              scopeValue: rule.scopeValue,
              price: rule.price,
              currencyId: rule.currencyId,
            });
          } catch (err) {
            console.warn('Could not save geo price rule:', err);
          }
        }
      }

      // The event exists at this point, so a failed cover isn't fatal — but it
      // must be said out loud. An event without a cover cannot be published,
      // and an unpublished event never appears on connekyt.com, so silently
      // ignoring this left people with an event that was invisible for reasons
      // they had no way to discover.
      let coverFailed: string | null = null;
      try {
        await uploadEventPhoto(event.id, cover!, isCoordinator);
      } catch (e) {
        coverFailed = isApiError(e) ? e.message : 'The cover photo could not be uploaded.';
      }
      if (coverFailed) {
        Alert.alert(
          tr('b3_evnew_cover_not_uploaded_title'),
          `${coverFailed}\n\nYour event was created, but it needs a cover photo before it can be published. Open the event and edit it to add one.`,
        );
      }

      // Booking payment is completed in the app. Bookings are a real-world
      // service (Play-exempt). The sheet mints the handoff itself, so if the
      // declaration is not ready yet the user sees why and can pay later from
      // the event's Payments.
      if (amount && amount > 0) {
        setPayEventId(event.id);
        return;
      }

      router.replace(`/event/${event.id}`);
    } catch (err) {
      setServerError(isApiError(err) ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const busy = isSubmitting;
  const cats = isCoordinator ? [entertainmentCategory] : (categories.data ?? []);

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
          {isBooking ? (
            <LinearGradient colors={gradients.heroBlue} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.banner}>
              <Text style={styles.bannerLabel}>{tr('b3_evnew_booking')}</Text>
              <Text style={styles.bannerName}>{params.photographerName ?? 'Photographer'}</Text>
              {amount ? <Text style={styles.bannerPrice}>{formatPrice(amount, params.currency)}</Text> : null}
            </LinearGradient>
          ) : // The sheet header already says "New event"; only editing needs the in-body title for photographers.
          isPhotographer && !isEditing ? null : (
            <Text style={styles.title}>{isEditing ? 'Edit event' : 'New event'}</Text>
          )}

          <View style={styles.form}>
            <Text style={styles.formEyebrow}>EVENT</Text>
            {/* Cover photo (required) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{tr('b3_evnew_cover_photo')}</Text>
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
                    <Text style={styles.coverHint}>{tr('b3_evnew_add_cover')}</Text>
                  </View>
                )}
              </Pressable>
              {coverError ? <Text style={styles.errText}>{coverError}</Text> : null}
            </View>

            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label={tr('b3_evnew_title_label')} placeholder={tr('b3_evnew_title_ph')} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.title?.message} />
              )}
            />

            {/* Category */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{tr('b3_evnew_category_label')}</Text>
              {isCoordinator ? (
                <Controller
                  control={control}
                  name="category"
                  render={({ field: { onChange } }) => (
                    <View style={styles.chips}>
                      <Pressable
                        onPress={() => onChange(entertainmentCategory)}
                        style={[styles.chip, styles.chipActiveAccent]}
                      >
                        <Text style={[styles.chipText, styles.chipTextActive]}>
                          {entertainmentCategory}
                        </Text>
                      </Pressable>
                    </View>
                  )}
                />
              ) : categories.loading && !categories.data ? (
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
                          <Pressable
                            key={c}
                            onPress={() => onChange(c)}
                            style={[styles.chip, active && (isPhotographer ? styles.chipActive : styles.chipActiveAccent)]}
                          >
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
                    <Input placeholder={tr('b3_evnew_category_ph')} value={value} onChangeText={onChange} onBlur={onBlur} />
                  )}
                />
              )}
              {errors.category ? <Text style={styles.errText}>{errors.category.message}</Text> : null}
            </View>

            <Text style={styles.formEyebrow}>WHEN</Text>
            <Controller
              control={control}
              name="eventDate"
              render={({ field: { onChange, value } }) => (
                <DateField label={tr('b3_evnew_date_label')} value={value} onChange={onChange} error={errors.eventDate?.message} minimumDate={new Date()} />
              )}
            />

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Controller
                  control={control}
                  name="startTime"
                  render={({ field: { onChange, value } }) => (
                    <TimeField label={tr('b3_evnew_start_label')} value={value} onChange={onChange} error={errors.startTime?.message} />
                  )}
                />
              </View>
              <View style={styles.rowItem}>
                <Controller
                  control={control}
                  name="endTime"
                  render={({ field: { onChange, value } }) => (
                    <TimeField label={tr('b3_evnew_end_label')} value={value ?? ''} onChange={onChange} />
                  )}
                />
              </View>
            </View>

            {/* Coordinator: Pricing & Stream Fee (Prominently displayed) */}
            {isCoordinator ? (
              <View style={styles.coordinatorSection}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionIconBadge}>
                    <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.sectionHeading}>{tr('b3_evnew_pricing_heading')}</Text>
                    <Text style={styles.sectionSubheading}>
                      {tr('b3_evnew_pricing_sub')}
                    </Text>
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Controller
                      control={control}
                      name="price"
                      render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                          label={tr('b3_evnew_default_price')}
                          placeholder="0"
                          keyboardType="number-pad"
                          value={value}
                          onChangeText={onChange}
                          onBlur={onBlur}
                        />
                      )}
                    />
                  </View>

                  <View style={styles.rowItem}>
                    <Text style={styles.fieldLabel}>{tr('b3_evnew_currency')}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.currencyChipsScroll}
                    >
                      {currenciesList.map((c) => {
                        const active = selectedCurrency === c.code;
                        return (
                          <Pressable
                            key={c.code}
                            onPress={() => {
                              setSelectedCurrency(c.code);
                              setCurrencyId(c.id);
                            }}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {c.code}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>
                </View>
              </View>
            ) : null}

            {/* Coordinator: Geo-pricing Rules */}
            {isCoordinator ? (
              <View style={styles.coordinatorSection}>
                <Pressable
                  style={styles.sectionHeaderRow}
                  onPress={() => setShowGeoPricing((v) => !v)}
                >
                  <View style={styles.sectionIconBadge}>
                    <Ionicons name="earth" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={styles.sectionHeading}>{tr('b3_evnew_geo_heading')}</Text>
                    <Text style={styles.sectionSubheading}>
                      {tr('b3_evnew_geo_sub')}
                    </Text>
                  </View>
                  <Ionicons
                    name={showGeoPricing ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={colors.primary}
                  />
                </Pressable>

                {showGeoPricing ? (
                  <View style={styles.geoBody}>
                    <Text style={styles.geoIntroText}>
                      {tr('b3_evnew_geo_intro')}
                    </Text>

                    {/* Filter Tabs & Search */}
                    <View style={styles.fieldGroup}>
                      <View style={styles.geoFilterHeader}>
                        <Text style={styles.fieldLabel}>{tr('b3_evnew_select_locations')}</Text>
                        <View style={styles.geoTabsRow}>
                          {(['ALL', 'CONTINENT', 'COUNTRY'] as const).map((tab) => (
                            <Pressable
                              key={tab}
                              onPress={() => setGeoFilterTab(tab)}
                              style={[
                                styles.geoFilterTab,
                                geoFilterTab === tab && styles.geoFilterTabActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.geoFilterTabText,
                                  geoFilterTab === tab && styles.geoFilterTabTextActive,
                                ]}
                              >
                                {tab === 'ALL'
                                  ? 'All'
                                  : tab === 'CONTINENT'
                                    ? 'Continents'
                                    : 'Countries'}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      {/* Search Bar */}
                      <Input
                        placeholder={tr('b3_evnew_geo_search_ph')}
                        value={geoSearchQuery}
                        onChangeText={setGeoSearchQuery}
                        leftElement={
                          <Ionicons
                            name="search-outline"
                            size={18}
                            color={colors.textMuted}
                            style={{ marginLeft: spacing.sm, marginRight: spacing.xs }}
                          />
                        }
                      />

                      {/* Selected Locations Tray */}
                      {selectedGeoLocations.length > 0 ? (
                        <View style={styles.selectedLocationsTray}>
                          <View style={styles.selectedLocationsHeader}>
                            <Text style={styles.selectedLocationsCount}>
                              Selected ({selectedGeoLocations.length}):
                            </Text>
                            <Pressable onPress={clearSelectedGeoLocations} hitSlop={6}>
                              <Text style={styles.clearSelectionLink}>{tr('b3_evnew_clear_all')}</Text>
                            </Pressable>
                          </View>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.selectedChipsScroll}
                          >
                            {selectedGeoLocations.map((item) => (
                              <Pressable
                                key={`${item.scopeType}-${item.code}`}
                                onPress={() => removeSelectedGeoLocation(item)}
                                style={styles.selectedTrayChip}
                              >
                                <Ionicons
                                  name={
                                    item.scopeType === 'CONTINENT'
                                      ? 'globe-outline'
                                      : 'flag-outline'
                                  }
                                  size={13}
                                  color={colors.primary}
                                />
                                <Text style={styles.selectedTrayChipText}>
                                  {item.label} ({item.scopeType === 'CONTINENT' ? 'Continent' : 'Country'})
                                </Text>
                                <Ionicons
                                  name="close-circle"
                                  size={15}
                                  color={colors.textMuted}
                                />
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      ) : null}

                      {/* Locations Options */}
                      <View style={styles.locationsListContainer}>
                        <View style={styles.locationsListHeaderRow}>
                          <Text style={styles.locationsAvailableText}>
                            {filteredGeoRegions.length} available
                          </Text>
                          {filteredGeoRegions.length > 1 && filteredGeoRegions.length <= 15 ? (
                            <Pressable onPress={selectAllMatching} hitSlop={6}>
                              <Text style={styles.selectAllLink}>{tr('b3_evnew_select_all_shown')}</Text>
                            </Pressable>
                          ) : null}
                        </View>

                        <ScrollView
                          style={styles.locationsScrollArea}
                          contentContainerStyle={styles.locationsWrap}
                          nestedScrollEnabled
                          keyboardShouldPersistTaps="handled"
                        >
                          {filteredGeoRegions.map((item) => {
                            const isSelected = selectedGeoLocations.some(
                              (x) => x.scopeType === item.scopeType && x.code === item.code,
                            );
                            const hasExistingRule = geoRules.some(
                              (r) => r.scopeType === item.scopeType && r.scopeValue === item.code,
                            );
                            return (
                              <Pressable
                                key={`${item.scopeType}-${item.code}`}
                                onPress={() => toggleGeoLocation(item)}
                                style={[
                                  styles.geoItemChip,
                                  isSelected && styles.geoItemChipSelected,
                                  hasExistingRule && !isSelected && styles.geoItemChipHasRule,
                                ]}
                              >
                                <Ionicons
                                  name={
                                    isSelected
                                      ? 'checkmark-circle'
                                      : item.scopeType === 'CONTINENT'
                                        ? 'globe-outline'
                                        : 'flag-outline'
                                  }
                                  size={14}
                                  color={
                                    isSelected
                                      ? colors.textOnPrimary
                                      : hasExistingRule
                                        ? colors.primary
                                        : colors.textMuted
                                  }
                                />
                                <Text
                                  style={[
                                    styles.geoItemChipText,
                                    isSelected && styles.geoItemChipTextSelected,
                                  ]}
                                >
                                  {item.label}
                                </Text>
                                {geoFilterTab === 'ALL' ? (
                                  <Text
                                    style={[
                                      styles.geoItemScopeBadge,
                                      isSelected && styles.geoItemScopeBadgeSelected,
                                    ]}
                                  >
                                    {item.scopeType === 'CONTINENT' ? 'Cont' : 'Ctry'}
                                  </Text>
                                ) : null}
                              </Pressable>
                            );
                          })}
                          {filteredGeoRegions.length === 0 ? (
                            <Text style={styles.noMatchText}>
                              No regions match &quot;{geoSearchQuery}&quot;.
                            </Text>
                          ) : null}
                        </ScrollView>
                      </View>
                    </View>

                    {/* Price and Currency for this region */}
                    <View style={styles.row}>
                      <View style={styles.rowItem}>
                        <Input
                          label={
                            selectedGeoLocations.length > 1
                              ? `Price for ${selectedGeoLocations.length} locations`
                              : selectedGeoLocations.length === 1
                                ? `Price for ${selectedGeoLocations[0].label}`
                                : 'Regional Price'
                          }
                          placeholder="0.00"
                          keyboardType="decimal-pad"
                          value={geoPriceInput}
                          onChangeText={setGeoPriceInput}
                        />
                      </View>
                      <View style={styles.rowItem}>
                        <Text style={styles.fieldLabel}>{tr('b3_evnew_currency')}</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.currencyChipsScroll}
                        >
                          {currenciesList.map((c) => {
                            const active = (geoCurrencyId ? geoCurrencyId === c.id : selectedCurrency === c.code);
                            return (
                              <Pressable
                                key={c.code}
                                onPress={() => setGeoCurrencyId(c.id)}
                                style={[styles.chip, active && styles.chipActive]}
                              >
                                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                  {c.code}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </ScrollView>
                      </View>
                    </View>

                    {geoError ? <Text style={styles.errText}>{geoError}</Text> : null}

                    <Button
                      title={
                        selectedGeoLocations.length > 1
                          ? `Apply Price (${geoPriceInput || '0'} ${currenciesList.find((c) => (geoCurrencyId ? c.id === geoCurrencyId : c.code === selectedCurrency))?.code || selectedCurrency}) to ${selectedGeoLocations.length} Locations`
                          : selectedGeoLocations.length === 1
                            ? `Add Price for ${selectedGeoLocations[0].label}`
                            : 'Add Location Price'
                      }
                      variant="outline"
                      onPress={addGeoRules}
                    />

                    {/* Active Rules List */}
                    {geoRules.length > 0 ? (
                      <View style={styles.rulesList}>
                        <View style={styles.rulesListHeaderRow}>
                          <Text style={styles.rulesListHeader}>
                            Active Location Prices ({geoRules.length})
                          </Text>
                          <Pressable onPress={clearAllGeoRules} hitSlop={6}>
                            <Text style={styles.clearAllRulesText}>{tr('b3_evnew_remove_all')}</Text>
                          </Pressable>
                        </View>
                        {geoRules.map((rule, idx) => (
                          <View
                            key={`${rule.scopeType}-${rule.scopeValue}-${idx}`}
                            style={styles.ruleItem}
                          >
                            <View style={styles.ruleBadge}>
                              <Ionicons
                                name={
                                  rule.scopeType === 'CONTINENT'
                                    ? 'globe-outline'
                                    : 'flag-outline'
                                }
                                size={14}
                                color={colors.primary}
                              />
                            </View>
                            <View style={styles.flex}>
                              <Text style={styles.ruleLocationText}>
                                {regionLabel(rule.scopeType, rule.scopeValue)}
                              </Text>
                              <Text style={styles.ruleScopeText}>
                                {rule.scopeType === 'CONTINENT' ? 'Continent' : 'Country'}
                              </Text>
                            </View>
                            <Text style={styles.rulePriceText}>
                              {formatPrice(Number(rule.price), rule.currencyCode || selectedCurrency)}
                            </Text>
                            <Pressable
                              onPress={() => removeGeoRule(idx)}
                              hitSlop={8}
                              style={styles.ruleDeleteBtn}
                            >
                              <Ionicons name="trash-outline" size={18} color={colors.error} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.noRulesText}>
                        {tr('b3_evnew_no_geo_rules')}
                      </Text>
                    )}

                    {isEditing && params.editId ? (
                      <Pressable
                        style={styles.openDedicatedGeoBtn}
                        onPress={() =>
                          router.push(`/event/geo-pricing?eventId=${params.editId}` as never)
                        }
                      >
                        <Ionicons name="open-outline" size={16} color={colors.primary} />
                        <Text style={styles.openDedicatedGeoText}>
                          {tr('b3_evnew_open_geo_mgr')}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Visibility drives the whole model, so it's always visible. */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{tr('b3_evnew_who_covers')}</Text>
              <Segmented
                value={visibility}
                onChange={(v) => setVisibility(v)}
                options={[
                  { label: 'A photographer', value: 'PUBLIC' },
                  { label: 'I stream it myself', value: 'PRIVATE' },
                ]}
              />
              <View style={styles.visibilityHintBox}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={15}
                  color={colors.success}
                  style={styles.visibilityHintIcon}
                />
                <Text style={styles.visibilityHint}>
                  {visibility === 'PRIVATE'
                    ? 'You go live yourself, with no photographer and no booking. Viewers pay to watch, so it needs a fee of at least 100 RWF.'
                    : 'A photographer covers your event and streams it. Published events appear on connekyt.com.'}
                </Text>
              </View>
            </View>

            {!isCoordinator && visibility === 'PRIVATE' ? (
              <Controller
                control={control}
                name="price"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label={tr('b3_evnew_stream_fee_label')}
                    placeholder={tr('b3_evnew_stream_fee_ph')}
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
              <Text style={styles.moreToggleText}>{tr('b3_evnew_more_options')}</Text>
              <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
            </Pressable>

            {showMore ? (
              <View style={styles.moreSection}>
                {/* Location breakdown */}
                <Controller control={control} name="venueName" render={({ field: { onChange, onBlur, value } }) => (
                  <Input label={tr('b3_evnew_venue_label')} placeholder={tr('b3_evnew_venue_ph')} value={value} onChangeText={onChange} onBlur={onBlur} />
                )} />
                <Pressable
                  onPress={() => setInPerson((v) => !v)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: inPerson }}
                  style={styles.attestRow}
                >
                  <Ionicons
                    name={inPerson ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={inPerson ? colors.primary : colors.textMuted}
                  />
                  <View style={styles.attestBody}>
                    <Text style={styles.attestTitle}>{tr('b3_evnew_in_person_title')}</Text>
                    <Text style={styles.hint}>
                      {tr('b3_evnew_in_person_hint')}
                    </Text>
                  </View>
                </Pressable>
                <Controller control={control} name="address" render={({ field: { onChange, onBlur, value } }) => (
                  <Input label={tr('b3_evnew_address_label')} placeholder={tr('b3_evnew_address_ph')} value={value} onChangeText={onChange} onBlur={onBlur} />
                )} />
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Controller control={control} name="city" render={({ field: { onChange, onBlur, value } }) => (
                      <Input label={tr('b3_evnew_city_label')} placeholder={tr('b3_evnew_city_label')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    )} />
                  </View>
                  <View style={styles.rowItem}>
                    <Controller control={control} name="country" render={({ field: { onChange, onBlur, value } }) => (
                      <Input label={tr('b3_evnew_country_label')} placeholder={tr('b3_evnew_country_label')} value={value} onChangeText={onChange} onBlur={onBlur} />
                    )} />
                  </View>
                </View>

                {/* Max guests */}
                <View style={styles.row}>
                  <View style={styles.rowItem}>
                    <Controller control={control} name="maxGuests" render={({ field: { onChange, onBlur, value } }) => (
                      <Input label={tr('b3_evnew_max_guests')} placeholder="0" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} />
                    )} />
                  </View>
                </View>

                {/* Tags */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>{tr('b3_evnew_tags')}</Text>
                  <View style={styles.tagRow}>
                    <View style={styles.tagInput}>
                      <Input placeholder={tr('b3_evnew_add_tag_ph')} value={tagInput} onChangeText={setTagInput} onSubmitEditing={addTag} returnKeyType="done" />
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
                  <Input label={tr('b3_evnew_organizer_label')} placeholder={tr('b3_evnew_organizer_ph')} value={value} onChangeText={onChange} onBlur={onBlur} />
                )} />

                {/* Assign photographer — public events only; a private event is
                    self-streamed and never takes a photographer. */}
                {!isBooking && visibility === 'PUBLIC' ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{tr('b3_evnew_photog_opt')}</Text>
                    {selPhotog ? (
                      <View style={styles.assignCard}>
                        <View style={styles.flex}>
                          <Text style={styles.assignName}>{selPhotog.name}</Text>
                          {selPackage ? (
                            <Text style={styles.assignSub}>
                              {selPackage.name}
                              {selPackage.price != null ? ` · ${formatPrice(selPackage.price, selPackage.currency)}` : ''}
                            </Text>
                          ) : (
                            <Text style={styles.assignSub}>{tr('b3_evnew_no_pkg')}</Text>
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
                        <Text style={styles.assignBtnText}>{tr('b3_evnew_assign_photog')}</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}

                {/* Escrow (only when a package is in play) */}
                {hasPackage ? (
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{tr('b3_evnew_escrow_label')}</Text>
                    <Text style={styles.hint}>{tr('b3_evnew_escrow_hint')}</Text>
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

            <Text style={styles.formEyebrow}>ABOUT</Text>
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label={tr('b3_evnew_desc_label')} placeholder={tr('b3_evnew_desc_ph')} value={value} onChangeText={onChange} onBlur={onBlur} multiline style={styles.multiline} />
              )}
            />

          </View>
        </ScrollView>
        <View style={styles.stickyBar}>
          {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}
          <Button
            title={
              isEditing
                ? 'Save changes'
                : amount
                  ? `Book & pay ${formatPrice(amount, params.currency)}`
                  : 'Create event'
            }
            onPress={handleSubmit(onSubmit)}
            loading={busy}
          />
        </View>
      </KeyboardAvoidingView>

      {/* Photographer / package picker */}
      <Modal visible={pickerOpen} transparent animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <GlassScrim style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <GlassSheetHost style={styles.pickerSheet}>
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
                  ListEmptyComponent={<Text style={styles.pickerEmpty}>{tr('b3_evnew_no_photogs')}</Text>}
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
                ListEmptyComponent={<Text style={styles.pickerEmpty}>{tr('b3_evnew_no_pkgs')}</Text>}
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
                      {item.price != null ? <Text style={styles.pickerSub}>{formatPrice(item.price, item.currency)}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                )}
              />
            )}
          </GlassSheetHost>
        </GlassScrim>
      </Modal>
      <HandoffCheckoutSheet
        visible={!!payEventId}
        onClose={() => router.replace(`/event/${payEventId}`)}
        handoff={payEventId ? { type: 'BOOKING_DECLARATION', eventId: payEventId } : null}
        title={tr('b3_evnew_booking_payment')}
        subtitle={tr('b3_evnew_reserve_date')}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xl, gap: spacing.xl },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  banner: { borderRadius: radii.xl, padding: spacing.lg, gap: 2 },
  formEyebrow: { fontSize: fontSize.xs, fontWeight: fontWeight.extrabold, color: c.accent, letterSpacing: 1.2, marginBottom: -spacing.xs },
  stickyBar: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md, gap: spacing.xs, backgroundColor: c.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft },
  bannerLabel: { color: 'rgba(255,255,255,0.82)', fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 1 },
  bannerName: { color: c.textOnPrimary, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  bannerPrice: { color: 'rgba(255,255,255,0.92)', fontSize: fontSize.md, fontWeight: fontWeight.semibold, marginTop: 2 },
  form: { gap: spacing.lg },

  fieldGroup: { gap: spacing.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  hint: { fontSize: fontSize.xs, color: c.textMuted },
  visibilityHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: c.successBg,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: 4,
    borderWidth: 1,
    borderColor: c.success + '25',
  },
  visibilityHintIcon: {
    marginTop: 2,
  },
  visibilityHint: {
    flex: 1,
    fontSize: fontSize.xs,
    color: c.success,
    lineHeight: 18,
    fontWeight: fontWeight.medium,
  },
  errText: { fontSize: fontSize.xs, color: c.error },
  attestRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  attestBody: { flex: 1, gap: 2 },
  attestTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text },
  alignStart: { alignSelf: 'flex-start' },

  cover: { height: 170, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  coverError: { borderColor: c.error },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  coverHint: { fontSize: fontSize.sm, color: c.textSoft, fontWeight: fontWeight.semibold },
  coverEditBadge: { position: 'absolute', right: spacing.md, bottom: spacing.md, width: 32, height: 32, borderRadius: radii.full, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipActiveAccent: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  chipTextActive: { color: c.textOnPrimary },

  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1, justifyContent: 'flex-end' },

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

  multiline: { minHeight: 100, paddingTop: spacing.md, textAlignVertical: 'top' },
  serverError: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },

  pickerBackdrop: { flex: 1, justifyContent: 'flex-end' },
  pickerSheet: { maxHeight: '75%', paddingBottom: spacing.xl },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  pickerTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  iconSpacer: { width: 22 },
  pickerLoader: { paddingVertical: spacing['2xl'] },
  pickerList: { paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  pickerEmpty: { textAlign: 'center', color: c.textMuted, paddingVertical: spacing['2xl'] },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  pickerName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  pickerSub: { fontSize: fontSize.sm, color: c.textMuted },

  coordinatorSection: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  sectionIconBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeading: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  sectionSubheading: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  currencyChipsScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  geoBody: {
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  geoIntroText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    lineHeight: 17,
  },
  geoFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  geoTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  geoFilterTab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  geoFilterTabActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  geoFilterTabText: {
    fontSize: 12,
    fontWeight: fontWeight.medium,
    color: c.textSoft,
  },
  geoFilterTabTextActive: {
    color: c.textOnPrimary,
    fontWeight: fontWeight.bold,
  },
  selectedLocationsTray: {
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  selectedLocationsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedLocationsCount: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  clearSelectionLink: {
    fontSize: fontSize.xs,
    color: c.primary,
    fontWeight: fontWeight.semibold,
  },
  selectedChipsScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  selectedTrayChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.primary,
  },
  selectedTrayChipText: {
    fontSize: fontSize.xs,
    color: c.text,
    fontWeight: fontWeight.semibold,
  },
  locationsListContainer: {
    gap: 4,
    marginTop: 2,
  },
  locationsListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  locationsAvailableText: {
    fontSize: 12,
    color: c.textMuted,
  },
  selectAllLink: {
    fontSize: 12,
    color: c.primary,
    fontWeight: fontWeight.semibold,
  },
  locationsScrollArea: {
    maxHeight: 180,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surfaceMuted,
    padding: spacing.sm,
  },
  locationsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  geoItemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  geoItemChipSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  geoItemChipHasRule: {
    borderColor: c.primary,
    borderStyle: 'dashed',
  },
  geoItemChipText: {
    fontSize: fontSize.xs,
    color: c.textSoft,
    fontWeight: fontWeight.medium,
  },
  geoItemChipTextSelected: {
    color: c.textOnPrimary,
    fontWeight: fontWeight.bold,
  },
  geoItemScopeBadge: {
    fontSize: 12,
    color: c.textMuted,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: c.surfaceMuted,
    textTransform: 'uppercase',
  },
  geoItemScopeBadgeSelected: {
    color: c.textOnPrimary,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  noMatchText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontStyle: 'italic',
    paddingVertical: spacing.sm,
    textAlign: 'center',
    width: '100%',
  },
  rulesList: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  rulesListHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  rulesListHeader: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
    textTransform: 'uppercase',
  },
  clearAllRulesText: {
    fontSize: fontSize.xs,
    color: c.error,
    fontWeight: fontWeight.semibold,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  ruleBadge: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruleLocationText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: c.text,
  },
  ruleScopeText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  rulePriceText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  ruleDeleteBtn: {
    padding: spacing.xs,
  },
  noRulesText: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  openDedicatedGeoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  openDedicatedGeoText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.primary,
  },
}));
