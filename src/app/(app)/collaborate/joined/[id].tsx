/**
 * A collaborator's workspace for an album someone else owns, mirrors the
 * dashboard's /user/photographer/collaborate/joined/[id]. Add photos from
 * the library; each one waits for the owner's decision. Follow what was
 * added or not accepted, with the owner's note.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { getJoinedAlbum, leaveAlbum, submitPhoto, withdrawSubmission } from '@/features/collab/api';
import { AlbumCover, PersonRow, StatusChip } from '@/features/collab/components';
import { timeAgo, type JoinedAlbumDetail, type SubmissionStatus } from '@/features/collab/model';
import { pickOriginalPhotos, type PickedImage } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

type Filter = 'ALL' | SubmissionStatus;
const FILTERS: [Filter, string][] = [['ALL', 'All'], ['PENDING', 'Waiting'], ['APPROVED', 'Added'], ['REJECTED', 'Not accepted']];
const GAP = 8;

function cleanErrorMessage(name: string, raw: string): string {
  if (raw.toLowerCase().includes('low-quality') || raw.toLowerCase().includes('is only')) {
    const dimMatch = raw.match(/is only (\d+x\d+)/i) || raw.match(/\((\d+x\d+)\)/);
    const dim = dimMatch ? dimMatch[1].replace('x', ' × ') : null;
    let guide = 'Photos must be at least Full HD (1920 × 1080).';
    const guideMatch = raw.match(/((?:Photos|Every photo) must be at least .+$)/i);
    if (guideMatch) {
      guide = guideMatch[1].trim();
    }
    return `${dim ? `Resolution: ${dim} px. ` : ''}${guide}`;
  }
  let clean = raw;
  if (clean.startsWith(`${name}:`)) {
    clean = clean.slice(name.length + 1).trim();
  }
  return clean;
}

export default function JoinedAlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useStyles();
  const { width } = useWindowDimensions();
  const [data, setData] = useState<JoinedAlbumDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [progress, setProgress] = useState<{ done: number; failed: number; total: number } | null>(null);
  const [failures, setFailures] = useState<Array<{ id: string; name: string; error: string }>>([]);
  const [staged, setStaged] = useState<PickedImage[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const d = await getJoinedAlbum(id);
      setData(d);
      navigation.setOptions({ title: d.album.title });
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load this album.');
    }
  }, [id, navigation]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subs = useMemo(() => data?.submissions ?? [], [data]);
  const counts = useMemo(() => ({
    ALL: subs.length,
    PENDING: subs.filter((s) => s.status === 'PENDING').length,
    APPROVED: subs.filter((s) => s.status === 'APPROVED').length,
    REJECTED: subs.filter((s) => s.status === 'REJECTED').length,
  }), [subs]);
  const shown = filter === 'ALL' ? subs : subs.filter((s) => s.status === filter);
  const uploading = !!progress && progress.done + progress.failed < progress.total;

  const columns = width >= 700 ? 4 : 2;
  const tile = Math.floor((Math.min(width, 900) - spacing.xl * 2 - GAP * (columns - 1)) / columns);

  const addPhotos = async () => {
    if (!id || uploading) return;
    // Originals, not the compressed copies other screens upload: this is
    // delivery work another photographer puts in their album.
    const { photos: picked, skipped } = await pickOriginalPhotos(50);
    if (skipped.length > 0) {
      Alert.alert(`${skipped.length} photo${skipped.length === 1 ? '' : 's'} left out`,
        skipped.slice(0, 5).map((s) => `${s.name}: ${s.reason}`).join('\n'));
    }
    if (picked.length === 0) return;
    // Stage only. Nothing reaches the owner until the collaborator taps Submit.
    setProgress(null);
    setFailures([]);
    setStaged((cur) => {
      const have = new Set(cur.map((p) => p.uri));
      return [...cur, ...picked.filter((p) => !have.has(p.uri))];
    });
  };

  const removeStaged = (uri: string) => setStaged((cur) => cur.filter((p) => p.uri !== uri));

  const submitStaged = async () => {
    if (!id || uploading || staged.length === 0) return;
    const batch = staged;
    setFailures([]);
    let done = 0;
    let failed = 0;
    const failedItems: Array<{ id: string; name: string; error: string }> = [];
    setProgress({ done, failed, total: batch.length });
    // One at a time: phones on mobile data do better with a steady single
    // upload than several competing ones.
    for (const img of batch) {
      try {
        await submitPhoto(id, img);
        done += 1;
      } catch (e) {
        failed += 1;
        const msg = isApiError(e) ? e.message : 'Upload failed';
        failedItems.push({ id: `${Date.now()}-${failed}`, name: img.name ?? `Photo ${done + failed}`, error: msg });
      }
      setProgress({ done, failed, total: batch.length });
    }
    // Sent photos leave the staging list. Rejected ones stay out too, since the
    // same file would be rejected again; the collaborator picks a better one.
    setStaged([]);
    await load();
    if (failedItems.length > 0) {
      setFailures(failedItems);
      const firstClean = cleanErrorMessage(failedItems[0].name, failedItems[0].error);
      Alert.alert(`${failedItems.length} photo${failedItems.length === 1 ? '' : 's'} not submitted`, firstClean);
    }
  };

  const withdraw = (sid: string) => {
    Alert.alert('Withdraw this photo?', 'It will be removed before the owner reviews it.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Withdraw', style: 'destructive', onPress: async () => {
          try { await withdrawSubmission(sid); await load(); } catch (e) {
            Alert.alert('Could not withdraw', isApiError(e) ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const leave = () => {
    if (!data || !id) return;
    Alert.alert('Leave this album?',
      `You will no longer be able to submit photos to "${data.album.title}". Photos already added stay in the album. To come back, ${data.owner.name} has to send you a new link.`,
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave', style: 'destructive', onPress: async () => {
            try { await leaveAlbum(id); router.replace('/collaborate' as Href); } catch (e) {
              Alert.alert('Could not leave', isApiError(e) ? e.message : 'Please try again.');
            }
          },
        },
      ]);
  };

  if (!data) {
    return (
      <Screen padded={false}>
        {error ? (
          <EmptyState icon="lock-closed-outline" title="You cannot open this album" message={error}
            action={{ label: 'Back to Collaborate', onPress: () => router.replace('/collaborate' as Href) }} />
        ) : (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        )}
      </Screen>
    );
  }

  const { album, owner } = data;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        <View style={styles.header}>
          <View style={styles.headerCover}><AlbumCover uri={album.coverImage} title={album.title} /></View>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>COLLABORATING</Text>
            <Text style={styles.title} numberOfLines={2}>{album.title}</Text>
          </View>
        </View>
        <PersonRow person={owner} caption="Owns this album and reviews what you submit" />

        <View style={styles.uploadCard}>
          <Text style={styles.uploadTitle}>Submit your photos</Text>
          <Text style={styles.muted}>
            Full quality. JPEG, PNG or WebP, up to 20 MB each, at least Full HD. Photos are only sent to {owner.name} when
            you tap Submit, and you can withdraw one until it is reviewed.
          </Text>
          <Button title={staged.length > 0 ? 'Add more photos' : 'Add photos'}
            variant={staged.length > 0 ? 'outline' : undefined} onPress={addPhotos} />
          {staged.length > 0 && (
            <View style={styles.stagedBox}>
              <Text style={styles.stagedTitle}>
                {staged.length} photo{staged.length === 1 ? '' : 's'} ready to submit
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stagedRow}>
                {staged.map((p) => (
                  <View key={p.uri} style={styles.stagedThumb}>
                    <Image source={{ uri: p.uri }} style={styles.fill} contentFit="cover" />
                    {!uploading && (
                      <Pressable onPress={() => removeStaged(p.uri)} hitSlop={6} style={styles.stagedRemove}
                        accessibilityRole="button" accessibilityLabel={`Remove ${p.name}`}>
                        <Ionicons name="close" size={14} color="#FFFFFF" />
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>
              <Button
                title={uploading
                  ? `Submitting ${Math.min(progress!.done + progress!.failed + 1, progress!.total)} of ${progress!.total}…`
                  : `Submit ${staged.length} photo${staged.length === 1 ? '' : 's'} to ${owner.name}`}
                onPress={submitStaged} loading={uploading} />
            </View>
          )}
          {progress && (
            <View style={styles.progressTrack} accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: progress.total, now: progress.done + progress.failed }}>
              <View style={[styles.progressFill, { width: `${Math.round(((progress.done + progress.failed) / progress.total) * 100)}%` }]} />
            </View>
          )}
          {progress && !uploading && (
            <Text style={styles.muted}>
              {progress.done} submitted{progress.failed > 0 ? ` · ${progress.failed} failed` : ''}
            </Text>
          )}
          {failures.length > 0 && !uploading && (
            <View style={styles.errorBox}>
              <View style={styles.errorHeader}>
                <Ionicons name="alert-circle" size={16} color={colors.error} />
                <Text style={styles.errorTitle}>
                  {failures.length} photo{failures.length === 1 ? '' : 's'} rejected
                </Text>
                <Pressable onPress={() => setFailures([])} hitSlop={8} style={{ marginLeft: 'auto' }}>
                  <Text style={styles.errorDismiss}>Dismiss</Text>
                </Pressable>
              </View>
              {failures.map((err) => (
                <View key={err.id} style={styles.errorRow}>
                  <Text style={styles.errorFileName} numberOfLines={1}>{err.name}</Text>
                  <Text style={styles.errorDetail}>{cleanErrorMessage(err.name, err.error)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map(([key, label]) => (
            <Pressable key={key} onPress={() => setFilter(key)} accessibilityRole="tab" accessibilityState={{ selected: filter === key }}
              style={[styles.filter, filter === key && styles.filterOn]}>
              <Text style={[styles.filterText, filter === key && styles.filterTextOn]}>{label} {counts[key]}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {shown.length === 0 ? (
          <EmptyState icon="images-outline"
            title={filter === 'ALL' ? 'Nothing submitted yet' : 'Nothing here'}
            message={filter === 'ALL' ? 'Photos you submit show up here with their review status.' : 'No photos with this status.'} />
        ) : (
          <View style={styles.grid}>
            {shown.map((s) => (
              <View key={s.id} style={[styles.card, { width: tile }]}>
                <View style={{ width: tile, height: tile, backgroundColor: colors.surfaceMuted }}>
                  {(s.thumbnailUrl || s.imageUrl) ? (
                    <Image source={{ uri: s.thumbnailUrl || s.imageUrl }} style={styles.fill} contentFit="cover" transition={120} />
                  ) : null}
                </View>
                <View style={styles.cardBody}>
                  <StatusChip status={s.status} />
                  {s.reviewNote ? <Text style={styles.note} numberOfLines={3}>“{s.reviewNote}”</Text> : null}
                  <View style={styles.cardFoot}>
                    <Text style={styles.small}>{timeAgo(s.submittedAt)}</Text>
                    {s.status === 'PENDING' && (
                      <Pressable onPress={() => withdraw(s.id)} style={styles.withdrawBtn} accessibilityRole="button" accessibilityLabel="Withdraw photo">
                        <Text style={styles.withdraw}>Withdraw</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        <Button title="Leave album" variant="ghost" onPress={leave} />
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.xl, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  header: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  headerCover: { width: 84, height: 64, borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  eyebrow: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  title: { color: c.text, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, fontFamily: fonts.bold },
  muted: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  uploadCard: {
    ...e(1), backgroundColor: c.card, borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft,
    padding: spacing.lg, gap: spacing.md,
  },
  uploadTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  stagedBox: { gap: spacing.md, borderTopWidth: 1, borderTopColor: c.borderSoft, paddingTop: spacing.md },
  stagedTitle: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  stagedRow: { gap: spacing.sm },
  stagedThumb: { width: 72, height: 72, borderRadius: radii.md, overflow: 'hidden', backgroundColor: c.surfaceMuted },
  stagedRemove: {
    position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center',
  },
  progressTrack: { height: 6, borderRadius: radii.full, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.full, backgroundColor: c.primary },
  filters: { gap: spacing.sm },
  filter: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: c.surfaceMuted, minHeight: 36, justifyContent: 'center' },
  filterOn: { backgroundColor: c.primary },
  filterText: { color: c.textSoft, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  filterTextOn: { color: c.textOnPrimary, fontWeight: fontWeight.semibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { backgroundColor: c.card, borderRadius: radii.md, overflow: 'hidden', borderWidth: 1, borderColor: c.borderSoft },
  cardBody: { padding: spacing.sm, gap: spacing.xs },
  note: { color: c.textSoft, fontSize: fontSize.xs, fontStyle: 'italic' },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { color: c.textMuted, fontSize: fontSize.xs },
  withdrawBtn: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'flex-end' },
  withdraw: { color: c.error, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: spacing.md,
    gap: spacing.sm,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  errorTitle: {
    color: c.error,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  errorDismiss: {
    color: c.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textDecorationLine: 'underline',
  },
  errorRow: {
    backgroundColor: c.card,
    borderRadius: radii.sm,
    padding: spacing.sm,
    gap: 2,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
  },
  errorFileName: {
    color: c.text,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  errorDetail: {
    color: c.text,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
}));
