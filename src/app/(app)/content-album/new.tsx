/**
 * New content album — the photographer's stock/library album creator.
 *
 * Saved as a draft; the photographer submits it for admin approval from
 * the album detail screen, after which it goes live on Connekyt's public
 * browse. Posts to /photographer/albums/content via createContentAlbum.
 *
 * (This is distinct from the normal Event/Personal album creator at
 * /album/new — content albums are the paid stock library.)
 */
import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { createContentAlbum, listAlbumCategories } from '@/features/gallery/api';
import { listCurrencies } from '@/features/reference/api';
import { useAsync } from '@/hooks/useAsync';
import { pickFromLibrary, pickMultipleFromLibrary, type PickedImage } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

const schema = z.object({
  title: z.string().min(1, 'Give the album a title'),
  description: z.string().optional(),
  pricePerImage: z
    .string()
    .regex(/^\d+$/, 'Enter a price')
    .refine((v) => Number(v) >= 100, 'At least 100 per photo'),
});
type FormValues = z.infer<typeof schema>;

export default function NewContentAlbumScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [imagesError, setImagesError] = useState<string | null>(null);
  const [category, setCategory] = useState('');
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [currencyId, setCurrencyId] = useState('');

  const categories = useAsync(useCallback(() => listAlbumCategories(), []));
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
    defaultValues: { title: '', description: '', pricePerImage: '' },
  });

  const addCover = async () => {
    const img = await pickFromLibrary();
    if (img) setCover(img);
  };
  const addPhotos = async () => {
    const arr = await pickMultipleFromLibrary(30);
    if (arr.length) {
      setImages((prev) => [...prev, ...arr]);
      setImagesError(null);
    }
  };
  const removePhoto = (uri: string) => setImages((prev) => prev.filter((x) => x.uri !== uri));

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    if (!category) {
      setCategoryError('Pick a category');
      return;
    }
    if (!currencyId) {
      setServerError('Pick a currency');
      return;
    }
    if (!images.length) {
      setImagesError('Add at least one photo');
      return;
    }
    try {
      await createContentAlbum({
        title: values.title,
        description: values.description || undefined,
        category,
        pricePerImage: Number(values.pricePerImage),
        currencyId,
        cover,
        images,
      });
      router.back();
    } catch (e) {
      setServerError(isApiError(e) ? e.message : 'Something went wrong. Please try again.');
    }
  };

  const cats = categories.data ?? [];

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>New content album</Text>
        <Text style={styles.sub}>
          Saved as a draft. Submit it for approval from the album screen and we&apos;ll review it before it
          goes live on Connekyt&apos;s public browse.
        </Text>

        {/* Cover */}
        <View style={styles.group}>
          <Text style={styles.label}>COVER IMAGE (OPTIONAL)</Text>
          <Pressable onPress={addCover} style={styles.cover}>
            {cover ? (
              <Image source={{ uri: cover.uri }} style={styles.coverImg} contentFit="cover" />
            ) : (
              <View style={styles.coverPlaceholder}>
                <Ionicons name="image-outline" size={26} color={colors.primary} />
                <Text style={styles.hint}>Add a cover — falls back to your first photo</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Photos */}
        <View style={styles.group}>
          <Text style={styles.label}>PHOTOS (REQUIRED)</Text>
          <View style={styles.thumbs}>
            {images.map((img) => (
              <View key={img.uri} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                <Pressable style={styles.thumbX} onPress={() => removePhoto(img.uri)} hitSlop={6}>
                  <Ionicons name="close" size={12} color={colors.textOnPrimary} />
                </Pressable>
              </View>
            ))}
            <Pressable style={styles.addThumb} onPress={addPhotos}>
              <Ionicons name="add" size={26} color={colors.primary} />
            </Pressable>
          </View>
          {images.length ? <Text style={styles.hint}>{images.length} photo{images.length > 1 ? 's' : ''}</Text> : null}
          {imagesError ? <Text style={styles.err}>{imagesError}</Text> : null}
        </View>

        <Controller
          control={control}
          name="title"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Title" placeholder="e.g. Diplomatic Reception, Kigali 2026" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.title?.message} />
          )}
        />

        {/* Category */}
        <View style={styles.group}>
          <Text style={styles.label}>CATEGORY</Text>
          {categories.loading && !categories.data ? (
            <ActivityIndicator color={colors.primary} style={styles.alignStart} />
          ) : (
            <View style={styles.chips}>
              {cats.map((c) => {
                const active = category === c.value;
                return (
                  <Pressable
                    key={c.value}
                    onPress={() => {
                      setCategory(c.value);
                      setCategoryError(null);
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {categoryError ? <Text style={styles.err}>{categoryError}</Text> : null}
        </View>

        {/* Price + currency */}
        <View style={styles.row}>
          <View style={styles.rowItem}>
            <Controller
              control={control}
              name="pricePerImage"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input label="Price per image" placeholder="e.g. 500" keyboardType="number-pad" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.pricePerImage?.message} />
              )}
            />
          </View>
          <View style={styles.rowItem}>
            <Text style={styles.label}>CURRENCY</Text>
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

        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input label="Description (optional)" placeholder="Caption-style summary that public browsers will see." value={value} onChangeText={onChange} onBlur={onBlur} multiline style={styles.multiline} />
          )}
        />

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

        <Button title="Create draft" onPress={handleSubmit(onSubmit)} loading={isSubmitting} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.lg },
  title: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20, marginTop: -8 },
  group: { gap: spacing.xs },
  label: { fontFamily: fonts.bold, fontSize: 11, color: c.accent, letterSpacing: 0.6 },
  hint: { fontSize: fontSize.xs, color: c.textMuted },
  err: { fontSize: fontSize.xs, color: c.error },
  alignStart: { alignSelf: 'flex-start' },

  cover: { height: 150, borderRadius: radii.lg, overflow: 'hidden', borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', backgroundColor: c.surfaceMuted },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg },

  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { width: 72, height: 72, borderRadius: radii.md, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbX: { position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: radii.full, backgroundColor: 'rgba(8,58,133,0.85)', alignItems: 'center', justifyContent: 'center' },
  addThumb: { width: 72, height: 72, borderRadius: radii.md, borderWidth: 1, borderColor: c.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  chipTextActive: { color: c.textOnPrimary },

  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1, gap: spacing.xs },
  multiline: { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },
  serverError: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },
}));
