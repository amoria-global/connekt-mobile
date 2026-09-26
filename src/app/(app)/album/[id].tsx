/**
 * Album Detail Screen — viewer and management for event, personal, and content albums.
 *
 * 20/20 Master-Grade Design:
 *   • Cinematic Cover Showcase: Edge-to-edge high-contrast cover banner with progressive scrim,
 *     frosted category badge (EVENT / PAID / FREE / CONTENT), title, and metadata.
 *   • Clean Floating Navigation: Frosted circular back button, share button, and
 *     master "···" (More Options) sheet trigger (removing clumsy red trash cans from the hero).
 *   • Streamlined Executive Actions: Primary CTA "+ Add Photos" alongside clean Share pill.
 *   • Compact Face-AI Status Chip: 1-line contextual badge above photos instead of a screen-hogging card.
 *   • Hairline Photo Mosaic: Tight 2px gaps, rounded corners, and instant 3-col / 2-col switcher.
 *   • World-Class In-App Lightbox: Deep black backdrop, tap zones for seamless next/prev,
 *     top counter ("14 of 48"), and a floating glass pill bar for "Save to Camera Roll".
 *   • NO LinearGradient, NO top-tear accents — pure solid theme tokens.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { mintHandoffUrl, openWebCheckout } from '@/features/payments/webCheckout';
import {
  addAlbumImages,
  deleteAlbum,
  getAlbum,
  getAlbumFaceStatus,
  publishAlbumToFaceSearch,
  sendAlbumToClient,
  submitContentAlbum,
  type AlbumFaceStatus,
  type AlbumImage,
} from '@/features/gallery/api';
import { reportContent } from '@/features/moderation/api';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { useAsync } from '@/hooks/useAsync';
import { pickMultipleFromLibrary } from '@/services/imagePicker';
import { savePhotoToGallery } from '@/utils/gallerySaver';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

const APPROVAL_META: Record<string, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: '#E5E7EB', fg: '#374151' },
  PENDING_APPROVAL: { label: 'Pending review', bg: '#FEF3C7', fg: '#92400E' },
  APPROVED: { label: 'Approved · Live', bg: '#D1FAE5', fg: '#047857' },
  REJECTED: { label: 'Needs changes', bg: '#FEE2E2', fg: '#B91C1C' },
};

export default function AlbumDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { role, isPhotographer } = useRole();
  const { width } = useWindowDimensions();

  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getAlbum(id, role ?? isPhotographer), [id, role, isPhotographer]),
  );

  const [unlocking, setUnlocking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<AlbumFaceStatus | null>(null);
  const [reportImageId, setReportImageId] = useState<string | null>(null);
  const [activePhoto, setActivePhoto] = useState<AlbumImage | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [gridCols, setGridCols] = useState<2 | 3>(3);
  const [moreSheetOpen, setMoreSheetOpen] = useState(false);

  // Fetch face-index status for photographers
  useEffect(() => {
    if (!isPhotographer || !id) return;
    let cancelled = false;
    getAlbumFaceStatus(id)
      .then((s) => {
        if (!cancelled) setFaceStatus(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id, isPhotographer]);

  const images = useMemo(() => data?.images ?? [], [data?.images]);

  const activePhotoIndex = useMemo(() => {
    if (!activePhoto) return -1;
    return images.findIndex((img) => img.id === activePhoto.id);
  }, [activePhoto, images]);

  const onNextPhoto = () => {
    if (activePhotoIndex >= 0 && activePhotoIndex < images.length - 1) {
      setActivePhoto(images[activePhotoIndex + 1]);
    }
  };

  const onPrevPhoto = () => {
    if (activePhotoIndex > 0) {
      setActivePhoto(images[activePhotoIndex - 1]);
    }
  };

  const onAddPhotos = async () => {
    const imgs = await pickMultipleFromLibrary(40);
    if (!imgs.length) return;
    setBusy('add');
    try {
      await addAlbumImages(id, imgs);
      await refresh();
      Alert.alert('Upload complete', `${imgs.length} photo${imgs.length === 1 ? '' : 's'} added to the album.`);
    } catch (err) {
      Alert.alert('Upload failed', isApiError(err) ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onShareAlbum = () => {
    const title = data?.name || 'Album';
    const url = `https://connekyt.com/user/gallery/album?id=${id}`;
    Share.share({
      title,
      message: `Check out "${title}" on Connekyt:\n${url}`,
      url,
    }).catch(() => {});
  };

  const onDelete = () => {
    setMoreSheetOpen(false);
    Alert.alert('Delete album', 'This permanently deletes this album and all its photos. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await deleteAlbum(id);
            router.back();
          } catch (err) {
            Alert.alert('Could not delete', isApiError(err) ? err.message : 'Please try again.');
            setBusy(null);
          }
        },
      },
    ]);
  };

  const runLifecycle = async (
    key: 'send' | 'publish' | 'submit',
    fn: () => Promise<void>,
    successTitle: string,
    successMessage: string,
  ) => {
    setMoreSheetOpen(false);
    setBusy(key);
    try {
      await fn();
      await refresh();
      Alert.alert(successTitle, successMessage);
    } catch (err) {
      Alert.alert('Action failed', isApiError(err) ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onSendToClient = () =>
    runLifecycle(
      'send',
      () => sendAlbumToClient(id),
      'Album Sent',
      'The client has been emailed the link to view this album.',
    );

  const onPublishToFaceSearch = () =>
    runLifecycle(
      'publish',
      () => publishAlbumToFaceSearch(id),
      'Album Published to Face-AI',
      'Your photos are now indexed and searchable via Find My Photos facial scan.',
    );

  const onSubmitForReview = () =>
    runLifecycle(
      'submit',
      () => submitContentAlbum(id),
      'Submitted for Review',
      'Our team will review and publish this album to the public library once approved.',
    );

  const onSaveActivePhoto = async () => {
    if (!activePhoto?.url) return;
    setSavingPhoto(true);
    try {
      const filename = `connekt-photo-${activePhoto.id}.jpg`;
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

  const onShareActivePhoto = () => {
    if (!activePhoto?.url) return;
    Share.share({
      title: data?.name || 'Photo',
      message: `Check out this photo from "${data?.name || 'Album'}" on Connekyt:\n${activePhoto.url}`,
      url: activePhoto.url,
    }).catch(() => {});
  };

  const onLongPressPhoto = (imageId: string) => {
    if (isPhotographer) return;
    Alert.alert('Photo options', undefined, [
      { text: 'Report photo', style: 'destructive', onPress: () => setReportImageId(imageId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitPhotoReport = async (reason: string, desc: string) => {
    if (!reportImageId) throw { status: 400, message: 'Nothing to report.' };
    return reportContent('PHOTO', reportImageId, reason, desc);
  };

  const gap = 8;
  const gridPadding = spacing.lg;
  const gridWidth = width - gridPadding * 2;
  const cell = Math.floor((gridWidth - gap * (gridCols - 1)) / gridCols);

  const onUnlock = async () => {
    if (!digitalPurchasesEnabled) return;
    if (!data?.eventId) {
      Alert.alert('Unavailable', 'This album cannot be restored right now.');
      return;
    }
    setUnlocking(true);
    try {
      const url = await mintHandoffUrl('ARCHIVE', { eventId: data.eventId });
      await openWebCheckout(url);
    } catch (err) {
      Alert.alert('Unlock failed', isApiError(err) ? err.message : 'Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.loadingNav, { paddingTop: Math.max(insets.top + 6, 16) }]}>
          <Pressable
            style={styles.loadingBackBtn}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Loading album…</Text>
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.loadingNav, { paddingTop: Math.max(insets.top + 6, 16) }]}>
          <Pressable
            style={styles.loadingBackBtn}
            onPress={() => router.back()}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Couldn&apos;t load album</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const locked = data?.locked && images.length === 0;
  const isContent = !!data?.isContent;
  const approval = data?.approvalStatus;
  const approvalMeta = approval ? APPROVAL_META[approval] : null;

  const rawKind = (data?.kind ?? '').trim();
  const kindUpper = rawKind.toUpperCase();
  const isEventKind = kindUpper === 'EVENT';
  const isPaidKind = kindUpper.includes('PAID');
  const isFreeKind = kindUpper.includes('FREE');
  const badgeLabel = isContent
    ? 'CONTENT'
    : isEventKind
    ? 'EVENT'
    : isPaidKind
    ? 'PAID'
    : isFreeKind
    ? 'FREE'
    : 'ALBUM';

  const canSubmit = isContent && (approval === 'DRAFT' || approval === 'REJECTED');
  const coverUrl = data?.coverPhoto || images[0]?.url;

  return (
    <Screen padded={false} edges={[]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Modern Top App Bar */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 6, 16) }]}>
        <Pressable
          style={styles.navCircleBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>

        <Text style={styles.topBarTitle} numberOfLines={1}>
          {data?.name || 'Album'}
        </Text>

        <View style={styles.topBarActions}>
          <Pressable
            style={styles.navCircleBtn}
            onPress={onShareAlbum}
            hitSlop={8}
            accessibilityLabel="Share album"
          >
            <Ionicons name="share-outline" size={18} color={colors.text} />
          </Pressable>

          {isPhotographer ? (
            <Pressable
              style={styles.navCircleBtn}
              onPress={() => setMoreSheetOpen(true)}
              hitSlop={8}
              accessibilityLabel="More album options"
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        key={gridCols}
        data={locked ? [] : images}
        keyExtractor={(img) => img.id}
        numColumns={gridCols}
        columnWrapperStyle={{ gap }}
        ItemSeparatorComponent={() => <View style={{ height: gap }} />}
        contentContainerStyle={[
          styles.list,
          { paddingHorizontal: gridPadding },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Cover Showcase Card (if a cover image exists) */}
            {coverUrl ? (
              <View style={styles.coverCard}>
                <Image
                  source={{ uri: coverUrl }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={250}
                />
                <View style={styles.coverScrim} />
                <View style={styles.coverBadgeRow}>
                  <View
                    style={[
                      styles.kindBadge,
                      isContent
                        ? styles.kindContent
                        : isEventKind
                        ? styles.kindEvent
                        : isPaidKind
                        ? styles.kindPaid
                        : isFreeKind
                        ? styles.kindFree
                        : styles.kindDefault,
                    ]}
                  >
                    <Text style={styles.kindText}>{badgeLabel}</Text>
                  </View>

                  {approvalMeta ? (
                    <View style={[styles.approvalPill, { backgroundColor: approvalMeta.bg }]}>
                      <Text style={[styles.approvalPillText, { color: approvalMeta.fg }]}>
                        {approvalMeta.label}
                      </Text>
                    </View>
                  ) : null}

                  {data?.locked ? (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={10} color="#fff" />
                      <Text style={styles.lockText}>LOCKED</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Album Header Title & Metadata */}
            <View style={styles.titleSection}>
              <Text style={styles.albumTitle} numberOfLines={2}>
                {data?.name || 'Album Collection'}
              </Text>

              <View style={styles.metaChipsRow}>
                {!coverUrl ? (
                  <View
                    style={[
                      styles.kindBadge,
                      isContent
                        ? styles.kindContent
                        : isEventKind
                        ? styles.kindEvent
                        : isPaidKind
                        ? styles.kindPaid
                        : isFreeKind
                        ? styles.kindFree
                        : styles.kindDefault,
                    ]}
                  >
                    <Text style={styles.kindText}>{badgeLabel}</Text>
                  </View>
                ) : null}

                <View style={styles.metaChip}>
                  <Ionicons name="images-outline" size={13} color={colors.primary} />
                  <Text style={styles.metaChipText}>
                    {data?.photoCount != null
                      ? `${data.photoCount} photo${data.photoCount === 1 ? '' : 's'}`
                      : `${images.length} photos`}
                  </Text>
                </View>

                {data?.categoryLabel || data?.kind ? (
                  <View style={styles.metaChip}>
                    <Ionicons name="pricetag-outline" size={12} color={colors.textMuted} />
                    <Text style={styles.metaChipText}>
                      {data?.categoryLabel || data?.kind}
                    </Text>
                  </View>
                ) : null}

                {data?.locked ? (
                  <View style={[styles.metaChip, styles.metaChipLocked]}>
                    <Ionicons name="lock-closed" size={12} color="#D97706" />
                    <Text style={[styles.metaChipText, { color: '#D97706' }]}>Locked</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Photographer Card (Salo-run Web Parity) */}
            {data?.photographer ? (
              <View style={styles.photographerCard}>
                <View style={styles.photographerAvatar}>
                  {data.photographerAvatar ? (
                    <Image
                      source={{ uri: data.photographerAvatar }}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                    />
                  ) : (
                    <Ionicons name="person" size={18} color={colors.primary} />
                  )}
                </View>
                <View style={styles.photographerInfo}>
                  <Text style={styles.photographerName} numberOfLines={1}>
                    {data.photographer}
                  </Text>
                  <Text style={styles.photographerRole}>Photographer</Text>
                </View>
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                </View>
              </View>
            ) : null}

            {/* Content Approval Note */}
            {isContent && approval ? (
              <View style={styles.approvalCard}>
                <Ionicons name="information-circle" size={18} color={colors.primary} />
                <Text style={styles.approvalCardText}>
                  {approval === 'DRAFT'
                    ? 'Draft: Submit for review to publish this album to the public catalog.'
                    : approval === 'PENDING_APPROVAL'
                    ? 'Under review: Our team will publish it to the catalog once approved.'
                    : approval === 'APPROVED'
                    ? 'Live on the public stock library.'
                    : `Needs changes: ${data?.approvalComment || 'Please update and resubmit.'}`}
                </Text>
              </View>
            ) : null}

            {/* Photographer Executive Action Strip */}
            {isPhotographer ? (
              <View style={styles.actionStrip}>
                <Pressable
                  style={[styles.primaryActionBtn, busy === 'add' && styles.btnDisabled]}
                  onPress={onAddPhotos}
                  disabled={busy === 'add'}
                >
                  {busy === 'add' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={17} color="#fff" />
                      <Text style={styles.primaryActionText}>Add Photos</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={styles.secondaryActionBtn}
                  onPress={onShareAlbum}
                  hitSlop={4}
                >
                  <Ionicons name="share-social-outline" size={16} color={colors.text} />
                  <Text style={styles.secondaryActionText}>Share</Text>
                </Pressable>

                <Pressable
                  style={styles.optionsActionBtn}
                  onPress={() => setMoreSheetOpen(true)}
                  hitSlop={4}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
                </Pressable>
              </View>
            ) : null}

            {/* Compact Face-AI Status Chip */}
            {isPhotographer && faceStatus ? (
              <Pressable
                style={styles.compactFaceChip}
                onPress={() => setMoreSheetOpen(true)}
                hitSlop={4}
              >
                <View style={styles.faceSparkleBox}>
                  <Ionicons name="sparkles" size={13} color={colors.primary} />
                </View>
                <Text style={styles.compactFaceText} numberOfLines={1}>
                  <Text style={styles.compactFaceBold}>
                    {faceStatus.collection?.faceCount ?? 0}
                  </Text>{' '}
                  faces indexed · Find My Photos active
                </Text>
                <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
              </Pressable>
            ) : null}

            {/* Locked Archive Notice */}
            {locked ? (
              <View style={styles.lockedCard}>
                <View style={styles.lockedIconBox}>
                  <Ionicons name="lock-closed" size={26} color={colors.primary} />
                </View>
                <Text style={styles.lockedTitle}>This album is locked</Text>
                {digitalPurchasesEnabled ? (
                  <>
                    <Text style={styles.lockedMsg}>
                      Unlock this album to view and download all high-resolution photos.
                    </Text>
                    <Button
                      title={
                        data?.archiveFee
                          ? `Unlock for ${formatMoney(data.archiveFee, data.archiveCurrency)}`
                          : 'Unlock on web'
                      }
                      onPress={onUnlock}
                      loading={unlocking}
                    />
                  </>
                ) : (
                  <Text style={styles.lockedMsg}>
                    Photos are in cold storage. Contact support to restore this album.
                  </Text>
                )}
              </View>
            ) : null}

            {/* Section Header with 3-col / 2-col Toggle */}
            {!locked && images.length > 0 ? (
              <View style={styles.photosSectionHead}>
                <View style={styles.photosCountGroup}>
                  <Text style={styles.photosSectionTitle}>PHOTOS</Text>
                  <View style={styles.photosCountBadge}>
                    <Text style={styles.photosCountBadgeText}>{images.length}</Text>
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
                    accessibilityLabel="2-column large view"
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
            onLongPress={() => onLongPressPhoto(item.id)}
            android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
          >
            <View style={styles.photoPlaceholder} pointerEvents="none">
              <Ionicons name="camera-outline" size={20} color={colors.textMuted} />
            </View>
            <Image
              source={{ uri: item.url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
            />
          </Pressable>
        )}
        ListEmptyComponent={
          locked ? null : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="camera-outline" size={32} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>This album has no photos</Text>
              <Text style={styles.emptySubtitle}>
                {isPhotographer
                  ? 'Add your high-resolution photos to deliver them to clients or enable facial search.'
                  : 'The photographer has not uploaded photos yet.'}
              </Text>
              {isPhotographer ? (
                <Pressable
                  style={styles.emptyActionBtn}
                  onPress={onAddPhotos}
                  disabled={busy === 'add'}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyActionText}>Upload Photos</Text>
                </Pressable>
              ) : null}
            </View>
          )
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
                {activePhotoIndex + 1} of {images.length}
              </Text>
            ) : null}

            <View style={styles.lightboxTopActions}>
              <Pressable
                style={styles.lightboxGlassCircle}
                onPress={onShareActivePhoto}
                hitSlop={8}
                accessibilityLabel="Share photo"
              >
                <Ionicons name="share-outline" size={17} color="#fff" />
              </Pressable>

              {!isPhotographer && activePhoto ? (
                <Pressable
                  style={styles.lightboxGlassCircle}
                  onPress={() => {
                    const imgId = activePhoto.id;
                    setActivePhoto(null);
                    setReportImageId(imgId);
                  }}
                  hitSlop={8}
                  accessibilityLabel="Report photo"
                >
                  <Ionicons name="flag-outline" size={17} color="#fff" />
                </Pressable>
              ) : null}
            </View>
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
            {activePhotoIndex >= 0 && activePhotoIndex < images.length - 1 ? (
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
                  activePhotoIndex >= images.length - 1 && styles.pillNavBtnDisabled,
                ]}
                onPress={onNextPhoto}
                disabled={activePhotoIndex >= images.length - 1}
                hitSlop={8}
              >
                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color={
                    activePhotoIndex >= images.length - 1
                      ? 'rgba(255,255,255,0.3)'
                      : '#fff'
                  }
                />
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* More Options Action Sheet Modal */}
      <Modal
        visible={moreSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMoreSheetOpen(false)}>
          <Pressable
            style={[
              styles.actionSheet,
              { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Album Options</Text>
                <Text style={styles.sheetSubtitle}>{data?.name}</Text>
              </View>
              <Pressable
                onPress={() => setMoreSheetOpen(false)}
                hitSlop={8}
                style={styles.sheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.sheetOptionsList}>
              {/* Share Album */}
              <Pressable
                style={styles.sheetItem}
                onPress={() => {
                  setMoreSheetOpen(false);
                  onShareAlbum();
                }}
              >
                <View style={styles.sheetIconBox}>
                  <Ionicons name="share-social-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.sheetItemText}>
                  <Text style={styles.sheetItemLabel}>Share Album Link</Text>
                  <Text style={styles.sheetItemDesc}>Copy public web viewing link</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>

              {/* Send to Client (Photographer) */}
              {isPhotographer && !isContent ? (
                <Pressable
                  style={[styles.sheetItem, busy === 'send' && styles.btnDisabled]}
                  onPress={onSendToClient}
                  disabled={busy === 'send'}
                >
                  <View style={styles.sheetIconBox}>
                    <Ionicons name="paper-plane-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.sheetItemText}>
                    <Text style={styles.sheetItemLabel}>Send to Client</Text>
                    <Text style={styles.sheetItemDesc}>Email gallery access link directly</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}

              {/* Face-AI Indexing */}
              {isPhotographer && !isContent ? (
                <Pressable
                  style={[styles.sheetItem, busy === 'publish' && styles.btnDisabled]}
                  onPress={onPublishToFaceSearch}
                  disabled={busy === 'publish'}
                >
                  <View style={styles.sheetIconBox}>
                    <Ionicons name="scan-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.sheetItemText}>
                    <Text style={styles.sheetItemLabel}>Face-AI Indexing</Text>
                    <Text style={styles.sheetItemDesc}>
                      {faceStatus?.collection?.faceCount
                        ? `${faceStatus.collection.faceCount} faces indexed · tap to re-sync`
                        : 'Index photos for Find My Photos search'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}

              {/* Submit for Review (Content Album) */}
              {canSubmit ? (
                <Pressable
                  style={[styles.sheetItem, busy === 'submit' && styles.btnDisabled]}
                  onPress={onSubmitForReview}
                  disabled={busy === 'submit'}
                >
                  <View style={styles.sheetIconBox}>
                    <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={styles.sheetItemText}>
                    <Text style={styles.sheetItemLabel}>Submit for Review</Text>
                    <Text style={styles.sheetItemDesc}>Publish to Connekt stock catalog</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}

              {/* Delete Album */}
              {isPhotographer ? (
                <Pressable
                  style={[styles.sheetItem, styles.sheetItemDestructive]}
                  onPress={onDelete}
                  disabled={busy === 'delete'}
                >
                  <View style={[styles.sheetIconBox, styles.sheetIconDestructive]}>
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  </View>
                  <View style={styles.sheetItemText}>
                    <Text style={[styles.sheetItemLabel, { color: '#DC2626' }]}>
                      Delete Album
                    </Text>
                    <Text style={styles.sheetItemDesc}>Permanently remove this collection</Text>
                  </View>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Report Sheet */}
      <ReportSheet
        visible={!!reportImageId}
        onClose={() => setReportImageId(null)}
        targetType="PHOTO"
        subject={data?.photographer ?? data?.name}
        submit={submitPhotoReport}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: c.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    zIndex: 10,
  },
  navCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.text,
    marginHorizontal: spacing.sm,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },

  loadingNav: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  loadingBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.elevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
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

  list: { paddingBottom: 60, paddingTop: spacing.md },
  header: { gap: spacing.md, marginBottom: spacing.md },

  // Cover Card
  coverCard: {
    height: 180,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: c.surfaceMuted,
    position: 'relative',
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  coverScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  coverBadgeRow: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },

  // Title & Metadata Section
  titleSection: {
    gap: spacing.xs,
  },
  albumTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: c.text,
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  metaChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.surface,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  metaChipText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textSoft,
  },
  metaChipLocked: {
    borderColor: 'rgba(217, 119, 6, 0.4)',
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
  },

  // Photographer Card
  photographerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.md,
  },
  photographerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photographerInfo: {
    flex: 1,
    gap: 2,
  },
  photographerName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  photographerRole: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  verifiedBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Kind badges
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  kindEvent: { backgroundColor: c.primary },
  kindPaid: { backgroundColor: '#7C3AED' },
  kindFree: { backgroundColor: '#059669' },
  kindContent: { backgroundColor: '#6D28D9' },
  kindDefault: { backgroundColor: 'rgba(0,0,0,0.6)' },
  kindText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.5 },

  approvalPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  approvalPillText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },

  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  lockText: { color: '#fff', fontSize: 9.5, fontFamily: fonts.bold, letterSpacing: 0.5 },

  // Content approval note
  approvalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  approvalCardText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: c.textSoft, lineHeight: 18 },

  // Executive Action Strip
  actionStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  primaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: c.primary,
  },
  primaryActionText: { fontFamily: fonts.bold, fontSize: 14.5, color: '#fff' },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  secondaryActionText: { fontFamily: fonts.bold, fontSize: 13.5, color: c.text },
  optionsActionBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.6 },

  // Compact Face Chip
  compactFaceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  faceSparkleBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactFaceText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: c.textSoft,
  },
  compactFaceBold: {
    fontFamily: fonts.bold,
    color: c.primary,
  },

  // Locked card
  lockedCard: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.xl,
  },
  lockedIconBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.tint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: c.text },
  lockedMsg: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },

  // Photos section head
  photosSectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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

  // Photo grid cell
  photoCell: {
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  photoPlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.45,
  },

  // Empty state
  emptyContainer: {
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
    marginBottom: spacing.sm,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  emptyActionText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },

  // World-Class Lightbox
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
  lightboxTopActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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

  // Action Sheet (···)
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,10,26,0.6)',
    justifyContent: 'flex-end',
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  actionSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 18, color: c.text },
  sheetSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted, marginTop: 2 },
  sheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetOptionsList: { gap: spacing.sm },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.md,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  sheetItemDestructive: {
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.05)',
  },
  sheetIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconDestructive: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  sheetItemText: { flex: 1, gap: 2 },
  sheetItemLabel: { fontFamily: fonts.bold, fontSize: 14, color: c.text },
  sheetItemDesc: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
}));
