/**
 * New content album — the photographer's stock & commercial catalog creator.
 *
 * 20/20 Master-Grade Design:
 *   • Top Navigation Bar: Circular back button, category eyebrow, and display title.
 *   • Containerized Form Cards: Apple Settings / Airbnb style container cards.
 *   • Category & Currency Chips: Clean rounded pills with active state indicators.
 *   • Photo & Cover Drop-Zones: Cover preview card + photo thumbnail mosaic with
 *     live count and one-tap remove badges.
 *   • Informative Workflow Callout: Transparent explanation of the draft & approval lifecycle.
 *   • NO LinearGradient, NO top-tear accents — pure solid theme tokens.
 */
import { useCallback, useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Screen } from '@/components/ui/Screen';
import { createContentAlbum, listAlbumCategories } from '@/features/gallery/api';
import { listCurrencies } from '@/features/reference/api';
import { OptionsNote } from '@/components/ui/OptionsNote';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/hooks/useLanguage';
import { pickFromLibrary, pickMultipleFromLibrary, type PickedImage } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

const NCA_I18N = {
  en: {
    errTitle: 'Please enter an album title',
    errNumeric: 'Enter a numeric price',
    errMinPrice: 'Price must be at least 100',
    errCategory: 'Please choose a category',
    errCurrency: 'Please select a currency',
    errPhotos: 'Please add at least one photo',
    errCreate: 'Could not create album. Please try again.',
    backA11y: 'Back',
    eyebrow: 'STOCK CATALOG',
    title: 'New Content Album',
    notePrefix: 'Saved as a ',
    noteDraft: 'draft',
    noteSuffix: ". Submit it for review from the album viewer to publish to Connekt's public stock catalog.",
    sectionDetails: 'COLLECTION DETAILS',
    labelTitle: 'ALBUM TITLE',
    placeholderTitle: 'e.g. Diplomatic Reception, Kigali 2026',
    labelDesc: 'DESCRIPTION (OPTIONAL)',
    placeholderDesc: 'Caption-style summary for public browsers and stock buyers…',
    labelCategory: 'CATEGORY',
    sectionPricing: 'COMMERCIAL PRICING',
    labelPrice: 'PRICE PER PHOTO',
    placeholderPrice: 'e.g. 500',
    labelCurrency: 'CURRENCY',
    labelCover: 'COVER PHOTO (OPTIONAL)',
    coverHint: 'Tap to select a custom cover photo (or falls back to first photo)',
    labelStockPhotos: 'STOCK PHOTOS',
    photosCount: '{count} photos',
    addMorePhotos: 'Add more stock photos',
    selectFromLib: 'Select photos from library',
    readyForReview: '{count} photos ready for review',
    helperUpload: 'High-resolution images will be submitted for commercial stock catalog.',
    readyToUpload: 'Ready to upload',
    clearAll: 'Clear all',
    removePhotoA11y: 'Remove photo',
    cancel: 'Cancel',
    createBtn: 'Create Draft Album',
  },
  fr: {
    errTitle: 'Veuillez saisir un titre d’album',
    errNumeric: 'Saisissez un prix numérique',
    errMinPrice: 'Le prix doit être d’au moins 100',
    errCategory: 'Veuillez choisir une catégorie',
    errCurrency: 'Veuillez sélectionner une devise',
    errPhotos: 'Veuillez ajouter au moins une photo',
    errCreate: 'Impossible de créer l’album. Veuillez réessayer.',
    backA11y: 'Retour',
    eyebrow: 'CATALOGUE DE CONTENU',
    title: 'Nouvel album de contenu',
    notePrefix: 'Enregistré comme ',
    noteDraft: 'brouillon',
    noteSuffix: '. Soumettez-le pour examen depuis la visionneuse pour le publier dans le catalogue public Connekt.',
    sectionDetails: 'DÉTAILS DE LA COLLECTION',
    labelTitle: 'TITRE DE L’ALBUM',
    placeholderTitle: 'ex. Réception diplomatique, Kigali 2026',
    labelDesc: 'DESCRIPTION (OPTIONNEL)',
    placeholderDesc: 'Résumé pour les visiteurs et acheteurs…',
    labelCategory: 'CATÉGORIE',
    sectionPricing: 'TARIFICATION COMMERCIALE',
    labelPrice: 'PRIX PAR PHOTO',
    placeholderPrice: 'ex. 500',
    labelCurrency: 'DEVISE',
    labelCover: 'PHOTO DE COUVERTURE (OPTIONNEL)',
    coverHint: 'Appuyez pour choisir une couverture personnalisée (ou utilise la première photo)',
    labelStockPhotos: 'PHOTOS DE CONTENU',
    photosCount: '{count} photos',
    addMorePhotos: 'Ajouter plus de photos',
    selectFromLib: 'Sélectionner des photos de la galerie',
    readyForReview: '{count} photos prêtes pour examen',
    helperUpload: 'Des images haute résolution seront soumises au catalogue commercial.',
    readyToUpload: 'Prêt à téléverser',
    clearAll: 'Tout effacer',
    removePhotoA11y: 'Retirer la photo',
    cancel: 'Annuler',
    createBtn: 'Créer le brouillon d’album',
  },
  es: {
    errTitle: 'Por favor ingresa un título de álbum',
    errNumeric: 'Ingresa un precio numérico',
    errMinPrice: 'El precio debe ser de al menos 100',
    errCategory: 'Por favor elige una categoría',
    errCurrency: 'Por favor selecciona una moneda',
    errPhotos: 'Por favor añade al menos una foto',
    errCreate: 'No se pudo crear el álbum. Inténtalo de nuevo.',
    backA11y: 'Atrás',
    eyebrow: 'CATÁLOGO DE STOCK',
    title: 'Nuevo álbum de contenido',
    notePrefix: 'Guardado como ',
    noteDraft: 'borrador',
    noteSuffix: '. Envíalo a revisión desde el visor del álbum para publicarlo en el catálogo público de Connekt.',
    sectionDetails: 'DETALLES DE LA COLECCIÓN',
    labelTitle: 'TÍTULO DEL ÁLBUM',
    placeholderTitle: 'ej. Recepción Diplomática, Kigali 2026',
    labelDesc: 'DESCRIPCIÓN (OPCIONAL)',
    placeholderDesc: 'Resumen para visitantes y compradores…',
    labelCategory: 'CATEGORÍA',
    sectionPricing: 'PRECIOS COMERCIALES',
    labelPrice: 'PRECIO POR FOTO',
    placeholderPrice: 'ej. 500',
    labelCurrency: 'MONEDA',
    labelCover: 'FOTO DE PORTADA (OPCIONAL)',
    coverHint: 'Toca para elegir una portada personalizada (o usa la primera foto)',
    labelStockPhotos: 'FOTOS DE STOCK',
    photosCount: '{count} fotos',
    addMorePhotos: 'Añadir más fotos de stock',
    selectFromLib: 'Seleccionar fotos de la galería',
    readyForReview: '{count} fotos listas para revisión',
    helperUpload: 'Se enviarán imágenes de alta resolución para el catálogo comercial.',
    readyToUpload: 'Listo para subir',
    clearAll: 'Borrar todo',
    removePhotoA11y: 'Eliminar foto',
    cancel: 'Cancelar',
    createBtn: 'Crear borrador de álbum',
  },
} as const;

export default function NewContentAlbumScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useLanguage();
  const s = NCA_I18N[language] ?? NCA_I18N.en;

  const schema = z.object({
    title: z.string().min(1, s.errTitle),
    description: z.string().optional(),
    pricePerImage: z
      .string()
      .regex(/^\d+$/, s.errNumeric)
      .refine((v) => Number(v) >= 100, s.errMinPrice),
  });
  type FormValues = z.infer<typeof schema>;

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
      setCategoryError(s.errCategory);
      return;
    }
    if (!currencyId) {
      setServerError(s.errCurrency);
      return;
    }
    if (!images.length) {
      setImagesError(s.errPhotos);
      return;
    }
    try {
      await createContentAlbum({
        title: values.title.trim(),
        description: values.description?.trim() || undefined,
        category,
        pricePerImage: Number(values.pricePerImage),
        currencyId,
        cover,
        images,
      });
      router.back();
    } catch (e) {
      setServerError(isApiError(e) ? e.message : s.errCreate);
    }
  };

  const cats = categories.data ?? [];

  return (
    <Screen padded={false} edges={[]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: Math.max(insets.bottom + 40, 60) },
          ]}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
            <Pressable
              style={styles.backBtn}
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityLabel={s.backA11y}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <View style={{ flex: 1, gap: 1 }}>
              <Text style={styles.eyebrow}>{s.eyebrow}</Text>
              <Text style={styles.h1}>{s.title}</Text>
            </View>
          </View>

          {/* Workflow Info Note */}
          <View style={styles.note}>
            <Ionicons name="information-circle" size={18} color={colors.primary} />
            <Text style={styles.noteText}>
              {s.notePrefix}<Text style={styles.bold}>{s.noteDraft}</Text>{s.noteSuffix}
            </Text>
          </View>

          {/* Card 1: Details */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>{s.sectionDetails}</Text>

            <FieldLabel text={s.labelTitle} required />
            <Controller
              control={control}
              name="title"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, errors.title && styles.inputError]}
                  placeholder={s.placeholderTitle}
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            {errors.title?.message ? (
              <Text style={styles.err}>{errors.title.message}</Text>
            ) : null}

            <FieldLabel text={s.labelDesc} />
            <Controller
              control={control}
              name="description"
              render={({ field: { onChange, onBlur, value } }) => (
                <TextInput
                  style={[styles.input, styles.multiline]}
                  placeholder={s.placeholderDesc}
                  placeholderTextColor={colors.textMuted}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  multiline
                />
              )}
            />
          </View>

          {/* Card 2: Category Selector */}
          <View style={styles.cardSection}>
            <FieldLabel text={s.labelCategory} required />
            {categories.loading && !categories.data ? (
              <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start', marginVertical: 6 }} />
            ) : (
              <>
                {!cats.length ? (
                  <OptionsNote what="categories" loading={categories.loading} onRetry={() => void categories.refresh()} />
                ) : null}
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
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              </>
            )}
            {categoryError ? <Text style={styles.err}>{categoryError}</Text> : null}
          </View>

          {/* Card 3: Commercial Pricing */}
          <View style={styles.cardSection}>
            <Text style={styles.sectionTitle}>{s.sectionPricing}</Text>

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <FieldLabel text={s.labelPrice} required />
                <Controller
                  control={control}
                  name="pricePerImage"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      style={[styles.input, errors.pricePerImage && styles.inputError]}
                      placeholder={s.placeholderPrice}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                    />
                  )}
                />
                {errors.pricePerImage?.message ? (
                  <Text style={styles.err}>{errors.pricePerImage.message}</Text>
                ) : null}
              </View>

              <View style={styles.rowItem}>
                <FieldLabel text={s.labelCurrency} required />
                {!currencies.data?.length ? (
                  <OptionsNote what="currencies" loading={currencies.loading} onRetry={() => void currencies.refresh()} />
                ) : null}
                <View style={styles.chips}>
                  {(currencies.data ?? []).map((c) => {
                    const active = currencyId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setCurrencyId(c.id)}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {c.code}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>

          {/* Card 4: Cover Image Drop-Zone */}
          <View style={styles.cardSection}>
            <FieldLabel text={s.labelCover} />
            <Pressable onPress={addCover} style={styles.coverDrop}>
              {cover ? (
                <Image source={{ uri: cover.uri }} style={styles.coverImg} contentFit="cover" />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Ionicons name="image-outline" size={26} color={colors.primary} />
                  <Text style={styles.coverHint}>
                    {s.coverHint}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Card 5: Stock Photos Upload */}
          <View style={styles.cardSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <FieldLabel text={s.labelStockPhotos} required />
              {images.length > 0 ? (
                <View style={styles.badgePill}>
                  <Text style={styles.badgePillText}>{s.photosCount.replace('{count}', String(images.length))}</Text>
                </View>
              ) : null}
            </View>

            <Pressable style={styles.uploadBox} onPress={addPhotos}>
              <View style={styles.uploadIcon}>
                <Ionicons name="images" size={20} color="#fff" />
              </View>
              <Text style={styles.uploadTitle}>
                {images.length > 0 ? s.addMorePhotos : s.selectFromLib}
              </Text>
              <Text style={styles.helper}>
                {images.length > 0
                  ? s.readyForReview.replace('{count}', String(images.length))
                  : s.helperUpload}
              </Text>
            </Pressable>

            {images.length ? (
              <View style={styles.thumbsContainer}>
                <View style={styles.thumbsHeader}>
                  <Text style={styles.thumbsTitle}>{s.readyToUpload}</Text>
                  <Pressable onPress={() => setImages([])} hitSlop={8}>
                    <Text style={styles.clearPhotosText}>{s.clearAll}</Text>
                  </Pressable>
                </View>

                <View style={styles.thumbs}>
                  {images.map((img) => (
                    <View key={img.uri} style={styles.thumbWrap}>
                      <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                      <Pressable
                        style={styles.thumbX}
                        onPress={() => removePhoto(img.uri)}
                        hitSlop={6}
                        accessibilityLabel={s.removePhotoA11y}
                      >
                        <Ionicons name="close" size={11} color="#fff" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {imagesError ? <Text style={styles.err}>{imagesError}</Text> : null}
          </View>

          {serverError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={styles.errorText}>{serverError}</Text>
            </View>
          ) : null}

          {/* Action buttons */}
          <View style={styles.actions}>
            <Pressable
              style={[styles.btn, styles.cancel]}
              onPress={() => router.back()}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelText}>{s.cancel}</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.create, isSubmitting && styles.btnDisabled]}
              onPress={handleSubmit(onSubmit)}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createText}>{s.createBtn}</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function FieldLabel({ text, required }: { text: string; required?: boolean }) {
  const styles = useStyles();
  return (
    <Text style={styles.fieldLabel}>
      {text} {required ? <Text style={styles.requiredStar}>*</Text> : null}
    </Text>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  scroll: { padding: spacing.lg, gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: spacing.xs,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.primary, letterSpacing: 1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 24, color: c.text, letterSpacing: -0.5 },

  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: c.tint,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  noteText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: c.textSoft, lineHeight: 17 },
  bold: { fontFamily: fonts.bold, color: c.primary },

  // Card Container Sections
  cardSection: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
    letterSpacing: 0.8,
  },
  badgePill: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgePillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },

  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textSoft,
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  requiredStar: { color: c.primary },
  input: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: c.text,
    backgroundColor: c.background,
  },
  inputError: { borderColor: c.error },
  multiline: { minHeight: 76, textAlignVertical: 'top', paddingTop: 10 },
  err: { fontFamily: fonts.regular, fontSize: 12, color: c.error, marginTop: 2 },
  helper: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, lineHeight: 16 },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  chipActive: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontFamily: fonts.bold, fontSize: 12.5, color: c.textSoft },
  chipTextActive: { color: '#fff' },

  row: { flexDirection: 'row', gap: spacing.md },
  rowItem: { flex: 1 },

  // Cover Drop-Zone
  coverDrop: {
    height: 140,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderStyle: 'dashed',
    backgroundColor: c.background,
    marginTop: spacing.xs,
  },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
  },
  coverHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },

  // Upload box
  uploadBox: {
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    borderStyle: 'dashed',
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.background,
    marginTop: spacing.xs,
  },
  uploadIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  uploadTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: c.text },

  // Thumbs
  thumbsContainer: {
    backgroundColor: c.background,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  thumbsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  thumbsTitle: { fontFamily: fonts.bold, fontSize: 12.5, color: c.text },
  clearPhotosText: { fontFamily: fonts.bold, fontSize: 12, color: c.primary },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumbWrap: { width: 62, height: 62, borderRadius: radii.md, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  thumbX: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Error box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: c.error },

  // Actions
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  btn: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: { backgroundColor: c.surfaceMuted },
  cancelText: { fontFamily: fonts.bold, fontSize: 14, color: c.textSoft },
  create: { backgroundColor: c.primary },
  createText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },
  btnDisabled: { opacity: 0.6 },
}));
