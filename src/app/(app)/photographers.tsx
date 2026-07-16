import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { inviteCoordinatorPhotographer, listPhotographers } from '@/features/photographers/api';
import { PhotographerCard } from '@/features/photographers/PhotographerCard';
import { useRole } from '@/features/auth/role';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fonts, fontSize, fontWeight, radii, spacing } from '@/theme';

const ITEMS_PER_PAGE = 4;

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
  { label: '4.5+', min: 4.5 },
  { label: '4.0+', min: 4 },
  { label: '3.0+', min: 3 },
] as const;

type SortKey = 'rating' | 'price' | 'name';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'rating', label: 'Rating' },
  { key: 'price', label: 'Price' },
  { key: 'name', label: 'Name' },
];

type SheetKey = 'category' | 'location' | 'price' | 'rating' | 'sort';

// Filter button component
function FilterButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.filterButton} onPress={onPress} accessibilityRole="button">
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.filterButtonText} numberOfLines={1}>{label}</Text>
      <Ionicons name="chevron-down" size={12} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}

export default function PhotographersScreen() {
  const { isCoordinator } = useRole();
  const [query, setQuery] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [location, setLocation] = useState(ALL_LOCATIONS);
  const [price, setPrice] = useState<string>(ALL_PRICES);
  const [rating, setRating] = useState<string>(ALL_RATINGS);
  const [sort, setSort] = useState<SortKey>('rating');
  const [sheet, setSheet] = useState<SheetKey | null>(null);

  // Coordinator invite-by-email state — gated to Coordinator role.
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

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
  // Live width — keeps the 2-column grid in step with rotation /
  // tablet split / web window resize. Replaces a module-level
  // Dimensions.get that froze the column width at JS-bundle load.
  const { width: deviceWidth } = useResponsive();
  const cardWidth = (deviceWidth - spacing.sm * 2) / 2;
  
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPhotographers(), []));
  const router = useRouter();

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((p) => { if (p.category) set.add(p.category); });
    return [ALL_CATEGORIES, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [data]);

  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((p) => { if (p.location) set.add(p.location); });
    return [ALL_LOCATIONS, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [data]);

  // Only offer buckets that actually contain someone, so the sheet never
  // shows a range that can only ever return zero results.
  const priceOptions = useMemo(() => {
    const prices = (data ?? [])
      .map((p) => p.startingPrice)
      .filter((n): n is number => typeof n === 'number');
    return [
      ALL_PRICES,
      ...PRICE_BUCKETS.filter((b) => prices.some((v) => v >= b.min && v < b.max)).map((b) => b.label),
    ];
  }, [data]);

  const ratingOptions = useMemo(() => RATING_OPTIONS.map((o) => o.label), []);

  // Options that vanish when the data changes must not leave a stale
  // selection filtering everything out.
  useEffect(() => {
    if (!categoryOptions.includes(category)) setCategory(ALL_CATEGORIES);
    if (!locationOptions.includes(location)) setLocation(ALL_LOCATIONS);
    if (!priceOptions.includes(price)) setPrice(ALL_PRICES);
  }, [categoryOptions, locationOptions, priceOptions, category, location, price]);

  const filtered = useMemo(() => {
    if (!data) return data;
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
        // Unpriced profiles sort last rather than reading as free.
        return (a.startingPrice ?? Infinity) - (b.startingPrice ?? Infinity);
      }
      return (b.rating ?? 0) - (a.rating ?? 0);
    });
  }, [data, query, category, location, price, rating, sort]);

  // The search box narrows the list exactly like the filters do, so it counts
  // as active and gets cleared too — otherwise "Clear filters" leaves a
  // no-match query in place and appears to do nothing.
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
  };

  const sheetConfig: Record<SheetKey, { title: string; options: string[]; selected: string; select: (v: string) => void }> = {
    category: { title: 'Category', options: categoryOptions, selected: category, select: setCategory },
    location: { title: 'Location', options: locationOptions, selected: location, select: setLocation },
    price: { title: 'Starting price', options: priceOptions, selected: price, select: setPrice },
    rating: { title: 'Rating', options: ratingOptions, selected: rating, select: setRating },
    sort: {
      title: 'Sort by',
      options: SORT_OPTIONS.map((o) => o.label),
      selected: SORT_OPTIONS.find((o) => o.key === sort)!.label,
      select: (v) => {
        const next = SORT_OPTIONS.find((o) => o.label === v);
        if (next) setSort(next.key);
      },
    },
  };
  const activeSheet = sheet ? sheetConfig[sheet] : null;
  const sortLabel = SORT_OPTIONS.find((o) => o.key === sort)!.label;

  // Reset to the first page whenever the filtered set changes. This is a real
  // side effect, so it belongs in useEffect — doing it in useMemo set state
  // during render and made the pager jump/stall.
  useEffect(() => {
    setCurrentPage(1);
  }, [filtered]);

  const totalPages = filtered ? Math.ceil(filtered.length / ITEMS_PER_PAGE) : 0;

  // The reset above only lands after paint, so narrowing the filters while on a
  // deep page would render one frame of "no photographers found". Clamp here so
  // that frame never shows.
  const safePage = Math.min(currentPage, Math.max(1, totalPages));

  const paginatedData = useMemo(() => {
    if (!filtered) return [];
    const start = (safePage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, safePage]);

  const handlePhotographerPress = (id: string) => {
    router.push(`/photographer/${id}`);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Top Promotional Banner */}
      {showBanner && (
        <View style={styles.promoBanner}>
          <Ionicons name="megaphone-outline" size={18} color="white" />
          <View style={styles.promoTextContainer}>
            <Text style={styles.promoTextLines}>
              The Smart Way to{'\n'}Capture Life
            </Text>
            <View style={styles.promoDivider} />
            <Text style={styles.promoTextBold}>
              Book your perfect photographer{'\n'}today!
            </Text>
          </View>
          <Pressable onPress={() => setShowBanner(false)} hitSlop={10}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
      )}

      {/* Main Blue Header Area */}
      <View style={[styles.heroSection, { paddingTop: !showBanner ? spacing.md : spacing.md }]}>
        <View style={styles.eyebrowPill}>
          <Ionicons name="sparkles" size={10} color="white" />
          <Text style={styles.eyebrowText}>BROWSE CONNEKYT PHOTOGRAPHERS</Text>
        </View>
        <Text style={styles.heroTitle}>Find Your Perfect Photographer</Text>
        <Text style={styles.heroSubtitle}>
          Browse through professional photographers and videographers
        </Text>
      </View>

      {/* Floating Filter Card */}
      <View style={styles.filterCard}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
          <Input
            placeholder="Search by name, specialty, or location..."
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            style={styles.searchInput}
          />
        </View>
        
        <View style={styles.filtersGrid}>
          <View style={styles.filtersRow}>
            <FilterButton icon="camera-outline" label={category} onPress={() => setSheet('category')} />
            <FilterButton icon="location-outline" label={location} onPress={() => setSheet('location')} />
          </View>
          <View style={styles.filtersRow}>
            <FilterButton icon="cash-outline" label={price} onPress={() => setSheet('price')} />
            <FilterButton icon="star-outline" label={rating} onPress={() => setSheet('rating')} />
          </View>
        </View>
      </View>

      {/* Results Strip */}
      <View style={styles.resultsStrip}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
          <Text style={styles.resultsText}>
            <Text style={styles.resultsCount}>{filtered?.length ?? 0}</Text> photographers found
          </Text>
          {activeFilterCount > 0 ? (
            <Pressable style={styles.clearPill} onPress={clearFilters} accessibilityRole="button">
              <Ionicons name="close-circle" size={12} color={colors.primary} />
              <Text style={styles.clearPillText}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {/*
           * Coordinator-only invite pill. Web parity: salo-run
           * coordinator/photographers shows this CTA so a workspace
           * owner can email a photographer who isn't on the platform
           * yet. Backend persists the invite + sends a Brevo email.
           */}
          {isCoordinator ? (
            <Pressable style={styles.invitePill} onPress={() => setInviteOpen(true)}>
              <Ionicons name="mail-outline" size={14} color="#fff" />
              <Text style={styles.invitePillText}>Invite</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.sortButton} onPress={() => setSheet('sort')} accessibilityRole="button">
            <Ionicons name="swap-vertical" size={14} color={colors.text} />
            <Text style={styles.sortText}>Sort: <Text style={styles.sortValue}>{sortLabel}</Text></Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={styles.paginationContainer}>
        <Pressable 
          style={[styles.pagerBtn, safePage === 1 && styles.pagerBtnDisabled]}
          onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={safePage === 1}
        >
          <Ionicons name="chevron-back" size={12} color={safePage === 1 ? colors.textMuted : colors.text} />
          <Text style={[styles.pagerText, safePage === 1 && styles.pagerTextDisabled]}>Prev</Text>
        </Pressable>
        
        <View style={styles.pageNumbers}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Pressable
              key={page}
              style={[styles.pageNumberBtn, safePage === page && styles.pageNumberBtnActive]}
              onPress={() => setCurrentPage(page)}
            >
              <Text style={[styles.pageNumberText, safePage === page && styles.pageNumberTextActive]}>
                {page}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable 
          style={[styles.pagerBtn, safePage === totalPages && styles.pagerBtnDisabled]}
          onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={safePage === totalPages}
        >
          <Text style={[styles.pagerText, safePage === totalPages && styles.pagerTextDisabled]}>Next</Text>
          <Ionicons name="chevron-forward" size={12} color={safePage === totalPages ? colors.textMuted : colors.text} />
        </Pressable>
      </View>
    );
  };

  return (
    <>
      <Screen padded={false} edges={['left', 'right', 'bottom']}>
        <Stack.Screen 
          options={{
            title: 'Photographers',
            headerStyle: { backgroundColor: showBanner ? '#052960' : '#083A85' },
            headerTintColor: '#fff',
            headerTitleStyle: { fontWeight: '700' },
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
        {loading && !data ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error && !data?.length ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={paginatedData}
            keyExtractor={(p) => p.id}
            ListHeaderComponent={renderHeader()}
            ListFooterComponent={renderFooter()}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={refresh}
                tintColor={colors.primary}
              />
            }
            ListEmptyComponent={<EmptyState icon="camera-outline" title="No photographers found" message="Try a different search, or pull to refresh." />}
            renderItem={({ item }) => (
              <Pressable 
                style={[styles.cardWrapper, { width: cardWidth }]}
                onPress={() => handlePhotographerPress(item.id)}
              >
                <PhotographerCard photographer={item} />
              </Pressable>
            )}
          />
        )}
      </Screen>
      <Modal
        visible={inviteOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setInviteOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Invite a photographer</Text>
            <Text style={styles.modalHint}>
              They'll receive an email with a link to join your workspace.
            </Text>
            <Input
              label="Email"
              placeholder="photographer@example.com"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              label="Personal note (optional)"
              placeholder="Add a short message for context"
              value={inviteMessage}
              onChangeText={setInviteMessage}
              multiline
              style={{ height: 80, paddingTop: spacing.md, textAlignVertical: 'top', marginTop: spacing.sm }}
            />
            <Button
              title={inviteSubmitting ? 'Sending…' : 'Send invitation'}
              onPress={submitInvite}
              loading={inviteSubmitting}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={activeSheet !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSheet(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSheet(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>{activeSheet?.title}</Text>
            <ScrollView style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {activeSheet?.options.map((option) => {
                const active = option === activeSheet.selected;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      activeSheet.select(option);
                      setSheet(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button title="Close" variant="ghost" onPress={() => setSheet(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  listContent: { 
    flexGrow: 1, 
    paddingBottom: 120,
    backgroundColor: '#F8FAFC', // light background for the body
  },
  columnWrapper: {
    paddingHorizontal: spacing.sm,
  },
  cardWrapper: {
    // Width applied inline via cardWidth (responsive on rotation/resize).
    padding: spacing.xs,
  },
  headerContainer: {
    backgroundColor: '#F8FAFC',
    marginBottom: spacing.xs,
  },
  promoBanner: {
    backgroundColor: '#052960',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    gap: spacing.md,
  },
  promoTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  promoTextLines: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    lineHeight: 14,
  },
  promoDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  promoTextBold: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  heroSection: {
    backgroundColor: '#083A85',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 60, // Compacted padding
    alignItems: 'center',
  },
  eyebrowPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: 12,
  },
  eyebrowText: {
    color: 'white',
    fontFamily: fonts.bold,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: 'white',
    fontFamily: fonts.bold,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  filterCard: {
    backgroundColor: 'white',
    marginHorizontal: spacing.md,
    marginTop: -40, // Float over the blue background
    borderRadius: radii.xl,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 4,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  searchIcon: {
    position: 'absolute',
    left: spacing.sm,
    top: 10,
    zIndex: 1,
  },
  searchInput: {
    paddingLeft: 36,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    height: 40,
    fontSize: 13,
  },
  filtersGrid: {
    gap: 8,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    height: 36,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
    flexShrink: 1,
  },
  clearPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.infoBg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  clearPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  chipScroll: { maxHeight: 240 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: fontSize.xs, color: colors.textSoft, fontWeight: fontWeight.semibold },
  chipTextActive: { color: colors.textOnPrimary },
  resultsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: 16,
    marginBottom: spacing.xs,
  },
  resultsText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textMuted,
  },
  resultsCount: {
    fontFamily: fonts.bold,
    fontWeight: '700',
    color: '#083A85',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.lg,
    gap: 4,
  },
  sortText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sortValue: {
    fontWeight: '600',
    color: colors.text,
  },
  paginationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  pagerBtnDisabled: {
    opacity: 0.5,
  },
  pagerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  pagerTextDisabled: {
    color: colors.textMuted,
  },
  pageNumbers: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pageNumberBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: 'transparent',
  },
  pageNumberBtnActive: {
    backgroundColor: colors.primary,
  },
  pageNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pageNumberTextActive: {
    color: 'white',
  },

  invitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.lg,
  },
  invitePillText: { color: '#fff', fontFamily: fonts.bold, fontSize: 12, fontWeight: '700' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, fontWeight: '700', color: colors.text },
  modalHint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },
});
