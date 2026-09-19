/**
 * Content Albums — the photographer's stock/library albums.
 *
 * Mobile port of salo-run's photographer ContentAlbumsTab: lists the
 * albums the photographer has published to the content library, grouped
 * by their approval lifecycle (Draft → Pending → Approved / Rejected).
 * The list reuses `/photographer/albums` filtered to rows that carry a
 * `contentApprovalStatus` (there's no dedicated content GET endpoint yet).
 *
 * Reached from the photographer "Events & albums" dashboard's Content
 * view tab. Type is Pragati Narrow, matching the web brand.
 */
import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import {
  listContentAlbums,
  type ContentAlbumItem,
  type ContentApprovalStatus,
} from '@/features/gallery/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

type Filter = 'ALL' | ContentApprovalStatus;

const STATUS_META: Record<ContentApprovalStatus, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: '#E5E7EB', fg: '#374151' },
  PENDING_APPROVAL: { label: 'Pending', bg: '#FEF3C7', fg: '#92400E' },
  APPROVED: { label: 'Approved', bg: '#D1FAE5', fg: '#047857' },
  REJECTED: { label: 'Rejected', bg: '#FEE2E2', fg: '#B91C1C' },
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'REJECTED', label: 'Rejected' },
];

export default function ContentAlbumsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(useCallback(() => listContentAlbums(), []));
  const [filter, setFilter] = useState<Filter>('ALL');

  const albums = data ?? [];
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      ALL: albums.length,
      DRAFT: 0,
      PENDING_APPROVAL: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    for (const a of albums) if (a.approvalStatus) c[a.approvalStatus] += 1;
    return c;
  }, [albums]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? albums : albums.filter((a) => a.approvalStatus === filter)),
    [albums, filter],
  );

  return (
    <Screen padded={false}>
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.eyebrow}>LIBRARY</Text>
            <Text style={styles.h1}>Content albums</Text>
            <Text style={styles.subtitle}>
              Publish stock photos to the Connekyt browse library. Albums go live once approved.
            </Text>

            <Pressable style={styles.newBtn} onPress={() => router.push('/content-album/new' as Href)}>
              <Ionicons name="add-circle" size={18} color="#fff" />
              <Text style={styles.newBtnText}>New content album</Text>
            </Pressable>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={[styles.pill, active && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, active && styles.pillTextActive]}>{f.label}</Text>
                    <View style={[styles.badge, active && styles.badgeActive]}>
                      <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                        {counts[f.key]}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => <ContentAlbumCard album={item} onOpen={() => router.push(`/album/${item.id}` as Href)} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : error ? (
            <EmptyState icon="cloud-offline-outline" title="Couldn't load albums" message="Pull to refresh and try again." />
          ) : (
            <EmptyState
              icon="images-outline"
              title={filter === 'ALL' ? 'No content albums yet' : 'Nothing here'}
              message={
                filter === 'ALL'
                  ? 'Tap "New content album" to publish stock photos to the library.'
                  : 'No albums match this filter.'
              }
            />
          )
        }
      />
    </Screen>
  );
}

function ContentAlbumCard({ album, onOpen }: { album: ContentAlbumItem; onOpen: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const meta = album.approvalStatus ? STATUS_META[album.approvalStatus] : null;
  return (
    <Pressable style={styles.card} onPress={onOpen} android_ripple={{ color: 'rgba(0,0,0,0.05)' }}>
      <View style={styles.cover}>
        {album.coverPhoto ? (
          <Image source={{ uri: album.coverPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
            <Ionicons name="images-outline" size={26} color={colors.textMuted} />
          </View>
        )}
        {meta ? (
          <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
            <Text style={[styles.statusBadgeText, { color: meta.fg }]}>{meta.label}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {album.name}
      </Text>
      <View style={styles.cardMeta}>
        {album.categoryLabel ? (
          <Text style={styles.cardCategory} numberOfLines={1}>
            {album.categoryLabel}
          </Text>
        ) : (
          <View />
        )}
        {typeof album.photoCount === 'number' ? (
          <Text style={styles.cardCount}>{album.photoCount} photos</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md },

  header: { paddingTop: spacing.md, marginBottom: spacing.xs },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 28, color: c.text, letterSpacing: -0.5, marginTop: 2 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted, marginTop: 2, lineHeight: 20 },

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: c.primary,
  },
  newBtnText: { fontFamily: fonts.bold, fontSize: 14, color: '#fff' },

  filterRow: { gap: 8, paddingVertical: spacing.md },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  pillActive: { backgroundColor: c.primary },
  pillText: { fontFamily: fonts.bold, fontSize: 14, color: c.textSoft },
  pillTextActive: { color: '#fff' },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: 'rgba(8,58,133,0.10)',
    alignItems: 'center',
  },
  badgeActive: { backgroundColor: 'rgba(255,255,255,0.24)' },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: c.primary },
  badgeTextActive: { color: '#fff' },

  card: { flex: 1, marginBottom: spacing.md },
  cover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: c.surfaceMuted,
  },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusBadgeText: { fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.3 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.text, marginTop: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 1 },
  cardCategory: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted, flex: 1 },
  cardCount: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
}));
