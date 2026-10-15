/**
 * Content Albums — the photographer's stock & commercial catalog albums.
 *
 * 20/20 Master-Grade Design:
 *   • Confident Editorial Header: Display title ("Content Albums") with live count badge,
 *     integrated search bar, and approval lifecycle pills (All / Draft / Pending / Approved / Rejected).
 *   • Editorial 4:5 Photography Cards: High-aspect portrait cards with subtle scrim,
 *     frosted approval badges, and clean typography.
 *   • Modern Floating Action Button: Solid high-contrast "+ New Content Album" anchored
 *     comfortably above the safe area.
 *   • Seamless Navigation: Routes to the master album viewer and editor at /album/[id].
 *   • NO LinearGradient, NO top-tear accents — pure solid theme tokens.
 */
import { useCallback, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  PENDING_APPROVAL: { label: 'In Review', bg: '#FEF3C7', fg: '#92400E' },
  APPROVED: { label: 'Live · Approved', bg: '#D1FAE5', fg: '#047857' },
  REJECTED: { label: 'Needs Changes', bg: '#FEE2E2', fg: '#B91C1C' },
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Drafts' },
  { key: 'PENDING_APPROVAL', label: 'In Review' },
  { key: 'APPROVED', label: 'Live' },
  { key: 'REJECTED', label: 'Needs Changes' },
];

export default function ContentAlbumsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, loading, error, refresh } = useAsync(useCallback(() => listContentAlbums(), []));
  const [filter, setFilter] = useState<Filter>('ALL');
  const [search, setSearch] = useState('');

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return albums.filter((a) => {
      if (filter !== 'ALL' && a.approvalStatus !== filter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.categoryLabel ?? '').toLowerCase().includes(q)
      );
    });
  }, [albums, filter, search]);

  const header = (
    <View style={styles.header}>
      {/* Top Title & Total Badge Row */}
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text style={styles.eyebrow}>STOCK & COMMERCIAL</Text>
          <View style={styles.titleWithBadge}>
            <Text style={styles.h1}>Content Albums</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{albums.length}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Filter Segment Row */}
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
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {f.label}
              </Text>
              <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                  {counts[f.key]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Integrated Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search stock collections by title or tag…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          blurOnSubmit={true}
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {search ? (
          <Pressable onPress={() => setSearch('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      <FlatList
        data={filtered}
        keyExtractor={(a) => a.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={header}
        renderItem={({ item }) => {
          const meta = item.approvalStatus ? STATUS_META[item.approvalStatus] : null;

          return (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/album/${item.id}` as Href)}
              android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
            >
              <View style={styles.cover}>
                {item.coverPhoto ? (
                  <Image
                    source={{ uri: item.coverPhoto }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={200}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFill, styles.coverFallback]}>
                    <Ionicons name="images-outline" size={32} color={colors.textMuted} />
                  </View>
                )}

                {/* Scrim Overlay */}
                <View style={styles.cardScrim} />

                {/* Status Badge in Top Corner */}
                <View style={styles.cardTop}>
                  {meta ? (
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.fg }]}>
                        {meta.label}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Bottom Overlay: Photo count */}
                <View style={styles.cardBottom}>
                  <View style={styles.photoCountChip}>
                    <Ionicons name="images" size={11} color="#fff" />
                    <Text style={styles.photoCountText}>
                      {typeof item.photoCount === 'number' ? item.photoCount : 0} photos
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item.categoryLabel ? item.categoryLabel : 'Stock Library'}
                </Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Loading stock albums…</Text>
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Couldn&apos;t load content albums</Text>
              <Text style={styles.emptySubtitle}>
                Please check your network connection and pull down to retry.
              </Text>
              <Pressable style={styles.emptyBtn} onPress={refresh}>
                <Text style={styles.emptyBtnText}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="images-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {search || filter !== 'ALL' ? 'No matching content albums' : 'No content albums yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search || filter !== 'ALL'
                  ? 'Try selecting a different approval status or clearing your search.'
                  : 'Publish high-resolution stock photos to monetize them in Connekt\'s public catalog.'}
              </Text>
              {!search && filter === 'ALL' ? (
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => router.push('/content-album/new' as Href)}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>New Content Album</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
      />

      {/* Floating Action Button — Create New Content Album */}
      <Pressable
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom + 18, 28) },
        ]}
        onPress={() => router.push('/content-album/new' as Href)}
        android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
        accessibilityRole="button"
        accessibilityLabel="New content album"
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.fabText}>New Content Album</Text>
      </Pressable>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  header: { paddingTop: spacing.md, gap: spacing.md, marginBottom: spacing.xs },

  // Title Row
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  titleCol: { gap: 2 },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    letterSpacing: 1.2,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  h1: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: c.text,
    letterSpacing: -0.6,
  },
  totalBadge: {
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    alignSelf: 'center',
  },
  totalBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },

  // Filter Segment
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  filterPillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  filterPillText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.textSoft,
  },
  filterPillTextActive: {
    color: '#fff',
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  filterBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
  },
  filterBadgeTextActive: {
    color: '#fff',
  },

  // Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 14.5,
    color: c.text,
    padding: 0,
  },

  // Editorial 4:5 Cards
  card: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cover: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: c.surfaceMuted,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  cardScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 18, 36, 0.35)',
  },
  coverFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
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
  photoCountChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  photoCountText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
  },
  cardBody: {
    padding: spacing.sm,
    gap: 2,
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: c.text,
    letterSpacing: -0.2,
  },
  cardMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radii.full,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 10,
  },
  fabText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
    letterSpacing: 0.2,
  },

  // Empty & Loading States
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },
  emptyContainer: {
    marginVertical: spacing.xl,
    padding: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: c.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
    marginBottom: spacing.sm,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  emptyBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
  },
}));
