/**
 * GlobalSearchModal — Comprehensive, real-time multi-domain platform search.
 *
 * Provides real-time search across:
 *   • Photographers & Studios (names, specialties, locations, ratings)
 *   • Events & Live Broadcasts (upcoming shoots, active streams, tickets)
 *   • Categories & Styles (Weddings, Portraits, Studio, etc.)
 *
 * Features:
 *   • Debounced backend + in-memory queries for 60fps instant feedback
 *   • Scope filter chips: All · Photographers · Live & Events · Styles
 *   • Recent searches persistent history
 *   • Trending search suggestions
 *   • Direct navigation to photographer portfolios & live stream events
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { listPhotographers, type Photographer } from '@/features/photographers/api';
import { listPublicEventsDetailed } from '@/features/events/api';
import { isEventLive, type PublicEvent } from '@/features/events/types';
import { storage } from '@/services/storage';
import { formatDate } from '@/utils/format';
import { EVENT_COVER_PLACEHOLDER, PHOTOGRAPHER_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

const RECENT_SEARCHES_KEY = 'connekt.global_search_recents';

const POPULAR_STYLES = [
  { name: 'Live Streams', icon: 'videocam' as const, color: '#EF4444' },
  { name: 'Weddings', icon: 'heart' as const, color: '#F20C8F' },
  { name: 'Portraits', icon: 'person' as const, color: '#3B82F6' },
  { name: 'Events', icon: 'calendar' as const, color: '#0EA5E9' },
  { name: 'Birthdays', icon: 'gift' as const, color: '#F59E0B' },
  { name: 'Studio', icon: 'camera' as const, color: '#10B981' },
  { name: 'Fashion', icon: 'shirt-outline' as const, color: '#8B5CF6' },
  { name: 'Graduation', icon: 'school-outline' as const, color: '#EC4899' },
  { name: 'Family', icon: 'people-outline' as const, color: '#14B8A6' },
  { name: 'Corporate', icon: 'briefcase-outline' as const, color: '#64748B' },
];

type SearchScope = 'all' | 'photographers' | 'events' | 'styles';

interface GlobalSearchModalProps {
  visible: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function GlobalSearchModal({ visible, onClose, initialQuery = '' }: GlobalSearchModalProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tr } = useSharedT();

  const [query, setQuery] = useState(initialQuery);
  const [scope, setScope] = useState<SearchScope>('all');
  const [loading, setLoading] = useState(false);

  // Cached data
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [eventResults, setEventResults] = useState<PublicEvent[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const inputRef = useRef<TextInput>(null);

  // Load directory cache and recents on open
  useEffect(() => {
    if (!visible) return;

    // Fetch photographer directory once for instant fuzzy searching
    listPhotographers()
      .then((list) => setPhotographers(list))
      .catch(() => {});

    // Load recent searches
    storage
      .get(RECENT_SEARCHES_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setRecentSearches(JSON.parse(raw));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});

    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  const saveRecentSearch = useCallback(
    async (term: string) => {
      const clean = term.trim();
      if (!clean) return;
      const updated = [clean, ...recentSearches.filter((s) => s.toLowerCase() !== clean.toLowerCase())].slice(
        0,
        6,
      );
      setRecentSearches(updated);
      await storage.set(RECENT_SEARCHES_KEY, JSON.stringify(updated)).catch(() => {});
    },
    [recentSearches],
  );

  const clearRecentSearches = async () => {
    setRecentSearches([]);
    await storage.remove(RECENT_SEARCHES_KEY).catch(() => {});
  };

  // Debounced search query runner
  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setEventResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await listPublicEventsDetailed({ search: term, size: 8 });
        setEventResults(res.content || []);
      } catch {
        setEventResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  // Filter photographers in memory based on query
  const filteredPhotographers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return photographers
      .filter((p) => {
        const name = (p.name || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const loc = (p.location || '').toLowerCase();
        return name.includes(term) || cat.includes(term) || loc.includes(term);
      })
      .slice(0, 8);
  }, [photographers, query]);

  // Filter styles/categories
  const matchingStyles = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return POPULAR_STYLES.filter((s) => s.name.toLowerCase().includes(term));
  }, [query]);

  // Check for active live streams
  const liveEvents = useMemo(() => {
    return eventResults.filter((e) => isEventLive(e));
  }, [eventResults]);

  const handleSelectPhotographer = (id: string, name: string) => {
    saveRecentSearch(name);
    onClose();
    router.push(`/photographer/${id}` as never);
  };

  const handleSelectEvent = (id: string, title: string) => {
    saveRecentSearch(title);
    onClose();
    router.push(`/(public)/event/${id}` as never);
  };

  const handleSelectStyle = (styleName: string) => {
    saveRecentSearch(styleName);
    onClose();
    if (styleName === 'Live Streams') {
      router.push('/(public)/explore-events' as never);
    } else {
      router.push('/photographers' as never);
    }
  };

  const hasResults =
    filteredPhotographers.length > 0 || eventResults.length > 0 || matchingStyles.length > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Top Search Bar */}
        <View style={styles.searchBarRow}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close search"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.searchInputWrap}>
            <Ionicons name="search" size={17} color={colors.textMuted} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder={tr('Search photographers, live streams, events...')}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => saveRecentSearch(query)}
            />
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 4 }} />
            ) : query.length > 0 ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* Scope Selector Chips */}
        <View style={styles.scopeRail}>
          {(
            [
              { id: 'all', label: tr('All') },
              { id: 'photographers', label: `${tr('Photographers & Creators')} (${filteredPhotographers.length})` },
              { id: 'events', label: `${tr('Events & Public Shoots')} (${eventResults.length})` },
              { id: 'styles', label: tr('Categories') },
            ] as const
          ).map((t) => {
            const active = scope === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setScope(t.id)}
                style={[styles.scopeChip, active && styles.scopeChipActive]}
              >
                <Text style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Content Area */}
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={true}
          showsVerticalScrollIndicator={false}
        >
          {/* State 1: Query is Empty — Show Recents & Trending */}
          {query.trim().length === 0 ? (
            <View style={styles.idleWrap}>
              {recentSearches.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHeadRow}>
                    <Text style={styles.sectionTitle}>{tr('Recent Searches')}</Text>
                    <Pressable onPress={clearRecentSearches} hitSlop={8}>
                      <Text style={styles.clearLink}>{tr('Clear')}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.recentTagsWrap}>
                    {recentSearches.map((term) => (
                      <Pressable
                        key={term}
                        style={({ pressed }) => [styles.recentTag, pressed && styles.pressed]}
                        onPress={() => setQuery(term)}
                      >
                        <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                        <Text style={styles.recentTagText}>{term}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Trending Styles & Searches */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{tr('Explore by Category')}</Text>
                <View style={styles.styleGrid}>
                  {POPULAR_STYLES.map((st) => (
                    <Pressable
                      key={st.name}
                      style={({ pressed }) => [styles.styleCard, pressed && styles.pressed]}
                      onPress={() => handleSelectStyle(st.name)}
                    >
                      <View style={[styles.styleIconWrap, { backgroundColor: `${st.color}15` }]}>
                        <Ionicons name={st.icon} size={20} color={st.color} />
                      </View>
                      <Text style={styles.styleCardName}>{tr(st.name)}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ) : /* State 2: Searching with Query */
          loading && !hasResults ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>{tr('Searching platform...')}</Text>
            </View>
          ) : !hasResults ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={44} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No results found for "{query}"</Text>
              <Text style={styles.emptySub}>
                Try searching for photographer names, shoot styles like 'wedding', or city locations.
              </Text>
            </View>
          ) : (
            <View style={styles.resultsWrap}>
              {/* Live Broadcasts section (Top Priority) */}
              {(scope === 'all' || scope === 'events') && liveEvents.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.liveHeadRow}>
                    <View style={styles.liveDotRed} />
                    <Text style={styles.liveHeadTitle}>{tr('LIVE BROADCASTS NOW')}</Text>
                  </View>
                  {liveEvents.map((ev) => (
                    <Pressable
                      key={ev.id}
                      style={({ pressed }) => [styles.liveCard, pressed && styles.pressed]}
                      onPress={() => handleSelectEvent(ev.id, ev.title)}
                    >
                      <Image
                        source={ev.eventPhoto ? { uri: ev.eventPhoto } : EVENT_COVER_PLACEHOLDER}
                        style={styles.liveCardThumb}
                        contentFit="cover"
                      />
                      <View style={styles.liveCardInfo}>
                        <Text style={styles.liveCardTitle} numberOfLines={1}>
                          {ev.title}
                        </Text>
                        <Text style={styles.liveCardSub} numberOfLines={1}>
                          {ev.photographerName || ev.eventOrganizer || tr('Live Stream')}
                        </Text>
                      </View>
                      <View style={styles.watchLivePill}>
                        <Ionicons name="play" size={11} color="#FFFFFF" />
                        <Text style={styles.watchLivePillText}>{tr('Watch')}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Photographers Section */}
              {(scope === 'all' || scope === 'photographers') &&
                filteredPhotographers.length > 0 && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{tr('Photographers & Creators')}</Text>
                    {filteredPhotographers.map((p) => (
                      <Pressable
                        key={p.id}
                        style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                        onPress={() => handleSelectPhotographer(p.id, p.name)}
                      >
                        <Image
                          source={
                            p.avatar
                              ? { uri: p.avatar }
                              : PHOTOGRAPHER_COVER_PLACEHOLDER
                          }
                          style={styles.photogAvatar}
                          contentFit="cover"
                        />
                        <View style={styles.resultInfo}>
                          <View style={styles.rowInline}>
                            <Text style={styles.resultTitle} numberOfLines={1}>
                              {p.name}
                            </Text>
                            <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />
                          </View>
                          <Text style={styles.resultSub} numberOfLines={1}>
                            {[p.category, p.location].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        <View style={styles.resultMeta}>
                          {p.rating ? (
                            <View style={styles.ratingChip}>
                              <Ionicons name="star" size={10} color="#FBBF24" />
                              <Text style={styles.ratingChipText}>{p.rating.toFixed(1)}</Text>
                            </View>
                          ) : null}
                          <Text style={styles.priceTag}>
                            {p.startingPrice ? `From $${p.startingPrice}` : 'View'}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

              {/* Events & Streams Section */}
              {(scope === 'all' || scope === 'events') && eventResults.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Events & Public Shoots</Text>
                  {eventResults.map((ev) => {
                    const isLive = isEventLive(ev);
                    return (
                      <Pressable
                        key={ev.id}
                        style={({ pressed }) => [styles.resultRow, pressed && styles.pressed]}
                        onPress={() => handleSelectEvent(ev.id, ev.title)}
                      >
                        <Image
                          source={
                            ev.eventPhoto
                              ? { uri: ev.eventPhoto }
                              : EVENT_COVER_PLACEHOLDER
                          }
                          style={styles.eventThumb}
                          contentFit="cover"
                        />
                        <View style={styles.resultInfo}>
                          <Text style={styles.resultTitle} numberOfLines={1}>
                            {ev.title}
                          </Text>
                          <Text style={styles.resultSub} numberOfLines={1}>
                            {[
                              isLive ? 'LIVE NOW' : ev.eventDate ? formatDate(ev.eventDate) : null,
                              ev.location,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        <View style={styles.resultMeta}>
                          {isLive ? (
                            <View style={styles.liveTagChip}>
                              <Text style={styles.liveTagChipText}>LIVE</Text>
                            </View>
                          ) : (
                            <Ionicons name="chevron-forward" size={16} color={colors.border} />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Matching Styles / Categories */}
              {(scope === 'all' || scope === 'styles') && matchingStyles.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Categories</Text>
                  <View style={styles.recentTagsWrap}>
                    {matchingStyles.map((st) => (
                      <Pressable
                        key={st.name}
                        style={({ pressed }) => [styles.categoryBadge, pressed && styles.pressed]}
                        onPress={() => handleSelectStyle(st.name)}
                      >
                        <Ionicons name={st.icon} size={14} color={st.color} />
                        <Text style={styles.categoryBadgeText}>{st.name}</Text>
                        <Ionicons name="arrow-forward" size={11} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c, e) => ({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  pressed: {
    opacity: 0.85,
  },

  // Top Search Bar
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.text,
    height: '100%',
    padding: 0,
  },

  // Scope Tabs
  scopeRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  scopeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  scopeChipActive: {
    backgroundColor: c.primary,
  },
  scopeChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
  },
  scopeChipTextActive: {
    color: '#FFFFFF',
  },

  scrollContent: {
    padding: spacing.md,
    gap: spacing.xl,
  },

  // Idle Wrap
  idleWrap: {
    gap: spacing.xl,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  clearLink: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
  },
  recentTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  recentTagText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.text,
  },

  // Popular Styles
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  styleCard: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    borderRadius: radii.xl,
    ...e(1),
  },
  styleIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  styleCardName: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },

  // Results Rows
  resultsWrap: {
    gap: spacing.xl,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.xl,
    padding: spacing.md,
    ...e(1),
  },
  photogAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surfaceMuted,
  },
  eventThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.surfaceMuted,
  },
  resultInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resultTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  resultSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  resultMeta: {
    alignItems: 'flex-end',
    gap: 3,
  },
  ratingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  ratingChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.text,
  },
  priceTag: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
  },

  // Live Broadcast row
  liveHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  liveDotRed: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  liveHeadTitle: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#EF4444',
    letterSpacing: 0.6,
  },
  liveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: radii.xl,
    padding: spacing.md,
    ...e(1),
  },
  liveCardThumb: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: c.surfaceMuted,
  },
  liveCardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  liveCardTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  liveCardSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  watchLivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  watchLivePillText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#FFFFFF',
  },
  liveTagChip: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  liveTagChipText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#EF4444',
  },

  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  categoryBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: c.text,
  },

  // Loading & Empty States
  loadingWrap: {
    paddingVertical: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  emptyWrap: {
    paddingVertical: spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
    textAlign: 'center',
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
}));
