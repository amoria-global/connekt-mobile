/**
 * The Calendar view: Month, Week and Agenda, shown only when the user opens the calendar. Picking a day sets the date
 * filter (it appears as a removable chip); "Whole week" picks that week as a range. The events themselves are listed by the
 * screen under the calendar, under the same status chips.
 */
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WeekStrip } from '@/components/ui/WeekStrip';
import { GlassCard } from '@/components/ui/GlassCard';
import { alpha, fontSize, fonts, makeStyles, onFill, radii, spacing, useTheme } from '@/theme';
import { dayKey, monthGrid, parseDayKey, shiftDays, shiftMonth, weekOf } from '@/features/photographer/schedule';
import { dayFilter, dayLabel, dayOf, rangeFilter, type DateFilter, type FilterItem } from './eventsFilter';

export type CalendarMode = 'month' | 'week' | 'agenda';
const MODES: { key: CalendarMode; label: string }[] = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'agenda', label: 'Agenda' },
];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const AGENDA_DAYS = 14;

const monthTitle = (k: string) => parseDayKey(k).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
function weekTitle(days: string[]): string {
  const a = parseDayKey(days[0]);
  const b = parseDayKey(days[6]);
  const m = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
  return a.getMonth() === b.getMonth() ? `${a.getDate()} to ${b.getDate()} ${m(b)}` : `${a.getDate()} ${m(a)} to ${b.getDate()} ${m(b)}`;
}

export function EventsCalendar({ events, date, onSelect, mode, onMode }: { events: readonly FilterItem[]; date: DateFilter; onSelect: (d: DateFilter) => void; mode: CalendarMode; onMode: (m: CalendarMode) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const today = dayKey(new Date());
  const [anchor, setAnchor] = useState(date?.from ?? today);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of events) {
      const d = dayOf(e);
      if (d) m.set(d, (m.get(d) ?? 0) + 1);
    }
    return m;
  }, [events]);
  const picked = (k: string) => !!date && k >= date.from && k <= date.to;
  const week = weekOf(anchor);

  return (
    <View style={styles.wrap}>
      <View style={styles.modes} accessibilityRole="tablist" accessibilityLabel="Calendar mode">
        {MODES.map((m) => (
          <Pressable key={m.key} onPress={() => onMode(m.key)} accessibilityRole="tab" accessibilityState={{ selected: mode === m.key }} style={[styles.mode, mode === m.key && styles.modeOn]} hitSlop={{ top: 4, bottom: 4 }}>
            <Text style={[styles.modeText, { color: mode === m.key ? colors.text : colors.textSoft }]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'month' ? (
        <GlassCard style={styles.card}>
          <View style={styles.head}>
            <Pressable onPress={() => setAnchor(shiftMonth(anchor, -1))} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={8} style={styles.nav}>
              <Ionicons name="chevron-back" size={20} color={colors.textSoft} />
            </Pressable>
            <Text style={styles.title} accessibilityRole="header">
              {monthTitle(anchor)}
            </Text>
            <Pressable onPress={() => setAnchor(shiftMonth(anchor, 1))} accessibilityRole="button" accessibilityLabel="Next month" hitSlop={8} style={styles.nav}>
              <Ionicons name="chevron-forward" size={20} color={colors.textSoft} />
            </Pressable>
          </View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <Text key={w} style={styles.weekday}>
                {w}
              </Text>
            ))}
          </View>
          {monthGrid(anchor).map((wk) => (
            <View key={wk[0]} style={styles.weekRow}>
              {wk.map((k) => {
                const inMonth = parseDayKey(k).getMonth() === parseDayKey(anchor).getMonth();
                const on = picked(k);
                const n = counts.get(k) ?? 0;
                return (
                  <Pressable
                    key={k}
                    onPress={() => onSelect(on && date?.from === date?.to ? null : dayFilter(k))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${dayLabel(k)}${n ? `, ${n} event${n === 1 ? '' : 's'}` : ', no events'}`}
                    style={[styles.cell, on && styles.cellOn, k === today && !on && styles.cellToday]}
                  >
                    <Text style={[styles.cellText, { color: on ? onFill : inMonth ? colors.text : colors.textMuted }]}>{parseDayKey(k).getDate()}</Text>
                    <View style={[styles.dot, { backgroundColor: n ? (on ? onFill : colors.link) : 'transparent' }]} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </GlassCard>
      ) : null}

      {mode === 'week' ? (
        <View style={{ gap: spacing.sm }}>
          <WeekStrip
            title={weekTitle(week)}
            days={week.map((k) => ({ key: k, date: parseDayKey(k), count: counts.get(k) ?? 0, accessibilityLabel: `${dayLabel(k)}${counts.get(k) ? `, ${counts.get(k)} events` : ', no events'}` }))}
            selected={date?.from === date?.to && date ? date.from : ''}
            today={today}
            onSelect={(k) => onSelect(date?.from === k && date.to === k ? null : dayFilter(k))}
            onPrev={() => setAnchor(shiftDays(anchor, -7))}
            onNext={() => setAnchor(shiftDays(anchor, 7))}
          />
          <Pressable onPress={() => onSelect(rangeFilter(week[0], week[6]))} accessibilityRole="button" style={styles.wholeWeek} hitSlop={6}>
            <Ionicons name="calendar-number-outline" size={16} color={colors.link} />
            <Text style={[styles.modeText, { color: colors.link }]}>Show the whole week</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'agenda' ? (
        <GlassCard style={styles.card}>
          <Text style={styles.title} accessibilityRole="header">
            Next {AGENDA_DAYS} days
          </Text>
          {Array.from({ length: AGENDA_DAYS }, (_, i) => shiftDays(today, i)).map((k) => {
            const n = counts.get(k) ?? 0;
            const on = picked(k);
            return (
              <Pressable key={k} onPress={() => onSelect(on ? null : dayFilter(k))} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={`${dayLabel(k)}, ${n} event${n === 1 ? '' : 's'}`} style={[styles.agenda, on && styles.cellOn]}>
                <Text style={[styles.cellText, { color: on ? onFill : colors.text, flex: 1, textAlign: 'left' }]}>{dayLabel(k)}</Text>
                <Text style={[styles.weekday, { color: on ? onFill : n ? colors.link : colors.textMuted }]}>{n ? `${n} event${n === 1 ? '' : 's'}` : 'Free'}</Text>
              </Pressable>
            );
          })}
        </GlassCard>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    modes: { flexDirection: 'row', alignSelf: 'flex-start', padding: 3, gap: 2, borderRadius: radii.md, backgroundColor: c.well, borderWidth: 1, borderColor: c.stroke },
    mode: { minHeight: 36, paddingHorizontal: spacing.md, justifyContent: 'center', borderRadius: radii.sm },
    modeOn: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.stroke },
    modeText: { fontFamily: fonts.semibold, fontSize: fontSize.sm },
    card: { padding: spacing.md, gap: 4 },
    head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontFamily: fonts.bold, fontSize: fontSize.md },
    weekRow: { flexDirection: 'row' },
    weekday: { flex: 1, textAlign: 'center', color: c.textMuted, fontFamily: fonts.semibold, fontSize: fontSize.xs, paddingVertical: 4 },
    cell: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radii.sm, gap: 2 },
    cellOn: { backgroundColor: c.primary },
    cellToday: { borderWidth: 1, borderColor: alpha(c.link, 0.6) },
    cellText: { textAlign: 'center', fontFamily: fonts.semibold, fontSize: fontSize.sm },
    dot: { width: 5, height: 5, borderRadius: 3 },
    wholeWeek: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
    agenda: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, borderRadius: radii.sm },
  }),
);
