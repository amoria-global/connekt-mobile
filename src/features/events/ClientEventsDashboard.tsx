/**
 * ClientEventsDashboard: the client's Events tab.
 *
 * Bookings can be browsed as a list or in the Month / Week / Agenda calendar views, with an
 * event-status ring summary at the top, under three light controls: a title row with
 * "New", filter chips with counts, and search with sort. There is no floating button
 * (it covered the last card and the pager).
 *
 * Every action the old coordinator-shared list had is kept: open, edit, share, QR for a
 * published event, the hybrid "Choose" and "Post" steps, create (direct or hybrid), find
 * a photographer, explore events.
 *
 * `coordinator` runs the same screen over the coordinator's own feed: Photographers and Geo pricing replace
 * Explore events, each card also names the client, and the primary action manages the event (where the
 * stream is controlled) instead of opening the client's viewing room. Nothing is added to or removed from
 * what a coordinator could already do.
 *
 * A failed read is an error with a retry, never "No events yet". A failed refresh keeps
 * the last list on screen and says so.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookingModeSelector, type ExistingHybridEvent } from '@/features/booking/BookingModeSelector';
import { ExploreChoiceSheet } from '@/features/hybrid/ExploreChoiceSheet';
import { ModeBadge, friendlyEventStatus, isOpenHybrid, modeOf } from '@/features/hybrid/hybridUi';
import { env } from '@/config/env';
import { useAsync } from '@/hooks/useAsync';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import {
  ActionButton,
  Chip,
  EmptyNote,
  ErrorNotice,
  SegmentedTabs,
  SkeletonCard,
  StatusBadge,
} from '@/features/photographer/kit';
import { ScheduleView, type ScheduleMode } from '@/features/photographer/ScheduleView';
import { StatusBreakdownCard, type BreakdownSegment } from '@/features/client/ClientCharts';
import { isLiveNow } from '@/features/client/homeModel';
import { LiveButton, LivePill, LiveTwinkle } from '@/components/ui/live';
import { clock12, dayKey, eventDay } from '@/features/photographer/schedule';
import { formatDate } from '@/utils/format';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { listCoordinatorEvents, listEvents } from './api';
import { EventQrSheet } from './EventQrSheet';
import type { EventItem } from './types';
import {
  FILTERS,
  countByFilter,
  eventStatus,
  filterEvents,
  sortEvents,
  visibleSlice,
  type EventFilter,
  type EventSort,
} from './clientEventsModel';
import { useTabBarClearance } from '@/hooks/useScrollClearance';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

const SHARE_BASE = 'https://connekyt.com/user/events/view-event?id=';
const PAGE_SIZE = 8;

const SORTS: { key: EventSort; label: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'newest', label: 'Newest created first', description: 'Recently booked or created events first', icon: 'sparkles-outline' },
  { key: 'oldest', label: 'Oldest created first', description: 'Earliest booked or created events first', icon: 'time-outline' },
  { key: 'date_asc', label: 'Event date', description: 'Scheduled date in chronological order', icon: 'calendar-outline' },
  { key: 'title_asc', label: 'Title (A to Z)', description: 'Alphabetical order by event name', icon: 'text-outline' },
];

function whenText(e: EventItem): string {
  const day = eventDay(e);
  const parts = [day ? formatDate(day) : '', e.startTime ? clock12(e.startTime) : ''].filter(Boolean);
  return parts.join(' · ') || 'No date yet';
}

export function ClientEventsDashboard({
  topInset = 0,
  initialSearch = '',
  coordinator = false,
}: {
  topInset?: number;
  initialSearch?: string;
  coordinator?: boolean;
}) {
  const styles = useStyles();
  const clearance = useTabBarClearance();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, error, refresh, refreshQuietly } = useAsync(coordinator ? listCoordinatorEvents : listEvents);
  const [pulling, setPulling] = useState(false);

  // Quiet on return from an edit so the change shows without a spinner flash. Not on the first
  // focus: the screen is already loading, and a quiet tick then would swallow that request's failure.
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) void refreshQuietly();
      focused.current = true;
    }, [refreshQuietly]),
  );
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refresh();
    } finally {
      setPulling(false);
    }
  }, [refresh]);

  const [filter, setFilter] = useState<EventFilter>('all');
  const [search, setSearch] = useState(initialSearch);
  const [sort, setSort] = useState<EventSort>('newest');
  const [shown, setShown] = useState(PAGE_SIZE);
  // List is the default; the calendar layouts reuse the photographer's schedule view in its client variant.
  const [layout, setLayout] = useState<ScheduleMode | 'list'>('list');
  const [sortOpen, setSortOpen] = useState(false);
  const [qrTarget, setQrTarget] = useState<EventItem | null>(null);
  const [bookingModeOpen, setBookingModeOpen] = useState(false);
  const [postExisting, setPostExisting] = useState<ExistingHybridEvent | null>(null);
  const [exploreOpen, setExploreOpen] = useState(false);

  const events = data;
  const today = dayKey(new Date());
  const counts = useMemo(() => (events ? countByFilter(events, today) : null), [events, today]);
  const sorted = useMemo(
    () => (events ? sortEvents(filterEvents(events, filter, search, today), sort) : []),
    [events, filter, search, sort, today],
  );
  const { rows, hasMore } = visibleSlice(sorted, shown);
  const isList = layout === 'list';
  const toneColor = { success: colors.success, warning: colors.warning, error: colors.error, info: colors.primary, neutral: colors.textMuted };
  const summary = useMemo<BreakdownSegment[]>(() => {
    const pickColor = (label: string, tone: keyof typeof toneColor): string => {
      if (label === 'Ongoing') return colors.accent;
      if (label === 'Published') return colors.success;
      if (label === 'Not published') return colors.warning;
      if (label === 'Completed') return '#3B82F6';
      if (label === 'Paused') return '#8B5CF6';
      if (label === 'Cancelled') return colors.error;
      return toneColor[tone];
    };
    const by = new Map<string, BreakdownSegment>();
    for (const e of events ?? []) {
      const s = eventStatus(e);
      const cur = by.get(s.label);
      if (cur) cur.value += 1;
      else by.set(s.label, { key: s.label, label: s.label, value: 1, color: pickColor(s.label, s.tone) });
    }
    return [...by.values()];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, colors]);
  const narrowed = search.trim().length > 0 || filter !== 'all';

  const newEvent = () => {
    if (env.hybridBookingEnabled) setBookingModeOpen(true);
    else router.push('/event/new' as Href);
  };
  const open = (path: string) => router.push(path as Href);
  const share = (e: EventItem) => {
    Share.share({ title: e.title, message: `Check out "${e.title}" on Connekyt\n${SHARE_BASE}${e.id}` }).catch(() => {});
  };
  const resetPaging = () => setShown(PAGE_SIZE);

  const header = (
    <View style={{ paddingTop: topInset + spacing.md }}>
      <View style={[styles.titleRow, styles.pad]}>
        <View style={styles.flex}>
          <Text style={styles.title} accessibilityRole="header">
            Events
          </Text>
          <Text style={styles.subtitle}>
            {coordinator ? 'Events you coordinate: bookings, photographers and live sessions.' : 'Your bookings, sessions and live events.'}
          </Text>
        </View>
        <ActionButton label="New" icon="add" variant="primary" compact onPress={newEvent} />
      </View>

      <View style={[styles.row, styles.pad]}>
        <ActionButton label="Photographers" icon="search-outline" compact onPress={() => open('/photographers')} style={styles.flex} />
        {coordinator ? (
          <ActionButton label="Geo pricing" icon="globe-outline" compact onPress={() => open('/event/geo-pricing')} style={styles.flex} />
        ) : (
          <ActionButton label="Explore events" icon="compass-outline" compact onPress={() => setExploreOpen(true)} style={styles.flex} />
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Filter events">
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            // No count until the list has loaded, so nothing is shown as zero.
            count={counts ? counts[f.key] : undefined}
            selected={filter === f.key}
            onPress={() => {
              setFilter(f.key);
              resetPaging();
            }}
          />
        ))}
      </ScrollView>

      <View style={[styles.row, styles.pad]}>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={(t) => {
              setSearch(t);
              resetPaging();
            }}
            placeholder="Search events"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search events"
            returnKeyType="search"
          />
          {search ? (
            <Pressable onPress={() => { setSearch(''); resetPaging(); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          onPress={() => setSortOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Sort events, ${SORTS.find((s) => s.key === sort)?.label}`}
          style={({ pressed }) => [styles.sortBtn, sort !== 'newest' && styles.sortBtnOn, pressed && styles.pressed]}
        >
          <Ionicons name="swap-vertical-outline" size={18} color={sort !== 'newest' ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      {events && events.length > 0 ? (
        <View style={styles.chartBlock}>
          <StatusBreakdownCard segments={summary} centerLabel="events" summary="Your events by status" emptyText="No events yet." />
        </View>
      ) : null}
      <View style={styles.tabsBlock}>
        <SegmentedTabs
          label="Events layout"
          value={layout}
          onChange={setLayout}
          tabs={[
            { key: 'list', label: 'List' },
            { key: 'month', label: 'Month' },
            { key: 'week', label: 'Week' },
            { key: 'agenda', label: 'Agenda' },
          ]}
        />
      </View>

      {error && events ? (
        <View style={styles.noticeBlock}>
          <ErrorNotice compact message={`Could not refresh. Showing the last list. ${error}`} onRetry={refresh} />
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={isList ? rows : []}
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.listContent, { paddingBottom: clearance }]}
        ItemSeparatorComponent={ListGap}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.primary} progressViewOffset={topInset} />}
        renderItem={({ item }) => (
          <EventRow
            event={item}
            onOpen={() => open(`/event/${item.id}`)}
            coordinator={coordinator}
            onWatchLive={() => open(coordinator ? `/event/${item.id}` : `/(public)/events/live-stream?id=${item.id}`)}
            onEdit={() => open(`/event/new?editId=${item.id}`)}
            onShare={() => share(item)}
            onQr={() => setQrTarget(item)}
            onCandidates={() => open(`/event/candidates?id=${item.id}`)}
            onPost={() => {
              setPostExisting({ id: item.id, title: item.title, eventDate: item.eventDate, startTime: item.startTime, endTime: item.endTime, city: item.city, venue: item.location });
              setBookingModeOpen(true);
            }}
          />
        )}
        ListFooterComponent={
          !isList ? (
            <ScheduleView
              variant="client"
              mode={layout}
              onModeChange={setLayout}
              events={sorted}
              allEvents={events ?? []}
              busyId={null}
              onOpen={(e) => open(isLiveNow(e) && !coordinator ? `/(public)/events/live-stream?id=${e.id}` : `/event/${e.id}`)}
              onAccept={() => {}}
              onDecline={() => {}}
              onCreate={newEvent}
            />
          ) : rows.length > 0 ? (
            <View style={styles.footer}>
              <Text style={styles.count} accessibilityLiveRegion="polite">
                Showing {rows.length} of {sorted.length} {sorted.length === 1 ? 'event' : 'events'}
              </Text>
              {hasMore ? (
                <ActionButton label="Show more" compact onPress={() => setShown((n) => n + PAGE_SIZE)} />
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !isList ? null : error && !events ? (
            <ErrorNotice message={error} onRetry={refresh} />
          ) : loading && !events ? (
            <View style={styles.skeletons}>
              <SkeletonCard height={150} />
              <SkeletonCard height={150} />
            </View>
          ) : narrowed ? (
            <EmptyNote
              icon="search-outline"
              title="No matching events"
              body="Try a different filter or search term."
              actionLabel="Clear filters"
              onAction={() => {
                setFilter('all');
                setSearch('');
                resetPaging();
              }}
            />
          ) : (
            <EmptyNote
              icon="calendar-outline"
              title="No events yet"
              body={
                coordinator
                  ? 'Create an event to start coordinating photographers and streams.'
                  : 'Book a photographer directly or post your event and let photographers answer.'
              }
              actionLabel="Create event"
              onAction={newEvent}
            />
          )
        }
      />

      <EventQrSheet visible={!!qrTarget} onClose={() => setQrTarget(null)} eventId={qrTarget?.id ?? ''} title={qrTarget?.title ?? ''} published={!!qrTarget?.published} />

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <GlassScrim style={styles.backdrop} onPress={() => setSortOpen(false)} accessibilityLabel="Close sort options">
          <GlassSheetHost
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) }]}
          >
            <View style={styles.handle} />
            <Text style={styles.sheetTitle} accessibilityRole="header">
              Sort events
            </Text>
            {SORTS.map((s) => {
              const on = sort === s.key;
              return (
                <Pressable
                  key={s.key}
                  onPress={() => {
                    setSort(s.key);
                    resetPaging();
                    setSortOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={s.label}
                  style={({ pressed }) => [styles.sortRow, on && styles.sortRowOn, pressed && styles.pressed]}
                >
                  <Ionicons name={s.icon} size={20} color={on ? colors.primary : colors.textMuted} />
                  <View style={styles.flex}>
                    <Text style={styles.sortLabel}>{s.label}</Text>
                    <Text style={styles.sortDesc}>{s.description}</Text>
                  </View>
                  {on ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </GlassSheetHost>
        </GlassScrim>
      </Modal>

      <ExploreChoiceSheet
        visible={exploreOpen}
        onClose={() => setExploreOpen(false)}
        signedIn
        onPostEvent={() => {
          setPostExisting(null);
          setBookingModeOpen(true);
        }}
      />

      <BookingModeSelector
        visible={bookingModeOpen}
        existingEvent={postExisting}
        onClose={() => {
          setBookingModeOpen(false);
          setPostExisting(null);
          void refresh();
        }}
        onSelectDirect={() => {
          setBookingModeOpen(false);
          router.push('/event/new' as Href);
        }}
      />
    </View>
  );
}

function EventRow({
  event,
  coordinator,
  onOpen,
  onWatchLive,
  onEdit,
  onShare,
  onQr,
  onCandidates,
  onPost,
}: {
  event: EventItem;
  coordinator: boolean;
  onOpen: () => void;
  onWatchLive: () => void;
  onEdit: () => void;
  onShare: () => void;
  onQr: () => void;
  onCandidates: () => void;
  onPost: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const live = isLiveNow(event);
  const status = (event.status ?? '').toUpperCase();
  const openHybrid = isOpenHybrid(event.bookingMode, status, !!event.photographerName);
  const canPost =
    !event.photographerName &&
    modeOf(event.bookingMode) === 'DIRECT' &&
    !['COMPLETED', 'DONE', 'CANCELLED', 'CANCELED'].includes(status);
  const hybridLabel = ['MATCHES_AWAITING_SELECTION', 'CANDIDATES_AVAILABLE'].includes(status)
    ? 'Choose photographer'
    : ['HYBRID_TIMEOUT', 'MATCHING_FAILED'].includes(status)
      ? 'Matching ended'
      : 'See answers';
  const photographerText = event.photographerName || (openHybrid ? friendlyEventStatus(status) : 'No photographer yet');
  const hasPhotographer = !!event.photographerName;

  return (
    <LiveTwinkle active={live} radius={radii.xl} style={styles.cardTwinkle}>
      <View style={[styles.eventCard, live && styles.eventCardLive]}>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Open ${event.title}`}
          style={({ pressed }) => [styles.coverBanner, pressed && styles.pressed]}
        >
          <Image
            source={event.coverImage ? { uri: event.coverImage } : EVENT_COVER_PLACEHOLDER}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
          <View style={styles.coverScrimTop} />
          <View style={styles.coverScrimBottom} />

          <View style={styles.coverTopRow}>
            <View style={styles.coverDatePill}>
              <Ionicons name="calendar" size={12} color="#FFFFFF" />
              <Text style={styles.coverDateText} numberOfLines={2}>
                {whenText(event)}
              </Text>
            </View>
            {live ? <LivePill label="Live now" size="xs" sparkle /> : <StatusBadge {...eventStatus(event)} />}
          </View>

          <View style={styles.coverBottom}>
            <View style={styles.coverTextCol}>
              {modeOf(event.bookingMode) === 'HYBRID' ? (
                <View style={styles.modeBadgeWrap}>
                  <ModeBadge mode="HYBRID" />
                </View>
              ) : null}
              <Text style={styles.cardTitle} numberOfLines={2}>
                {event.title}
              </Text>
            </View>
            <View style={styles.coverChevronCircle}>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </View>
          </View>
        </Pressable>

        <View style={styles.cardBody}>
          <View style={styles.metaGrid}>
            {event.location ? (
              <MetaTile icon="location" label="Location" text={event.location} accent={colors.accent} />
            ) : null}
            {coordinator && event.clientName ? <MetaTile icon="person" label="Client" text={event.clientName} accent={colors.primary} /> : null}
            <MetaTile
              icon="camera"
              label="Photographer"
              text={photographerText}
              accent={hasPhotographer ? colors.success : colors.primary}
            />
          </View>

          <View style={styles.primaryActions}>
            {openHybrid ? (
              <ActionButton label={hybridLabel} icon="people-outline" variant="accent" compact onPress={onCandidates} style={styles.flex} />
            ) : null}
            {canPost ? (
              <ActionButton label="Post my event" icon="radio-outline" variant="accent" compact onPress={onPost} style={styles.flex} />
            ) : null}
            {live ? (
              <LiveButton
                label={coordinator ? 'Control live' : 'Watch live'}
                size="sm"
                icon="play"
                onPress={onWatchLive}
                style={styles.flex}
              />
            ) : (
              <ActionButton label={coordinator ? 'Manage event' : 'View booking'} icon="arrow-forward-outline" variant="primary" compact onPress={onOpen} style={styles.flex} />
            )}
          </View>

          <View style={styles.quickBar}>
            <QuickActionButton label="Edit" icon="create-outline" onPress={onEdit} />
            {event.published ? <QuickActionButton label="QR" icon="qr-code-outline" onPress={onQr} /> : null}
            <QuickActionButton label="Share" icon="share-social-outline" onPress={onShare} />
          </View>
        </View>
      </View>
    </LiveTwinkle>
  );
}

function MetaTile({
  icon,
  label,
  text,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  text: string;
  accent: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.metaTile}>
      <View style={[styles.metaIconCircle, { backgroundColor: `${accent}18` }]}>
        <Ionicons name={icon} size={14} color={accent} />
      </View>
      <View style={styles.metaTileTextCol}>
        <Text style={styles.metaTileLabel}>{label}</Text>
        <Text style={styles.metaTileValue} numberOfLines={4}>
          {text}
        </Text>
      </View>
    </View>
  );
}

function QuickActionButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={15} color={colors.textSoft} />
      <Text style={styles.quickBtnText}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c, e) => ({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  // The kit cards, notices and empty states carry their own side margins; only the plain header rows need padding.
  listContent: {},
  pad: { paddingHorizontal: spacing.lg },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  title: { color: c.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  searchInput: { flex: 1, color: c.text, fontSize: 14, paddingVertical: 8 },
  sortBtn: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  sortBtnOn: { borderColor: c.primary, backgroundColor: c.tint },
  pressed: { opacity: 0.85 },
  chartBlock: { marginBottom: spacing.md },
  tabsBlock: { marginBottom: spacing.md },
  noticeBlock: { marginBottom: spacing.md },
  skeletons: { gap: spacing.md },
  cardTwinkle: { marginHorizontal: spacing.lg },
  eventCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.borderSoft,
    ...e(3),
  },
  eventCardLive: {
    borderWidth: 0,
  },
  coverBanner: {
    height: 164,
    backgroundColor: '#0B162C',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  coverScrimTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(6, 12, 26, 0.34)',
  },
  coverScrimBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 96,
    backgroundColor: 'rgba(6, 12, 26, 0.52)',
  },
  coverTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  coverDatePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(10, 18, 36, 0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    flexShrink: 1,
  },
  coverDateText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  coverBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  coverTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  modeBadgeWrap: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    borderRadius: radii.full,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  coverChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metaTile: {
    flex: 1,
    minWidth: 136,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: c.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  metaIconCircle: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaTileTextCol: {
    flex: 1,
    minWidth: 0,
  },
  metaTileLabel: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metaTileValue: {
    color: c.text,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  primaryActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  quickBtn: {
    flex: 1,
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.md,
    backgroundColor: c.elevated,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.sm,
  },
  quickBtnText: {
    color: c.textSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  footer: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },
  count: { color: c.textMuted, fontSize: 13 },
  backdrop: { flex: 1, justifyContent: 'flex-end', },
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: c.border, marginBottom: spacing.md },
  sheetTitle: { color: c.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.sm },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, paddingHorizontal: spacing.sm, borderRadius: radii.md },
  sortRowOn: { backgroundColor: c.tint },
  sortLabel: { color: c.text, fontSize: 15, fontWeight: '700' },
  sortDesc: { color: c.textMuted, fontSize: 12 },
}));

/** Module level, so the list keeps one separator type and does not remount every gap on each render. */
function ListGap() {
  return <View style={{ height: spacing.md }} />;
}
