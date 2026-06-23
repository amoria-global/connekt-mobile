import { useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import { Pressable, StyleSheet, View, Text, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '@gorhom/bottom-sheet';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { listPhotographers } from '@/features/photographers/api';
import { PhotographerCard } from '@/features/photographers/PhotographerCard';
import { BookingBottomSheet } from '@/features/booking/BookingBottomSheet';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const ITEMS_PER_PAGE = 4;
let hasAutoShownWizard = false;

// Filter button component
function FilterButton({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <Pressable style={styles.filterButton}>
      <Ionicons name={icon} size={14} color={colors.textMuted} />
      <Text style={styles.filterButtonText}>{label}</Text>
      <Ionicons name="chevron-down" size={12} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}

export default function PhotographersScreen() {
  const [query, setQuery] = useState('');
  const [showBanner, setShowBanner] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const bottomSheetRef = useRef<BottomSheet>(null);
  // Live width — keeps the 2-column grid in step with rotation /
  // tablet split / web window resize. Replaces a module-level
  // Dimensions.get that froze the column width at JS-bundle load.
  const { width: deviceWidth } = useResponsive();
  const cardWidth = (deviceWidth - spacing.sm * 2) / 2;
  
  const { data, loading, error, refresh } = useAsync(useCallback(() => listPhotographers(), []));
  const router = useRouter();

  // Show bottom sheet automatically after 5 seconds, just like the web wizard
  useEffect(() => {
    if (!hasAutoShownWizard) {
      const timer = setTimeout(() => {
        bottomSheetRef.current?.expand();
        hasAutoShownWizard = true;
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  const filtered = useMemo(() => {
    if (!data) return data;
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q) ||
        (p.location ?? '').toLowerCase().includes(q),
    );
  }, [data, query]);

  // Reset page when filter changes
  useMemo(() => {
    setCurrentPage(1);
  }, [filtered]);

  const totalPages = filtered ? Math.ceil(filtered.length / ITEMS_PER_PAGE) : 0;
  
  const paginatedData = useMemo(() => {
    if (!filtered) return [];
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

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
            <FilterButton icon="camera-outline" label="All Categories" />
            <FilterButton icon="location-outline" label="All Locations" />
          </View>
          <View style={styles.filtersRow}>
            <FilterButton icon="cash-outline" label="All Prices" />
            <FilterButton icon="star-outline" label="All Ratings" />
          </View>
          <View style={styles.filtersRow}>
            <FilterButton icon="calendar-outline" label="dd/mm/yyyy" />
            <View style={{ flex: 1 }} />
          </View>
        </View>
      </View>

      {/* Results Strip */}
      <View style={styles.resultsStrip}>
        <Text style={styles.resultsText}>
          <Text style={styles.resultsCount}>{filtered?.length ?? 0}</Text> photographers found
        </Text>
        <Pressable style={styles.sortButton}>
          <Ionicons name="swap-vertical" size={14} color={colors.text} />
          <Text style={styles.sortText}>Sort: <Text style={styles.sortValue}>Newest</Text></Text>
          <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
        </Pressable>
      </View>
    </View>
  );

  const renderFooter = () => {
    if (totalPages <= 1) return null;
    return (
      <View style={styles.paginationContainer}>
        <Pressable 
          style={[styles.pagerBtn, currentPage === 1 && styles.pagerBtnDisabled]}
          onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <Ionicons name="chevron-back" size={12} color={currentPage === 1 ? colors.textMuted : colors.text} />
          <Text style={[styles.pagerText, currentPage === 1 && styles.pagerTextDisabled]}>Prev</Text>
        </Pressable>
        
        <View style={styles.pageNumbers}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <Pressable
              key={page}
              style={[styles.pageNumberBtn, currentPage === page && styles.pageNumberBtnActive]}
              onPress={() => setCurrentPage(page)}
            >
              <Text style={[styles.pageNumberText, currentPage === page && styles.pageNumberTextActive]}>
                {page}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable 
          style={[styles.pagerBtn, currentPage === totalPages && styles.pagerBtnDisabled]}
          onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          <Text style={[styles.pagerText, currentPage === totalPages && styles.pagerTextDisabled]}>Next</Text>
          <Ionicons name="chevron-forward" size={12} color={currentPage === totalPages ? colors.textMuted : colors.text} />
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
      <BookingBottomSheet 
        ref={bottomSheetRef} 
        photographerId={undefined} 
      />
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
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
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
  },
  resultsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: 16,
    marginBottom: spacing.xs,
  },
  resultsText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  resultsCount: {
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
});
