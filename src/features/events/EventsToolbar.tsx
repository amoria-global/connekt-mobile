/**
 * The Events filter bar: status chips with counts (All, Upcoming, Ongoing, Completed), then the date chip and the
 * List | Calendar switch. "Any date" is the resting state; a picked day or range shows as a removable chip. The chip row
 * scrolls sideways with a fade on the right edge if a large text size or a narrow phone cannot fit all four.
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusChip, type ChipTone } from '@/components/ui/StatusChip';
import { alpha, fontSize, fonts, makeStyles, radii, spacing, useTheme } from '@/theme';
import { dateChipLabel, STATUS_LABEL, type Counts, type DateFilter, type StatusFilter } from './eventsFilter';

export type EventsLayout = 'list' | 'calendar';
const ORDER: StatusFilter[] = ['all', 'upcoming', 'ongoing', 'completed'];
const TONE: Record<StatusFilter, ChipTone> = { all: 'primary', upcoming: 'primary', ongoing: 'active', completed: 'success' };

export function EventsToolbar({
  counts,
  status,
  onStatus,
  date,
  onClearDate,
  onPickDate,
  layout,
  onLayout,
}: {
  counts: Counts | null;
  status: StatusFilter;
  onStatus: (s: StatusFilter) => void;
  date: DateFilter;
  onClearDate: () => void;
  /** "Any date" opens the calendar, where a day or range is picked. */
  onPickDate: () => void;
  layout: EventsLayout;
  onLayout: (l: EventsLayout) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
          {ORDER.map((s) => (
            <StatusChip
              key={s}
              label={STATUS_LABEL[s]}
              tone={TONE[s]}
              dot={s === 'ongoing'}
              compact
              count={counts ? counts[s] : undefined}
              selected={status === s}
              onPress={() => onStatus(s)}
            />
          ))}
        </ScrollView>
        <LinearGradient pointerEvents="none" colors={[alpha(colors.background, 0), colors.background]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fade} />
      </View>

      <View style={styles.row}>
        {date ? (
          <Pressable onPress={onClearDate} accessibilityRole="button" accessibilityLabel={`${dateChipLabel(date)}. Remove the date filter`} style={[styles.dateChip, styles.dateChipOn]} hitSlop={6}>
            <Ionicons name="calendar-outline" size={16} color={colors.link} />
            <Text style={[styles.dateText, { color: colors.link }]} numberOfLines={1}>
              {dateChipLabel(date)}
            </Text>
            <Ionicons name="close-circle" size={16} color={colors.link} />
          </Pressable>
        ) : (
          <Pressable onPress={onPickDate} accessibilityRole="button" accessibilityLabel="Any date. Choose a date in the calendar" style={styles.dateChip} hitSlop={6}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSoft} />
            <Text style={[styles.dateText, { color: colors.textSoft }]}>Any date</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        )}

        <View style={styles.switch} accessibilityRole="radiogroup" accessibilityLabel="Events layout">
          {(['list', 'calendar'] as const).map((l) => {
            const on = layout === l;
            return (
              <Pressable key={l} onPress={() => onLayout(l)} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={l === 'list' ? 'List' : 'Calendar'} style={[styles.opt, on && styles.optOn]} hitSlop={{ top: 4, bottom: 4 }}>
                <Ionicons name={l === 'list' ? 'list' : 'calendar-outline'} size={16} color={on ? colors.text : colors.textSoft} />
                <Text style={[styles.optText, { color: on ? colors.text : colors.textSoft }]}>{l === 'list' ? 'List' : 'Calendar'}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    wrap: { gap: spacing.sm },
    chips: { gap: 4, paddingRight: spacing.sm },
    fade: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 12 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
    dateChip: { minHeight: 40, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radii.full, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.glassTop },
    dateChipOn: { borderColor: alpha(c.link, 0.5), backgroundColor: c.tint },
    dateText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, flexShrink: 1 },
    switch: { flexDirection: 'row', padding: 3, gap: 2, borderRadius: radii.md, backgroundColor: c.well, borderWidth: 1, borderColor: c.stroke },
    opt: { minHeight: 36, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radii.sm },
    optOn: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.stroke },
    optText: { fontFamily: fonts.semibold, fontSize: fontSize.sm },
  }),
);
