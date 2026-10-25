/**
 * DateTile: a date as an object (design/home.png, design/events.png).
 *
 *   paper   the skeuo calendar tile, white paper under a magenta or blue header. The one tactile
 *           object on a screen, so use it once (the next shoot, an empty day).
 *   glass   the small dark well for list rows (Coming up: NOV 8).
 */
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { darkPalette, fonts, makeStyles, paper, radii, raisedStops, shadows, tracking, useTheme } from '@/theme';

type Props = {
  date: Date;
  variant?: 'paper' | 'glass';
  /** Header colour for the paper tile: magenta (a booked shoot) or blue (today). */
  tone?: 'accent' | 'primary';
  /** Paper only: the weekday under the number. */
  showWeekday?: boolean;
  size?: number;
};

export function DateTile({ date, variant = 'glass', tone = 'accent', showWeekday = false, size = 72 }: Props) {
  const styles = useStyles();
  const { gradients, colors } = useTheme();
  const month = date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
  const day = date.getDate();
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase();
  const label = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  if (variant === 'glass') {
    return (
      <View style={[styles.glass, { width: size * 0.72, height: size * 0.72 }]} accessible accessibilityLabel={label}>
        <Text style={[styles.glassMonth, { color: colors.accentLight }]}>{month}</Text>
        <Text style={styles.glassDay}>{day}</Text>
      </View>
    );
  }
  const header = tone === 'accent' ? gradients.raisedAccent : gradients.raisedPrimary;
  return (
    <View style={[styles.paper, { width: size, minHeight: size * 1.1 }]} accessible accessibilityLabel={label}>
      <LinearGradient colors={header as unknown as [string, string, ...string[]]} locations={raisedStops as unknown as [number, number, ...number[]]} style={styles.paperHead}>
        <Text style={styles.paperMonth}>{month}</Text>
      </LinearGradient>
      <LinearGradient colors={[paper.top, paper.bottom]} style={styles.paperBody}>
        <Text style={[styles.paperDay, { fontSize: size * 0.46, lineHeight: size * 0.52 }]}>{day}</Text>
        {showWeekday ? <Text style={styles.paperWeekday}>{weekday}</Text> : null}
      </LinearGradient>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  paper: {
    borderRadius: radii.md,
    overflow: 'hidden',
    boxShadow: c === darkPalette ? shadows.object : shadows.glassLight,
  },
  paperHead: { paddingVertical: 5, alignItems: 'center' },
  paperMonth: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1.2, color: c.textOnPrimary },
  paperBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  paperDay: { fontFamily: fonts.display, color: paper.ink, letterSpacing: tracking(30, -0.035) },
  paperWeekday: { fontFamily: fonts.semibold, fontSize: 11, color: paper.inkSoft, letterSpacing: 0.6 },
  glass: {
    borderRadius: radii.md,
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassMonth: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1 },
  glassDay: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, color: c.text },
}));
