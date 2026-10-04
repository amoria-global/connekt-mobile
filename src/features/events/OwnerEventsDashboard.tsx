/**
 * Owner events dashboard — for the roles that CREATE events (Event
 * Coordinator, and reusable for Client). Mobile port of salo-run's
 * client / event-coordinator events page (they share one design):
 *
 *   • Header: eyebrow → "Events" → subtitle, with a "New event" button.
 *   • Stat strip: Total / Upcoming / Published / Completed.
 *   • Filter pills (All / Upcoming / Published / Past) with count badges +
 *     a search box.
 *   • Dark, image-led event cards with status + date pills, location,
 *     assigned-photographer line, and quick Edit / Share actions. Tapping
 *     a card opens the event detail (which carries the full Manage panel:
 *     publish, pause/resume, delete, confirm-done, …).
 *
 * Shares the visual language + Pragati Narrow type of the photographer
 * "Events & albums" dashboard.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';
import { listCoordinatorEvents, listEvents } from './api';
import type { EventItem } from './types';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { BookingModeSelector } from '@/features/booking/BookingModeSelector';
import { env } from '@/config/env';

const SHARE_BASE = 'https://connekyt.com/user/events/view-event?id=';
const PAGE_SIZE = 8;

export type EventSortOption = 'newest' | 'oldest' | 'date_asc' | 'title_asc';

export const SORT_OPTIONS: {
  key: EventSortOption;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    key: 'newest',
    label: 'Newest created first',
    description: 'Recently booked or created events appear first',
    icon: 'sparkles-outline',
  },
  {
    key: 'oldest',
    label: 'Oldest created first',
    description: 'Earliest booked or created events first',
    icon: 'time-outline',
  },
  {
    key: 'date_asc',
    label: 'Event date (Upcoming first)',
    description: 'Scheduled event date & time in chronological order',
    icon: 'calendar-outline',
  },
  {
    key: 'title_asc',
    label: 'Title (A–Z)',
    description: 'Alphabetical order by event name',
    icon: 'text-outline',
  },
];

type Filter = 'all' | 'upcoming' | 'published' | 'past';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

const isPast = (e: EventItem, today: number) => {
  const t = e.eventDate ? new Date(e.eventDate).getTime() : NaN;
  return !Number.isNaN(t) && t < today;
};

function heroStatus(e: EventItem): { label: string; bg: string; fg: string } {
  const s = (e.status ?? '').toUpperCase();
  if (s === 'ONGOING' || s === 'IN_PROGRESS') return { label: 'ONGOING', bg: '#DBEAFE', fg: '#1D4ED8' };
  if (s === 'COMPLETED' || s === 'DONE') return { label: 'COMPLETED', bg: '#D1FAE5', fg: '#047857' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { label: 'CANCELLED', bg: '#FEE2E2', fg: '#B91C1C' };
  if (s === 'PAUSED') return { label: 'PAUSED', bg: '#E5E7EB', fg: '#374151' };
  if (e.published) return { label: 'PUBLISHED', bg: '#CCFBF1', fg: '#0F766E' };
  // An unpublished event is invisible on connekyt.com. Saying "UPCOMING" read
  // as though everything was fine, so owners never knew there was a step left.
  return { label: 'NOT PUBLISHED', bg: '#FEF3C7', fg: '#92400E' };
}

function fmtShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STAT_META = [
  { key: 'all', label: 'Total Events', accent: '#083A85', icon: 'calendar' },
  { key: 'upcoming', label: 'Upcoming', accent: '#3B82F6', icon: 'hourglass' },
  { key: 'published', label: 'Published', accent: '#10B981', icon: 'globe' },
  { key: 'completed', label: 'Completed', accent: '#8B5CF6', icon: 'checkmark-circle' },
] as const;

const WORKSPACE_TABS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; route?: Href }[] = [
  { key: 'events', label: 'Events', icon: 'calendar-outline' as const },
  { key: 'photographers', label: 'Photographers', icon: 'camera-outline' as const, route: '/photographers' as Href },
  { key: 'geo-pricing', label: 'Geo Pricing', icon: 'globe-outline' as const, route: '/event/geo-pricing' as Href },
];

export function OwnerEventsDashboard({
  coordinator = false,
  topInset = 0,
  initialSearch = '',
}: {
  coordinator?: boolean;
  topInset?: number;
  initialSearch?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<EventItem>>(null);
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(
    coordinator ? listCoordinatorEvents : listEvents,
  );

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState(initialSearch);
  const [sortBy, setSortBy] = useState<EventSortOption>('newest');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [bookingModeOpen, setBookingModeOpen] = useState(false);
  const [page, setPage] = useState(1);

  const handleNewEvent = () => {
    if (env.hybridBookingEnabled) {
      setBookingModeOpen(true);
    } else {
      router.push('/event/new' as Href);
    }
  };

  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  const events = data ?? [];
  const today = startOfToday();

  const onFilterChange = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  const onSearchChange = (text: string) => {
    setSearch(text);
    setPage(1);
  };

  const onSortChange = (opt: EventSortOption) => {
    setSortBy(opt);
    setPage(1);
    setSortSheetOpen(false);
  };

  const stats = useMemo(() => {
    const c = { all: events.length, upcoming: 0, published: 0, completed: 0 };
    for (const e of events) {
      const s = (e.status ?? '').toUpperCase();
      if (e.published) c.published += 1;
      if (s === 'COMPLETED' || s === 'DONE') c.completed += 1;
      else if (!isPast(e, today)) c.upcoming += 1;
    }
    return c;
  }, [events, today]);

  const tabCounts = useMemo(() => {
    let upcoming = 0;
    let published = 0;
    let past = 0;
    for (const e of events) {
      if (e.published) published += 1;
      if (isPast(e, today)) past += 1;
      else upcoming += 1;
    }
    return { all: events.length, upcoming, published, past };
  }, [events, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (filter === 'upcoming' && isPast(e, today)) return false;
      if (filter === 'past' && !isPast(e, today)) return false;
      if (filter === 'published' && !e.published) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q) ||
        (e.photographerName ?? '').toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [events, filter, search, today]);

  const sortedAndFiltered = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case 'newest':
        list.sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
        });
        break;
      case 'oldest':
        list.sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
          return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
        });
        break;
      case 'date_asc':
        list.sort((a, b) => {
          const ta = a.eventDate ? Date.parse(a.eventDate) : 0;
          const tb = b.eventDate ? Date.parse(b.eventDate) : 0;
          return (Number.isNaN(ta) ? 0 : ta) - (Number.isNaN(tb) ? 0 : tb);
        });
        break;
      case 'title_asc':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return list;
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedAndFiltered.length / PAGE_SIZE));

  const pagedEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedAndFiltered.slice(start, start + PAGE_SIZE);
  }, [sortedAndFiltered, page]);

  const goToPage = (nextPage: number) => {
    const valid = Math.max(1, Math.min(totalPages, nextPage));
    setPage(valid);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const onShare = (e: EventItem) => {
    Share.share({ title: e.title, message: `Check out "${e.title}" on Connekyt\n${SHARE_BASE}${e.id}` }).catch(() => {});
  };

  const header = (
    <View style={{ paddingTop: topInset + spacing.md }}>
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.eyebrowRow}>
            <Ionicons name={coordinator ? 'business' : 'calendar'} size={12} color={colors.accent} />
            <Text style={styles.eyebrow}>{coordinator ? 'COORDINATOR WORKSPACE' : 'MY EVENTS'}</Text>
          </View>
          <Text style={styles.h1}>{coordinator ? 'Events & Productions' : 'Events'}</Text>
          <Text style={styles.subtitle}>Your bookings, sessions and live events.</Text>
        </View>
        <Pressable
          style={styles.bigAddBtn}
          onPress={handleNewEvent}
          accessibilityRole="button"
          accessibilityLabel="Create new event"
        >
          <Ionicons name="add" size={28} color="#fff" />
        </Pressable>
      </View>

      {/* Workspace toggle tabs for Coordinator or Client */}
      {coordinator ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.workspaceTabs}
        >
          {WORKSPACE_TABS.map((t) => {
            const active = t.key === 'events';
            return (
              <Pressable
                key={t.key}
                onPress={() => (t.route ? router.push(t.route) : null)}
                style={[styles.workspaceTab, active && styles.workspaceTabActive]}
              >
                <Ionicons
                  name={t.icon}
                  size={14}
                  color={active ? '#fff' : colors.textMuted}
                />
                <Text
                  style={[styles.workspaceTabText, active && styles.workspaceTabTextActive]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.workspaceTabs}
        >
          <View style={[styles.workspaceTab, styles.workspaceTabActive]}>
            <Ionicons name="calendar" size={14} color="#fff" />
            <Text style={[styles.workspaceTabText, styles.workspaceTabTextActive]}>
              My Events
            </Text>
            {events.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{events.length}</Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={() => router.push('/photographers' as Href)}
            style={styles.workspaceTab}
          >
            <Ionicons name="camera-outline" size={14} color={colors.textMuted} />
            <Text style={styles.workspaceTabText}>
              Photographers
            </Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/explore-events' as Href)}
            style={styles.workspaceTab}
          >
            <Ionicons name="compass-outline" size={14} color={colors.textMuted} />
            <Text style={styles.workspaceTabText}>
              Explore Public Streams
            </Text>
          </Pressable>
        </ScrollView>
      )}

      {/* Stat strip - clean solid cards, no top tear, no gradients */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statStrip}>
        {STAT_META.map((s) => (
          <View key={s.key} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: `${s.accent}14`, borderColor: `${s.accent}2E` }]}>
              <Ionicons name={s.icon} size={18} color={s.accent} />
            </View>
            <View style={{ minWidth: 0, flex: 1 }}>
              <Text style={styles.statLabel} numberOfLines={1}>{s.label}</Text>
              <Text style={styles.statValue}>{stats[s.key]}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Filter pills */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(['all', 'upcoming', 'published', 'past'] as const).map((f) => {
          const active = filter === f;
          return (
            <Pressable key={f} onPress={() => onFilterChange(f)} style={[styles.filterPill, active && styles.filterPillActive]}>
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
              <View style={[styles.filterBadge, active && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, active && styles.filterBadgeTextActive]}>{tabCounts[f]}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Search & Sort row */}
      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={onSearchChange}
            placeholder="Search events…"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <Pressable onPress={() => onSearchChange('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={[styles.sortBtn, sortBy !== 'newest' && styles.sortBtnActive]}
          onPress={() => setSortSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Sort events"
        >
          <Ionicons
            name="funnel-outline"
            size={16}
            color={sortBy !== 'newest' ? colors.primary : colors.textMuted}
          />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        key="owner-events-grid-2"
        data={pagedEvents}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <OwnerEventCard
            event={item}
            onOpen={() => router.push(`/event/${item.id}` as Href)}
            onEdit={() => router.push(`/event/new?editId=${item.id}` as Href)}
            onShare={() => onShare(item)}
          />
        )}
        ListFooterComponent={
          sortedAndFiltered.length > 0 ? (
            <View style={styles.paginationFooter}>
              <View style={styles.pagerBar}>
                <Pressable
                  style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
                  onPress={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  accessibilityRole="button"
                  accessibilityLabel="Previous page"
                >
                  <Ionicons
                    name="chevron-back"
                    size={16}
                    color={page <= 1 ? colors.textMuted : colors.text}
                  />
                  <Text
                    style={[
                      styles.pagerBtnText,
                      page <= 1 && styles.pagerBtnTextDisabled,
                    ]}
                  >
                    Previous
                  </Text>
                </Pressable>

                <View style={styles.pagerIndicator}>
                  <Text style={styles.pagerIndicatorText}>
                    Page <Text style={styles.pagerIndicatorBold}>{page}</Text> of{' '}
                    <Text style={styles.pagerIndicatorBold}>{totalPages}</Text>
                  </Text>
                  <Text style={styles.pagerTotalText}>
                    ({sortedAndFiltered.length} {sortedAndFiltered.length === 1 ? 'event' : 'events'})
                  </Text>
                </View>

                <Pressable
                  style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
                  onPress={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  accessibilityRole="button"
                  accessibilityLabel="Next page"
                >
                  <Text
                    style={[
                      styles.pagerBtnText,
                      page >= totalPages && styles.pagerBtnTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={page >= totalPages ? colors.textMuted : colors.text}
                  />
                </Pressable>
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : error ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState icon="cloud-offline-outline" title="Couldn't load events" message="Pull to refresh and try again." />
            </View>
          ) : (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState
                icon="calendar-outline"
                title={search || filter !== 'all' ? 'No matching events' : 'No events yet'}
                message={
                  search || filter !== 'all'
                    ? 'Try a different filter or search term.'
                    : 'Create your first event with Direct Booking or Hybrid Matching.'
                }
                action={{
                  label: '+ Create Event',
                  onPress: handleNewEvent,
                }}
              />
            </View>
          )
        }
      />

      {/* Floating Action Button — Create New Event */}
      <Pressable
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom + 84, 96) },
        ]}
        onPress={handleNewEvent}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        accessibilityRole="button"
        accessibilityLabel="Create new event"
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

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
                <Text style={styles.sortSheetTitle}>Sort Events</Text>
                <Text style={styles.sortSheetSubtitle}>Choose an order for your event list</Text>
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
                    onPress={() => onSortChange(opt.key)}
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

      {/* Dual Entry Booking Mode Selector */}
      <BookingModeSelector
        visible={bookingModeOpen}
        onClose={() => {
          setBookingModeOpen(false);
          refresh();
        }}
        onSelectDirect={() => {
          setBookingModeOpen(false);
          router.push('/event/new' as Href);
        }}
      />
    </View>
  );
}

function OwnerEventCard({
  event,
  onOpen,
  onEdit,
  onShare,
}: {
  event: EventItem;
  onOpen: () => void;
  onEdit: () => void;
  onShare: () => void;
}) {
  const styles = useStyles();
  const pill = heroStatus(event);
  return (
    <Pressable style={styles.card} onPress={onOpen} android_ripple={{ color: 'rgba(255,255,255,0.06)' }}>
      <Image source={event.coverImage ? { uri: event.coverImage } : EVENT_COVER_PLACEHOLDER} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
      {/* Solid dark scrim overlay (no gradients) */}
      <View style={styles.cardScrim} />

      <View style={styles.cardTop}>
        <View style={styles.datePill}>
          <Ionicons name="calendar" size={11} color="#fff" />
          <Text style={styles.datePillText}>{fmtShortDate(event.eventDate) || 'No date'}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
          <Text style={[styles.statusPillText, { color: pill.fg }]}>{pill.label}</Text>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
        {event.location ? (
          <View style={styles.metaRow}>
            <Ionicons name="location" size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
          </View>
        ) : null}
        <View style={styles.metaRow}>
          <Ionicons name="camera" size={12} color="rgba(255,255,255,0.85)" />
          <Text style={styles.metaText} numberOfLines={1}>
            {event.photographerName || 'No photographer assigned'}
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable style={[styles.actBtn, styles.actEdit]} onPress={onEdit}>
            <Ionicons name="create-outline" size={14} color="#fff" />
            <Text style={styles.actText}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.actBtn, styles.actShare]} onPress={onShare}>
            <Ionicons name="share-social-outline" size={14} color="#fff" />
            <Text style={styles.actText}>Share</Text>
          </Pressable>
          <View style={styles.manageHint}>
            <Text style={styles.manageHintText}>Manage</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.9)" />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  columnWrapper: { gap: spacing.md },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  h1: { fontFamily: fonts.bold, fontSize: 30, color: c.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted, marginTop: 2 },

  // Big circular + button without text (Header)
  bigAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },

  // Floating Action Button (New Event — big circular + without text)
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.accent,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },

  workspaceTabs: { gap: 8, paddingVertical: spacing.sm },
  workspaceTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  workspaceTabActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  workspaceTabText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.textSoft,
  },
  workspaceTabTextActive: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    marginLeft: 2,
  },
  tabBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#fff',
    fontWeight: '700',
  },

  statStrip: { gap: 10, paddingVertical: spacing.md },
  statCard: {
    width: 172,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radii.xl,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  statIcon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  statLabel: { fontFamily: fonts.bold, fontSize: 12, color: c.textMuted },
  statValue: { fontFamily: fonts.bold, fontSize: 24, color: c.text, lineHeight: 28 },

  filterRow: { gap: 8, paddingBottom: spacing.md },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
  },
  filterPillActive: { backgroundColor: c.primary },
  filterText: { fontFamily: fonts.bold, fontSize: 14, color: c.textSoft },
  filterTextActive: { color: '#fff' },
  filterBadge: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.full, backgroundColor: 'rgba(8,58,133,0.10)', alignItems: 'center' },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.24)' },
  filterBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: c.primary },
  filterBadgeTextActive: { color: '#fff' },

  container: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.text, padding: 0 },
  sortBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortBtnActive: {
    borderColor: c.primary,
    backgroundColor: c.infoBg,
  },

  paginationFooter: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + 40,
  },
  pagerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    gap: 4,
  },
  pagerBtnDisabled: {
    opacity: 0.35,
  },
  pagerBtnText: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    color: c.text,
  },
  pagerBtnTextDisabled: {
    color: c.textMuted,
  },
  pagerIndicator: {
    alignItems: 'center',
  },
  pagerIndicatorText: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  pagerIndicatorBold: {
    fontFamily: fonts.bold,
    color: c.text,
  },
  pagerTotalText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: c.textMuted,
    marginTop: 1,
  },

  // Sort sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  sortSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sortSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  sortSheetTitle: {
    fontFamily: fonts.bold,
    fontSize: fontSize.md,
    color: c.text,
  },
  sortSheetSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 2,
  },
  sortSheetCloseBtn: {
    padding: spacing.xs,
  },
  sortOptionsList: {
    gap: spacing.xs,
  },
  sortOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  sortOptionItemActive: {
    backgroundColor: c.infoBg,
  },
  sortOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionIconBoxActive: {
    backgroundColor: c.primary,
  },
  sortOptionTextCol: {
    flex: 1,
  },
  sortOptionLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSize.sm,
    color: c.text,
  },
  sortOptionLabelActive: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
  sortOptionDesc: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 1,
  },
  sortOptionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },

  card: { flex: 1, minHeight: 260, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: '#071224', borderWidth: 1, borderColor: c.borderSoft, justifyContent: 'space-between' },
  cardScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 12, 28, 0.45)',
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.sm, gap: 4, flexWrap: 'wrap' },
  datePill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 7, paddingVertical: 3.5, borderRadius: radii.full },
  datePillText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#fff' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.full },
  statusPillText: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.3 },

  cardBottom: {
    backgroundColor: 'rgba(3, 8, 20, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.sm,
    gap: 4,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: '#fff', letterSpacing: -0.2, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.85)', flex: 1 },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, flexWrap: 'wrap' },
  actBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radii.sm },
  actEdit: { backgroundColor: c.primary },
  actShare: { backgroundColor: 'rgba(255,255,255,0.16)' },
  actText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff' },
  manageHint: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 1 },
  manageHintText: { fontFamily: fonts.bold, fontSize: 11, color: 'rgba(255,255,255,0.9)' },
}));
