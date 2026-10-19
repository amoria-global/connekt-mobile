/**
 * Schedule: Month, Week and Agenda views over the photographer's real events.
 *
 * Month and Week pick a day and list that day's events in time order. Agenda
 * lists everything still ahead, grouped by day. A conflict is reported only
 * when two accepted events genuinely overlap (see `findConflicts`).
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import type { EventItem } from '@/features/events/types';
import { formatDate } from '@/utils/format';
import { eventStatus } from '@/features/events/clientEventsModel';
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
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const STATUS: Record<EventBucket, { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  pending: { label: 'Awaiting your reply', tone: 'warning' },
  upcoming: { label: 'Scheduled', tone: 'info' },
  ongoing: { label: 'In progress', tone: 'success' },
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

  return (
    <View style={styles.wrap}>
      {controlled ? null : <SegmentedTabs tabs={MODES} value={mode} onChange={setMode} label="Calendar view" />}

      {conflicts.length > 0 ? (
        <Pressable
          onPress={reviewConflict}
          accessibilityRole="button"
          accessibilityLabel={`${conflicts.length} possible schedule conflict${conflicts.length === 1 ? '' : 's'}. Review`}
          style={[styles.conflict, { backgroundColor: colors.warningBg }]}
        >
          <Ionicons name="warning" size={18} color={colors.warning} />
          <Text style={[styles.conflictText, { color: colors.warning }]}>
            {conflicts.length} possible schedule conflict{conflicts.length === 1 ? '' : 's'}
          </Text>
          <Text style={[styles.conflictAction, { color: colors.warning }]}>Review</Text>
        </Pressable>
      ) : null}

      {mode === 'month' ? (
        <View style={styles.block}>
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
                    <View style={[styles.dot, count > 0 ? { backgroundColor: on ? '#fff' : colors.accent } : null]} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}

      {mode === 'week' ? (
        <View style={styles.block}>
          <Navigator
            title={weekTitle(week)}
            onPrev={() => setSelected(shiftDays(selected, -7))}
            onNext={() => setSelected(shiftDays(selected, 7))}
            prevLabel="Previous week"
            nextLabel="Next week"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
            {week.map((d) => {
              const on = d === selected;
              const count = byDay.get(d)?.length ?? 0;
              const date = parseDayKey(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => setSelected(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${dayTitle(d)}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ', no events'}`}
                  style={[styles.dayChip, on && styles.dayChipOn, d === today && !on && styles.cellToday]}
                >
                  <Text style={[styles.dayChipTop, on && styles.cellTextOn]}>
                    {date.toLocaleDateString(undefined, { weekday: 'short' })}
                  </Text>
                  <Text style={[styles.dayChipNum, on && styles.cellTextOn]}>{date.getDate()}</Text>
                  <View style={[styles.dot, count > 0 ? { backgroundColor: on ? '#fff' : colors.accent } : null]} />
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {mode !== 'agenda' ? (
        <View style={styles.list}>
          <Text style={styles.dayHeading} accessibilityRole="header">
            {dayTitle(selected)}
          </Text>
          {dayEvents.length === 0 ? (
            <EmptyNote
              icon="calendar-outline"
              title="Nothing scheduled"
              body="No events on this day."
              actionLabel={isClient ? 'Book photographer' : 'Create event'}
              onAction={onCreate}
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
                    {day === today ? 'Today · ' : ''}
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
  const isClient = variant === 'client';
  const bucket = bucketOf(event);
  const status = isClient ? eventStatus(event) : STATUS[bucket];
  const time = event.startTime ? clock12(event.startTime) : 'All day';
  const range = event.startTime && event.endTime ? `${clock12(event.startTime)} to ${clock12(event.endTime)}` : time;
  const meta = [isClient ? event.photographerName : event.clientName, event.location].filter(Boolean).join(' · ');
  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onOpen(event)}
        accessibilityRole="button"
        accessibilityLabel={`${event.title}, ${range}, ${status.label}${conflict ? ', possible schedule conflict' : ''}`}
        style={styles.rowMain}
      >
        <Text style={styles.time}>{time}</Text>
        {event.coverImage ? (
          <Image source={{ uri: event.coverImage }} style={styles.thumb} contentFit="cover" accessibilityIgnoresInvertColors />
        ) : null}
        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {event.title || (isClient ? 'Event' : 'Photo shoot')}
          </Text>
          {meta ? (
            <Text style={styles.rowMeta} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
          <View style={styles.badges}>
            <StatusBadge label={status.label} tone={status.tone} />
            {conflict ? <StatusBadge label="May overlap another shoot" tone="warning" icon="warning" /> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      </Pressable>
      {bucket === 'pending' && !isClient ? (
        <View style={styles.rowActions}>
          <ActionButton label="Accept" variant="primary" busy={busy} onPress={() => onAccept(event)} style={styles.grow} />
          <ActionButton label="Decline" busy={busy} onPress={() => onDecline(event)} style={styles.grow} />
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.md },
  block: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  navTitle: { color: c.text, fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  weekdayRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 12, fontWeight: '700' },
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
  cellOn: { backgroundColor: c.primary },
  cellToday: { borderColor: c.primary },
  cellText: { color: c.text, fontSize: 15, fontWeight: '600' },
  cellMuted: { color: c.textMuted, opacity: 0.6 },
  cellTextOn: { color: c.textOnPrimary },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  strip: { gap: spacing.sm },
  dayChip: {
    minWidth: 52,
    minHeight: 72,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  dayChipOn: { backgroundColor: c.primary, borderColor: c.primary },
  dayChipTop: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
  dayChipNum: { color: c.text, fontSize: 18, fontWeight: '800' },
  list: { gap: spacing.md, paddingHorizontal: spacing.lg },
  group: { gap: spacing.sm },
  dayHeading: { color: c.text, fontSize: 16, fontWeight: '800' },
  row: {
    backgroundColor: c.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.md,
  },
  rowMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: TOUCH },
  time: { width: 58, color: c.link, fontSize: 13, fontWeight: '800' },
  thumb: { width: 56, height: 56, borderRadius: radii.md },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  rowMeta: { color: c.textMuted, fontSize: 13 },
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
  conflictText: { flex: 1, fontSize: 14, fontWeight: '700' },
  conflictAction: { fontSize: 14, fontWeight: '800' },
}));
