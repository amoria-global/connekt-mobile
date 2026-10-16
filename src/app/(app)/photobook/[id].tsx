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
  Modal,
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
import { dismissReceivedPhotobook, getPhotobook, resubmitPhotobook, type PhotobookPhoto } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { savePhotoToGallery } from '@/utils/gallerySaver';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
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

export default function PhotobookDetailScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { id, received: receivedParam } = useLocalSearchParams<{ id: string; received?: string }>();
  // Opened from the photographer's "Received from clients" shelf: read it, and resubmit or dismiss it, through the
  // photographer endpoints. The customer endpoint 404s for a book the signed-in user does not own as a customer.
  const received = receivedParam === '1';
  const router = useRouter();
  const { width } = useWindowDimensions();

  const { data, loading, error, refresh } = useAsync(useCallback(() => getPhotobook(id, received), [id, received]));
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [payDeclarationId, setPayDeclarationId] = useState<string | null>(null);
  const payBusy = false;
  const [activePhoto, setActivePhoto] = useState<PhotobookPhoto | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [gridCols, setGridCols] = useState<2 | 3>(3);

  const photos = useMemo(() => data?.photos ?? [], [data?.photos]);

  const activePhotoIndex = useMemo(() => {
    if (!activePhoto) return -1;
    return photos.findIndex((p) => p.id === activePhoto.id);
  }, [activePhoto, photos]);

  const onNextPhoto = () => {
    if (activePhotoIndex >= 0 && activePhotoIndex < photos.length - 1) {
      setActivePhoto(photos[activePhotoIndex + 1]);
    }
  };

  const onPrevPhoto = () => {
    if (activePhotoIndex > 0) {
      setActivePhoto(photos[activePhotoIndex - 1]);
    }
  };

  const onShareBook = () => {
    const title = data?.name || 'Photobook';
    const url = `https://connekyt.com/user/events/photobooks/${id}`;
    Share.share({
      title,
      message: `Explore "${title}" on Connekyt:\n${url}`,
      url,
    }).catch(() => {});
  };

  const onShareActivePhoto = () => {
    if (!activePhoto?.url) return;
    Share.share({
      title: data?.name || 'Photo',
      message: `Check out this photo from "${data?.name || 'Photobook'}" on Connekyt:\n${activePhoto.url}`,
      url: activePhoto.url,
    }).catch(() => {});
  };

  const onSaveActivePhoto = async () => {
    if (!activePhoto?.url) return;
    setSavingPhoto(true);
    try {
      const filename = `connekt-photobook-${activePhoto.id}.jpg`;
      const res = await savePhotoToGallery(activePhoto.url, filename, {
        notifyOnSuccess: true,
        customSuccessMessage: 'Photo successfully saved to your camera roll.',
      });
      if (!res.success && res.error) {
        Alert.alert('Save failed', res.error);
      }
    } catch {
      Alert.alert('Could not save', 'Please try again.');
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

  const gap = 2;
  const cell = (width - gap * (gridCols - 1)) / gridCols;

  if (loading && !data) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading photobook…</Text>
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
          <Text style={styles.errorTitle}>Couldn&apos;t load photobook</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const coverUrl = data?.coverImage || photos[0]?.url;
  const statusKey = (data?.status ?? '').toUpperCase();
  const baseMeta = STATUS_META[statusKey] ?? {
    label: data?.status || 'Book',
    bg: 'rgba(0,0,0,0.6)',
    fg: '#fff',
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
                  <Text style={styles.heroFallbackText}>Curated Photobook</Text>
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
                  accessibilityLabel="Back"
                >
                  <Ionicons name="chevron-back" size={20} color="#fff" />
                </Pressable>

                {received ? (
                  // The share link points at the customer view of a book, which a received book does not have.
                  <View />
                ) : (
                  <Pressable
                    style={styles.heroNavCircle}
                    onPress={onShareBook}
                    hitSlop={8}
                    accessibilityLabel="Share photobook"
                  >
                    <Ionicons name="share-outline" size={18} color="#fff" />
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
                    <Text style={styles.kindBadgeText}>PHOTOBOOK</Text>
                  </View>
                </View>

                <Text style={styles.heroTitle} numberOfLines={2}>
                  {data?.name}
                </Text>

                <View style={styles.heroMetaRow}>
                  <Text style={styles.heroMetaText}>
                    {photos.length} curated photo{photos.length === 1 ? '' : 's'}
                  </Text>
                  {data?.photographerName ? (
                    <>
                      <Text style={styles.heroMetaDot}>·</Text>
                      <Text style={styles.heroMetaText}>By {data.photographerName}</Text>
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
                  <Text style={styles.payTitle}>Extra Photos Available</Text>
                  <Text style={styles.paySubtitle}>
                    {data.extraPhotosCount ?? 0} additional photos · {formatPrice(data.extraPhotosAmount)}
                  </Text>
                </View>
                {payBusy ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={styles.payActionBtn}>
                    <Text style={styles.payActionText}>Pay & Unlock</Text>
                    <Ionicons name="open-outline" size={14} color="#fff" />
                  </View>
                )}
              </Pressable>
            ) : null}

            {/* Section Header with Grid Toggle */}
            {photos.length > 0 ? (
              <View style={styles.photosSectionHead}>
                <View style={styles.photosCountGroup}>
                  <Text style={styles.photosSectionTitle}>CURATED SPREADS</Text>
                  <View style={styles.photosCountBadge}>
                    <Text style={styles.photosCountBadgeText}>{photos.length}</Text>
                  </View>
                </View>

                <View style={styles.gridToggleGroup}>
                  <Pressable
                    style={[styles.gridToggleItem, gridCols === 3 && styles.gridToggleItemActive]}
                    onPress={() => setGridCols(3)}
                    hitSlop={6}
                    accessibilityLabel="3-column dense view"
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
                    accessibilityLabel="2-column editorial view"
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
        renderItem={({ item }) => (
          <Pressable
            style={[styles.photoCell, { width: cell, height: cell }]}
            onPress={() => setActivePhoto(item)}
            android_ripple={{ color: 'rgba(255,255,255,0.15)' }}
          >
            <Image
              source={{ uri: item.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="book-outline" size={32} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No photos in this book</Text>
            <Text style={styles.emptySubtitle}>
              {received
                ? 'This photobook has no photos yet.'
                : 'The photographer has not added photos to this photobook collection yet.'}
            </Text>
          </View>
        }
      />

      {/* World-Class Fullscreen Photo Lightbox Modal */}
      <Modal
        visible={!!activePhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePhoto(null)}
      >
        <View style={styles.lightboxBackdrop}>
          {/* Top Bar */}
          <View style={[styles.lightboxTopBar, { paddingTop: Math.max(insets.top + 6, 18) }]}>
            <Pressable
              style={styles.lightboxGlassCircle}
              onPress={() => setActivePhoto(null)}
              hitSlop={8}
              accessibilityLabel="Close photo viewer"
            >
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>

            {activePhotoIndex >= 0 ? (
              <Text style={styles.lightboxCounter}>
                {activePhotoIndex + 1} of {photos.length}
              </Text>
            ) : null}

            <Pressable
              style={styles.lightboxGlassCircle}
              onPress={onShareActivePhoto}
              hitSlop={8}
              accessibilityLabel="Share photo"
            >
              <Ionicons name="share-outline" size={17} color="#fff" />
            </Pressable>
          </View>

          {/* Central Image View with Invisible Tap Navigation Zones */}
          <View style={styles.lightboxImageContainer}>
            {activePhoto?.url ? (
              <Image
                source={{ uri: activePhoto.url }}
                style={styles.lightboxImage}
                contentFit="contain"
                transition={200}
              />
            ) : null}

            {/* Tap left zone */}
            {activePhotoIndex > 0 ? (
              <Pressable
                style={styles.leftTapZone}
                onPress={onPrevPhoto}
                accessibilityLabel="Previous photo"
              />
            ) : null}

            {/* Tap right zone */}
            {activePhotoIndex >= 0 && activePhotoIndex < photos.length - 1 ? (
              <Pressable
                style={styles.rightTapZone}
                onPress={onNextPhoto}
                accessibilityLabel="Next photo"
              />
            ) : null}
          </View>

          {/* Bottom Floating Glass Navigation & Download Pill */}
          <View
            style={[
              styles.lightboxBottomBar,
              { paddingBottom: Math.max(insets.bottom + 8, 24) },
            ]}
          >
            <View style={styles.lightboxControlPill}>
              {/* Previous Photo Button */}
              <Pressable
                style={[
                  styles.pillNavBtn,
                  activePhotoIndex <= 0 && styles.pillNavBtnDisabled,
                ]}
                onPress={onPrevPhoto}
                disabled={activePhotoIndex <= 0}
                hitSlop={8}
              >
                <Ionicons
                  name="chevron-back"
                  size={19}
                  color={activePhotoIndex <= 0 ? 'rgba(255,255,255,0.3)' : '#fff'}
                />
              </Pressable>

              {/* Save to Camera Roll Action */}
              <Pressable
                style={[styles.pillSaveBtn, savingPhoto && styles.btnDisabled]}
                onPress={onSaveActivePhoto}
                disabled={savingPhoto}
              >
                {savingPhoto ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={16} color="#fff" />
                    <Text style={styles.pillSaveText}>Save to Camera Roll</Text>
                  </>
                )}
              </Pressable>

              {/* Next Photo Button */}
              <Pressable
                style={[
                  styles.pillNavBtn,
                  activePhotoIndex >= photos.length - 1 && styles.pillNavBtnDisabled,
                ]}
                onPress={onNextPhoto}
                disabled={activePhotoIndex >= photos.length - 1}
                hitSlop={8}
              >
                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color={
                    activePhotoIndex >= photos.length - 1
                      ? 'rgba(255,255,255,0.3)'
                      : '#fff'
                  }
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <HandoffCheckoutSheet
        visible={!!payDeclarationId}
        onClose={() => setPayDeclarationId(null)}
        onSettled={() => void refresh()}
        handoff={payDeclarationId ? { type: 'BOOKING_DECLARATION', declarationId: payDeclarationId } : null}
        title={data?.name ?? 'Photobook extras'}
        subtitle="Extra photos"
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
  retryBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },

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
    justifyContent: 'center',
    gap: 8,
  },
  heroFallbackIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  heroFallbackText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
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
    color: '#fff',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: '#fff',
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
    color: '#fff',
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
    color: '#fff',
  },
  btnDisabled: { opacity: 0.6 },
}));
