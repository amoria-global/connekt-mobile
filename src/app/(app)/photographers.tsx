import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, Stack } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import {
  bookmarkPhotographer,
  inviteCoordinatorPhotographer,
  listBookmarkedPhotographers,
  listPhotographers,
  unbookmarkPhotographer,
  type Photographer,
} from '@/features/photographers/api';
import { useRole } from '@/features/auth/role';
import { Screen } from '@/components/ui/Screen';
import { EmptyState } from '@/components/ui/EmptyState';
import { PhotographerCard } from '@/features/photographers/PhotographerCard';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';

const ITEMS_PER_PAGE = 8;
const ALL_CATEGORIES = 'All Categories';
const ALL_LOCATIONS = 'All Locations';
const ALL_PRICES = 'All Prices';
const ALL_RATINGS = 'All Ratings';

const PRICE_BUCKETS = [
  { label: 'Under $100', min: 0, max: 100 },
  { label: '$100 – $250', min: 100, max: 250 },
  { label: '$250 – $500', min: 250, max: 500 },
  { label: '$500+', min: 500, max: Infinity },
] as const;

const RATING_OPTIONS = [
  { label: ALL_RATINGS, min: 0 },
  { label: '4.5+ Stars', min: 4.5 },
  { label: '4.0+ Stars', min: 4 },
  { label: '3.0+ Stars', min: 3 },
] as const;

type SortKey = 'rating' | 'price' | 'name';
const SORT_OPTIONS: { key: SortKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'rating', label: 'Top Rated', icon: 'star-outline' },
  { key: 'price', label: 'Price: Low to High', icon: 'cash-outline' },
  { key: 'name', label: 'Alphabetical', icon: 'text-outline' },
];

type SheetKey = 'category' | 'location' | 'price' | 'rating' | 'sort';

function getCategoryIcon(cat: string): keyof typeof Ionicons.glyphMap {
  const lower = cat.toLowerCase();
  if (lower.includes('all')) return 'apps-outline';
  if (lower.includes('wedding')) return 'heart-outline';
  if (lower.includes('portrait')) return 'person-outline';
  if (lower.includes('event')) return 'calendar-outline';
  if (lower.includes('birthday')) return 'gift-outline';
  if (lower.includes('studio')) return 'camera-outline';
  if (lower.includes('fashion')) return 'shirt-outline';
  if (lower.includes('graduat')) return 'school-outline';
  if (lower.includes('family')) return 'people-outline';
  if (lower.includes('corporate') || lower.includes('business')) return 'briefcase-outline';
  if (lower.includes('video') || lower.includes('stream')) return 'videocam-outline';
  return 'camera-outline';
}

export default function PhotographersScreen() {
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const responsive = useResponsive();
  const { isCoordinator } = useRole();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [location, setLocation] = useState(ALL_LOCATIONS);
  const [price, setPrice] = useState<string>(ALL_PRICES);
  const [rating, setRating] = useState<string>(ALL_RATINGS);
  const [sort, setSort] = useState<SortKey>('rating');
  const [sheet, setSheet] = useState<SheetKey | null>(null);

  // Bookmark state & parity sync
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkLoading, setBookmarkLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let mounted = true;
    listBookmarkedPhotographers()
      .then((items) => {
        if (!mounted) return;
        setBookmarkedIds(new Set(items.map((p) => p.id)));
      })
      .catch(() => {
        // Bookmark listing fails gracefully if offline or unauthenticated
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleBookmark = async (id: string) => {
    if (bookmarkLoading[id]) return;
    const isBookmarked = bookmarkedIds.has(id);
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setBookmarkLoading((prev) => ({ ...prev, [id]: true }));
    try {
      if (isBookmarked) {
        await unbookmarkPhotographer(id);
      } else {
        await bookmarkPhotographer(id);
      }
    } catch {
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) {
          next.add(id);
        } else {
          next.delete(id);
        }
        return next;
      });
    } finally {
      setBookmarkLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // Coordinator invite-by-email state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  const { data, loading, error, refresh } = useAsync(useCallback(() => listPhotographers(), []));

  const submitInvite = async () => {
    if (!inviteEmail.includes('@')) {
      Alert.alert('Invalid email', 'Enter a valid email address.');
      return;
    }
    setInviteSubmitting(true);
    try {
      await inviteCoordinatorPhotographer(inviteEmail, inviteMessage);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteMessage('');
      Alert.alert('Invitation sent', `An invite was emailed to ${inviteEmail}.`);
    } catch (e) {
      Alert.alert('Could not send invite', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setInviteSubmitting(false);
    }
  };

  const columns = responsive.isLarge ? 3 : 2;
  const cardGap = spacing.sm;
  const horizontalPadding = spacing.md * 2;
  const cardWidth = Math.floor(
    (responsive.width - horizontalPadding - cardGap * (columns - 1)) / columns,
  );

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return [ALL_CATEGORIES, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [data]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((p) => {
      if (p.location) set.add(p.location);
    });
    return [ALL_LOCATIONS, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [data]);

  const priceOptions = useMemo(() => {
    const prices = (data ?? [])
      .map((p) => p.startingPrice)
      .filter((n): n is number => typeof n === 'number');
    return [
      ALL_PRICES,
      ...PRICE_BUCKETS.filter((b) => prices.some((v) => v >= b.min && v < b.max)).map(
        (b) => b.label,
      ),
    ];
  }, [data]);

  const ratingOptions = useMemo(() => RATING_OPTIONS.map((o) => o.label), []);

  useEffect(() => {
    if (!categoryOptions.includes(category)) setCategory(ALL_CATEGORIES);
    if (!locationOptions.includes(location)) setLocation(ALL_LOCATIONS);
    if (!priceOptions.includes(price)) setPrice(ALL_PRICES);
  }, [categoryOptions, locationOptions, priceOptions, category, location, price]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const bucket = PRICE_BUCKETS.find((b) => b.label === price);
    const minRating = RATING_OPTIONS.find((o) => o.label === rating)?.min ?? 0;

    const rows = data.filter((p) => {
      if (q) {
        const hit =
          p.name.toLowerCase().includes(q) ||
          (p.category ?? '').toLowerCase().includes(q) ||
          (p.location ?? '').toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (category !== ALL_CATEGORIES && p.category !== category) return false;
      if (location !== ALL_LOCATIONS && p.location !== location) return false;
      if (bucket) {
        if (typeof p.startingPrice !== 'number') return false;
        if (p.startingPrice < bucket.min || p.startingPrice >= bucket.max) return false;
      }
      if (minRating > 0 && (p.rating ?? 0) < minRating) return false;
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'price') {
        return (a.startingPrice ?? Infinity) - (b.startingPrice ?? Infinity);
      }
      return (b.rating ?? 0) - (a.rating ?? 0);
    });
  }, [data, query, category, location, price, rating, sort]);

  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (category !== ALL_CATEGORIES ? 1 : 0) +
    (location !== ALL_LOCATIONS ? 1 : 0) +
    (price !== ALL_PRICES ? 1 : 0) +
    (rating !== ALL_RATINGS ? 1 : 0);

  const clearFilters = () => {
    setQuery('');
    setCategory(ALL_CATEGORIES);
    setLocation(ALL_LOCATIONS);
    setPrice(ALL_PRICES);
    setRating(ALL_RATINGS);
    setCurrentPage(0);
  };

  // Pagination State & Senior Dev Scroll Management
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList<Photographer>>(null);

  // Reset to first page on any query, filter, or sorting change
  useEffect(() => {
    setCurrentPage(0);
  }, [query, category, location, price, rating, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages - 1);

  const pagedPhotographers = useMemo(() => {
    const start = safePage * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, safePage]);

  const goToPage = (pageIndex: number) => {
    const target = Math.max(0, Math.min(pageIndex, totalPages - 1));
    setCurrentPage(target);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const sheetConfig: Record<
    SheetKey,
    { title: string; options: string[]; selected: string; select: (v: string) => void }
  > = {
    category: {
      title: 'Select Category',
      options: categoryOptions,
      selected: category,
      select: setCategory,
    },
    location: {
      title: 'Filter by Location',
      options: locationOptions,
      selected: location,
      select: setLocation,
    },
    price: {
      title: 'Starting Price',
      options: priceOptions,
      selected: price,
      select: setPrice,
    },
    rating: {
      title: 'Minimum Rating',
      options: ratingOptions,
      selected: rating,
      select: setRating,
    },
    sort: {
      title: 'Sort By',
      options: SORT_OPTIONS.map((o) => o.label),
      selected: SORT_OPTIONS.find((o) => o.key === sort)!.label,
      select: (v) => {
        const next = SORT_OPTIONS.find((o) => o.label === v);
        if (next) setSort(next.key);
      },
    },
  };
  const activeSheet = sheet ? sheetConfig[sheet] : null;
  const currentSortObj = SORT_OPTIONS.find((o) => o.key === sort)!;

  const handlePhotographerPress = (id: string) => {
    router.push(`/photographer/${id}` as never);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Title Area */}
      <View style={styles.titleSection}>
        <View style={styles.eyebrowPill}>
          <Ionicons name="sparkles" size={10} color={colors.primary} />
          <Text style={styles.eyebrowText}>VERIFIED PROS</Text>
        </View>
        <Text style={styles.title}>Find Photographers</Text>
        <Text style={styles.subtitle}>
          Browse vetted visual creators for your upcoming shoots and events
        </Text>
      </View>

      {/* Global In-Page Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          placeholder="Search by name, style, or location..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {query.trim().length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10} style={styles.searchClearBtn}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Category Chips Horizontal Rail */}
      <View style={styles.categoryRailWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRail}
        >
          {categoryOptions.map((cat) => {
            const active = cat === category;
            const iconName = getCategoryIcon(cat);
            const label = cat === ALL_CATEGORIES ? 'All' : cat;
            return (
              <Pressable
                key={cat}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Ionicons
                  name={iconName}
                  size={13}
                  color={active ? '#FFFFFF' : colors.textMuted}
                />
                <Text
                  style={[styles.categoryChipText, active && styles.categoryChipTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Filter Chips Bar */}
      <View style={styles.filterPillsRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterPillsScroll}
        >
          {/* Location Filter Pill */}
          <Pressable
            style={[
              styles.filterPill,
              location !== ALL_LOCATIONS && styles.filterPillActive,
            ]}
            onPress={() => setSheet('location')}
          >
            <Ionicons
              name="location-outline"
              size={13}
              color={location !== ALL_LOCATIONS ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.filterPillText,
                location !== ALL_LOCATIONS && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
            >
              {location === ALL_LOCATIONS ? 'Location' : location}
            </Text>
            <Ionicons
              name="chevron-down"
              size={11}
              color={location !== ALL_LOCATIONS ? colors.primary : colors.textMuted}
            />
          </Pressable>

          {/* Price Filter Pill */}
          <Pressable
            style={[styles.filterPill, price !== ALL_PRICES && styles.filterPillActive]}
            onPress={() => setSheet('price')}
          >
            <Ionicons
              name="cash-outline"
              size={13}
              color={price !== ALL_PRICES ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.filterPillText,
                price !== ALL_PRICES && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
            >
              {price === ALL_PRICES ? 'Price' : price}
            </Text>
            <Ionicons
              name="chevron-down"
              size={11}
              color={price !== ALL_PRICES ? colors.primary : colors.textMuted}
            />
          </Pressable>

          {/* Rating Filter Pill */}
          <Pressable
            style={[styles.filterPill, rating !== ALL_RATINGS && styles.filterPillActive]}
            onPress={() => setSheet('rating')}
          >
            <Ionicons
              name="star-outline"
              size={13}
              color={rating !== ALL_RATINGS ? '#F59E0B' : colors.textMuted}
            />
            <Text
              style={[
                styles.filterPillText,
                rating !== ALL_RATINGS && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
            >
              {rating === ALL_RATINGS ? 'Rating' : rating}
            </Text>
            <Ionicons
              name="chevron-down"
              size={11}
              color={rating !== ALL_RATINGS ? '#F59E0B' : colors.textMuted}
            />
          </Pressable>

          {/* Sort Selector Pill */}
          <Pressable
            style={styles.filterPill}
            onPress={() => setSheet('sort')}
          >
            <Ionicons name={currentSortObj.icon} size={13} color={colors.textMuted} />
            <Text style={styles.filterPillText} numberOfLines={1}>
              {currentSortObj.label}
            </Text>
            <Ionicons name="chevron-down" size={11} color={colors.textMuted} />
          </Pressable>

          {/* Reset Filters Pill */}
          {activeFilterCount > 0 && (
            <Pressable style={styles.resetPill} onPress={clearFilters}>
              <Ionicons name="close-circle" size={13} color={colors.primary} />
              <Text style={styles.resetPillText}>Reset</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* Results Header Strip */}
      <View style={styles.resultsStrip}>
        <Text style={styles.resultsText}>
          <Text style={styles.resultsCount}>{filtered.length}</Text>{' '}
          {filtered.length === 1 ? 'photographer' : 'photographers'} found
          {totalPages > 1 ? ` · Page ${safePage + 1} of ${totalPages}` : ''}
        </Text>

        {isCoordinator && (
          <Pressable style={styles.inviteBtn} onPress={() => setInviteOpen(true)}>
            <Ionicons name="mail" size={12} color="#FFFFFF" />
            <Text style={styles.inviteBtnText}>Invite Pro</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderFooter = () => {
    if (filtered.length === 0) return null;

    const startItem = safePage * ITEMS_PER_PAGE + 1;
    const endItem = Math.min((safePage + 1) * ITEMS_PER_PAGE, filtered.length);

    if (totalPages <= 1) {
      return (
        <View style={styles.listFooter}>
          <View style={styles.listFooterLine} />
          <Text style={styles.listFooterText}>
            Showing all {filtered.length} photographers
          </Text>
          <View style={styles.listFooterLine} />
        </View>
      );
    }

    const getPageNumbers = () => {
      if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i);
      }
      const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
      pages.push(0);

      const start = Math.max(1, safePage - 1);
      const end = Math.min(totalPages - 2, safePage + 1);

      if (start > 1) {
        pages.push('ellipsis-start');
      }

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (end < totalPages - 2) {
        pages.push('ellipsis-end');
      }

      pages.push(totalPages - 1);
      return pages;
    };

    const pageNumbers = getPageNumbers();

    return (
      <View style={styles.pagerContainer}>
        {/* Result summary text */}
        <Text style={styles.pagerInfoText}>
          Showing <Text style={styles.pagerBoldText}>{startItem}–{endItem}</Text> of{' '}
          <Text style={styles.pagerBoldText}>{filtered.length}</Text> photographers
        </Text>

        {/* Pager controls row */}
        <View style={styles.pagerControls}>
          {/* Prev Button */}
          <Pressable
            style={[styles.pagerBtn, safePage === 0 && styles.pagerBtnDisabled]}
            onPress={() => goToPage(safePage - 1)}
            disabled={safePage === 0}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-back"
              size={13}
              color={safePage === 0 ? colors.textMuted : colors.text}
            />
            <Text
              style={[
                styles.pagerBtnText,
                safePage === 0 && styles.pagerBtnTextDisabled,
              ]}
            >
              Prev
            </Text>
          </Pressable>

          {/* Numbered Page Buttons */}
          {pageNumbers.map((p, idx) => {
            if (typeof p === 'string') {
              return (
                <Text key={`ellipsis-${idx}`} style={styles.pagerEllipsis}>
                  …
                </Text>
              );
            }
            const isActive = p === safePage;
            return (
              <Pressable
                key={`page-${p}`}
                style={[styles.pagerNumBtn, isActive && styles.pagerNumBtnActive]}
                onPress={() => goToPage(p)}
                hitSlop={8}
              >
                <Text
                  style={[styles.pagerNumText, isActive && styles.pagerNumTextActive]}
                >
                  {p + 1}
                </Text>
              </Pressable>
            );
          })}

          {/* Next Button */}
          <Pressable
            style={[
              styles.pagerBtn,
              safePage >= totalPages - 1 && styles.pagerBtnDisabled,
            ]}
            onPress={() => goToPage(safePage + 1)}
            disabled={safePage >= totalPages - 1}
            hitSlop={8}
          >
            <Text
              style={[
                styles.pagerBtnText,
                safePage >= totalPages - 1 && styles.pagerBtnTextDisabled,
              ]}
            >
              Next
            </Text>
            <Ionicons
              name="chevron-forward"
              size={13}
              color={safePage >= totalPages - 1 ? colors.textMuted : colors.text}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <>
      <Screen padded={false} edges={[]}>
        <Stack.Screen
          options={{
            title: 'Photographers',
            headerBackButtonDisplayMode: 'minimal',
          }}
        />

        {loading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading directory…</Text>
          </View>
        ) : error && !data?.length ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
            <Button title="Retry" onPress={refresh} variant="outline" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            key={`photog-grid-${columns}`}
            data={pagedPhotographers}
            keyExtractor={(p) => p.id}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={renderFooter}
            numColumns={columns}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState
                icon="camera-outline"
                title="No photographers match"
                message={
                  activeFilterCount > 0
                    ? 'Try clearing your filters or changing your search terms.'
                    : 'No photographers are currently registered.'
                }
                action={
                  activeFilterCount > 0
                    ? { label: 'Clear All Filters', onPress: clearFilters }
                    : undefined
                }
              />
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.cardWrapper,
                  { width: cardWidth },
                  pressed && styles.cardPressed,
                ]}
                onPress={() => handlePhotographerPress(item.id)}
              >
                <PhotographerCard
                  photographer={item}
                  isBookmarked={bookmarkedIds.has(item.id)}
                  onToggleBookmark={() => handleToggleBookmark(item.id)}
                />
              </Pressable>
            )}
          />
        )}
      </Screen>

      {/* Coordinator Invite Modal */}
      <Modal
        visible={inviteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Invite a photographer</Text>
            <Text style={styles.modalHint}>
              They will receive an email invitation to register and join your workspace.
            </Text>
            <TextInput
              placeholder="photographer@example.com"
              placeholderTextColor={colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.modalInput}
            />
            <TextInput
              placeholder="Personal note (optional)"
              placeholderTextColor={colors.textMuted}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              multiline
              style={[styles.modalInput, { height: 75, textAlignVertical: 'top' }]}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setInviteOpen(false)}
              />
              <Button
                title={inviteSubmitting ? 'Sending…' : 'Send Invite'}
                onPress={submitInvite}
                loading={inviteSubmitting}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={activeSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSheet(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.modalTitle}>{activeSheet?.title}</Text>
              <Pressable onPress={() => setSheet(null)} hitSlop={10}>
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {activeSheet?.options.map((option) => {
                const active = option === activeSheet.selected;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      activeSheet.select(option);
                      setSheet(null);
                    }}
                    style={[styles.sheetOption, active && styles.sheetOptionActive]}
                  >
                    <Text
                      style={[
                        styles.sheetOptionText,
                        active && styles.sheetOptionTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                    {active && (
                      <Ionicons
                        name="checkmark-circle"
                        size={18}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const useStyles = makeStyles((c, e) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  errorText: {
    fontFamily: fonts.regular,
    color: c.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 110,
    backgroundColor: c.background,
  },
  columnWrapper: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  cardWrapper: {
    marginBottom: spacing.sm,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.985 }],
  },

  // Header
  headerContainer: {
    backgroundColor: c.background,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  titleSection: {
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.tint,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: radii.full,
  },
  eyebrowText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.primary,
    letterSpacing: 0.7,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: c.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: c.textMuted,
    lineHeight: 17,
  },

  // Search Bar
  searchBar: {
    marginHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    height: 46,
    gap: spacing.sm,
    ...e(1),
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.text,
    height: '100%',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 2,
  },

  // Category Rail
  categoryRailWrap: {
    marginTop: 2,
  },
  categoryRail: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: radii.full,
  },
  categoryChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  categoryChipText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.text,
  },
  categoryChipTextActive: {
    fontFamily: fonts.bold,
    color: '#FFFFFF',
  },

  // Filter Pills
  filterPillsRow: {
    marginTop: 2,
  },
  filterPillsScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    alignItems: 'center',
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  filterPillActive: {
    borderColor: c.primary + '60',
    backgroundColor: c.tint,
  },
  filterPillText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.text,
  },
  filterPillTextActive: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
  resetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.tint,
    borderWidth: 1,
    borderColor: c.primary + '40',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  resetPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
  },

  // Results Strip
  resultsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginTop: 6,
  },
  resultsText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  resultsCount: {
    fontFamily: fonts.bold,
    color: c.text,
  },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: radii.full,
  },
  inviteBtnText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },

  // List Footer
  listFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
  listFooterLine: {
    flex: 1,
    height: 1,
    backgroundColor: c.borderSoft,
  },
  listFooterText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },

  // Pagination Controls
  pagerContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  pagerInfoText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  pagerBoldText: {
    fontFamily: fonts.bold,
    color: c.text,
  },
  pagerControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    ...e(1),
  },
  pagerBtnDisabled: {
    opacity: 0.45,
    backgroundColor: c.surfaceMuted,
    borderColor: c.borderSoft,
  },
  pagerBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: c.text,
  },
  pagerBtnTextDisabled: {
    color: c.textMuted,
  },
  pagerNumBtn: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 6,
    ...e(1),
  },
  pagerNumBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  pagerNumText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.text,
  },
  pagerNumTextActive: {
    color: '#FFFFFF',
  },
  pagerEllipsis: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.textMuted,
    paddingHorizontal: 3,
  },

  // Modals & Bottom Sheets
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: c.elevated,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.sm,
    ...e(3),
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
  },
  modalHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    lineHeight: 17,
  },
  modalInput: {
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  sheetScroll: {
    maxHeight: 280,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  sheetOptionActive: {
    backgroundColor: c.tint,
  },
  sheetOptionText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.text,
  },
  sheetOptionTextActive: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
}));
