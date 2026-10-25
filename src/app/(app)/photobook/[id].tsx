/**
 * Photobook Detail Screen — viewer and photo collection for curated event books.
 *
 * 20/20 Master-Grade Design:
 *   • Cinematic Hardcover Showcase: Edge-to-edge cover banner with progressive scrim,
 *     frosted status badge, photobook title, and metadata.
 *   • Clean Floating Navigation: Frosted circular back button and share button.
 *   • High-End Extras Payment Banner: Transparent breakdown for unlocked extra photos
 *     with secure web checkout handoff.
 *   • Editorial Hairline Photo Grid: 2px gaps, rounded corners, and 3-col / 2-col switcher.
 *   • Master In-App Photo Lightbox: Fullscreen deep black backdrop, tap zones for seamless
 *     browsing (no Safari redirect!), top counter, and floating glass pill bar for
 *     "Save to Camera Roll".
 *   • NO LinearGradient, NO top-tear accents — pure solid theme tokens.
 */
import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { HandoffCheckoutSheet } from '@/features/payments/HandoffCheckoutSheet';
import { useRole } from '@/features/auth/role';
import { PhotoViewer } from '@/features/gallery/PhotoViewer';
import { PhotoCell } from '@/features/gallery/PhotoGrid';
import { dismissReceivedPhotobook, getPhotobook, resubmitPhotobook, type PhotobookPhoto } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { savePhotoToGallery } from '@/utils/gallerySaver';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme, onFill } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';

const I18N = {
  en: {
    statusPublished: 'Published · Live',
    statusDraft: 'Draft',
    statusPending: 'Pending review',
    statusSent: 'Delivered',
    statusBook: 'Book',
    photobookFallback: 'Photobook',
    photoFallback: 'Photo',
    shareBookMsg: (title: string, url: string) => `Explore "${title}" on Connekyt:\n${url}`,
    sharePhotoMsg: (title: string, url: string) =>
      `Check out this photo from "${title}" on Connekyt:\n${url}`,
    photoSavedMsg: 'Photo successfully saved to your camera roll.',
    saveFailedTitle: 'Save failed',
    couldNotSaveTitle: 'Could not save',
    pleaseTryAgain: 'Please try again.',
    loadingBook: 'Loading photobook…',
    errorLoadBook: "Couldn't load photobook",
    retry: 'Retry',
    backA11y: 'Back',
    shareBookA11y: 'Share photobook',
    kindBadge: 'PHOTOBOOK',
    curatedPhotosCount: (count: number) => `${count} curated photo${count === 1 ? '' : 's'}`,
    byPhotographer: (name: string) => `By ${name}`,
    extraPhotosAvailable: 'Extra Photos Available',
    additionalPhotosMeta: (count: number, price: string) => `${count} additional photos · ${price}`,
    payAndUnlock: 'Pay & Unlock',
    curatedSpreads: 'CURATED SPREADS',
    grid3A11y: '3-column dense view',
    grid2A11y: '2-column editorial view',
    emptyTitle: 'No photos in this book',
    emptySubtitle: 'The photographer has not added photos to this photobook collection yet.',
    closeViewerA11y: 'Close photo viewer',
    counterOf: (idx: number, total: number) => `${idx} of ${total}`,
    sharePhotoA11y: 'Share photo',
    prevPhotoA11y: 'Previous photo',
    nextPhotoA11y: 'Next photo',
    saveToCameraRoll: 'Save to Camera Roll',
    photobookExtras: 'Photobook extras',
    extraPhotosSub: 'Extra photos',
  },
  fr: {
    statusPublished: 'Publié · En ligne',
    statusDraft: 'Brouillon',
    statusPending: 'En attente de validation',
    statusSent: 'Livré',
    statusBook: 'Livre',
    photobookFallback: 'Livre photo',
    photoFallback: 'Photo',
    shareBookMsg: (title: string, url: string) => `Découvrez « ${title} » sur Connekyt :\n${url}`,
    sharePhotoMsg: (title: string, url: string) =>
      `Découvrez cette photo de « ${title} » sur Connekyt :\n${url}`,
    photoSavedMsg: 'Photo enregistrée dans votre pellicule avec succès.',
    saveFailedTitle: 'Échec de l’enregistrement',
    couldNotSaveTitle: 'Impossible d’enregistrer',
    pleaseTryAgain: 'Veuillez réessayer.',
    loadingBook: 'Chargement du livre photo…',
    errorLoadBook: 'Impossible de charger le livre photo',
    retry: 'Réessayer',
    backA11y: 'Retour',
    shareBookA11y: 'Partager le livre photo',
    kindBadge: 'LIVRE PHOTO',
    curatedPhotosCount: (count: number) =>
      `${count} photo${count === 1 ? '' : 's'} sélectionnée${count === 1 ? '' : 's'}`,
    byPhotographer: (name: string) => `Par ${name}`,
    extraPhotosAvailable: 'Photos supplémentaires disponibles',
    additionalPhotosMeta: (count: number, price: string) =>
      `${count} photos supplémentaires · ${price}`,
    payAndUnlock: 'Payer et débloquer',
    curatedSpreads: ' PLANCHES SÉLECTIONNÉES',
    grid3A11y: 'Vue dense à 3 colonnes',
    grid2A11y: 'Vue éditoriale à 2 colonnes',
    emptyTitle: 'Aucune photo dans ce livre',
    emptySubtitle: 'Le photographe n’a pas encore ajouté de photos à cette collection.',
    closeViewerA11y: 'Fermer la visionneuse',
    counterOf: (idx: number, total: number) => `${idx} sur ${total}`,
    sharePhotoA11y: 'Partager la photo',
    prevPhotoA11y: 'Photo précédente',
    nextPhotoA11y: 'Photo suivante',
    saveToCameraRoll: 'Enregistrer dans la pellicule',
    photobookExtras: 'Suppléments du livre photo',
    extraPhotosSub: 'Photos supplémentaires',
  },
  es: {
    statusPublished: 'Publicado · En vivo',
    statusDraft: 'Borrador',
    statusPending: 'Pendiente de revisión',
    statusSent: 'Entregado',
    statusBook: 'Libro',
    photobookFallback: 'Fotolibro',
    photoFallback: 'Foto',
    shareBookMsg: (title: string, url: string) => `Explora "${title}" en Connekyt:\n${url}`,
    sharePhotoMsg: (title: string, url: string) =>
      `Mira esta foto de "${title}" en Connekyt:\n${url}`,
    photoSavedMsg: 'Foto guardada exitosamente en tu carrete.',
    saveFailedTitle: 'Error al guardar',
    couldNotSaveTitle: 'No se pudo guardar',
    pleaseTryAgain: 'Por favor, inténtalo de nuevo.',
    loadingBook: 'Cargando fotolibro…',
    errorLoadBook: 'No se pudo cargar el fotolibro',
    retry: 'Reintentar',
    backA11y: 'Atrás',
    shareBookA11y: 'Compartir fotolibro',
    kindBadge: 'FOTOLIBRO',
    curatedPhotosCount: (count: number) =>
      `${count} foto${count === 1 ? '' : 's'} seleccionada${count === 1 ? '' : 's'}`,
    byPhotographer: (name: string) => `Por ${name}`,
    extraPhotosAvailable: 'Fotos adicionales disponibles',
    additionalPhotosMeta: (count: number, price: string) => `${count} fotos adicionales · ${price}`,
    payAndUnlock: 'Pagar y desbloquear',
    curatedSpreads: 'PLIEGOS SELECCIONADOS',
    grid3A11y: 'Vista densa de 3 columnas',
    grid2A11y: 'Vista editorial de 2 columnas',
    emptyTitle: 'No hay fotos en este libro',
    emptySubtitle: 'El fotógrafo aún no ha agregado fotos a esta colección de fotolibro.',
    closeViewerA11y: 'Cerrar visor de fotos',
    counterOf: (idx: number, total: number) => `${idx} de ${total}`,
    sharePhotoA11y: 'Compartir foto',
    prevPhotoA11y: 'Foto anterior',
    nextPhotoA11y: 'Foto siguiente',
    saveToCameraRoll: 'Guardar en el carrete',
    photobookExtras: 'Extras del fotolibro',
    extraPhotosSub: 'Fotos adicionales',
  },
} as const;
import { chipColors } from '@/features/photobooks/statusChip';

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  PUBLISHED: { label: 'Published · Live', bg: '#D1FAE5', fg: '#047857' },
  DRAFT: { label: 'Draft', bg: '#E5E7EB', fg: '#374151' },
  PENDING: { label: 'Pending review', bg: '#FEF3C7', fg: '#92400E' },
  SENT: { label: 'Delivered', bg: '#DBEAFE', fg: '#1D4ED8' },
  SENT_TO_PHOTOGRAPHER: { label: 'To edit', bg: '#FEF3C7', fg: '#92400E' },
  PHOTOGRAPHER_EDITING: { label: 'Editing', bg: '#DBEAFE', fg: '#1D4ED8' },
  RESUBMITTED: { label: 'Resubmitted', bg: '#DBEAFE', fg: '#1D4ED8' },
  COMPLETED: { label: 'Completed', bg: '#D1FAE5', fg: '#047857' },
};

const PhotoGap = () => <View style={{ height: 3 }} />;

import { buildKinyarwandaDict } from '@/i18n/kinyarwanda';
import { buildSwahiliDict } from '@/i18n/swahili';
const PB_DETAIL_RW = buildKinyarwandaDict(I18N.en, {
  counterOf: (idx: number, total: number) => `${idx} kuri ${total}`,
});
const PB_DETAIL_SW = buildSwahiliDict(I18N.en, {
  counterOf: (idx: number, total: number) => `${idx} kati ya ${total}`,
});

export default function PhotobookDetailScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors, isDark } = useTheme();
  const { isPhotographer } = useRole();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { id, received: receivedParam } = useLocalSearchParams<{ id: string; received?: string }>();
  // Opened from the photographer's "Received from clients" shelf: read it, and resubmit or dismiss it, through the
  // photographer endpoints. The customer endpoint 404s for a book the signed-in user does not own as a customer.
  const received = receivedParam === '1';
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { language } = useLanguage();
  const tr = language === 'rw' ? PB_DETAIL_RW : language === 'sw' ? PB_DETAIL_SW : (I18N as any)[language] || I18N.en;

  const statusMetaMap: Record<string, { label: string; bg: string; fg: string }> = useMemo(
    () => ({
      PUBLISHED: { label: tr.statusPublished, bg: '#D1FAE5', fg: '#047857' },
      DRAFT: { label: tr.statusDraft, bg: '#E5E7EB', fg: '#374151' },
      PENDING: { label: tr.statusPending, bg: '#FEF3C7', fg: '#92400E' },
      SENT: { label: tr.statusSent, bg: '#DBEAFE', fg: '#1D4ED8' },
    }),
    [tr],
  );

  const { data, loading, error, refresh } = useAsync(useCallback(() => getPhotobook(id, received), [id, received]));
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payDeclarationId, setPayDeclarationId] = useState<string | null>(null);
  const payBusy = false;
  const [viewerIndex, setViewerIndex] = useState(-1);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [gridCols, setGridCols] = useState<2 | 3>(3);

  const photos = useMemo(() => data?.photos ?? [], [data?.photos]);

  const openPhoto = useCallback((photoId: string) => setViewerIndex(photos.findIndex((p) => p.id === photoId)), [photos]);

  const onShareBook = () => {
    const title = data?.name || tr.photobookFallback;
    const url = `https://connekyt.com/user/events/photobooks/${id}`;
    Share.share({
      title,
      message: tr.shareBookMsg(title, url),
      url,
    }).catch(() => {});
  };

  const onShareActivePhoto = (photo: PhotobookPhoto) => {
    if (!photo.url) return;
    const bookName = data?.name || tr.photobookFallback;
    Share.share({
      title: data?.name || tr.photoFallback,
      message: tr.sharePhotoMsg(bookName, photo.url),
      url: photo.url,
    }).catch(() => {});
  };

  const onSaveActivePhoto = async (photo: PhotobookPhoto) => {
    if (!photo.url) return;
    setSavingPhoto(true);
    try {
      const filename = `connekt-photobook-${photo.id}.jpg`;
      const res = await savePhotoToGallery(photo.url, filename, {
        notifyOnSuccess: true,
        customSuccessMessage: tr.photoSavedMsg,
      });
      if (!res.success && res.error) {
        Alert.alert(tr.saveFailedTitle, res.error);
      }
    } catch {
      Alert.alert(tr.couldNotSaveTitle, tr.pleaseTryAgain);
    } finally {
      setSavingPhoto(false);
    }
  };

  const onPayExtras = () => {
    if (!digitalPurchasesEnabled) return;
    const declarationId = data?.paymentDeclarationId;
    if (!declarationId) {
      router.push('/payments' as never);
      return;
    }
    setPayDeclarationId(declarationId);
  };

  const runAction = async (op: () => Promise<void>, onDone: () => void, fallback: string) => {
    setActionBusy(true);
    setActionError(null);
    try {
      await op();
      onDone();
    } catch (e) {
      setActionError(isApiError(e) ? e.message : fallback);
    } finally {
      setActionBusy(false);
    }
  };
  const onResubmit = () =>
    Alert.alert('Send back to the client?', 'The client will see your edited photobook.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resubmit',
        onPress: () => void runAction(() => resubmitPhotobook(id), () => void refresh(), 'Could not resubmit. Please try again.'),
      },
    ]);
  const onDismiss = () =>
    Alert.alert('Remove from your list?', 'This hides the photobook from your received list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void runAction(() => dismissReceivedPhotobook(id), () => router.back(), 'Could not remove it. Please try again.'),
      },
    ]);

  const gap = 3;
  const cell = (width - gap * (gridCols - 1)) / gridCols;

  if (loading && !data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>{tr.loadingBook}</Text>
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
          <Text style={styles.errorTitle}>{tr.errorLoadBook}</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryBtnText}>{tr.retry}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const coverUrl = data?.coverImage || photos[0]?.url;
  const statusKey = (data?.status ?? '').toUpperCase();
  const baseMeta = statusMetaMap[statusKey] ?? {
    label: data?.status || tr.statusBook,
    bg: 'rgba(0,0,0,0.6)',
    fg: onFill,
  };
  const statusMeta = { ...baseMeta, ...chipColors(baseMeta, isDark, colors) };

  return (
    <Screen padded={false}>
      <Stack.Screen options={{ headerShown: false }} />
      <FlatList
        key={gridCols}
        data={photos}
        keyExtractor={(p) => p.id}
        numColumns={gridCols}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Cinematic Cover Banner */}
            <View style={[styles.heroBanner, { height: 260 + insets.top }]}>
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.heroFallback]}>
                  <View style={styles.heroFallbackIconBox}>
                    <Ionicons name="book" size={38} color="rgba(255,255,255,0.4)" />
                  </View>
                </View>
              )}

              {/* Scrim Overlay */}
              <View style={styles.heroScrim} />

              {/* Top Navigation Row */}
              <View style={[styles.heroNav, { paddingTop: Math.max(insets.top + 6, 16) }]}>
                <Pressable
                  style={styles.heroNavCircle}
                  onPress={() => router.back()}
                  hitSlop={8}
                  accessibilityLabel={tr.backA11y}
                >
                  <Ionicons name="chevron-back" size={20} color={onFill} />
                </Pressable>

                {received ? (
                  // The share link points at the customer view of a book, which a received book does not have.
                  <View />
                ) : (
                  <Pressable
                    style={styles.heroNavCircle}
                    onPress={onShareBook}
                    hitSlop={8}
                    accessibilityLabel={tr.shareBookA11y}
                  >
                    <Ionicons name="share-outline" size={18} color={onFill} />
                  </Pressable>
                )}
              </View>

              {/* Hero Bottom Info */}
              <View style={styles.heroBottom}>
                <View style={styles.badgeRow}>
                  <View style={[styles.statusBadge, { backgroundColor: statusMeta.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: statusMeta.fg }]}>
                      {statusMeta.label}
                    </Text>
                  </View>
                  <View style={styles.kindBadge}>
                    <Text style={styles.kindBadgeText}>{tr.kindBadge}</Text>
                  </View>
                </View>

                <Text style={styles.heroTitle} numberOfLines={2}>
                  {data?.name}
                </Text>

                <View style={styles.heroMetaRow}>
                  <Text style={styles.heroMetaText}>
                    {tr.curatedPhotosCount(photos.length)}
                  </Text>
                  {data?.photographerName ? (
                    <>
                      <Text style={styles.heroMetaDot}>·</Text>
                      <Text style={styles.heroMetaText}>{tr.byPhotographer(data.photographerName)}</Text>
                    </>
                  ) : null}
                </View>
              </View>
            </View>

            {/* Description blurb if available */}
            {data?.description ? (
              <View style={styles.descCard}>
                <Text style={styles.descText}>{data.description}</Text>
              </View>
            ) : null}

            {received ? (
              <View style={styles.descCard}>
                <Pressable
                  onPress={onResubmit}
                  disabled={actionBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Resubmit to client"
                  accessibilityState={{ disabled: actionBusy, busy: actionBusy }}
                  style={[styles.retryBtn, { minHeight: 48, justifyContent: 'center', alignItems: 'center' }]}
                >
                  <Text style={styles.retryBtnText}>{actionBusy ? 'Working...' : 'Resubmit to client'}</Text>
                </Pressable>
                <Pressable
                  onPress={onDismiss}
                  disabled={actionBusy}
                  accessibilityRole="button"
                  accessibilityLabel="Remove from my list"
                  style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={[styles.muted, { color: colors.textSoft, fontWeight: '600' }]}>Remove from my list</Text>
                </Pressable>
                {actionError ? (
                  <Text style={[styles.muted, { color: colors.error }]} accessibilityRole="alert">
                    {actionError}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {/* Extras Payment Banner */}
            {!received && data?.paymentRequired && data?.extraPhotosAmount && digitalPurchasesEnabled ? (
              <Pressable
                style={({ pressed }) => [styles.payBanner, pressed && { opacity: 0.9 }]}
                onPress={() => void onPayExtras()}
                disabled={payBusy}
              >
                <View style={styles.payIconBox}>
                  <Ionicons name="card-outline" size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.payTitle}>{tr.extraPhotosAvailable}</Text>
                  <Text style={styles.paySubtitle}>
                    {tr.additionalPhotosMeta(
                      data.extraPhotosCount ?? 0,
                      formatPrice(data.extraPhotosAmount),
                    )}
                  </Text>
                </View>
                {payBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.payActionBtn}>
                    <Text style={styles.payActionText}>{tr.payAndUnlock}</Text>
                    <Ionicons name="open-outline" size={14} color={onFill} />
                  </View>
                )}
              </Pressable>
            ) : null}

            {/* Section Header with Grid Toggle */}
            {photos.length > 0 ? (
              <View style={styles.photosSectionHead}>
                <View style={styles.photosCountGroup}>
                  <Text style={styles.photosSectionTitle}>{tr.curatedSpreads}</Text>
                  <View style={styles.photosCountBadge}>
                    <Text style={styles.photosCountBadgeText}>{photos.length}</Text>
                  </View>
                </View>

                <View style={styles.gridToggleGroup}>
                  <Pressable
                    style={[styles.gridToggleItem, gridCols === 3 && styles.gridToggleItemActive]}
                    onPress={() => setGridCols(3)}
                    hitSlop={6}
                    accessibilityLabel={tr.grid3A11y}
                  >
                    <Ionicons
                      name="grid"
                      size={14}
                      color={gridCols === 3 ? colors.primary : colors.textMuted}
                    />
                  </Pressable>

                  <Pressable
                    style={[styles.gridToggleItem, gridCols === 2 && styles.gridToggleItemActive]}
                    onPress={() => setGridCols(2)}
                    hitSlop={6}
                    accessibilityLabel={tr.grid2A11y}
                  >
                    <Ionicons
                      name="square"
                      size={14}
                      color={gridCols === 2 ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        }
        initialNumToRender={18}
        windowSize={7}
        maxToRenderPerBatch={12}
        removeClippedSubviews
        ItemSeparatorComponent={PhotoGap}
        renderItem={({ item, index }) => <PhotoCell photo={item} size={cell} position={index + 1} total={photos.length} onOpen={openPhoto} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="book-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>{tr.emptyTitle}</Text>
            <Text style={styles.emptySubtitle}>
              {received
                ? 'This photobook has no photos yet.'
                : tr.emptySubtitle}
            </Text>
          </View>
        }
      />

      <PhotoViewer
        photos={photos}
        index={viewerIndex}
        onIndexChange={setViewerIndex}
        onClose={() => setViewerIndex(-1)}
        onSave={onSaveActivePhoto}
        onShare={onShareActivePhoto}
        saving={savingPhoto}
        saveColor={isPhotographer ? colors.primary : colors.accent}
      />
      <HandoffCheckoutSheet
        visible={!!payDeclarationId}
        onClose={() => setPayDeclarationId(null)}
        onSettled={() => void refresh()}
        handoff={payDeclarationId ? { type: 'BOOKING_DECLARATION', declarationId: payDeclarationId } : null}
        title={data?.name ?? tr.photobookExtras}
        subtitle={tr.extraPhotosSub}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  errorTitle: { fontFamily: fonts.bold, fontSize: 18, color: c.text },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: c.primary,
    marginTop: spacing.sm,
  },
  retryBtnText: { fontFamily: fonts.bold, fontSize: 14, color: c.textOnPrimary },

  list: { paddingBottom: 60 },
  header: { gap: spacing.md, marginBottom: spacing.sm },

  // Hero Cover Banner
  heroBanner: {
    width: '100%',
    backgroundColor: '#071224',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  heroFallback: {
    backgroundColor: '#0B162C',
    alignItems: 'center',
    // Icon sits high so the status chips and title never collide with it at large text sizes.
    justifyContent: 'flex-start',
    paddingTop: 92,
  },
  heroFallbackIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 12, 28, 0.45)',
  },
  heroNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  heroNavCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBottom: {
    zIndex: 2,
    gap: 5,
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.3,
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  kindBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.textOnPrimary,
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: c.textOnPrimary,
    letterSpacing: -0.5,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  heroMetaDot: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  heroMetaText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },

  // Description Card
  descCard: {
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  descText: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: c.textSoft,
    lineHeight: 19,
  },

  // Payment Banner
  payBanner: {
    marginHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.tint,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
  },
  payIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  paySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  payActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.md,
  },
  payActionText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textOnPrimary,
  },

  // Section Header
  photosSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    paddingBottom: 2,
  },
  photosCountGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photosSectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
    letterSpacing: 0.8,
  },
  photosCountBadge: {
    backgroundColor: c.tint,
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: radii.full,
  },
  photosCountBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
  },
  gridToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceMuted,
    padding: 2,
    borderRadius: radii.md,
  },
  gridToggleItem: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  gridToggleItemActive: {
    backgroundColor: c.surface,
  },

  // Photo Cell
  photoCell: {
    backgroundColor: c.surfaceMuted,
    overflow: 'hidden',
  },

  // Empty state
  emptyContainer: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 16, color: c.text },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Master Lightbox
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'space-between',
  },
  lightboxTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 10,
  },
  lightboxGlassCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCounter: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
  lightboxImageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: {
    width: '100%',
    height: '100%',
  },
  leftTapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '30%',
    zIndex: 5,
  },
  rightTapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '30%',
    zIndex: 5,
  },
  lightboxBottomBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    alignItems: 'center',
    zIndex: 10,
  },
  lightboxControlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(25,25,25,0.75)',
    borderRadius: radii.full,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  pillNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillNavBtnDisabled: {
    opacity: 0.4,
  },
  pillSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  pillSaveText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.textOnPrimary,
  },
  btnDisabled: { opacity: 0.6 },
}));
