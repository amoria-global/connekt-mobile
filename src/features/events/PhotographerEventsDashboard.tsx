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
import { useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { glassTile } from '@/components/ui/GlassCard';
import { Input } from '@/components/ui/Input';
import { useAsync } from '@/hooks/useAsync';
import { useNow } from '@/hooks/useNow';
import { isApiError } from '@/store/auth';
import { bucketOf } from '@/features/photographer/schedule';
import { SectionTabs } from '@/components/ui/SectionTabs';
import { EventsToolbar, type EventsLayout } from './EventsToolbar';
import { EventsCalendar, type CalendarMode } from './EventsCalendar';
import { EventRow } from './EventRow';
import { countsOf, dayFilter, emptyInfo, filterEvents, groupEvents, type DateFilter, type StatusFilter, type StatusKey } from './eventsFilter';
import { spacing, radii, fonts, makeStyles, onMedia, shadows, tracking, useTheme } from '@/theme';
import { HeaderHelpButton } from '@/components/help/HeaderHelpButton';
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
import { useLanguage } from '@/store/language';
import { useTabBarClearance } from '@/hooks/useScrollClearance';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

/** "8:20 PM" from an "HH:mm[:ss]" or ISO time. */
function fmtTime(t?: string): string {
  if (!t) return '';
  const hm = /^(d{1,2}):(d{2})/.exec(t);
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
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Jun 26, 2026". */
function fmtShortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return formatDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type ViewTab = 'events' | 'albums' | 'photobooks' | 'content';

// What the user last chose this session. A fresh app launch starts here again: List, with the calendar on Month. The
// status chip and the date are never remembered: the screen always opens on All and Any date.
const session: { layout: EventsLayout; calMode: CalendarMode } = { layout: 'list', calMode: 'month' };

type Row = { kind: 'section'; key: string; title: string; count: number } | { kind: 'event'; key: string; event: EventItem; status: StatusKey };

export function PhotographerEventsDashboard({ topInset = 0 }: { topInset?: number }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const clearance = useTabBarClearance();
  const router = useRouter();
  const { data, loading, error, refresh } = useAsync(listPhotographerEvents);

  const viewTabs: { key: ViewTab; label: string; icon: keyof typeof Ionicons.glyphMap; route?: Href }[] = useMemo(
    () => [
      { key: 'events', label: t('eventsTitle'), icon: 'calendar-outline' },
      { key: 'albums', label: t('albums'), icon: 'images-outline', route: '/gallery' as Href },
      { key: 'photobooks', label: t('photobooks'), icon: 'book-outline', route: '/photobooks' as Href },
      { key: 'content', label: t('content'), icon: 'newspaper-outline', route: '/content-albums' as Href },
    ],
    [t],
  );

  const [view, setView] = useState<ViewTab>('events');
  const [layout, setLayoutState] = useState<EventsLayout>(session.layout);
  const [calMode, setCalModeState] = useState<CalendarMode>(session.calMode);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [date, setDate] = useState<DateFilter>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [acceptTarget, setAcceptTarget] = useState<EventItem | null>(null);
  const [declineTarget, setDeclineTarget] = useState<EventItem | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<EventItem | null>(null);

  const setLayout = (l: EventsLayout) => {
    session.layout = l;
    setLayoutState(l);
    // Back to the list means no date filter at all.
    if (l === 'list') setDate(null);
  };
  const setCalMode = (m: CalendarMode) => {
    session.calMode = m;
    setCalModeState(m);
  };

  const events = useMemo(() => data ?? [], [data]);
  const now = useNow();
  const filters = { status, date, search };
  const counts = data ? countsOf(events, { date, search }, now) : null;
  const list = filterEvents(events, filters, now);
  const empty = data && list.length === 0 ? emptyInfo(events, filters, now) : null;

  const rows = useMemo<Row[]>(() => {
    const g = groupEvents(filterEvents(events, { status, date, search }, now), now);
    const out: Row[] = [];
    const add = (key: StatusKey, title: string, items: EventItem[]) => {
      if (!items.length) return;
      out.push({ kind: 'section', key: `s-${key}`, title, count: items.length });
      for (const e of items) out.push({ kind: 'event', key: e.id, event: e, status: key });
    };
    add('ongoing', 'Ongoing now', g.ongoing);
    add('upcoming', 'Upcoming', g.upcoming);
    add('completed', 'Completed', g.completed);
    return out;
  }, [events, status, date, search, now]);

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
   * Streaming and albums both hang off the public event page, so the backend only accepts them once the event is
   * published. The photographer can't publish it themselves, so say so.
   */
  const requirePublished = (e: EventItem, action: string): boolean => {
    if (e.published) return true;
    Alert.alert('Event not published yet', `${action} is only available for published events. Ask the event creator to publish "${e.title}" first.`);
    return false;
  };

  // The row is one tap to the event. Press and hold keeps what the old cards offered: stream, album, QR, reply, remove.
  const onRowActions = (e: EventItem, st: StatusKey) => {
    const bucket = bucketOf(e);
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [{ text: 'Open', onPress: () => router.push(`/event/${e.id}` as Href) }];
    if (bucket === 'pending') {
      buttons.push({ text: 'Accept booking', onPress: () => setAcceptTarget(e) }, { text: 'Decline booking', onPress: () => setDeclineTarget(e) });
    }
    if (st !== 'completed' && bucket !== 'pending') {
      buttons.push({ text: 'Live stream', onPress: () => requirePublished(e, 'Live streaming') && router.push(`/stream/control/${e.id}` as Href) });
    }
    buttons.push({ text: 'Create album', onPress: () => requirePublished(e, 'Album creation') && router.push(`/album/new?eventId=${e.id}` as Href) }, { text: 'Event QR code', onPress: () => setQrTarget(e) });
    if (st === 'completed' || bucket === 'cancelled') buttons.push({ text: 'Remove from my list', style: 'destructive', onPress: () => onDismissEvent(e) });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(e.title, undefined, buttons);
  };

  const header = (
    <View style={{ paddingTop: topInset + spacing.sm, gap: spacing.md }}>
      {/* Large title: search, Help and Create stay one tap away, nothing floats over a row. */}
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
        <Pressable onPress={() => router.push('/event/new' as Href)} accessibilityRole="button" accessibilityLabel="Create new event" style={({ pressed }) => [styles.createBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={24} color={colors.textOnPrimary} />
        </Pressable>
      </View>

      {/* Library sections: Events here, the other three open their screens. */}
      <SectionTabs tabs={viewTabs} value={view} onChange={(k) => { const tab = viewTabs.find((v) => v.key === k); if (tab?.route) router.push(tab.route); else setView('events'); }} label="Library sections" />

      {view === 'events' ? (
        <>
          <EventsToolbar
            counts={counts}
            status={status}
            onStatus={setStatus}
            date={date}
            onClearDate={() => setDate(null)}
            onPickDate={() => setLayout('calendar')}
            layout={layout}
            onLayout={setLayout}
          />

          {layout === 'calendar' ? <EventsCalendar events={events} date={date} onSelect={setDate} mode={calMode} onMode={setCalMode} /> : null}

          {searchOpen || search ? (
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
          ) : null}
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        key="photographer-events-list"
        data={view === 'events' ? rows : []}
        keyExtractor={(r) => r.key}
        ItemSeparatorComponent={RowGap}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.listContent, { paddingBottom: clearance }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        renderItem={({ item }) =>
          item.kind === 'section' ? (
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                {item.title.toUpperCase()}
              </Text>
              <Text style={styles.sectionCount}>{item.count}</Text>
            </View>
          ) : (
            <EventRow event={item.event} status={item.status} pending={bucketOf(item.event) === 'pending'} onOpen={() => router.push(`/event/${item.event.id}` as Href)} onLongPress={() => onRowActions(item.event, item.status)} onAccept={() => setAcceptTarget(item.event)} onDecline={() => setDeclineTarget(item.event)} />
          )
        }
        ListEmptyComponent={
          view !== 'events' ? null : loading && !data ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : error && !data ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState icon="cloud-offline-outline" title={t('couldNotLoadEvents')} message={t('pullToRefresh')} />
            </View>
          ) : events.length === 0 ? (
            <View style={{ paddingTop: spacing.xl }}>
              <EmptyState icon="calendar-outline" title={t('noEventsYet')} message={t('eventsBookedAppear')} />
            </View>
          ) : empty ? (
            <View style={styles.empty} accessibilityLiveRegion="polite">
              <Text style={styles.emptyTitle}>{empty.title}</Text>
              {empty.otherDays ? <Text style={styles.emptySub}>{empty.otherDays}</Text> : null}
              <View style={styles.emptyActions}>
                {date || status !== 'all' || search ? (
                  <Button title={date ? 'Show all dates' : 'Show all events'} variant="outline" onPress={() => (date ? setDate(null) : (setStatus('all'), setSearch('')))} style={styles.emptyBtn} />
                ) : null}
                {empty.nextDay ? <Button title="Jump to next" variant="outline" onPress={() => setDate(dayFilter(empty.nextDay!))} style={styles.emptyBtn} /> : null}
              </View>
            </View>
          ) : null
        }
      />

      <EventQrSheet visible={!!qrTarget} onClose={() => setQrTarget(null)} eventId={qrTarget?.id ?? ''} title={qrTarget?.title ?? ''} published={!!qrTarget?.published} />

      <AcceptBookingSheet event={acceptTarget} busy={busyId === acceptTarget?.id} onCancel={() => setAcceptTarget(null)} onConfirm={() => acceptTarget && onAcceptConfirmed(acceptTarget)} />

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
    </View>
  );
}

function RowGap() {
  return <View style={{ height: spacing.sm }} />;
}

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
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  sectionTitle: { color: c.textMuted, fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1 },
  sectionCount: { color: c.textMuted, fontFamily: fonts.semibold, fontSize: 12 },
  empty: { paddingTop: spacing.xl, alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  emptyTitle: { color: c.text, fontFamily: fonts.bold, fontSize: 17, textAlign: 'center' },
  emptySub: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: spacing.sm, alignSelf: 'stretch', marginTop: spacing.sm },
  emptyBtn: { flex: 1 },
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
