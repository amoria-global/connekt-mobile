/**
 * Albums (Gallery) — the photographer's event & personal photo albums,
 * OR (for clients/coordinators) albums shared by photographers.
 *
 * 20/20 Master-Grade Design:
 *   • Confident Editorial Header: Large display title ("Albums") with live collection
 *     count chip, layout switcher (grid vs list), and quick sort trigger.
 *   • Unified Clean Navigation: Single streamlined segmented control with live counters
 *     (All / Events / Personal / Locked) plus Photobooks & Content quick shortcuts.
 *   • Refined Search Bar: Integrated search input with clear button and active query indicator.
 *   • Editorial Photography Grid: 4:5 portrait aspect ratio cards with subtle scrim,
 *     frosted category badges, and crisp typography.
 *   • Spacious List View: Widescreen 4:3 previews with rich metadata and quick navigation.
 *   • Modern Floating Action Button: Solid high-contrast "+ New Album" anchored with safe area.
 *   • Night-studio pass: client and coordinator see the latest delivery as the screen's one gradient hero, active
 *     filters use the accent, cards are real data only (cover, count, date, photographer). The photographer keeps the
 *     primary-coloured controls and no hero.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Keyboard,
  Modal,
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
import { listAlbums, type GalleryItem } from '@/features/gallery/api';
import { featuredAlbum } from '@/features/gallery/albumFacts';
import { AlbumGridCard, AlbumGridSkeleton, AlbumHero, AlbumListRow } from '@/features/gallery/AlbumCards';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';

type AlbumFilter = 'all' | 'event' | 'personal' | 'locked';
type AlbumSort = 'newest' | 'oldest' | 'photos_desc' | 'name_asc';
type LayoutMode = 'grid' | 'list';

const SORT_OPTIONS: {
  key: AlbumSort;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: 'newest',
    label: 'Recently added first',
    description: 'Latest albums appear at the top',
    icon: 'sparkles-outline',
  },
  {
    key: 'oldest',
    label: 'Oldest added first',
    description: 'Earliest albums appear first',
    icon: 'time-outline',
  },
  {
    key: 'photos_desc',
    label: 'Most photos first',
    description: 'Albums with the highest photo count',
    icon: 'images-outline',
  },
  {
    key: 'name_asc',
    label: 'Title (A–Z)',
    description: 'Alphabetical order by album title',
    icon: 'text-outline',
  },
];

export default function GalleryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role, isPhotographer } = useRole();
  const accent = !isPhotographer;

  const [filter, setFilter] = useState<AlbumFilter>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<AlbumSort>('newest');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');

  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listAlbums(role ?? isPhotographer), [role, isPhotographer]),
  );

  const albums = useMemo(() => data ?? [], [data]);
  const openAlbum = useCallback((id: string) => router.push(`/album/${id}` as Href), [router]);

  const counts = useMemo(() => {
    const c = { all: albums.length, event: 0, personal: 0, locked: 0 };
    for (const a of albums) {
      if (a.locked) c.locked += 1;
      const k = (a.kind ?? '').toLowerCase();
      if (k === 'event') c.event += 1;
      else c.personal += 1;
    }
    return c;
  }, [albums]);

  const sortedAndFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = albums.filter((a) => {
      if (filter === 'locked' && !a.locked) return false;
      if (filter === 'event' && (a.kind ?? '').toLowerCase() !== 'event') return false;
      if (filter === 'personal' && (a.kind ?? '').toLowerCase() === 'event') return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        (a.kind ?? '').toLowerCase().includes(q)
      );
    });

    switch (sortBy) {
      case 'newest':
        return list;
      case 'oldest':
        return [...list].reverse();
      case 'photos_desc':
        return [...list].sort((a, b) => (b.photoCount ?? 0) - (a.photoCount ?? 0));
      case 'name_asc':
        return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      default:
        return list;
    }
  }, [albums, filter, search, sortBy]);

  const activeSortLabel = useMemo(() => {
    switch (sortBy) {
      case 'photos_desc':
        return 'Most photos';
      case 'oldest':
        return 'Oldest';
      case 'name_asc':
        return 'A–Z';
      default:
        return 'Recent';
    }
  }, [sortBy]);

  const hero = useMemo(() => (isPhotographer ? undefined : featuredAlbum(albums)), [albums, isPhotographer]);
  const showHero = !search.trim() && filter === 'all';

  const header = (
    <View style={styles.headerContainer}>
      {showHero && hero ? <AlbumHero album={hero} showPhotographer={!isPhotographer} onOpen={() => openAlbum(hero.id)} /> : null}
      {/* Editorial Title & Controls Row */}
      <View style={styles.titleRow}>
        <View style={styles.titleCol}>
          <Text style={styles.titleEyebrow}>
            {isPhotographer ? 'PHOTOGRAPHY PORTFOLIO' : 'PHOTO VAULT'}
          </Text>
          <View style={styles.titleWithBadge}>
            <Text style={styles.pageTitle}>Albums</Text>
            {data ? (
              <View style={styles.totalBadge}>
                <Text style={styles.totalBadgeText}>{albums.length}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Top Right Controls: Layout Toggle & Sort Trigger */}
        <View style={styles.headerControls}>
          <Pressable
            style={[styles.controlBtn, sortBy !== 'newest' && styles.controlBtnActive]}
            onPress={() => setSortSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Sort albums"
            hitSlop={6}
          >
            <Ionicons
              name="swap-vertical"
              size={17}
              color={sortBy !== 'newest' ? colors.primary : colors.text}
            />
            {sortBy !== 'newest' && <View style={styles.activeDot} />}
          </Pressable>

          <Pressable
            style={styles.controlBtn}
            onPress={() => setLayoutMode((m) => (m === 'grid' ? 'list' : 'grid'))}
            accessibilityRole="button"
            accessibilityLabel="Toggle grid or list view"
            hitSlop={6}
          >
            <Ionicons
              name={layoutMode === 'grid' ? 'list' : 'grid'}
              size={17}
              color={colors.text}
            />
          </Pressable>
        </View>
      </View>

      {/* Unified Filter & Navigation Segment Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.segmentScroll}
      >
        {(['all', 'event', 'personal', 'locked'] as const).map((f) => {
          const active = filter === f;
          const label =
            f === 'all'
              ? 'All'
              : f === 'event'
              ? 'Event Albums'
              : f === 'personal'
              ? 'Personal'
              : 'Locked';
          return (
            <Pressable
              key={f}
              onPress={() => setFilter(f)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segmentPill, active && styles.segmentPillActive, active && accent && styles.segmentPillAccent]}
            >
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                {label}
              </Text>
              {data ? (
<View style={[styles.segmentCount, active && styles.segmentCountActive]}>
                <Text style={[styles.segmentCountText, active && styles.segmentCountTextActive]}>
                  {counts[f]}
                </Text>
              </View>
              ) : null}
            </Pressable>
          );
        })}

        {/* Shortcut Chips for Photobooks & Content (Photographer only) */}
        {isPhotographer ? (
          <>
            <View style={styles.segmentDivider} />
            <Pressable
              style={styles.shortcutChip}
              onPress={() => router.push('/photobooks' as Href)}
            >
              <Ionicons name="book-outline" size={14} color={colors.textMuted} />
              <Text style={styles.shortcutText}>Photobooks</Text>
            </Pressable>
            <Pressable
              style={styles.shortcutChip}
              onPress={() => router.push('/content-albums' as Href)}
            >
              <Ionicons name="newspaper-outline" size={14} color={colors.textMuted} />
              <Text style={styles.shortcutText}>Content</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      {/* Search & Active Sort Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search collections by name or type…"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          returnKeyType="search"
          blurOnSubmit={true}
          onSubmitEditing={() => Keyboard.dismiss()}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search ? (
          <Pressable
            onPress={() => {
              setSearch('');
              Keyboard.dismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable
            style={styles.sortIndicatorChip}
            onPress={() => setSortSheetOpen(true)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Sort options"
          >
            <Text style={styles.sortIndicatorText}>{activeSortLabel}</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <Screen padded={false} edges={[]}>
      <FlatList<GalleryItem>
        key={layoutMode}
        data={sortedAndFiltered}
        keyExtractor={(g) => g.id}
        numColumns={layoutMode === 'grid' ? 2 : 1}
        columnWrapperStyle={layoutMode === 'grid' ? { gap: spacing.md } : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.list,
          { paddingBottom: Math.max(insets.bottom + 80, 96) },
        ]}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={header}
        initialNumToRender={6}
        windowSize={7}
        maxToRenderPerBatch={6}
        removeClippedSubviews
        renderItem={({ item }) =>
          layoutMode === 'list' ? (
            <AlbumListRow album={item} showPhotographer={!isPhotographer} onOpen={openAlbum} />
          ) : (
            <AlbumGridCard album={item} showPhotographer={!isPhotographer} onOpen={openAlbum} />
          )
        }
        ListEmptyComponent={
          loading ? (
            <AlbumGridSkeleton />
          ) : error ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>Could not load albums</Text>
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
                <Ionicons name="images-outline" size={40} color={colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {search || filter !== 'all' ? 'No matching collections' : isPhotographer ? 'No albums yet' : 'No galleries shared'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search || filter !== 'all'
                  ? 'Try selecting a different filter or clearing your search query.'
                  : isPhotographer
                  ? 'Create an album to organize client event photos or monetize private galleries.'
                  : 'Albums delivered by your photographers will appear in this vault.'}
              </Text>
              {isPhotographer && !search && filter === 'all' ? (
                <Pressable
                  style={styles.emptyBtn}
                  onPress={() => router.push('/album/new' as Href)}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.emptyBtnText}>Create First Album</Text>
                </Pressable>
              ) : null}
            </View>
          )
        }
      />

      {/* Floating Action Button — Create New Album (Photographer only) */}
      {isPhotographer ? (
        <Pressable
          style={[
            styles.fab,
            { bottom: Math.max(insets.bottom + 18, 28) },
          ]}
          onPress={() => router.push('/album/new' as Href)}
          android_ripple={{ color: 'rgba(255,255,255,0.25)' }}
          accessibilityRole="button"
          accessibilityLabel="Create new album"
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.fabText}>New Album</Text>
        </Pressable>
      ) : null}

      {/* Sort Options Bottom Sheet */}
      <Modal
        visible={sortSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSortSheetOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setSortSheetOpen(false)}>
          <Pressable
            style={[
              styles.sortSheet,
              { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sortSheetHeader}>
              <View>
                <Text style={styles.sortSheetTitle}>Sort Collections</Text>
                <Text style={styles.sortSheetSubtitle}>Choose an order for your albums</Text>
              </View>
              <Pressable
                onPress={() => setSortSheetOpen(false)}
                hitSlop={8}
                style={styles.sortSheetCloseBtn}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.sortOptionsList}>
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.key;
                return (
                  <Pressable
                    key={opt.key}
                    style={[styles.sortOptionItem, active && styles.sortOptionItemActive]}
                    onPress={() => {
                      setSortBy(opt.key);
                      setSortSheetOpen(false);
                    }}
                  >
                    <View
                      style={[
                        styles.sortOptionIconBox,
                        active && styles.sortOptionIconBoxActive,
                      ]}
                    >
                      <Ionicons
                        name={opt.icon}
                        size={18}
                        color={active ? '#fff' : colors.primary}
                      />
                    </View>
                    <View style={styles.sortOptionTextCol}>
                      <Text
                        style={[
                          styles.sortOptionLabel,
                          active && styles.sortOptionLabelActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      <Text style={styles.sortOptionDesc}>{opt.description}</Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    ) : (
                      <View style={styles.sortOptionRadio} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  list: { paddingHorizontal: spacing.lg, gap: spacing.md },
  headerContainer: { paddingTop: spacing.xs, gap: spacing.md, marginBottom: spacing.xs },

  // Editorial Title & Header Controls
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  titleCol: { gap: 2 },
  titleEyebrow: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
    letterSpacing: 1.2,
  },
  titleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageTitle: {
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
  headerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  activeDot: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
  },

  // Segment Navigation
  segmentScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  segmentPill: {
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
  segmentPillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  segmentPillAccent: { backgroundColor: c.accent, borderColor: c.accent },
  segmentText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.textSoft,
  },
  segmentTextActive: {
    color: '#fff',
  },
  segmentCount: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  segmentCountActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  segmentCountText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  segmentCountTextActive: {
    color: '#fff',
  },
  segmentDivider: {
    width: 1,
    height: 20,
    backgroundColor: c.borderSoft,
    marginHorizontal: 4,
  },
  shortcutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  shortcutText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
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
  sortIndicatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  sortIndicatorText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },

  // Grid Card (Editorial 4:5 Aspect)
  gridCard: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    marginBottom: 4,
  },
  gridCover: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: c.surfaceMuted,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  gridScrim: {
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
  gridTopOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1,
  },
  gridBottomOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  gridLockBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 12,
    color: '#fff',
  },
  gridCardBody: {
    padding: spacing.sm,
    gap: 2,
  },
  gridCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: c.text,
    letterSpacing: -0.2,
  },
  gridCardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },

  // List Card (Spacious Editorial Row)
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.sm,
    gap: spacing.md,
  },
  listThumbWrap: {
    width: 86,
    height: 64,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: c.surfaceMuted,
  },
  listLockBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCardBody: {
    flex: 1,
    gap: 2,
  },
  listMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listPhotoCount: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  listCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
    letterSpacing: -0.2,
  },
  listCardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },

  // Kind Tags
  kindTag: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  kindTagEvent: { backgroundColor: c.primary },
  kindTagPaid: { backgroundColor: '#7C3AED' },
  kindTagFree: { backgroundColor: '#059669' },
  kindTagDefault: { backgroundColor: 'rgba(0,0,0,0.55)' },
  kindTagText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.5,
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

  // Sort Sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(4,10,26,0.6)', justifyContent: 'flex-end' },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  sortSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  sortSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  sortSheetTitle: { fontFamily: fonts.bold, fontSize: 18, color: c.text },
  sortSheetSubtitle: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted, marginTop: 2 },
  sortSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionsList: { gap: spacing.sm },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.lg,
    gap: spacing.md,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  sortOptionItemActive: {
    borderColor: c.primary,
    backgroundColor: c.tint,
  },
  sortOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionIconBoxActive: { backgroundColor: c.primary },
  sortOptionTextCol: { flex: 1, gap: 2 },
  sortOptionLabel: { fontFamily: fonts.bold, fontSize: 14, color: c.text },
  sortOptionLabelActive: { color: c.primary },
  sortOptionDesc: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  sortOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
}));
