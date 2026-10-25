/**
 * WeekStrip: a week as seven equal columns inside a glass panel (design/events.png).
 *
 * Seven columns that always fit, never a horizontal scroller. The old strip scrolled with 52pt
 * chips, so on a phone Sunday sat off screen, and on a Sunday the selected day was the one you
 * could not see. Each column is the full touch target (44pt or more at 360pt wide).
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { fonts, fontSize, makeStyles, radii, shadows, spacing, tracking, useTheme } from '@/theme';
import { GlassCard } from './GlassCard';

export type WeekDay = {
  key: string;
  date: Date;
  /** Events on this day; a dot shows when above zero. */
  count: number;
  /** Spoken name, e.g. "Sunday 25 October, 1 event". */
  accessibilityLabel: string;
};

type Props = {
  title: string;
  days: WeekDay[];
  selected: string;
  today?: string;
  onSelect: (key: string) => void;
  onPrev: () => void;
  onNext: () => void;
  prevLabel?: string;
  nextLabel?: string;
};

export function WeekStrip({ title, days, selected, today, onSelect, onPrev, onNext, prevLabel = 'Previous week', nextLabel = 'Next week' }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <GlassCard style={styles.card}>
      <View style={styles.head}>
        <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel={prevLabel} style={styles.nav} hitSlop={4}>
          <Ionicons name="chevron-back" size={20} color={colors.textSoft} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel={nextLabel} style={styles.nav} hitSlop={4}>
          <Ionicons name="chevron-forward" size={20} color={colors.textSoft} />
        </Pressable>
      </View>
      <View style={styles.row}>
        {days.map((d) => {
          const on = d.key === selected;
          const isToday = d.key === today;
          return (
            <Pressable
              key={d.key}
              onPress={() => onSelect(d.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={d.accessibilityLabel}
              style={styles.col}
            >
              <View style={[styles.day, isToday && !on && styles.dayToday, on && styles.dayOn]}>
                <Text style={[styles.dow, on && styles.textOn]} numberOfLines={1}>
                  {d.date.toLocaleDateString(undefined, { weekday: 'short' })}
                </Text>
                <Text style={[styles.num, on && styles.textOn]}>{d.date.getDate()}</Text>
                <View style={[styles.dot, d.count > 0 && (on ? styles.dotOn : styles.dotHas)]} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

const useStyles = makeStyles((c) => ({
  card: { borderRadius: radii.xl, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.display, fontSize: fontSize.md, letterSpacing: tracking(fontSize.md, -0.02), color: c.text },
  row: { flexDirection: 'row' },
  col: { flex: 1, minHeight: 72 },
  day: {
    flex: 1,
    marginHorizontal: 2,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayToday: { borderColor: c.stroke },
  dayOn: { backgroundColor: c.primary, boxShadow: shadows.highlight },
  dow: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: c.textMuted },
  num: { fontFamily: fonts.display, fontSize: 20, color: c.text },
  textOn: { color: c.textOnPrimary },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  dotHas: { backgroundColor: c.accent },
  dotOn: { backgroundColor: c.textOnPrimary },
}));
