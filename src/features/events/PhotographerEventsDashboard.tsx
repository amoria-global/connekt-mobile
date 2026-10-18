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
 * Type is Pragati Narrow throughout, matching the web brand.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassOnMedia } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';
import {
  acceptEventBooking,
  declineEventBooking,
  listPhotographerEvents,
} from './api';
import type { EventItem } from './types';
import { EventQrSheet } from './EventQrSheet';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { useLanguage } from '@/store/language';

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

type ViewTab = 'events' | 'albums' | 'photobooks' | 'content';
type EventFilter = 'all' | 'pending' | 'upcoming' | 'ongoing' | 'completed';
type PhotogStatus = 'pending' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

/** Collapse the many backend status strings into the web's 5 buckets. */
function statusOf(e: EventItem): PhotogStatus {
  if ((e.bookingStatus ?? '').toUpperCase() === 'PENDING') {
    return 'pending';
  }
  switch ((e.status ?? '').toUpperCase()) {
    case 'PENDING':
    case 'PROPOSED':
    case 'ASSIGNED':
      return 'pending';
    case 'ONGOING':
    case 'IN_PROGRESS':
      return 'ongoing';
    case 'COMPLETED':
    case 'DONE':
    case 'AWAITING_REVIEW':
      return 'completed';
    case 'CANCELLED':
    case 'CANCELED':
      return 'cancelled';
    default:
      return 'upcoming';
  }
}

const STATUS_PILL: Record<PhotogStatus, { bg: string; fg: string; label: string }> = {
  pending: { bg: '#FEF3C7', fg: '#92400E', label: 'PENDING' },
  upcoming: { bg: '#FACC15', fg: '#1A2E05', label: 'UPCOMING' },
  ongoing: { bg: '#DBEAFE', fg: '#1D4ED8', label: 'ONGOING' },
  completed: { bg: '#D1FAE5', fg: '#047857', label: 'COMPLETED' },
  cancelled: { bg: '#FEE2E2', fg: '#B91C1C', label: 'CANCELLED' },
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refresh } = useAsync(listPhotographerEvents);

  const viewTabs: { key: ViewTab; label: string; icon: keyof typeof Ionicons.glyphMap; route?: Href }[] = useMemo(() => [
    { key: 'events', label: t('eventsTitle'), icon: 'calendar' },
    { key: 'albums', label: t('albums'), icon: 'images', route: '/gallery' as Href },
    { key: 'photobooks', label: t('photobooks'), icon: 'book', route: '/photobooks' as Href },
    { key: 'content', label: t('content'), icon: 'newspaper', route: '/content-albums' as Href },
  ], [t]);

  const listRef = useRef<FlatList<EventItem>>(null);
  const [view, setView] = useState<ViewTab>('events');
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

  const header = (
    <View style={{ paddingTop: topInset + spacing.xs, gap: spacing.sm }}>
      {/* Quick action view tabs: Events, Albums, Photobooks, Content */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.viewTabs}
      >
        {viewTabs.map((t) => {
          const active = view === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => (t.route ? router.push(t.route) : setView('events'))}
              style={[styles.viewTab, active && styles.viewTabActive]}
            >
              <Ionicons name={t.icon} size={15} color={active ? '#fff' : colors.textMuted} />
              <Text style={[styles.viewTabText, active && styles.viewTabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {view === 'events' ? (
        <>

          {/* Filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(['all', 'pending', 'upcoming', 'ongoing', 'completed'] as const).map((f) => {
              const active = filter === f;
              const label =
                f === 'all'
                  ? t('filterAll')
                  : f === 'pending'
                  ? t('pending')
                  : f === 'upcoming'
                  ? t('filterUpcoming')
                  : f === 'ongoing'
                  ? t('filterOngoing')
                  : t('filterCompleted');
              return (
                <Pressable
                  key={f}
                  onPress={() => setFilter(f)}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                >
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
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
          </ScrollView>

          {/* Search & Sort Row */}
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
              />
              {search ? (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            <Pressable
              style={[styles.sortBtn, sortBy !== 'newest' && styles.sortBtnActive]}
              onPress={() => setSortSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('sortEvents')}
            >
              <Ionicons
                name="swap-vertical"
                size={16}
                color={sortBy !== 'newest' ? '#fff' : colors.text}
              />
              <Text style={[styles.sortBtnText, sortBy !== 'newest' && styles.sortBtnTextActive]}>
                {t('sort')}
              </Text>
              {sortBy !== 'newest' && <View style={styles.sortActiveDot} />}
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        key="photographer-events-grid"
        data={pagedEvents}
        keyExtractor={(e) => e.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
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
          loading ? (
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

      {/* Floating Action Button — Create New Event */}
      <Pressable
        style={[
          styles.fab,
          { bottom: Math.max(insets.bottom + 84, 96) },
        ]}
        onPress={() => router.push('/event/new' as Href)}
        android_ripple={{ color: 'rgba(255,255,255,0.2)' }}
        accessibilityRole="button"
        accessibilityLabel={t('createNewEvent')}
      >
        <Ionicons name="add" size={32} color="#fff" />
      </Pressable>

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
                <Text style={styles.sortSheetTitle}>{t('sortEvents')}</Text>
                <Text style={styles.sortSheetSubtitle}>{t('chooseOrder')}</Text>
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
                        {label}
                      </Text>
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
          </Pressable>
        </Pressable>
      </Modal>
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
}: {
  event: EventItem;
  busy: boolean;
  onOpen: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onLiveStream: () => void;
  onCreateAlbum: () => void;
  onQr: () => void;
}) {
  const styles = useStyles();
  const { t } = useLanguage();
  const s = statusOf(event);
  const booking = (event.bookingStatus ?? '').toUpperCase();
  const pill = STATUS_PILL[s];
  const isPending = booking === 'PENDING';
  const isAccepted = booking === 'ACCEPTED';
  const canStream = event.hasLiveStream && (s === 'upcoming' || s === 'ongoing');
  const canCreateAlbum = s === 'completed' || isAccepted;
  const showStreamPill = event.hasLiveStream && s !== 'completed';

  return (
    <Pressable
      style={styles.card}
      onPress={onOpen}
      android_ripple={{ color: 'rgba(255,255,255,0.06)' }}
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
            <Ionicons name="calendar" size={11} color="#fff" />
            <Text style={styles.datePillText}>{fmtShortDate(event.eventDate)}</Text>
          </GlassOnMedia>
          <View style={[styles.statusPill, { backgroundColor: pill.bg }]}>
            <Text style={[styles.statusPillText, { color: pill.fg }]}>{pill.label}</Text>
          </View>
        </View>
        {showStreamPill ? (
          <GlassOnMedia style={styles.streamPill} edge>
            <Ionicons name="radio" size={11} color="#fff" />
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
            <Ionicons name="location" size={12} color="rgba(255,255,255,0.85)" />
            <Text style={styles.locText} numberOfLines={1}>
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
            <Text style={styles.clientName} numberOfLines={1}>
              {event.clientName || 'Client'}
            </Text>
          </View>
          {event.startTime ? (
            <View style={styles.timePill}>
              <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.9)" />
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
              >
                <Ionicons name="checkmark-circle" size={13} color="#fff" />
                <Text style={styles.actText}>{t('acceptBooking')}</Text>
              </Pressable>
              <Pressable
                style={[styles.actBtn, styles.actDeny, busy && styles.actBusy]}
                onPress={onDecline}
                disabled={busy}
              >
                <Ionicons name="close-circle" size={13} color="#fff" />
                <Text style={styles.actText}>{t('declineBooking')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              {canStream ? (
                <Pressable style={[styles.actBtn, styles.actStream]} onPress={onLiveStream}>
                  <Ionicons name="radio" size={13} color="#fff" />
                  <Text style={styles.actText}>{t('liveStream')}</Text>
                </Pressable>
              ) : null}
              {canCreateAlbum ? (
                <Pressable style={[styles.actBtn, styles.actAlbum]} onPress={onCreateAlbum}>
                  <Ionicons name="add-circle" size={13} color="#fff" />
                  <Text style={styles.actText}>{t('createAlbum')}</Text>
                </Pressable>
              ) : null}
              {isAccepted && event.published ? (
                <Pressable style={[styles.actBtn, styles.actQr]} onPress={onQr} accessibilityLabel="Show event QR code">
                  <Ionicons name="qr-code" size={13} color="#fff" />
                  <Text style={styles.actText}>{t('qrCode')}</Text>
                </Pressable>
              ) : null}
              {isAccepted ? (
                <View style={[styles.actBtn, styles.actAcceptedChip]}>
                  <Ionicons name="checkmark-circle" size={13} color="#fff" />
                  <Text style={styles.actText}>{t('accepted')}</Text>
                </View>
              ) : null}
              {event.packageName ? (
                <View style={styles.pkgBadge}>
                  <Ionicons name="cube" size={12} color="#fff" />
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
      <Pressable style={styles.sheetBackdrop} onPress={() => !busy && onCancel()}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <View style={styles.sheetIcon}>
            <Ionicons name="checkmark" size={30} color="#fff" />
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
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.sheetConfirmText}>{t('confirmAccept')}</Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
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
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={!!event} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.sheetBackdrop} onPress={() => !busy && onCancel()}>
        <Pressable
          style={[styles.declineSheet, { paddingBottom: Math.max(insets.bottom + spacing.md, spacing.xl) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.declineTitle}>{t('declineBookingTitle')}</Text>
          <Text style={styles.declineHint}>
            {t('declineHint')}
          </Text>
          <Input
            placeholder="e.g. Schedule conflict, location too far, etc."
            value={reason}
            onChangeText={onChangeReason}
            multiline
            style={styles.declineInput}
          />
          <Button title={t('submitDecline')} onPress={onConfirm} loading={busy} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetMeta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!text) return null;
  return (
    <View style={styles.sheetMeta}>
      <Ionicons name={icon} size={13} color={colors.accent} />
      <Text style={styles.sheetMetaText} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  columnWrapper: { gap: spacing.md },

  // Floating Action Button (New Event — big circular + without text)
  fab: {
    position: 'absolute',
    right: spacing.lg,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 20,
  },
  fabText: {
    display: 'none',
  },

  // Header
  viewTabs: { gap: 6, paddingVertical: spacing.xs },
  viewTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  viewTabActive: { backgroundColor: c.primary, borderColor: c.primary },
  viewTabText: { fontFamily: fonts.bold, fontSize: 14, color: c.textMuted },
  viewTabTextActive: { color: '#fff' },

  // Filters
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
  filterBadge: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: 'rgba(8,58,133,0.10)',
    alignItems: 'center',
  },
  filterBadgeActive: { backgroundColor: 'rgba(255,255,255,0.24)' },
  filterBadgeText: { fontFamily: fonts.bold, fontSize: 12, color: c.primary },
  filterBadgeTextActive: { color: '#fff' },

  // Search & Sort Row
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
    color: '#fff',
  },
  sortActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  searchInput: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: c.text, padding: 0 },

  // Card (2-column responsive)
  card: {
    flex: 1,
    minHeight: 260,
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#071224',
    borderWidth: 1,
    borderColor: c.borderSoft,
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
  datePillText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#fff' },
  statusPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radii.full },
  statusPillText: { fontFamily: fonts.bold, fontSize: 9.5, letterSpacing: 0.3 },
  streamPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  streamPillText: { fontFamily: fonts.bold, fontSize: 9, color: '#fff', letterSpacing: 0.3 },

  cardBottom: {
    backgroundColor: 'rgba(3, 8, 20, 0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    padding: spacing.sm,
    gap: 4,
  },
  cardTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: '#fff', letterSpacing: -0.2, lineHeight: 18 },
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
  avatarInitial: { fontFamily: fonts.bold, fontSize: 9.5, color: '#fff' },
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
  actText: { fontFamily: fonts.bold, fontSize: 11, color: '#fff' },
  actBusy: { opacity: 0.6 },
  actAccept: { backgroundColor: '#10B981', flex: 1 },
  actDeny: { backgroundColor: '#EF4444', flex: 1 },
  actStream: { backgroundColor: '#8B5CF6' },
  actAlbum: { backgroundColor: c.primary },
  actAcceptedChip: { backgroundColor: '#10B981' },
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
  pkgText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#fff' },

  // Accept sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(4,10,26,0.6)', justifyContent: 'flex-end' },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  sheetIcon: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sheetEyebrow: { fontFamily: fonts.bold, fontSize: 11, color: '#10B981', letterSpacing: 1 },
  sheetTitle: { fontFamily: fonts.bold, fontSize: 22, color: c.text },
  sheetCard: {
    alignSelf: 'stretch',
    backgroundColor: c.background,
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
  sheetTermsText: { flex: 1, fontFamily: fonts.regular, fontSize: 13, color: c.primary, lineHeight: 18 },
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
  sheetCancel: { backgroundColor: c.surfaceMuted },
  sheetCancelText: { fontFamily: fonts.bold, fontSize: 15, color: c.textSoft },
  sheetConfirm: { backgroundColor: '#10B981' },
  sheetConfirmText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },

  // Decline sheet
  declineSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  declineTitle: { fontFamily: fonts.bold, fontSize: 20, color: c.text },
  declineHint: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted, lineHeight: 20 },
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
    color: c.primary,
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
