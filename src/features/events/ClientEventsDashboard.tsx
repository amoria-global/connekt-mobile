/**
 * ClientEventsDashboard: the client's Events tab.
 *
 * One column of bookings, newest first, under three light controls: a title row with
 * "New", filter chips with counts, and search with sort. There is no floating button
 * (it covered the last card and the pager) and no stat strip (the chips already count).
 *
 * Every action the old coordinator-shared list had is kept: open, edit, share, QR for a
 * published event, the hybrid "Choose" and "Post" steps, create (direct or hybrid), find
 * a photographer, explore events. Coordinators keep OwnerEventsDashboard unchanged.
 *
 * A failed read is an error with a retry, never "No events yet". A failed refresh keeps
 * the last list on screen and says so.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookingModeSelector, type ExistingHybridEvent } from '@/features/booking/BookingModeSelector';
import { ExploreChoiceSheet } from '@/features/hybrid/ExploreChoiceSheet';
import { ModeBadge, friendlyEventStatus, isOpenHybrid, modeOf } from '@/features/hybrid/hybridUi';
import { env } from '@/config/env';
import { useAsync } from '@/hooks/useAsync';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import {
  ActionButton,
  Card,
  Chip,
  EmptyNote,
  ErrorNotice,
  SkeletonCard,
  StatusBadge,
} from '@/features/photographer/kit';
import { Thumb } from '@/features/photographer/homeParts';
import { clock12, dayKey, eventDay } from '@/features/photographer/schedule';
import { formatDate } from '@/utils/format';
import { listEvents } from './api';
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

export function ClientEventsDashboard({ topInset = 0, initialSearch = '' }: { topInset?: number; initialSearch?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, loading, error, refresh, refreshQuietly } = useAsync(listEvents);
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
          <Text style={styles.subtitle}>Your bookings, sessions and live events.</Text>
        </View>
        <ActionButton label="New" icon="add" variant="primary" compact onPress={newEvent} />
      </View>

      <View style={[styles.row, styles.pad]}>
        <ActionButton label="Photographers" icon="search-outline" compact onPress={() => open('/photographers')} style={styles.flex} />
        <ActionButton label="Explore events" icon="compass-outline" compact onPress={() => setExploreOpen(true)} style={styles.flex} />
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

      {error && events ? <ErrorNotice compact message={`Could not refresh. Showing the last list. ${error}`} onRetry={refresh} /> : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.primary} progressViewOffset={topInset} />}
        renderItem={({ item }) => (
          <EventRow
            event={item}
            onOpen={() => open(`/event/${item.id}`)}
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
          rows.length > 0 ? (
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
          error && !events ? (
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
              body="Book a photographer directly or post your event and let photographers answer."
              actionLabel="Create event"
              onAction={newEvent}
            />
          )
        }
      />

      <EventQrSheet visible={!!qrTarget} onClose={() => setQrTarget(null)} eventId={qrTarget?.id ?? ''} title={qrTarget?.title ?? ''} published={!!qrTarget?.published} />

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSortOpen(false)} accessibilityLabel="Close sort options">
          <Pressable
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xl) }]}
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
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
          </Pressable>
        </Pressable>
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
  onOpen,
  onEdit,
  onShare,
  onQr,
  onCandidates,
  onPost,
}: {
  event: EventItem;
  onOpen: () => void;
  onEdit: () => void;
  onShare: () => void;
  onQr: () => void;
  onCandidates: () => void;
  onPost: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
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
  return (
    <Card>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Open ${event.title}`} style={styles.rowTop}>
        <Thumb uri={event.coverImage} size={88} />
        <View style={styles.rowText}>
          <StatusBadge {...eventStatus(event)} />
          <Text style={styles.cardTitle} numberOfLines={2}>
            {event.title}
          </Text>
          <Meta icon="calendar-outline" text={whenText(event)} />
          {event.location ? <Meta icon="location-outline" text={event.location} /> : null}
          <Meta
            icon="camera-outline"
            text={event.photographerName || (openHybrid ? friendlyEventStatus(status) : 'No photographer yet')}
          />
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
      {modeOf(event.bookingMode) === 'HYBRID' ? (
        <View style={styles.mode}>
          <ModeBadge mode="HYBRID" />
        </View>
      ) : null}
      <View style={styles.actions}>
        {openHybrid ? <ActionButton label={hybridLabel} icon="people-outline" variant="accent" compact onPress={onCandidates} style={styles.flex} /> : null}
        {canPost ? <ActionButton label="Post my event" icon="radio-outline" variant="accent" compact onPress={onPost} style={styles.flex} /> : null}
        <ActionButton label="View booking" variant="primary" compact onPress={onOpen} style={styles.flex} />
      </View>
      <View style={styles.actions}>
        <ActionButton label="Edit" icon="create-outline" variant="tertiary" compact onPress={onEdit} style={styles.flex} />
        {event.published ? <ActionButton label="QR" icon="qr-code-outline" variant="tertiary" compact onPress={onQr} style={styles.flex} /> : null}
        <ActionButton label="Share" icon="share-social-outline" variant="tertiary" compact onPress={onShare} style={styles.flex} />
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.metaLine}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.meta} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  container: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  // The kit cards, notices and empty states carry their own side margins; only the plain header rows need padding.
  listContent: { paddingBottom: 140 },
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
  skeletons: { gap: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  cardTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  meta: { color: c.textMuted, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  mode: { marginTop: spacing.sm, alignSelf: 'flex-start' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  footer: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg },
  count: { color: c.textMuted, fontSize: 13 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: c.card,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
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
