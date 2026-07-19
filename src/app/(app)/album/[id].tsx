import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
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
import { isApiError } from '@/store/auth';
import { colors, fonts, fontSize, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

const APPROVAL_META: Record<string, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: '#E5E7EB', fg: '#374151' },
  PENDING_APPROVAL: { label: 'Pending review', bg: '#FEF3C7', fg: '#92400E' },
  APPROVED: { label: 'Approved · Live', bg: '#D1FAE5', fg: '#047857' },
  REJECTED: { label: 'Needs changes', bg: '#FEE2E2', fg: '#B91C1C' },
};

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isPhotographer } = useRole();
  const { width } = useWindowDimensions();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getAlbum(id, isPhotographer), [id, isPhotographer]),
  );
  const [unlocking, setUnlocking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<AlbumFaceStatus | null>(null);
  const [reportImageId, setReportImageId] = useState<string | null>(null);

  // Pull the face-index status alongside the album so the photographer
  // can verify their photos are searchable. Best-effort: a failure here
  // shouldn't tank the album view.
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

  const onAddPhotos = async () => {
    const imgs = await pickMultipleFromLibrary(30);
    if (!imgs.length) return;
    setBusy('add');
    try {
      await addAlbumImages(id, imgs);
      await refresh();
    } catch (err) {
      Alert.alert('Upload failed', isApiError(err) ? err.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const onDelete = () => {
    Alert.alert('Delete album', 'This permanently deletes the album and its photos. Continue?', [
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

  /**
   * Album lifecycle actions (Photographer only):
   *   • Send       → emails the album link to the linked client
   *   • Publish    → publishes to Face-AI search so clients can find
   *                  themselves via /find-my-photos
   *   • Submit     → submits a content album for review (paid catalog)
   * The three actions are best-effort, each surfaces its own success
   * toast via Alert and refreshes the album view on completion.
   */
  const runLifecycle = async (
    key: 'send' | 'publish' | 'submit',
    fn: () => Promise<void>,
    successTitle: string,
    successMessage: string,
  ) => {
    setBusy(key);
    try {
      await fn();
      await refresh();
      Alert.alert(successTitle, successMessage);
    } catch (err) {
      Alert.alert(
        'Could not complete',
        isApiError(err) ? err.message : 'Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const onSendToClient = () =>
    runLifecycle(
      'send',
      () => sendAlbumToClient(id),
      'Album sent',
      "The client now has an email with the link to view this album.",
    );

  const onPublishToFaceSearch = () =>
    runLifecycle(
      'publish',
      () => publishAlbumToFaceSearch(id),
      'Album published',
      "Your photos are now searchable through the Find My Photos face-scan.",
    );

  const onSubmitForReview = () =>
    runLifecycle(
      'submit',
      () => submitContentAlbum(id),
      'Submitted for review',
      "Our team will publish this album to the catalog once it's approved.",
    );

  // Photographers own the photos in their own albums, so reporting is only
  // offered on the client side of this screen.
  const onLongPressPhoto = (imageId: string) => {
    if (isPhotographer) return;
    Alert.alert('Photo actions', undefined, [
      { text: 'Report photo', style: 'destructive', onPress: () => setReportImageId(imageId) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const submitPhotoReport = async (reason: string, description: string) => {
    if (!reportImageId) throw { status: 400, message: 'Nothing to report.' };
    return reportContent('PHOTO', reportImageId, reason, description);
  };

  const gap = spacing.sm;
  const cols = 3;
  const cell = (width - spacing.lg * 2 - gap * (cols - 1)) / cols;

  // Archive restore is PAID — the app never collects the payment (the old
  // unlockAlbum(id) POST unlocked with no payment at all). We mint an
  // ARCHIVE handoff token and complete the payment on connekyt.com.
  // Gated: on Android this button never renders (see lockedCard below).
  const onUnlock = async () => {
    if (!digitalPurchasesEnabled) return;
    setUnlocking(true);
    try {
      if (data?.eventId && data?.currencyId && data?.amountDue) {
        const url = await mintHandoffUrl('ARCHIVE', {
          eventId: data.eventId,
          amount: data.amountDue,
          currencyId: data.currencyId,
        });
        await openWebCheckout(url);
      } else {
        // FALLBACK: the customer album payload doesn't include the
        // eventId/currencyId the ARCHIVE handoff needs — send the user to
        // the web dashboard's album page to complete the unlock there.
        await openWebCheckout('https://dashboard.connekyt.com');
      }
    } catch (err) {
      Alert.alert('Unlock failed', isApiError(err) ? err.message : 'Please try again.');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  const locked = data?.locked && data.images.length === 0;

  // Content vs normal (event/personal) — drives the badge + which
  // lifecycle actions are offered.
  const isContent = !!data?.isContent;
  const approval = data?.approvalStatus;
  const approvalMeta = approval ? APPROVAL_META[approval] : null;
  const kindLabel = isContent
    ? 'CONTENT ALBUM'
    : data?.kind
      ? `${data.kind.toUpperCase()} ALBUM`
      : 'ALBUM';
  const canSubmit = isContent && (approval === 'DRAFT' || approval === 'REJECTED');

  return (
    <Screen padded={false}>
      <FlatList
        data={locked ? [] : data?.images ?? []}
        keyExtractor={(img) => img.id}
        numColumns={cols}
        columnWrapperStyle={{ gap }}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Kind badge (+ approval status for content albums) */}
            <View style={styles.badgeRow}>
              <View style={[styles.kindBadge, isContent ? styles.kindContent : styles.kindNormal]}>
                <Ionicons name={isContent ? 'newspaper' : 'images'} size={11} color="#fff" />
                <Text style={styles.kindText}>{kindLabel}</Text>
              </View>
              {approvalMeta ? (
                <View style={[styles.approvalPill, { backgroundColor: approvalMeta.bg }]}>
                  <Text style={[styles.approvalPillText, { color: approvalMeta.fg }]}>{approvalMeta.label}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.title}>{data?.name}</Text>
            <Text style={styles.meta}>
              {data?.photoCount != null ? `${data.photoCount} photo${data.photoCount === 1 ? '' : 's'}` : ''}
              {data?.categoryLabel ? ` · ${data.categoryLabel}` : ''}
              {data?.photographer ? ` · ${data.photographer}` : ''}
            </Text>

            {/* Content approval note */}
            {isContent && approval ? (
              <View style={styles.approvalCard}>
                <Text style={styles.approvalCardText}>
                  {approval === 'DRAFT'
                    ? 'Draft — submit for review to publish this album to the public browse library.'
                    : approval === 'PENDING_APPROVAL'
                      ? 'Under review — our team will publish it to the catalog once approved.'
                      : approval === 'APPROVED'
                        ? 'Live on the public browse library.'
                        : `Needs changes${data?.approvalComment ? `: ${data.approvalComment}` : '. Update it and resubmit.'}`}
                </Text>
              </View>
            ) : null}

            {/* Photographer actions — gated by album kind */}
            {isPhotographer ? (
              <View style={styles.actions}>
                <ActBtn icon="add" label="Add photos" variant="primary" onPress={onAddPhotos} loading={busy === 'add'} />
                {isContent ? (
                  canSubmit ? (
                    <ActBtn icon="cloud-upload" label="Submit for review" variant="accent" onPress={onSubmitForReview} loading={busy === 'submit'} />
                  ) : null
                ) : (
                  <>
                    <ActBtn icon="paper-plane" label="Send to client" variant="primary" onPress={onSendToClient} loading={busy === 'send'} />
                    <ActBtn icon="scan" label="Publish to Face-AI" variant="accent" onPress={onPublishToFaceSearch} loading={busy === 'publish'} />
                  </>
                )}
                <ActBtn icon="trash" label="Delete" variant="danger" onPress={onDelete} loading={busy === 'delete'} />
              </View>
            ) : null}

            {/* Face-scan index status — Photographer-only. */}
            {isPhotographer && faceStatus ? (
              <View style={styles.faceCard}>
                <View style={styles.faceHead}>
                  <Ionicons name="scan-outline" size={16} color={colors.primary} />
                  <Text style={styles.faceTitle}>Face-scan index</Text>
                </View>
                {faceStatus.collection?.error ? (
                  <Text style={[styles.faceMsg, { color: colors.error }]}>
                    Indexing error: {faceStatus.collection.message || faceStatus.collection.error}
                  </Text>
                ) : (
                  <Text style={styles.faceMsg}>
                    {faceStatus.collection?.faceCount ?? 0} face
                    {(faceStatus.collection?.faceCount ?? 0) === 1 ? '' : 's'} indexed across{' '}
                    {faceStatus.galleryImageCount} photo
                    {faceStatus.galleryImageCount === 1 ? '' : 's'}
                    {faceStatus.collection?.status ? ` · status: ${faceStatus.collection.status}` : ''}.
                  </Text>
                )}
              </View>
            ) : null}

            {locked ? (
              <View style={styles.lockedCard}>
                <Ionicons name="lock-closed" size={28} color={colors.primary} />
                <Text style={styles.lockedTitle}>This album is archived</Text>
                {digitalPurchasesEnabled ? (
                  <>
                    <Text style={styles.lockedMsg}>
                      Unlock to view and download all {data?.photoCount ?? ''} photos.
                      Payment is completed on connekyt.com.
                    </Text>
                    <Button
                      title={
                        data?.amountDue
                          ? `Unlock for ${formatMoney(data.amountDue, data.currency)} on connekyt.com`
                          : 'Unlock on connekyt.com'
                      }
                      onPress={onUnlock}
                      loading={unlocking}
                    />
                  </>
                ) : (
                  // Restoring an archived album is a paid digital service, so
                  // there's no in-app path to it on Android and no link out to
                  // one either.
                  <Text style={styles.lockedMsg}>
                    Its {data?.photoCount ?? ''} photos are in cold storage and aren&apos;t
                    available here. Contact support to restore this album.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <PhotoCell image={item} size={cell} onLongPress={() => onLongPressPhoto(item.id)} />
        )}
        ListEmptyComponent={
          locked ? null : (
            <EmptyState icon="images-outline" title="No photos" message="This album has no photos yet." />
          )
        }
      />

      {/* Report a photo (long-press a tile to open). */}
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

type ActVariant = 'primary' | 'accent' | 'danger';
const ACT_STYLES: Record<ActVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: '#fff' },
  accent: { bg: colors.accent, fg: '#fff' },
  danger: { bg: '#EF4444', fg: '#fff' },
};

function ActBtn({
  icon,
  label,
  variant,
  onPress,
  loading,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  variant: ActVariant;
  onPress: () => void;
  loading?: boolean;
}) {
  const v = ACT_STYLES[variant];
  return (
    <Pressable
      style={({ pressed }) => [styles.actBtn, { backgroundColor: v.bg }, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          <Ionicons name={icon} size={15} color={v.fg} />
          <Text style={[styles.actText, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

function PhotoCell({
  image,
  size,
  onLongPress,
}: {
  image: AlbumImage;
  size: number;
  onLongPress?: () => void;
}) {
  const open = () => {
    if (image.url) WebBrowser.openBrowserAsync(image.url);
  };
  return (
    <Pressable onPress={open} onLongPress={onLongPress} style={[styles.cell, { width: size, height: size }]}>
      <Image source={{ uri: image.url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  list: { padding: spacing.lg, gap: spacing.sm },
  header: { gap: 4, marginBottom: spacing.md },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  kindBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  kindNormal: { backgroundColor: colors.primary },
  kindContent: { backgroundColor: '#7C3AED' },
  kindText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.6 },
  approvalPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full },
  approvalPillText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },

  title: { fontFamily: fonts.bold, fontSize: 26, color: colors.text, letterSpacing: -0.5 },
  meta: { fontFamily: fonts.regular, fontSize: 13, color: colors.textMuted },

  approvalCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
  },
  approvalCardText: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSoft, lineHeight: 19 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  actBtn: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: radii.md,
  },
  actText: { fontFamily: fonts.bold, fontSize: 14 },

  faceCard: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.infoBg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 4,
  },
  faceHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  faceTitle: { fontFamily: fonts.bold, fontSize: fontSize.sm, color: colors.primary },
  faceMsg: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textSoft, lineHeight: 18 },

  lockedCard: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.xl,
  },
  lockedTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.text },
  lockedMsg: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  cell: { borderRadius: radii.sm, overflow: 'hidden', backgroundColor: colors.surfaceMuted, marginBottom: spacing.sm },
});
