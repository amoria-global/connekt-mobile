/**
 * Calendar for event coordinators: Month, Week and Agenda over the events they run and the payments they still owe,
 * all from the existing coordinator endpoints (see calendarModel.ts for what lands on which day). Events are blue, live
 * events pink, payments amber, and each entry carries an icon and a word as well as its colour. A failed read is an
 * error with a retry, never an empty calendar; a failed payments read leaves the events visible and says so.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { useAsync } from '@/hooks/useAsync';
import { useRole } from '@/features/auth/role';
import { useStackClearance } from '@/hooks/useScrollClearance';
import { getCoordinatorPendingPayments } from '@/features/analytics/api';
import { listCoordinatorEvents } from '@/features/events/api';
import { Chip, EmptyNote, ErrorNotice, SegmentedTabs, SkeletonCard } from '@/features/photographer/kit';
import { monthGrid, parseDayKey, shiftDays, shiftMonth, weekOf } from '@/features/photographer/schedule';
import { makeStyles, radii, spacing, useTheme, onFill } from '@/theme';
import {
  CALENDAR_FILTERS,
  agendaFrom,
  buildEntries,
  dayHeading,
  entriesOn,
  filterEntries,
  kindsByDay,
  monthHeading,
  todayKey,
  weekLabel,
  type CalendarEntry,
  type CalendarFilter,
  type CalendarKind,
} from './calendarModel';

type View_ = 'month' | 'week' | 'agenda';
const VIEWS: readonly { key: View_; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'agenda', label: 'Agenda' },
];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const KIND_LABEL: Record<CalendarKind, string> = { event: 'Event', live: 'Live event', payment: 'Payment' };
const KIND_ICON: Record<CalendarKind, keyof typeof Ionicons.glyphMap> = {
  event: 'calendar-outline',
  live: 'videocam-outline',
  payment: 'card-outline',
};

/** A translucent version of a #rrggbb colour; any other format is returned as it is. */
const alpha = (hex: string, a: number) =>
  /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}` : hex;

export function CoordinatorCalendar() {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { isCoordinator } = useRole();
  const clearance = useStackClearance();
  const events = useAsync(useCallback(() => (isCoordinator ? listCoordinatorEvents() : Promise.resolve([])), [isCoordinator]));
  const payments = useAsync(useCallback(() => (isCoordinator ? getCoordinatorPendingPayments() : Promise.resolve([])), [isCoordinator]));

  const today = todayKey();
  const [view, setView] = useState<View_>('week');
  const [selected, setSelected] = useState(today);
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [pulling, setPulling] = useState(false);

  const kindColor = useMemo<Record<CalendarKind, string>>(
    () => ({ event: colors.primary, live: colors.accent, payment: colors.warning }),
    [colors.primary, colors.accent, colors.warning],
  );

  const all = useMemo(() => buildEntries(events.data ?? [], payments.data ?? []), [events.data, payments.data]);
  const shown = useMemo(() => filterEntries(all, filter), [all, filter]);
  const dots = useMemo(() => kindsByDay(shown), [shown]);
  const week = useMemo(() => weekOf(selected), [selected]);

  const open = (href: string) => router.push(href as never);
  const onPull = async () => {
    setPulling(true);
    try {
      await Promise.all([events.refresh(), payments.refresh()]);
    } finally {
      setPulling(false);
    }
  };
  const step = (dir: -1 | 1) => setSelected((s) => (view === 'month' ? shiftMonth(s, dir) : shiftDays(s, dir * 7)));
  const goToday = () => setSelected(todayKey());

  const rangeLabel =
    view === 'month'
      ? monthHeading(selected)
      : view === 'week'
        ? weekLabel(week)
        : 'Upcoming';

  const failed = !!events.error && !events.data;
  const loading = events.loading && !events.data;

  const renderEntries = (list: CalendarEntry[]) =>
    list.map((e, i) => (
      <EntryRow key={e.key} entry={e} color={kindColor[e.kind]} last={i === list.length - 1} onOpen={() => open(e.href)} />
    ));

  const dayList = entriesOn(shown, selected);
  const agenda = useMemo(() => agendaFrom(shown, today), [shown, today]);

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: clearance }]}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            Calendar
          </Text>
          <Pressable onPress={goToday} accessibilityRole="button" accessibilityLabel="Go to today" style={styles.todayBtn}>
            <Text style={styles.todayText}>Today</Text>
          </Pressable>
          <Pressable onPress={() => open('/event/new')} accessibilityRole="button" accessibilityLabel="New event" style={styles.plusBtn}>
            <Ionicons name="add" size={24} color={onFill} />
          </Pressable>
        </View>

        {view !== 'agenda' ? (
          <View style={styles.rangeRow}>
            <Pressable onPress={() => step(-1)} hitSlop={12} accessibilityRole="button" accessibilityLabel={view === 'month' ? 'Previous month' : 'Previous week'}>
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </Pressable>
            <Text style={styles.rangeText} accessibilityLiveRegion="polite">
              {rangeLabel}
            </Text>
            <Pressable onPress={() => step(1)} hitSlop={12} accessibilityRole="button" accessibilityLabel={view === 'month' ? 'Next month' : 'Next week'}>
              <Ionicons name="chevron-forward" size={20} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <Text style={[styles.rangeText, styles.rangeSolo]}>{rangeLabel}</Text>
        )}

        <View style={styles.gutter}>
          <SegmentedTabs tabs={VIEWS} value={view} onChange={setView} label="Calendar view" />
        </View>

        {view === 'week' ? (
          <View style={styles.weekStrip}>
            {week.map((d, i) => {
              const on = d === selected;
              const isToday = d === today;
              return (
                <Pressable
                  key={d}
                  onPress={() => setSelected(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${dayHeading(d)}${isToday ? ', today' : ''}${dots.has(d) ? ', has entries' : ''}`}
                  style={[styles.weekDay, on && { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.dow, on && styles.onText]}>{DOW[i]}</Text>
                  <Text style={[styles.dayNum, on && styles.onText, isToday && !on && { color: colors.accent }]}>{parseDayKey(d).getDate()}</Text>
                  <DayDots kinds={dots.get(d)} colors={kindColor} on={on} />
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {view === 'month' ? (
          <View style={styles.month}>
            <View style={styles.monthRow}>
              {DOW.map((d) => (
                <Text key={d} style={styles.monthDow}>
                  {d.slice(0, 2)}
                </Text>
              ))}
            </View>
            {monthGrid(selected).map((w) => (
              <View key={w[0]} style={styles.monthRow}>
                {w.map((d) => {
                  const inMonth = d.slice(0, 7) === selected.slice(0, 7);
                  const on = d === selected;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => setSelected(d)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${dayHeading(d)}${dots.has(d) ? ', has entries' : ''}`}
                      style={[styles.monthCell, on && { backgroundColor: colors.primary }, d === today && !on && { borderColor: colors.accent, borderWidth: 1 }]}
                    >
                      <Text style={[styles.monthNum, !inMonth && styles.dim, on && styles.onText]}>{parseDayKey(d).getDate()}</Text>
                      <DayDots kinds={dots.get(d)} colors={kindColor} on={on} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Filter the calendar" style={styles.chipsWrap}>
          {CALENDAR_FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>

        {failed ? <ErrorNotice message={events.error as string} onRetry={events.refresh} /> : null}
        {events.error && events.data ? (
          <ErrorNotice compact message={`Could not refresh your events. Showing the last list. ${events.error}`} onRetry={events.refresh} />
        ) : null}
        {payments.error ? (
          <ErrorNotice compact message="Payments due could not be loaded, so they are not on the calendar." onRetry={payments.refresh} />
        ) : null}
        {loading ? (
          <View style={styles.gutter}>
            <SkeletonCard height={90} />
            <SkeletonCard height={90} />
          </View>
        ) : null}

        {!failed && !loading && view !== 'agenda' ? (
          <View style={styles.gutter}>
            <Text style={styles.dayHeading}>{dayHeading(selected)}</Text>
            {dayList.length === 0 ? (
              <EmptyNote compact icon="calendar-outline" title="Nothing on this day" body="Events you run and payments you owe appear here on their date." />
            ) : (
              renderEntries(dayList)
            )}
          </View>
        ) : null}

        {!failed && !loading && view === 'agenda' ? (
          <View style={styles.gutter}>
            {agenda.days.length === 0 && agenda.undated.length === 0 ? (
              <EmptyNote compact icon="calendar-outline" title="Nothing coming up" body="Upcoming events and payments you owe appear here." />
            ) : null}
            {agenda.days.map(([day, list]) => (
              <View key={day} style={styles.agendaDay}>
                <Text style={styles.dayHeading}>{day === today ? `Today, ${dayHeading(day)}` : dayHeading(day)}</Text>
                {renderEntries(list)}
              </View>
            ))}
            {agenda.undated.length > 0 ? (
              <View style={styles.agendaDay}>
                <Text style={styles.dayHeading}>No due date</Text>
                {renderEntries(agenda.undated)}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function DayDots({ kinds, colors, on }: { kinds?: Set<CalendarKind>; colors: Record<CalendarKind, string>; on: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.dots} importantForAccessibility="no-hide-descendants">
      {(['event', 'live', 'payment'] as const)
        .filter((k) => kinds?.has(k))
        .map((k) => (
          <View key={k} style={[styles.dot, { backgroundColor: on ? '#fff' : colors[k] }]} />
        ))}
    </View>
  );
}

function EntryRow({ entry, color, last, onOpen }: { entry: CalendarEntry; color: string; last: boolean; onOpen: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.entry}>
      <View style={styles.timeCol}>
        <Text style={styles.time} maxFontSizeMultiplier={1.6}>
          {entry.timeLabel}
        </Text>
      </View>
      <View style={styles.rail}>
        <View style={[styles.railDot, { backgroundColor: color }]} />
        {last ? null : <View style={[styles.railLine, { backgroundColor: alpha(color, 0.45) }]} />}
      </View>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${KIND_LABEL[entry.kind]}: ${entry.title}. ${entry.who}. ${entry.when}. ${entry.actionLabel}`}
        style={({ pressed }) => [styles.card, { backgroundColor: alpha(color, 0.14), borderColor: alpha(color, 0.55) }, pressed && styles.pressed]}
      >
        <View style={styles.cardTop}>
          <Ionicons name={KIND_ICON[entry.kind]} size={15} color={color} />
          <Text style={styles.cardTitle} numberOfLines={2}>
            {entry.title}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={color} />
        </View>
        <Text style={styles.cardMeta} numberOfLines={2}>
          {entry.who}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={2}>
          {entry.when}
        </Text>
        <View style={[styles.cta, { borderColor: color }]}>
          <Text style={[styles.ctaText, { color }]}>{entry.actionLabel}</Text>
        </View>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  content: { paddingTop: spacing.md },
  gutter: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  title: { flex: 1, color: c.text, fontSize: 30, fontWeight: '800' },
  todayBtn: { minHeight: 40, paddingHorizontal: spacing.lg, borderRadius: radii.full, borderWidth: 1, borderColor: c.border, justifyContent: 'center' },
  todayText: { color: c.text, fontSize: 15, fontWeight: '700' },
  plusBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md },
  rangeText: { color: c.text, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  rangeSolo: { marginTop: spacing.md },
  weekStrip: { flexDirection: 'row', paddingHorizontal: spacing.md, marginTop: spacing.md, gap: 2 },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radii.md, gap: 2 },
  dow: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
  dayNum: { color: c.text, fontSize: 18, fontWeight: '800' },
  onText: { color: c.textOnPrimary },
  dots: { flexDirection: 'row', gap: 3, height: 6, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  month: { paddingHorizontal: spacing.md, marginTop: spacing.md, gap: 2 },
  monthRow: { flexDirection: 'row', gap: 2 },
  monthDow: { flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 12, fontWeight: '600', paddingBottom: 4 },
  monthCell: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radii.md, gap: 2 },
  monthNum: { color: c.text, fontSize: 15, fontWeight: '700' },
  dim: { color: c.textMuted, opacity: 0.55 },
  chipsWrap: { marginTop: spacing.md, flexGrow: 0 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  dayHeading: { color: c.text, fontSize: 17, fontWeight: '800', marginBottom: spacing.md },
  agendaDay: { marginBottom: spacing.lg },
  entry: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  timeCol: { width: 62, paddingTop: 12 },
  time: { color: c.textSoft, fontSize: 13, fontWeight: '700' },
  rail: { width: 14, alignItems: 'center', paddingTop: 16 },
  railDot: { width: 10, height: 10, borderRadius: 5 },
  railLine: { flex: 1, width: 2, marginTop: 4 },
  card: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: 3 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, color: c.text, fontSize: 15.5, fontWeight: '800' },
  cardMeta: { color: c.textSoft, fontSize: 13, lineHeight: 18 },
  cta: { alignSelf: 'flex-end', marginTop: spacing.xs, borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: 6 },
  ctaText: { fontSize: 13.5, fontWeight: '700' },
  pressed: { opacity: 0.85 },
}));
