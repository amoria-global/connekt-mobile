/**
 * Photographer "Events & albums" dashboard — mobile port of
 * salo-run/app/pages/photographer/events.tsx.
 *
 * Matches the web layout 1:1, adapted for a phone:
 *   • Header: "LIBRARY" eyebrow → "Events & albums" → subtitle.
 *   • View toggle: Events / Albums / Photobooks / Content.
 *   • Stat strip: Total / Upcoming / Ongoing / Completed (accent-topped
 *     cards, horizontally scrollable).
 *   • Filter pills (All / Upcoming / Ongoing / Completed) with live count
 *     badges + a search box.
 *   • Dark, image-led event cards with the same overlays and per-status
 *     CTAs the web card exposes: Accept / Deny (pending), Live Stream,
 *     Create Album, Accepted chip, and the package badge.
 *   • Accept-booking confirmation sheet (green header, event summary,
 *     escrow note, Confirm Accept).
 *
 * Midnight Glass (design/events.png): a large title with search, Help and Create; underline
 * library tabs; the layout switch; filter chips that hide while they would say "0"; then the
 * schedule. Cards on photographs keep fixed light-on-dark text (`onMedia`), and colour means
 * what it means everywhere: blue action, magenta attention, cyan live, amber pending.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
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
import { Alert } from '@/components/ui/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassOnMedia, glassTile } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { ScheduleView, type ScheduleMode } from '@/features/photographer/ScheduleView';
import { bucketOf } from '@/features/photographer/schedule';
import { SegmentedTabs } from '@/features/photographer/kit';
import { alpha, darkPalette, spacing, radii, fonts, makeStyles, onMedia, shadows, tracking, useTheme, type Palette } from '@/theme';
import { HeaderHelpButton } from '@/components/help/HeaderHelpButton';
import { StatusChip, type ChipTone } from '@/components/ui/StatusChip';
import { formatDate } from '@/utils/format';
import {
  acceptEventBooking,
  declineEventBooking,
  dismissPhotographerEvent,
  listPhotographerEvents,
} from './api';
import type { EventItem } from './types';
import { Sheet } from '@/components/ui/Sheet';
import { EventQrSheet } from './EventQrSheet';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { useLanguage } from '@/store/language';
import { useTabBarClearance } from '@/hooks/useScrollClearance';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

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
    label: 'Title (A to Z)',
    description: 'Alphabetical order by event name',
    icon: 'text-outline',
  },
];

type ViewTab = 'events' | 'albums' | 'photobooks' | 'content';
type EventFilter = 'all' | 'pending' | 'upcoming' | 'ongoing' | 'completed';
type PhotogStatus = 'pending' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

/** Same buckets as the schedule view, so the list and the calendar never disagree. */
const statusOf = (e: EventItem): PhotogStatus => bucketOf(e);

const STATUS_LABEL: Record<PhotogStatus, string> = {
  pending: 'PENDING',
  upcoming: 'UPCOMING',
  ongoing: 'ONGOING',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

/** A bucket's meaning as a colour: amber pending, blue scheduled, cyan live, green done, red cancelled. */
const statusColor = (c: Palette, s: PhotogStatus) =>
  ({ pending: c.pending, upcoming: c.primaryLight, ongoing: c.active, completed: c.success, cancelled: c.error })[s];

const FILTER_TONE: Record<EventFilter, ChipTone> = {
  all: 'primary',
  pending: 'pending',
  upcoming: 'primary',
  ongoing: 'active',
  completed: 'success',
};

/** "8:20 PM" from an "HH:mm[:ss]" or ISO time. */
function fmtTime(t?: string): string {
  if (!t) return '';
  const hm = /^(\d{1,2}):(\d{2})/.exec(t);
  let h: number;
  let m: number;
  if (hm) {
    h = Number(hm[1]);
    m = Number(hm[2]);
  } else {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return '';
    h = d.getHours();
    m = d.getMinutes();
  }
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

/** "Jun 26, 2026" (screenshot style). */
function fmtShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Events is the in-place default; the other three link to their existing
// (or newly-created) library screens.
const VIEW_TABS: { key: ViewTab; label: string; icon: keyof typeof Ionicons.glyphMap; route?: Href }[] = [
  { key: 'events', label: 'Events', icon: 'calendar' },
  { key: 'albums', label: 'Albums', icon: 'images', route: '/gallery' as Href },
  { key: 'photobooks', label: 'Photobooks', icon: 'book', route: '/photobooks' as Href },
  { key: 'content', label: 'Content', icon: 'newspaper', route: '/content-albums' as Href },
];

export function PhotographerEventsDashboard({ topInset = 0 }: { topInset?: number }) {
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const clearance = useTabBarClearance();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(listPhotographerEvents);

  const viewTabs: { key: ViewTab; label: string; icon: keyof typeof Ionicons.glyphMap; route?: Href }[] = useMemo(() => [
    { key: 'events', label: t('eventsTitle'), icon: 'calendar' },
    { key: 'albums', label: t('albums'), icon: 'images', route: '/gallery' as Href },
    { key: 'photobooks', label: t('photobooks'), icon: 'book', route: '/photobooks' as Href },
    { key: 'content', label: t('content'), icon: 'newspaper', route: '/content-albums' as Href },
  ], [t]);

  const listRef = useRef<FlatList<EventItem>>(null);
  const [view, setView] = useState<ViewTab>('events');
  // Schedule (calendar) is the default workspace; List keeps the paginated card grid.
  // One switch for the whole events view: the three calendar modes or the original list.
  const [layout, setLayout] = useState<ScheduleMode | 'list'>('week');
  const [filter, setFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<EventSortOption>('newest');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<EventItem | null>(null);
  const [declineTarget, setDeclineTarget] = useState<EventItem | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<EventItem | null>(null);

  const events = data ?? [];

  const counts = useMemo(() => {
    const c = { all: events.length, pending: 0, upcoming: 0, ongoing: 0, completed: 0 };
    for (const e of events) {
      const s = statusOf(e);
      if (s === 'pending') c.pending += 1;
      else if (s === 'upcoming') c.upcoming += 1;
      else if (s === 'ongoing') c.ongoing += 1;
      else if (s === 'completed') c.completed += 1;
    }
    return c;
  }, [events]);

  const [page, setPage] = useState(1);

  // Reset to first page when filtering, searching or sorting
  useEffect(() => {
    setPage(1);
  }, [filter, search, sortBy]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      const s = statusOf(e);
      if (filter !== 'all' && s !== filter) return false;
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.clientName ?? '').toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q)
      );
    });
  }, [events, filter, search]);

  const sortedAndFiltered = useMemo(() => {
    const list = [...filtered];
    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
      case 'oldest':
        return list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeA - timeB;
        });
      case 'date_asc':
        return list.sort((a, b) => {
          const parseTime = (item: EventItem) => {
            if (!item.eventDate) return 0;
            const dateStr = item.eventDate.includes('T')
              ? item.eventDate
              : `${item.eventDate}T${item.startTime || '00:00'}:00`;
            const t = new Date(dateStr).getTime();
            return Number.isNaN(t) ? new Date(item.eventDate).getTime() || 0 : t;
          };
          return parseTime(a) - parseTime(b);
        });
      case 'title_asc':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      default:
        return list;
    }
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedAndFiltered.length / PAGE_SIZE));

  const pagedEvents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedAndFiltered.slice(start, start + PAGE_SIZE);
  }, [sortedAndFiltered, page]);

  const goToPage = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const onAcceptConfirmed = async (e: EventItem) => {
    setBusyId(e.id);
    try {
      await acceptEventBooking(e.id);
      setAcceptTarget(null);
      refresh();
    } catch {
      Alert.alert('Could not accept', 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const onDeclineConfirmed = async (e: EventItem) => {
    setBusyId(e.id);
    try {
      await declineEventBooking(e.id, declineReason);
      setDeclineTarget(null);
      setDeclineReason('');
      refresh();
    } catch {
      Alert.alert('Could not decline', 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  // Soft-hides a finished event, as the web's "Dismiss Event" does. Only completed or cancelled events offer it, so a
  // booking that still needs work can never be tucked away by a stray tap.
  const onDismissEvent = (e: EventItem) => {
    Alert.alert('Remove this event?', `"${e.title}" will disappear from your list. The client and the event are not affected.`, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusyId(e.id);
          try {
            await dismissPhotographerEvent(e.id);
            refresh();
          } catch (err) {
            Alert.alert('Could not remove', isApiError(err) ? err.message : 'Please try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  /**
   * Streaming and albums both hang off the public event page, so the backend
   * only accepts them once the event is published. The photographer can't
   * publish it themselves — that's the event creator's call — so say so.
   */
  const requirePublished = (e: EventItem, action: string): boolean => {
    if (e.published) return true;
    Alert.alert(
      'Event not published yet',
      `${action} is only available for published events. Ask the event creator to publish "${e.title}" first.`,
    );
    return false;
  };

  const onLiveStream = (e: EventItem) => {
    if (!requirePublished(e, 'Live streaming')) return;
    router.push(`/stream/control/${e.id}` as Href);
  };

  const onCreateAlbum = (e: EventItem) => {
    if (!requirePublished(e, 'Album creation')) return;
    router.push(`/album/new?eventId=${e.id}` as Href);
  };

  const scheduleMode = view === 'events' && layout !== 'list';

  const [searchOpen, setSearchOpen] = useState(false);
  const filterLabel = (f: EventFilter) =>
    f === 'all'
      ? t('filterAll')
      : f === 'pending'
        ? t('pending')
        : f === 'upcoming'
          ? t('filterUpcoming')
          : f === 'ongoing'
            ? t('filterOngoing')
            : t('filterCompleted');

  const header = (
    <View style={{ paddingTop: topInset + spacing.sm, gap: spacing.md }}>
      {/* Large title: search, Help and Create stay one tap away, nothing floats over a card. */}
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {t('eventsTitle')}
        </Text>
        {view === 'events' ? (
          <Pressable
            onPress={() => setSearchOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel={t('searchEventsPlaceholder')}
            accessibilityState={{ expanded: searchOpen || !!search }}
            style={({ pressed }) => [styles.roundBtn, pressed && styles.pressed]}
          >
            <Ionicons name="search" size={20} color={colors.text} />
          </Pressable>
        ) : null}
        <HeaderHelpButton />
        <Pressable
          onPress={() => router.push('/event/new' as Href)}
          accessibilityRole="button"
          accessibilityLabel="Create new event"
          style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}
        >
          <Ionicons name="add" size={24} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      {/* Library tabs: Events here, the other three open their screens. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewTabs}>
        {viewTabs.map((tab) => {
          const active = view === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => (tab.route ? router.push(tab.route) : setView('events'))}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={styles.viewTab}
            >
              <Text style={[styles.viewTabText, active && styles.viewTabTextActive]}>{tab.label}</Text>
              <View style={[styles.viewTabRule, active && styles.viewTabRuleOn]} />
            </Pressable>
          );
        })}
      </ScrollView>

      {view === 'events' ? (
        <>
          {/* The kit's blocks carry their own side margins; cancel this list's padding. */}
          <View style={{ marginHorizontal: -spacing.lg }}>
            <SegmentedTabs
              label="Events layout"
              value={layout}
              onChange={setLayout}
              tabs={[
                { key: 'month', label: 'Month' },
                { key: 'week', label: 'Week' },
                { key: 'agenda', label: 'Agenda' },
                { key: 'list', label: 'List' },
              ]}
            />
          </View>

          {/* Filter chips with live counts. A bucket with nothing in it is left out rather than shown as "0", unless
              it is the one selected, so the row never spends space saying nothing. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {(['all', 'pending', 'upcoming', 'ongoing', 'completed'] as const)
              .filter((f) => f === 'all' || f === filter || !data || counts[f] > 0)
              .map((f) => (
                <StatusChip
                  key={f}
                  label={filterLabel(f)}
                  tone={FILTER_TONE[f]}
                  dot={f === 'ongoing'}
                  count={data ? counts[f] : undefined}
                  selected={filter === f}
                  onPress={() => setFilter(f)}
                />
              ))}
          </ScrollView>

          {searchOpen || search || !scheduleMode ? (
            <View style={styles.searchRow}>
              <View style={styles.search}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder={t('searchEventsPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={searchOpen && !search}
                />
                {search ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
                    <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>

              {/* Sorting means nothing on a calendar, so only List mode shows it. */}
              {scheduleMode ? null : (
                <Pressable
                  style={[styles.sortBtn, sortBy !== 'newest' && styles.sortBtnActive]}
                  onPress={() => setSortSheetOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('sortEvents')}
                >
                  <Ionicons name="swap-vertical" size={16} color={sortBy !== 'newest' ? colors.textOnPrimary : colors.text} />
                  <Text style={[styles.sortBtnText, sortBy !== 'newest' && styles.sortBtnTextActive]}>{t('sort')}</Text>
                  {sortBy !== 'newest' && <View style={styles.sortActiveDot} />}
                </Pressable>
              )}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  const headerWithSchedule = scheduleMode ? (
    <View style={{ gap: spacing.md }}>
      {header}
      {loading && !data ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : error && !data ? (
        <View style={{ paddingTop: spacing.md }}>
          <EmptyState icon="cloud-offline-outline" title="Couldn't load events" message={error} />
        </View>
      ) : (
        <View style={{ marginHorizontal: -spacing.lg }}>
          <ScheduleView
            mode={layout}
            onModeChange={setLayout}
            events={filtered}
            allEvents={events}
            busyId={busyId}
            onOpen={(e) => router.push(`/event/${e.id}` as Href)}
            onAccept={(e) => setAcceptTarget(e)}
            onDecline={(e) => setDeclineTarget(e)}
            onCreate={() => router.push('/event/new' as Href)}
          />
        </View>
      )}
    </View>
  ) : (
    header
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        key="photographer-events-grid"
        data={scheduleMode ? [] : pagedEvents}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ItemSeparatorComponent={ListGap}
        ListHeaderComponent={headerWithSchedule}
        contentContainerStyle={[styles.listContent, { paddingBottom: clearance }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <PhotographerEventCard
            event={item}
            busy={busyId === item.id}
            onOpen={() => router.push(`/event/${item.id}` as Href)}
            onAccept={() => setAcceptTarget(item)}
            onDecline={() => setDeclineTarget(item)}
            onLiveStream={() => onLiveStream(item)}
            onCreateAlbum={() => onCreateAlbum(item)}
            onQr={() => setQrTarget(item)}
            onDismiss={() => onDismissEvent(item)}
          />
        )}
        ListFooterComponent={
          !scheduleMode && sortedAndFiltered.length > 0 ? (
            <View style={styles.paginationFooter}>
              <View style={styles.pagerBar}>
                <Pressable
                  style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
                  onPress={() => goToPage(page - 1)}
                  disabled={page <= 1}
                  accessibilityRole="button"
                  accessibilityLabel={t('previous')}
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
                    {t('previous')}
                  </Text>
                </Pressable>

                <View style={styles.pagerIndicator}>
                  <Text style={styles.pagerIndicatorText}>
                    {t('pageOf', { page, total: totalPages })}
                  </Text>
                  <Text style={styles.pagerTotalText}>
                    ({sortedAndFiltered.length === 1 ? t('singleEventCount', { count: 1 }) : t('eventsCount', { count: sortedAndFiltered.length })})
                  </Text>
                </View>

                <Pressable
                  style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
                  onPress={() => goToPage(page + 1)}
                  disabled={page >= totalPages}
                  accessibilityRole="button"
                  accessibilityLabel={t('next')}
                >
                  <Text
                    style={[
                      styles.pagerBtnText,
                      page >= totalPages && styles.pagerBtnTextDisabled,
                    ]}
                  >
                    {t('next')}
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
          scheduleMode ? null : loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : error ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState icon="cloud-offline-outline" title={t('couldNotLoadEvents')} message={t('pullToRefresh')} />
            </View>
          ) : (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState
                icon="calendar-outline"
                title={search || filter !== 'all' ? t('noMatchingEvents') : t('noEventsYet')}
                message={
                  search || filter !== 'all'
                    ? t('tryDifferentFilter')
                    : t('eventsBookedAppear')
                }
              />
            </View>
          )
        }
      />

      <EventQrSheet
        visible={!!qrTarget}
        onClose={() => setQrTarget(null)}
        eventId={qrTarget?.id ?? ''}
        title={qrTarget?.title ?? ''}
        published={!!qrTarget?.published}
      />

      <AcceptBookingSheet
        event={acceptTarget}
        busy={busyId === acceptTarget?.id}
        onCancel={() => setAcceptTarget(null)}
        onConfirm={() => acceptTarget && onAcceptConfirmed(acceptTarget)}
      />

      <DeclineBookingSheet
        event={declineTarget}
        reason={declineReason}
        onChangeReason={setDeclineReason}
        busy={busyId === declineTarget?.id}
        onCancel={() => {
          setDeclineTarget(null);
          setDeclineReason('');
        }}
        onConfirm={() => declineTarget && onDeclineConfirmed(declineTarget)}
      />

      {/* Sort options: the shared Sheet scrolls, so large text or a short phone never cuts off the last option. */}
      <Sheet
        visible={sortSheetOpen}
        title={t('sortEvents')}
        subtitle={t('chooseOrder')}
        onClose={() => setSortSheetOpen(false)}
      >
        <View style={styles.sortOptionsList}>
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.key;
            const label =
              opt.key === 'newest'
                ? t('newestCreatedFirst')
                : opt.key === 'oldest'
                ? t('oldestCreatedFirst')
                : opt.key === 'date_asc'
                ? t('eventDateUpcomingFirst')
                : t('titleAZ');
            const description =
              opt.key === 'newest'
                ? t('newestCreatedDesc')
                : opt.key === 'oldest'
                ? t('oldestCreatedDesc')
                : opt.key === 'date_asc'
                ? t('eventDateUpcomingDesc')
                : t('titleAZDesc');
            return (
              <Pressable
                key={opt.key}
                style={[styles.sortOptionItem, active && styles.sortOptionItemActive]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${label}. ${description}`}
                onPress={() => {
                  setSortBy(opt.key);
                  setSortSheetOpen(false);
                }}
              >
                <View style={[styles.sortOptionIconBox, active && styles.sortOptionIconBoxActive]}>
                  <Ionicons name={opt.icon} size={18} color={active ? colors.textOnPrimary : colors.link} />
                </View>
                <View style={styles.sortOptionTextCol}>
                  <Text style={[styles.sortOptionLabel, active && styles.sortOptionLabelActive]}>{label}</Text>
                  <Text style={styles.sortOptionDesc}>{description}</Text>
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
      </Sheet>
    </View>
  );
}

// ─── Event card ──────────────────────────────────────────────────────────

function PhotographerEventCard({
  event,
  busy,
  onOpen,
  onAccept,
  onDecline,
  onLiveStream,
  onCreateAlbum,
  onQr,
  onDismiss,
}: {
  event: EventItem;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onLiveStream: () => void;
  onCreateAlbum: () => void;
  onQr: () => void;
  onDismiss: () => void;
}) {
  const styles = useStyles();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const s = statusOf(event);
  const booking = (event.bookingStatus ?? '').toUpperCase();
  const isPending = booking === 'PENDING';
  const isAccepted = booking === 'ACCEPTED';
  const canStream = event.hasLiveStream && (s === 'upcoming' || s === 'ongoing');
  const canCreateAlbum = s === 'completed' || isAccepted;
  const showStreamPill = event.hasLiveStream && s !== 'completed';

  return (
    <Pressable
      style={styles.card}
      onPress={onOpen}
      android_ripple={{ color: onMedia.glass }}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${STATUS_LABEL[s].toLowerCase()}`}
    >
      <Image
        source={event.coverImage ? { uri: event.coverImage } : EVENT_COVER_PLACEHOLDER}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={200}
      />
      {/* Solid dark scrim overlay (no gradients) */}
      <View style={styles.cardScrim} />

      {/* Top row: date + status (left), stream (right) */}
      <View style={styles.cardTop}>
        <View style={styles.topLeft}>
          <GlassOnMedia style={styles.datePill} edge>
            <Ionicons name="calendar" size={11} color={onMedia.text} />
            <Text style={styles.datePillText}>{fmtShortDate(event.eventDate)}</Text>
          </GlassOnMedia>
          <GlassOnMedia style={styles.statusPill} edge>
            <View style={[styles.statusDot, { backgroundColor: statusColor(colors, s) }]} />
            <Text style={styles.statusPillText}>{STATUS_LABEL[s]}</Text>
          </GlassOnMedia>
        </View>
        {showStreamPill ? (
          <GlassOnMedia style={styles.streamPill} edge>
            <Ionicons name="radio" size={11} color={onMedia.text} />
            <Text style={styles.streamPillText}>STREAM</Text>
          </GlassOnMedia>
        ) : null}
      </View>

      {/* Bottom content */}
      <GlassOnMedia style={styles.cardBottom} intensity={40}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {event.title}
        </Text>
        {event.location ? (
          <View style={styles.locRow}>
            <Ionicons name="location" size={12} color={onMedia.soft} />
            <Text style={styles.locText} numberOfLines={2}>
              {event.location}
            </Text>
          </View>
        ) : null}

        {/* Client + time strip */}
        <View style={styles.clientRow}>
          <View style={styles.clientLeft}>
            {event.clientAvatar ? (
              <Image source={{ uri: event.clientAvatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {(event.clientName || 'C').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.clientName} numberOfLines={2}>
              {event.clientName || 'Client'}
            </Text>
          </View>
          {event.startTime ? (
            <View style={styles.timePill}>
              <Ionicons name="time-outline" size={12} color={onMedia.soft} />
              <Text style={styles.timeText}>{fmtTime(event.startTime)}</Text>
            </View>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {isPending ? (
            <>
              <Pressable
                style={[styles.actBtn, styles.actAccept, busy && styles.actBusy]}
                onPress={onAccept}
                disabled={busy}
                accessibilityRole="button"
              >
                <Ionicons name="checkmark-circle" size={13} color={onMedia.text} />
                <Text style={styles.actText}>{t('acceptBooking')}</Text>
              </Pressable>
              <Pressable
                style={[styles.actBtn, styles.actDeny, busy && styles.actBusy]}
                onPress={onDecline}
                disabled={busy}
                accessibilityRole="button"
              >
                <Ionicons name="close-circle" size={13} color={onMedia.text} />
                <Text style={styles.actText}>{t('declineBooking')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {canStream ? (
                <Pressable style={[styles.actBtn, styles.actStream]} onPress={onLiveStream} accessibilityRole="button">
                  <Ionicons name="radio" size={13} color={colors.active} />
                  <Text style={styles.actText}>{t('liveStream')}</Text>
                </Pressable>
              ) : null}
              {canCreateAlbum ? (
                <Pressable style={[styles.actBtn, styles.actAlbum]} onPress={onCreateAlbum}>
                  <Ionicons name="add-circle" size={13} color={onMedia.text} />
                  <Text style={styles.actText}>{t('createAlbum')}</Text>
                </Pressable>
              ) : null}
              {isAccepted && event.published ? (
                <Pressable style={[styles.actBtn, styles.actQr]} onPress={onQr} accessibilityLabel="Show event QR code">
                  <Ionicons name="qr-code" size={13} color={onMedia.text} />
                  <Text style={styles.actText}>{t('qrCode')}</Text>
                </Pressable>
              ) : null}
              {s === 'completed' || s === 'cancelled' ? (
                <Pressable
                  style={[styles.actBtn, styles.actQr, busy && styles.actBusy]}
                  onPress={onDismiss}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${event.title} from my list`}
                >
                  <Ionicons name="eye-off-outline" size={13} color={onMedia.text} />
                  <Text style={styles.actText}>Remove</Text>
                </Pressable>
              ) : null}
              {isAccepted ? (
                <View style={[styles.actBtn, styles.actAcceptedChip]}>
                  <Ionicons name="checkmark-circle" size={13} color={colors.success} />
                  <Text style={styles.actText}>{t('accepted')}</Text>
                </View>
              ) : null}
              {event.packageName ? (
                <View style={styles.pkgBadge}>
                  <Ionicons name="cube" size={12} color={onMedia.text} />
                  <Text style={styles.pkgText}>{event.packageName}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </GlassOnMedia>
    </Pressable>
  );
}

// ─── Accept-booking confirmation sheet ───────────────────────────────────

function AcceptBookingSheet({
  event,
  busy,
  onCancel,
  onConfirm,
}: {
  event: EventItem | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const styles = useStyles();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!event} transparent animationType="slide" onRequestClose={onCancel}>
      <GlassScrim style={styles.sheetBackdrop} onPress={() => !busy && onCancel()}>
        <GlassSheetHost
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) }]}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetIcon}>
            <Ionicons name="checkmark" size={30} color={colors.textOnPrimary} />
          </View>
          <Text style={styles.sheetEyebrow}>{t('confirmAcceptance')}</Text>
          <Text style={styles.sheetTitle}>{t('acceptBookingTitle')}</Text>

          {event ? (
            <View style={styles.sheetCard}>
              <Text style={styles.sheetCardEyebrow}>EVENT</Text>
              <Text style={styles.sheetEventTitle}>{event.title}</Text>
              <View style={styles.sheetMetaGrid}>
                <SheetMeta icon="calendar-outline" text={fmtShortDate(event.eventDate)} />
                <SheetMeta
                  icon="time-outline"
                  text={[fmtTime(event.startTime), fmtTime(event.endTime)].filter(Boolean).join(' · ')}
                />
                {event.clientName ? <SheetMeta icon="person-outline" text={event.clientName} /> : null}
                {event.location ? <SheetMeta icon="location-outline" text={event.location} /> : null}
                {event.packageName ? <SheetMeta icon="cube-outline" text={event.packageName} /> : null}
              </View>
            </View>
          ) : null}

          <View style={styles.sheetTerms}>
            <Ionicons name="shield-checkmark" size={15} color={colors.primary} />
            <Text style={styles.sheetTermsText}>
              {t('escrowNote')}
            </Text>
          </View>

          <Text style={styles.sheetNote}>
            {t('availabilityNote')}
          </Text>

          <View style={styles.sheetActions}>
            <Pressable style={[styles.sheetBtn, styles.sheetCancel]} onPress={onCancel} disabled={busy}>
              <Text style={styles.sheetCancelText}>{t('cancel')}</Text>
            </Pressable>
            <Pressable style={[styles.sheetBtn, styles.sheetConfirm]} onPress={onConfirm} disabled={busy}>
              {busy ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color={colors.textOnPrimary} />
                  <Text style={styles.sheetConfirmText}>{t('confirmAccept')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </GlassSheetHost>
      </GlassScrim>
    </Modal>
  );
}

// ─── Decline-booking reason sheet ────────────────────────────────────────

function DeclineBookingSheet({
  event,
  reason,
  onChangeReason,
  busy,
  onCancel,
  onConfirm,
}: {
  event: EventItem | null;
  reason: string;
  onChangeReason: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const styles = useStyles();
  const { t } = useLanguage();

  return (
    <Sheet
      visible={!!event}
      title={t('declineBookingTitle')}
      subtitle={`Share a short reason so ${event?.clientName || 'the client'} knows why you're not taking this on.`}
      onClose={onCancel}
      busy={busy}
      footer={<Button title={t('submitDecline')} onPress={onConfirm} loading={busy} />}
    >
      <Input
        placeholder="e.g. Schedule conflict, location too far, etc."
        value={reason}
        onChangeText={onChangeReason}
        multiline
        style={styles.declineInput}
      />
    </Sheet>
  );
}

function SheetMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!text) return null;
  return (
    <View style={styles.sheetMeta}>
      <Ionicons name={icon} size={13} color={colors.accent} />
      <Text style={styles.sheetMetaText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg },
  columnWrapper: { gap: spacing.md },


  // Header
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { flex: 1, color: c.text, fontSize: 34, fontFamily: fonts.display, letterSpacing: tracking(34, -0.03) },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: c.glassTop,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Flat blue with the raised family's highlight: the day's empty state carries the screen's one raised button.
  createBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    boxShadow: shadows.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  viewTabs: { gap: spacing.xl, borderBottomWidth: 1, borderBottomColor: c.stroke, minWidth: '100%' },
  viewTab: { minHeight: 44, justifyContent: 'flex-end', gap: spacing.sm },
  viewTabText: { fontFamily: fonts.medium, fontSize: 16, color: c.textMuted },
  viewTabTextActive: { color: c.text, fontFamily: fonts.semibold },
  viewTabRule: { height: 2, borderRadius: 1, backgroundColor: 'transparent' },
  viewTabRuleOn: { backgroundColor: c.primaryLight },

  filterRow: { gap: spacing.sm, paddingVertical: 4 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xs,
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
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  sortBtnActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  sortBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
  },
  sortBtnTextActive: {
    color: c.textOnPrimary,
  },
  sortActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.textOnPrimary,
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.text, padding: 0 },

  // Card (2-column responsive)
  card: {
    flex: 1,
    minHeight: 260,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: onMedia.ground,
    borderWidth: 1,
    borderColor: c.stroke,
    justifyContent: 'space-between',
  },
  cardScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(5, 12, 28, 0.45)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.sm,
    gap: 4,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1, flexWrap: 'wrap' },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: radii.full,
  },
  datePillText: { fontFamily: fonts.bold, fontSize: 10.5, color: onMedia.text },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.full, backgroundColor: onMedia.smoke },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontFamily: fonts.semibold, fontSize: 9.5, letterSpacing: 0.4, color: onMedia.text },
  streamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  streamPillText: { fontFamily: fonts.bold, fontSize: 9, color: onMedia.text, letterSpacing: 0.3 },

  cardBottom: {
    backgroundColor: 'rgba(3, 8, 20, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.sm,
    gap: 4,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: onMedia.text, letterSpacing: -0.2, lineHeight: 18 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locText: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.85)', flex: 1 },

  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  clientLeft: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 },
  avatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  avatarFallback: { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.bold, fontSize: 9.5, color: onMedia.text },
  clientName: { fontFamily: fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.9)', flexShrink: 1 },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  timeText: { fontFamily: fonts.bold, fontSize: 10, color: 'rgba(255,255,255,0.95)' },

  actions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  actBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  actText: { fontFamily: fonts.bold, fontSize: 11, color: onMedia.text },
  actBusy: { opacity: 0.6 },
  // Blue is the action; declining and the rest are glass on the photograph, so only one control is filled.
  actAccept: { backgroundColor: c.primary, flex: 1 },
  actDeny: { backgroundColor: onMedia.glass, borderWidth: 1, borderColor: onMedia.faint, flex: 1 },
  actStream: { backgroundColor: onMedia.glass, borderWidth: 1, borderColor: c.active },
  actAlbum: { backgroundColor: c.primary },
  actAcceptedChip: { backgroundColor: onMedia.glass },
  actQr: { backgroundColor: 'rgba(255,255,255,0.16)' },
  pkgBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  pkgText: { fontFamily: fonts.bold, fontSize: 10.5, color: onMedia.text },

  // Accept sheet
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheet: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  sheetIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: c.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sheetEyebrow: { fontFamily: fonts.bold, fontSize: 11, color: c.success, letterSpacing: 1 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 22, color: c.text },
  sheetCard: {
    alignSelf: 'stretch',
    ...glassTile(c),
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.sm,
    gap: 6,
  },
  sheetCardEyebrow: { fontFamily: fonts.bold, fontSize: 10, color: c.accent, letterSpacing: 1 },
  sheetEventTitle: { fontFamily: fonts.bold, fontSize: 18, color: c.text },
  sheetMetaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '46%' },
  sheetMetaText: { fontFamily: fonts.regular, fontSize: 13, color: c.textSoft, flex: 1 },
  sheetTerms: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: c.infoBg,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  sheetTermsText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: c.link, lineHeight: 18 },
  sheetNote: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
  sheetActions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: spacing.lg },
  sheetBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radii.md,
  },
  sheetCancel: { ...glassTile(c) },
  sheetCancelText: { fontFamily: fonts.bold, fontSize: 15, color: c.textSoft },
  sheetConfirm: { backgroundColor: c.primary, boxShadow: shadows.highlight },
  sheetConfirmText: { fontFamily: fonts.bold, fontSize: 15, color: c.textOnPrimary },

  // Decline sheet
  declineInput: { height: 90, paddingTop: spacing.md, textAlignVertical: 'top' },

  // Pagination footer & pager bar
  paginationFooter: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'stretch',
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
  },
  pagerBtnDisabled: {
    opacity: 0.35,
  },
  pagerBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
  },
  pagerBtnTextDisabled: {
    color: c.textMuted,
  },
  pagerIndicator: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerIndicatorText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textSoft,
  },
  pagerIndicatorBold: {
    fontFamily: fonts.bold,
    color: c.text,
  },
  pagerTotalText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
    marginTop: 2,
  },

  // Sort Sheet
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
  sortSheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
  },
  sortSheetSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    marginTop: 2,
  },
  sortSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortOptionsList: {
    gap: spacing.sm,
  },
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
  sortOptionIconBoxActive: {
    backgroundColor: c.primary,
  },
  sortOptionTextCol: {
    flex: 1,
    gap: 2,
  },
  sortOptionLabel: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  sortOptionLabelActive: {
    color: c.link,
  },
  sortOptionDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  sortOptionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
}));

/** Module level, so the list keeps one separator type and does not remount every gap on each render. */
function ListGap() {
  return <View style={{ height: spacing.md }} />;
}
