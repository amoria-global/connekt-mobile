/**
 * Photobooks — curated photo collections from events.
 *
 * 20/20 Master-Grade Design:
 *   • Confident Editorial Header: Display title ("Photobooks") with live collection
 *     count chip, search bar, and status filter pills (All / Published / Draft / Sent).
 *   • Hardcover Book Cards: 3:4 portrait book aspect ratio, subtle spine shadow,
 *     frosted status badge, and rich typography.
 *   • Modern Floating Action Button: Solid high-contrast "+ New Photobook" anchored
 *     safely above bottom insets.
 *   • Night-studio pass: spine-edged cover cards with the API's own status, count and byline, skeleton loading,
 *     an error with Try again, and the accent on the active filter for client and coordinator (the photographer
 *     keeps the primary colour).
 */
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { listPhotobooks, listReceivedPhotobooks, type Photobook } from '@/features/photobooks/api';
import { useAsync } from '@/hooks/useAsync';
import { PhotobookCard, PhotobookGridSkeleton } from '@/features/photobooks/PhotobookCard';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

type StatusFilter = 'ALL' | 'PUBLISHED' | 'DRAFT' | 'SENT';

export default function PhotobooksScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isPhotographer, isCoordinator } = useRole();
  const canCreate = isPhotographer || isCoordinator;
  const accent = !isPhotographer;

  // A photographer has two shelves: books they made, and books clients sent them to edit (web "received photobooks").
  const [shelf, setShelf] = useState<'mine' | 'received'>('mine');
  const mine = useAsync(useCallback(() => listPhotobooks(), []));
  const receivedList = useAsync(useCallback(() => (isPhotographer ? listReceivedPhotobooks() : Promise.resolve([])), [isPhotographer]));
  const received = isPhotographer && shelf === 'received';
  // Coming back from a book (resubmitted or removed there) must not show the old shelf. Quiet, so the list does not flash.
  const refreshMine = mine.refreshQuietly;
  const refreshReceived = receivedList.refreshQuietly;
  useFocusEffect(
    useCallback(() => {
      void refreshMine();
      void refreshReceived();
    }, [refreshMine, refreshReceived]),
  );
  const { data, loading, error, refresh } = received ? receivedList : mine;
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [search, setSearch] = useState('');

  const photobooks = useMemo(() => data ?? [], [data]);
  const openBook = useCallback((id: string, isReceived: boolean) => router.push((isReceived ? `/photobook/${id}?received=1` : `/photobook/${id}`) as Href), [router]);

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = { ALL: photobooks.length, PUBLISHED: 0, DRAFT: 0, SENT: 0 };
    for (const p of photobooks) {
      const s = (p.status ?? '').toUpperCase();
      if (s === 'PUBLISHED') c.PUBLISHED += 1;
      else if (s === 'DRAFT') c.DRAFT += 1;
      else if (s === 'SENT') c.SENT += 1;
    }
    return c;
  }, [photobooks]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return photobooks.filter((p) => {
      const s = (p.status ?? '').toUpperCase();
      if (!received) {
        if (filter === 'PUBLISHED' && s !== 'PUBLISHED') return false;
        if (filter === 'DRAFT' && s !== 'DRAFT') return false;
        if (filter === 'SENT' && s !== 'SENT') return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.photographerName ?? '').toLowerCase().includes(q)
      );
    });
  }, [photobooks, filter, search, received]);

  const header = (
    <View style={styles.header}>
      {/* Top Title & Count Row */}
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text style={styles.eyebrow}>CURATED COLLECTIONS</Text>
          <View style={styles.titleWithBadge}>
            <Text style={styles.h1}>Photobooks</Text>
            <View style={styles.totalBadge}>
              <Text style={styles.totalBadgeText}>{photobooks.length}</Text>
            </View>
          </View>
        </View>
      </View>

      {isPhotographer ? (
        <View style={styles.filterRow} accessibilityRole="tablist">
          {(['mine', 'received'] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setShelf(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: shelf === k }}
              style={[styles.filterPill, shelf === k && styles.filterPillActive, { minHeight: 44 }]}
            >
              <Text style={[styles.filterPillText, shelf === k && styles.filterPillTextActive]}>
                {k === 'mine' ? 'My photobooks' : 'Received from clients'}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Filter Segment Row */}
      {received ? null : <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {(['ALL', 'PUBLISHED', 'DRAFT', 'SENT'] as const).map((f) => {
          const active = filter === f;
          const label =
            f === 'ALL'
              ? 'All Books'
              : f === 'PUBLISHED'
              ? 'Published'
              : f === 'DRAFT'
              ? 'Drafts'
              : 'Delivered';
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.filterPill, active && styles.filterPillActive, active && accent && styles.filterPillAccent]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {label}
              </Text>
              <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>
                  {counts[f]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>}

      {/* Integrated Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search photobooks by title or client…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
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
    <Screen padded={false}>
      <FlatList<Photobook>
        data={filtered}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.md }}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(insets.bottom + 90, 110) },
        ]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={header}
        initialNumToRender={6}
        windowSize={7}
        removeClippedSubviews
        renderItem={({ item }) => <PhotobookCard book={item} received={received} onOpen={openBook} />}
        ListEmptyComponent={
          loading ? (
            <PhotobookGridSkeleton />
          ) : error ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Could not load photobooks</Text>
              <Text style={styles.emptySubtitle}>
                Check your connection, then try again.
              </Text>
              <Pressable style={styles.emptyBtn} onPress={refresh} accessibilityRole="button" accessibilityLabel="Try again">
                <Text style={styles.emptyBtnText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="book-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {search || (!received && filter !== 'ALL') ? 'No matching photobooks' : received ? 'Nothing received yet' : 'No photobooks yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search || (!received && filter !== 'ALL')
                  ? 'Try selecting a different status filter or clearing your search.'
                  : received
                  ? 'Photobooks your clients send you to edit will appear here.'
                  : canCreate
                  ? 'Curate your event photos into a bound, high-impact digital photobook.'
                  : 'Curated photobooks created by your photographer will appear here.'}
              </Text>
              {canCreate && !received && !search && filter === 'ALL' ? (
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => router.push('/photobook/new' as Href)}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>Create Photobook</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
      />

      {/* Floating Action Button — Create New Photobook */}
      {canCreate && !received ? (
        <Pressable
          style={[
            styles.fab,
            { bottom: Math.max(insets.bottom + 18, 28) },
          ]}
          onPress={() => router.push('/photobook/new' as Href)}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          accessibilityRole="button"
          accessibilityLabel="New photobook"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.fabText}>New Photobook</Text>
        </Pressable>
      ) : null}
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
  filterPillAccent: { backgroundColor: c.accent, borderColor: c.accent },
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

  // Hardcover Book Cards (3:4 ratio)
  card: {
    flex: 1,
    // A lone last card must stay one column wide, not stretch across the grid.
    maxWidth: '49%',
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    marginBottom: 4,
  },
  cover: {
    width: '100%',
    aspectRatio: 3 / 4,
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
