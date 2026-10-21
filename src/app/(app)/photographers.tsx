import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { useRouter, Stack } from 'expo-router';
import {
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
  listSpecialties,
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
import { SkeletonCard } from '@/features/photographer/kit';
import { env } from '@/config/env';
import { DirectBookingMapView } from '@/features/photographers/DirectBookingMapView';

import { useLanguage } from '@/hooks/useLanguage';
import { translate, type TranslationKey } from '@/i18n/translations';
const tr = (k: TranslationKey) => translate(useLanguage.getState().language, k);

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

function normalizeTerm(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getStem(term: string): string {
  return term.endsWith('s') && term.length > 3 ? term.slice(0, -1) : term;
}

function matchesCategory(p: Photographer, targetCategory: string): boolean {
  if (!targetCategory || targetCategory === ALL_CATEGORIES) return true;

  const targetNorm = normalizeTerm(targetCategory);
  const targetStem = getStem(targetNorm);

  const candidateStrings = [
    p.category,
    ...(p.specialties ?? []),
  ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

  const isTarget = (keyword: string) => targetNorm.includes(keyword) || targetStem.includes(keyword);

  return candidateStrings.some((c) => {
    const norm = normalizeTerm(c);
    const stem = getStem(norm);

    // Exact or stem match
    if (norm === targetNorm || stem === targetStem) return true;
    // Substring containment
    if (norm.includes(targetStem) || targetNorm.includes(stem)) return true;

    // Semantic client-need expansions
    if (isTarget('drone') || isTarget('aerial')) {
      if (norm.includes('drone') || norm.includes('aerial') || norm.includes('mavic')) return true;
    }
    if (isTarget('video') || isTarget('film')) {
      if (norm.includes('video') || norm.includes('film') || norm.includes('cinemat') || norm.includes('stream')) return true;
    }
    if (isTarget('wedding')) {
      if (norm.includes('wedding') || norm.includes('bridal') || norm.includes('couple') || norm.includes('marriage') || norm.includes('introduction') || norm.includes('kuhingira')) return true;
    }
    if (isTarget('family')) {
      if (norm.includes('family') || norm.includes('maternity') || norm.includes('newborn') || norm.includes('baby') || norm.includes('kids') || norm.includes('children')) return true;
    }
    if (isTarget('corporate')) {
      if (norm.includes('corporate') || norm.includes('business') || norm.includes('conference') || norm.includes('executive') || norm.includes('headshot')) return true;
    }
    if (isTarget('portrait')) {
      if (norm.includes('portrait') || norm.includes('headshot') || norm.includes('glamour') || norm.includes('model')) return true;
    }
    if (isTarget('commercial')) {
      if (norm.includes('commercial') || norm.includes('product') || norm.includes('realestate') || norm.includes('food') || norm.includes('brand')) return true;
    }
    if (isTarget('event')) {
      if (norm.includes('event') || norm.includes('festival') || norm.includes('party') || norm.includes('concert') || norm.includes('gala')) return true;
    }
    if (isTarget('birthday')) {
      if (norm.includes('birthday') || norm.includes('party') || norm.includes('anniversary')) return true;
    }

    return false;
  });
}

function matchesLocation(pLocation?: string, targetLocation?: string): boolean {
  if (!targetLocation || targetLocation === ALL_LOCATIONS) return true;
  if (!pLocation) return false;
  const pNorm = normalizeTerm(pLocation);
  const tNorm = normalizeTerm(targetLocation);
  return pNorm.includes(tNorm) || tNorm.includes(pNorm);
}

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
  if (lower.includes('family') || lower.includes('maternity') || lower.includes('baby')) return 'people-outline';
  if (lower.includes('corporate') || lower.includes('business')) return 'briefcase-outline';
  if (lower.includes('video') || lower.includes('stream') || lower.includes('film')) return 'videocam-outline';
  if (lower.includes('drone') || lower.includes('aerial')) return 'airplane-outline';
  if (lower.includes('commercial') || lower.includes('product') || lower.includes('store')) return 'storefront-outline';
  return 'camera-outline';
}

export default function PhotographersScreen() {
  useLanguage();
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const responsive = useResponsive();
  const { isCoordinator } = useRole();
  const router = useRouter();

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [inputQuery, setInputQuery] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [location, setLocation] = useState(ALL_LOCATIONS);
  const [price, setPrice] = useState<string>(ALL_PRICES);
  const [rating, setRating] = useState<string>(ALL_RATINGS);
  const [sort, setSort] = useState<SortKey>('rating');
  const [sheet, setSheet] = useState<SheetKey | null>(null);

  // Debounce search query so typing is smooth and never drops keystrokes on mobile
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(inputQuery);
    }, 280);
    return () => clearTimeout(timer);
  }, [inputQuery]);

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
  // Categories are the platform's specialties plus whatever the directory itself uses; cities come from the directory only.
  const specialties = useAsync(useCallback(() => listSpecialties(), []));

  const submitInvite = async () => {
    if (!inviteEmail.includes('@')) {
      Alert.alert(tr('b2_photogsInvalidEmailTitle'), 'Enter a valid email address.');
      return;
    }
    setInviteSubmitting(true);
    try {
      await inviteCoordinatorPhotographer(inviteEmail, inviteMessage);
      setInviteOpen(false);
      setInviteEmail('');
      setInviteMessage('');
      Alert.alert(tr('b2_photogsInviteSentTitle'), `An invite was emailed to ${inviteEmail}.`);
    } catch (e) {
      Alert.alert(tr('b2_photogsInviteErrorTitle'), isApiError(e) ? e.message : 'Please try again.');
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
    const dynamicSet = new Set<string>();
    (data ?? []).forEach((p) => {
      if (p.category && p.category.trim()) dynamicSet.add(p.category.trim());
      (p.specialties ?? []).forEach((s) => {
        if (s && s.trim()) dynamicSet.add(s.trim());
      });
    });

    const list: string[] = [ALL_CATEGORIES, ...(specialties.data ?? [])];

    dynamicSet.forEach((item) => {
      const itemNorm = normalizeTerm(item);
      const itemStem = getStem(itemNorm);
      const alreadyPresent = list.some((existing) => {
        const exNorm = normalizeTerm(existing);
        const exStem = getStem(exNorm);
        return (
          exNorm === itemNorm ||
          exStem === itemStem ||
          exNorm.includes(itemStem) ||
          itemNorm.includes(exStem)
        );
      });
      if (!alreadyPresent) {
        list.push(item);
      }
    });

    return list;
  }, [data, specialties.data]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((p) => {
      if (p.location && p.location.trim()) set.add(p.location.trim());
    });

    const list: string[] = [ALL_LOCATIONS];

    set.forEach((loc) => {
      const locNorm = normalizeTerm(loc);
      const alreadyPresent = list.some((existing) => {
        const exNorm = normalizeTerm(existing);
        return exNorm === locNorm || exNorm.includes(locNorm) || locNorm.includes(exNorm);
      });
      if (!alreadyPresent) {
        list.push(loc);
      }
    });

    return list;
  }, [data]);

  const priceOptions = useMemo(() => {
    return [ALL_PRICES, ...PRICE_BUCKETS.map((b) => b.label)];
  }, []);

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
        const nameHit = p.name.toLowerCase().includes(q);
        const catHit = (p.category ?? '').toLowerCase().includes(q);
        const locHit = (p.location ?? '').toLowerCase().includes(q);
        const specialtyHit = (p.specialties ?? []).some((s) =>
          s.toLowerCase().includes(q),
        );
        const smartMatch = matchesCategory(p, q);

        if (!nameHit && !catHit && !locHit && !specialtyHit && !smartMatch) {
          return false;
        }
      }

      if (!matchesCategory(p, category)) return false;
      if (!matchesLocation(p.location, location)) return false;

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
    (inputQuery.trim() || query.trim() ? 1 : 0) +
    (category !== ALL_CATEGORIES ? 1 : 0) +
    (location !== ALL_LOCATIONS ? 1 : 0) +
    (price !== ALL_PRICES ? 1 : 0) +
    (rating !== ALL_RATINGS ? 1 : 0);

  const clearFilters = () => {
    setInputQuery('');
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

  const renderViewModeSwitcher = () => (
    <View style={styles.viewModeContainer}>
      <Pressable
        style={[styles.viewModeBtn, viewMode === 'list' && styles.viewModeBtnActive]}
        onPress={() => setViewMode('list')}
      >
        <Ionicons
          name="grid"
          size={12}
          color={viewMode === 'list' ? '#FFFFFF' : colors.textMuted}
        />
        <Text
          style={[
            styles.viewModeBtnText,
            viewMode === 'list' && styles.viewModeBtnTextActive,
          ]}
        >
          {tr('b2_photogsViewList')}
        </Text>
      </Pressable>

      <Pressable
        style={[styles.viewModeBtn, viewMode === 'map' && styles.viewModeBtnActive]}
        onPress={() => setViewMode('map')}
      >
        <Ionicons
          name="map"
          size={12}
          color={viewMode === 'map' ? '#FFFFFF' : colors.textMuted}
        />
        <Text
          style={[
            styles.viewModeBtnText,
            viewMode === 'map' && styles.viewModeBtnTextActive,
          ]}
        >
          {tr('b2_photogsViewMap')}
        </Text>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveBadgeText}>{tr('b2_photogsLiveBadge')}</Text>
        </View>
      </Pressable>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Title Area */}
      <View style={styles.titleSection}>
        <View style={styles.titleTopRow}>
          <View style={styles.eyebrowPill}>
            <Ionicons name="sparkles" size={10} color={colors.primary} />
            <Text style={styles.eyebrowText}>{tr('b2_photogsVerifiedPros')}</Text>
          </View>
          {renderViewModeSwitcher()}
        </View>
        <Text style={styles.title}>{tr('b2_photogsTitle')}</Text>
        <Text style={styles.subtitle}>
          {tr('b2_photogsSubtitle')}
        </Text>
      </View>

      {/* Hybrid Matching Banner */}
      {env.hybridBookingEnabled && (
        <Pressable
          style={({ pressed }) => [styles.hybridBanner, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/event/hybrid-wizard' as never)}
          accessibilityRole="button"
          accessibilityLabel="Can't decide? Post your event. Post Brief"
        >
          {/* tint is translucent, so it sits over the opaque card instead of the page */}
          <View pointerEvents="none" style={styles.hybridBannerWash} />
          <View style={styles.hybridBannerIcon}>
            <Ionicons name="sparkles" size={16} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hybridBannerTitle}>{tr('b2_photogsHybridTitle')}</Text>
            <Text style={styles.hybridBannerDesc}>
              {tr('b2_photogsHybridDesc')}
            </Text>
          </View>
          <View style={styles.hybridBannerBtn}>
            <Text style={styles.hybridBannerBtnText}>{tr('b2_photogsHybridBtn')}</Text>
            <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
          </View>
        </Pressable>
      )}

      {/* Global In-Page Search Bar */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          placeholder={tr('b2_photogsSearchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={inputQuery}
          onChangeText={setInputQuery}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => setQuery(inputQuery)}
          cursorColor={colors.primary}
          selectionColor={colors.primary + '30'}
          style={styles.searchInput}
        />
        {inputQuery.trim().length > 0 && (
          <Pressable
            onPress={() => {
              setInputQuery('');
              setQuery('');
            }}
            hitSlop={10}
            style={styles.searchClearBtn}
          >
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
              <Text style={styles.resetPillText}>{tr('b2_photogsFilterReset')}</Text>
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
            <Text style={styles.inviteBtnText}>{tr('b2_photogsInvitePro')}</Text>
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
          {tr('b2_photogsShowing')} <Text style={styles.pagerBoldText}>{startItem}–{endItem}</Text> of{' '}
          <Text style={styles.pagerBoldText}>{filtered.length}</Text> {tr('b2_photogsPhotographersWord')}
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
              {tr('b2_photogsPrev')}
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
              {tr('b2_photogsNext')}
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

        {viewMode === 'map' ? (
          <View style={styles.mapScreenContainer}>
            <View style={styles.mapTopHeader}>
              <View>
                <Text style={styles.mapTopTitle}>{tr('b2_photogsMapTitle')}</Text>
                <Text style={styles.mapTopSubtitle}>{tr('b2_photogsMapSubtitle')}</Text>
              </View>
              {renderViewModeSwitcher()}
            </View>
            <DirectBookingMapView
              initialSearch={query}
              initialSpecialty={category}
              style={{ flex: 1 }}
            />
          </View>
        ) : loading && !data ? (
          <View style={styles.skeletonList} accessibilityLabel={tr('b2_photogsLoading')}>
            <SkeletonCard height={110} />
            <SkeletonCard height={110} />
            <SkeletonCard height={110} />
          </View>
        ) : error && !data?.length ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
            <Button title={tr('b2_photogsRetry')} onPress={refresh} variant="outline" />
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
                title={
                  category !== ALL_CATEGORIES
                    ? `No ${category} photographers yet`
                    : location !== ALL_LOCATIONS
                    ? `No photographers in ${location} yet`
                    : query.trim()
                    ? `No results for "${query.trim()}"`
                    : 'No photographers match'
                }
                message={
                  activeFilterCount > 0
                    ? 'Try clearing your filters or exploring another specialty or region.'
                    : 'No photographers are currently registered in the directory.'
                }
                action={
                  activeFilterCount > 0
                    ? { label: 'Clear All Filters', onPress: clearFilters }
                    : isCoordinator
                    ? { label: 'Invite a Pro', onPress: () => setInviteOpen(true) }
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
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name}'s profile`}
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
            <Text style={styles.modalTitle}>{tr('b2_photogsInviteModalTitle')}</Text>
            <Text style={styles.modalHint}>
              {tr('b2_photogsInviteModalHint')}
            </Text>
            <TextInput
              placeholder={tr('b2_photogsInviteEmailPlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.modalInput}
            />
            <TextInput
              placeholder={tr('b2_photogsInviteNotePlaceholder')}
              placeholderTextColor={colors.textMuted}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              multiline
              style={[styles.modalInput, { height: 75, textAlignVertical: 'top' }]}
            />
            <View style={styles.modalActions}>
              <Button
                title={tr('b2_photogsCancel')}
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
  skeletonList: { gap: spacing.md, padding: spacing.lg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 12,
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
  titleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    padding: 3,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radii.full,
  },
  viewModeBtnActive: {
    backgroundColor: c.primary,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  viewModeBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  viewModeBtnTextActive: {
    color: '#FFFFFF',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    backgroundColor: '#F20C8F',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.full,
    marginLeft: 2,
  },
  liveDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  mapScreenContainer: {
    flex: 1,
    backgroundColor: c.background,
  },
  mapTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: c.card,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
    zIndex: 10,
  },
  mapTopTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
  },
  mapTopSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
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
    fontSize: 12,
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

  // Hybrid Banner
  hybridBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: c.card,
    borderWidth: 1.5,
    borderColor: c.primary + '55',
    borderRadius: radii.xl,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    overflow: 'hidden',
  },
  hybridBannerWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: c.tint,
  },
  hybridBannerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hybridBannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
    marginBottom: 2,
  },
  hybridBannerDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textSoft,
    lineHeight: 15,
  },
  hybridBannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  hybridBannerBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#FFFFFF',
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
    fontSize: fontSize.md,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
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
    fontSize: 12,
    color: c.text,
  },
  sheetOptionTextActive: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
}));
