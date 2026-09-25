/**
 * A collaborator's workspace for an album someone else owns, mirrors the
 * dashboard's /user/photographer/collaborate/joined/[id]. Add photos from
 * the library; each one waits for the owner's decision. Follow what was
 * added or not accepted, with the owner's note.
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { getJoinedAlbum, leaveAlbum, submitPhoto, withdrawSubmission } from '@/features/collab/api';
import { AlbumCover, PersonRow, StatusChip } from '@/features/collab/components';
import { timeAgo, type JoinedAlbumDetail, type SubmissionStatus } from '@/features/collab/model';
import { pickMultipleFromLibrary } from '@/services/imagePicker';
import { isApiError } from '@/store/auth';
import { fontSize, fontWeight, fonts, radii, spacing, makeStyles, useTheme } from '@/theme';

type Filter = 'ALL' | SubmissionStatus;
const FILTERS: [Filter, string][] = [['ALL', 'All'], ['PENDING', 'Waiting'], ['APPROVED', 'Added'], ['REJECTED', 'Not accepted']];
const GAP = 8;

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
    const picked = await pickMultipleFromLibrary(50);
    if (picked.length === 0) return;
    let done = 0;
    let failed = 0;
    let firstError: string | null = null;
    setProgress({ done, failed, total: picked.length });
    // One at a time: phones on mobile data do better with a steady single
    // upload than several competing ones.
    for (const img of picked) {
      try {
        await submitPhoto(id, img);
        done += 1;
      } catch (e) {
        failed += 1;
        firstError = firstError ?? (isApiError(e) ? e.message : 'Upload failed');
      }
      setProgress({ done, failed, total: picked.length });
    }
    await load();
    if (failed > 0) {
      Alert.alert(`${failed} photo${failed === 1 ? '' : 's'} not submitted`, firstError ?? 'Please try again.');
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
          <Text style={styles.muted}>{owner.name} decides what goes into the album. You can withdraw a photo until it is reviewed.</Text>
          <Button title={uploading ? `Submitting ${progress!.done + progress!.failed + 1} of ${progress!.total}…` : 'Add photos'}
            onPress={addPhotos} loading={uploading} />
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
                  {s.imageUrl ? <Image source={{ uri: s.imageUrl }} style={styles.fill} contentFit="cover" transition={120} /> : null}
                </View>
                <View style={styles.cardBody}>
                  <StatusChip status={s.status} />
                  {s.reviewNote ? <Text style={styles.note} numberOfLines={3}>“{s.reviewNote}”</Text> : null}
                  <View style={styles.cardFoot}>
                    <Text style={styles.small}>{timeAgo(s.submittedAt)}</Text>
                    {s.status === 'PENDING' && (
                      <Pressable onPress={() => withdraw(s.id)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Withdraw photo">
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
  withdraw: { color: c.error, fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
}));
