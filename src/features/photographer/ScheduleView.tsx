/**
 * Schedule: Month, Week and Agenda views over the photographer's real events.
 *
 * Month and Week pick a day and list that day's events in time order. Agenda
 * lists everything still ahead, grouped by day. A conflict is reported only
 * when two accepted events genuinely overlap (see `findConflicts`).
 *
 * Midnight Glass (design/events.png): the week is the kit's WeekStrip, seven equal columns
 * (the old scroller hid Sunday). An empty day is never a dead end: the paper calendar tile,
 * what comes next, Create event and Jump to next. Coming up follows it.
 */
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { darkPalette, fonts, makeStyles, radii, shadows, spacing, tracking, useTheme } from '@/theme';
import { DateTile } from '@/components/ui/DateTile';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlassCard } from '@/components/ui/GlassCard';
import { WeekStrip } from '@/components/ui/WeekStrip';
import { ShootRow } from './homeParts';
import { useSharedT } from '@/i18n/sharedStrings';
import type { EventItem } from '@/features/events/types';
import { formatDate } from '@/utils/format';
import { eventStatus } from '@/features/events/clientEventsModel';
import { isLiveNow } from '@/features/client/homeModel';
import { LiveButton, LivePill, LiveTwinkle } from '@/components/ui/live';
import { ActionButton, EmptyNote, SegmentedTabs, StatusBadge, TOUCH } from './kit';
import {
  bucketOf,
  clock12,
  conflictIds,
  dayKey,
  eventDay,
  findConflicts,
  groupByDay,
  monthGrid,
  parseDayKey,
  shiftDays,
  shiftMonth,
  weekOf,
  type EventBucket,
} from './schedule';

export type ScheduleMode = 'month' | 'week' | 'agenda';
type Mode = ScheduleMode;
const MODES: readonly { key: Mode; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'agenda', label: 'Agenda' },
];
const AGENDA_PAGE_DAYS = 14;
const COMING_UP = 3;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS: Record<EventBucket, { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'live' }> = {
  pending: { label: 'Awaiting your reply', tone: 'warning' },
  upcoming: { label: 'Scheduled', tone: 'info' },
  ongoing: { label: 'In progress', tone: 'live' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'error' },
};

const monthTitle = (key: string) =>
  parseDayKey(key).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

function weekTitle(days: string[]): string {
  const a = parseDayKey(days[0]);
  const b = parseDayKey(days[6]);
  const sameMonth = a.getMonth() === b.getMonth();
  // "Oct 12 to 18, 2026" within a month, "Oct 28 to Nov 3, 2026" across two. The old left side lost its month.
  const left = a.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const right = sameMonth
    ? `${b.getDate()}, ${b.getFullYear()}`
    : b.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${left} to ${right}`;
}

const dayTitle = (key: string) =>
  parseDayKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

/** "Sunday, 25 Oct" beside the day heading. */
const dayShort = (key: string) => parseDayKey(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });
/** "Sun, 8 Nov" inside a sentence. */
const dayInline = (key: string) => parseDayKey(key).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

export function ScheduleView({
  events,
  allEvents,
  busyId,
  onOpen,
  onAccept,
  onDecline,
  onCreate,
  mode: controlledMode,
  onModeChange,
  variant = 'photographer',
}: {
  /**
   * "client" shows the client's own view of a booking: its status wording, the photographer's name, no
   * Accept/Decline and no schedule-conflict banner. Defaults to the photographer view, unchanged.
   */
  variant?: 'photographer' | 'client';
  /**
   * Optional control from the parent. When the screen already shows its own view switch (so the calendar mode and
   * the list share one control), it passes `mode` and `onModeChange` and this component hides its own tabs.
   */
  mode?: ScheduleMode;
  onModeChange?: (m: ScheduleMode) => void;
  /** Events after the screen's filter and search. */
  events: readonly EventItem[];
  /** Every event, so conflicts are never hidden by a filter. */
  allEvents: readonly EventItem[];
  busyId: string | null;
  onOpen: (e: EventItem) => void;
  onAccept: (e: EventItem) => void;
  onDecline: (e: EventItem) => void;
  onCreate: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const today = dayKey(new Date());
  const [ownMode, setOwnMode] = useState<Mode>('week');
  const controlled = controlledMode !== undefined;
  const mode = controlledMode ?? ownMode;
  const setMode = (m: Mode) => (controlled ? onModeChange?.(m) : setOwnMode(m));
  const [selected, setSelected] = useState(today);
  const [agendaDays, setAgendaDays] = useState(AGENDA_PAGE_DAYS);

  const byDay = useMemo(() => groupByDay(events), [events]);
  const isClient = variant === 'client';
  const conflicts = useMemo(() => (isClient ? [] : findConflicts(allEvents)), [allEvents, isClient]);
  const inConflict = useMemo(() => (isClient ? new Set<string>() : conflictIds(allEvents)), [allEvents, isClient]);
  const week = useMemo(() => weekOf(selected), [selected]);
  const grid = useMemo(() => monthGrid(selected), [selected]);
  const dayEvents = byDay.get(selected) ?? [];

  const reviewConflict = () => {
    const first = conflicts[0]?.[0];
    const day = first ? eventDay(first) : null;
    if (day) {
      setSelected(day);
      setMode('week');
    }
  };

  const agendaGroups = useMemo(
    () => [...byDay.entries()].filter(([day]) => day >= today).sort(([a], [b]) => (a < b ? -1 : 1)),
    [byDay, today],
  );
  // What follows the selected day, still open: the empty day points at it and Coming up lists it.
  const after = useMemo(
    () =>
      [...byDay.entries()]
        .filter(([day]) => day > selected)
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .flatMap(([, list]) => list.filter((e) => bucketOf(e) !== 'completed' && bucketOf(e) !== 'cancelled')),
    [byDay, selected],
  );
  const next = after[0];
  const nextDay = next ? eventDay(next) : null;
  const isToday = selected === today;

  return (
    <View style={styles.wrap}>
      {controlled ? null : <SegmentedTabs tabs={MODES} value={mode} onChange={setMode} label="Calendar view" />}

      {conflicts.length > 0 ? (
        <Pressable
          onPress={reviewConflict}
          accessibilityRole="button"
          accessibilityLabel={`${conflicts.length} possible schedule conflict${conflicts.length === 1 ? '' : 's'}. Review`}
          style={[styles.conflict, { backgroundColor: colors.pendingBg }]}
        >
          <Ionicons name="warning" size={18} color={colors.pending} />
          <Text style={[styles.conflictText, { color: colors.pending }]}>
            {conflicts.length} possible schedule conflict{conflicts.length === 1 ? '' : 's'}
          </Text>
          <Text style={[styles.conflictAction, { color: colors.pending }]}>Review</Text>
        </Pressable>
      ) : null}

      {mode === 'month' ? (
        <View style={styles.pad}>
        <GlassCard style={styles.block}>
          <Navigator
            title={monthTitle(selected)}
            onPrev={() => setSelected(shiftMonth(selected, -1))}
            onNext={() => setSelected(shiftMonth(selected, 1))}
            prevLabel="Previous month"
            nextLabel="Next month"
          />
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((d) => (
              <Text key={d} style={styles.weekday}>
                {d.slice(0, 1)}
              </Text>
            ))}
          </View>
          {grid.map((w) => (
            <View key={w[0]} style={styles.gridRow}>
              {w.map((d) => {
                const inMonth = parseDayKey(d).getMonth() === parseDayKey(selected).getMonth();
                const count = byDay.get(d)?.length ?? 0;
                const on = d === selected;
                return (
                  <Pressable
                    key={d}
                    onPress={() => setSelected(d)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${dayTitle(d)}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ', no events'}`}
                    style={[styles.cell, on && styles.cellOn, d === today && !on && styles.cellToday]}
                  >
                    <Text style={[styles.cellText, !inMonth && styles.cellMuted, on && styles.cellTextOn]}>
                      {parseDayKey(d).getDate()}
                    </Text>
                    <View style={[styles.dot, count > 0 ? { backgroundColor: on ? colors.textOnPrimary : colors.accent } : null]} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </GlassCard>
        </View>
      ) : null}

      {mode === 'week' ? (
        <View style={styles.pad}>
          <WeekStrip
            title={weekTitle(week)}
            days={week.map((d) => {
              const count = byDay.get(d)?.length ?? 0;
              return {
                key: d,
                date: parseDayKey(d),
                count,
                accessibilityLabel: `${dayTitle(d)}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ', no events'}`,
              };
            })}
            selected={selected}
            today={today}
            onSelect={setSelected}
            onPrev={() => setSelected(shiftDays(selected, -7))}
            onNext={() => setSelected(shiftDays(selected, 7))}
          />
        </View>
      ) : null}

      {mode !== 'agenda' ? (
        <View style={styles.list} testID="schedule-day">
          <View style={styles.dayHead}>
            <Text style={styles.dayTitle} accessibilityRole="header" accessibilityLabel={dayTitle(selected)}>
              {isToday ? tr('Today') : parseDayKey(selected).toLocaleDateString(undefined, { weekday: 'long' })}
            </Text>
            <Text style={styles.dayDate}>{dayShort(selected)}</Text>
          </View>
          {dayEvents.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              art={<DateTile date={parseDayKey(selected)} variant="paper" tone="primary" size={88} />}
              title={isToday ? 'A clear day' : 'Nothing scheduled'}
              message={
                next && nextDay
                  ? `Nothing scheduled ${isToday ? 'today' : 'this day'}. Your next ${isClient ? 'booking' : 'shoot'} is ${next.title || tr('Photo shoot')} on ${dayInline(nextDay)}.`
                  : `Nothing scheduled ${isToday ? 'today' : 'this day'}.`
              }
              action={{ label: isClient ? 'Book photographer' : 'Create event', onPress: onCreate, raised: true }}
              secondary={nextDay ? { label: 'Jump to next', onPress: () => setSelected(nextDay) } : undefined}
            />
          ) : (
            dayEvents.map((e) => (
              <AgendaRow
                key={String(e.id)}
                event={e}
                conflict={inConflict.has(String(e.id))}
                busy={busyId === String(e.id)}
                onOpen={onOpen}
                onAccept={onAccept}
                onDecline={onDecline}
                variant={variant}
              />
            ))
          )}
          {after.length > 0 ? (
            <View style={styles.comingUp} testID="schedule-coming-up">
              <Text style={styles.comingTitle} accessibilityRole="header">
                {tr('Coming up')}
              </Text>
              {after.slice(0, COMING_UP).map((e) => {
                const day = eventDay(e);
                return (
                  <View key={String(e.id)} style={styles.unpad}>
                    <ShootRow
                      date={day ? parseDayKey(day) : null}
                      title={e.title || tr(isClient ? 'Event' : 'Photo shoot')}
                      meta={[e.startTime ? clock12(e.startTime) : '', e.location].filter(Boolean).join(' · ') || (day ? formatDate(day) : '')}
                      onPress={() => onOpen(e)}
                    />
                  </View>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.list}>
          {agendaGroups.length === 0 ? (
            <EmptyNote
              icon="calendar-outline"
              title="No upcoming events"
              body={isClient ? 'Your bookings will appear here, in date order.' : 'Events you get booked for will appear here, in date order.'}
              actionLabel={isClient ? 'Book photographer' : 'Create event'}
              onAction={onCreate}
            />
          ) : (
            <>
              {agendaGroups.slice(0, agendaDays).map(([day, list]) => (
                <View key={day} style={styles.group}>
                  <Text style={styles.dayHeading} accessibilityRole="header">
                    {day === today ? tr('Today · ') : ''}
                    {formatDate(day)}
                  </Text>
                  {list.map((e) => (
                    <AgendaRow
                      key={String(e.id)}
                      event={e}
                      conflict={inConflict.has(String(e.id))}
                      busy={busyId === String(e.id)}
                      onOpen={onOpen}
                      onAccept={onAccept}
                      onDecline={onDecline}
                      variant={variant}
                    />
                  ))}
                </View>
              ))}
              {agendaGroups.length > agendaDays ? (
                <ActionButton
                  label={`Show more days (${agendaGroups.length - agendaDays} left)`}
                  variant="secondary"
                  onPress={() => setAgendaDays((n) => n + AGENDA_PAGE_DAYS)}
                />
              ) : null}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function Navigator({
  title,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
}: {
  title: string;
  onPrev: () => void;
  onNext: () => void;
  prevLabel: string;
  nextLabel: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.nav}>
      <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel={prevLabel} style={styles.navBtn}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.navTitle} accessibilityLiveRegion="polite">
        {title}
      </Text>
      <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel={nextLabel} style={styles.navBtn}>
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

function AgendaRow({
  event,
  conflict,
  busy,
  onOpen,
  onAccept,
  onDecline,
  variant,
}: {
  variant: 'photographer' | 'client';
  event: EventItem;
  conflict: boolean;
  busy: boolean;
  onOpen: (e: EventItem) => void;
  onAccept: (e: EventItem) => void;
  onDecline: (e: EventItem) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const isClient = variant === 'client';
  const live = isClient && isLiveNow(event);
  const bucket = bucketOf(event);
  const status = isClient ? eventStatus(event) : STATUS[bucket];
  const time = event.startTime ? clock12(event.startTime) : tr('All day');
  const range = event.startTime && event.endTime ? `${clock12(event.startTime)} to ${clock12(event.endTime)}` : time;
  const meta = [isClient ? event.photographerName : event.clientName, event.location].filter(Boolean).join(' · ');
  return (
    <LiveTwinkle active={live} radius={radii.lg}>
    <View style={styles.row}>
      <Pressable
        onPress={() => onOpen(event)}
        accessibilityRole="button"
          accessibilityLabel={`${event.title}, ${range}, ${live ? 'Live now' : status.label}${conflict ? ', possible schedule conflict' : ''}`}
        style={styles.rowMain}
      >
        <Text style={styles.time}>{time}</Text>
        {event.coverImage ? (
          <Image source={{ uri: event.coverImage }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : null}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {event.title || tr(isClient ? 'Event' : 'Photo shoot')}
          </Text>
          {meta ? (
              <Text style={styles.rowMeta} numberOfLines={2}>
              {meta}
            </Text>
          ) : null}
          <View style={styles.badges}>
              {live ? <LivePill label="Live now" size="xs" sparkle /> : <StatusBadge label={status.label} tone={status.tone} />}
            {conflict ? <StatusBadge label="May overlap another shoot" tone="warning" icon="warning" /> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
        {live ? (
          <View style={styles.rowActions}>
            <LiveButton label="Watch live" size="sm" icon="play" onPress={() => onOpen(event)} style={styles.grow} />
          </View>
        ) : bucket === 'pending' && !isClient ? (
        <View style={styles.rowActions}>
          <ActionButton label="Accept" variant="primary" busy={busy} onPress={() => onAccept(event)} style={styles.grow} />
          <ActionButton label="Decline" busy={busy} onPress={() => onDecline(event)} style={styles.grow} />
        </View>
      ) : null}
    </View>
    </LiveTwinkle>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.md },
  pad: { paddingHorizontal: spacing.lg },
  unpad: { marginHorizontal: -spacing.lg },
  block: { gap: spacing.sm, padding: spacing.md, borderRadius: radii.xl },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: c.text, fontSize: 16, fontFamily: fonts.display, flex: 1, textAlign: 'center' },
  weekdayRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 12, fontFamily: fonts.semibold },
  gridRow: { flexDirection: 'row' },
  cell: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  cellOn: { backgroundColor: c.primary, boxShadow: shadows.highlight },
  cellToday: { borderColor: c.stroke },
  cellText: { color: c.text, fontSize: 15, fontFamily: fonts.displayMedium },
  cellMuted: { color: c.textMuted, opacity: 0.6 },
  cellTextOn: { color: c.textOnPrimary },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  list: { gap: spacing.md, paddingHorizontal: spacing.lg },
  group: { gap: spacing.sm },
  dayHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm, marginTop: spacing.sm },
  dayTitle: { color: c.text, fontSize: 22, fontFamily: fonts.display, letterSpacing: tracking(22, -0.02) },
  dayDate: { color: c.textMuted, fontSize: 14, fontFamily: fonts.regular },
  dayHeading: { color: c.text, fontSize: 17, fontFamily: fonts.display },
  comingUp: { gap: spacing.md, marginTop: spacing.md },
  comingTitle: { color: c.text, fontSize: 18, fontFamily: fonts.display },
  row: {
    backgroundColor: c.glassTop,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.stroke,
    boxShadow: c === darkPalette ? shadows.glass : shadows.glassLight,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: TOUCH },
  time: { width: 62, color: c.link, fontSize: 13, fontFamily: fonts.semibold },
  thumb: { width: 56, height: 56, borderRadius: radii.md },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: c.text, fontSize: 16, fontFamily: fonts.display },
  rowMeta: { color: c.textMuted, fontSize: 13, fontFamily: fonts.regular },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  rowActions: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  conflict: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    padding: spacing.md,
    minHeight: TOUCH,
    borderRadius: radii.md,
  },
  conflictText: { flex: 1, fontSize: 14, fontFamily: fonts.semibold },
  conflictAction: { fontSize: 14, fontFamily: fonts.bold },
}));
