/**
 * StatusChip: a pill carrying a state, coloured by meaning (design/brief.png):
 * blue = action or scheduled, magenta = attention, red = live right now, cyan = active, amber = pending.
 *
 * With `onPress` it is a filter chip (Events: All 60 · Upcoming 29 · Ongoing 1); the hit area is
 * padded to 44pt whatever the chip's drawn height.
 */
import { Pressable, Text, View } from 'react-native';
import { alpha, fonts, fontSize, makeStyles, radii, spacing, useTheme, type Palette, type Gradients } from '@/theme';

export type ChipTone = 'primary' | 'accent' | 'live' | 'active' | 'pending' | 'success' | 'error' | 'neutral';

export function chipColors(c: Palette, g: Gradients, isDark: boolean, tone: ChipTone): { fg: string; bg: string } {
  switch (tone) {
    // Broadcast red, only for on air right now; active (cyan) is in progress, collaboration, connected.
    case 'live': return { fg: c.liveText, bg: alpha(c.live, 0.16) };
    case 'active': return { fg: c.active, bg: c.activeBg };
    case 'pending': return { fg: c.pending, bg: c.pendingBg };
    // Light mode's magenta is too pale for 12px text on white; it takes the raised fill's deep stop.
    case 'accent': return { fg: isDark ? c.accentLight : g.raisedAccent[2], bg: c.tintAccent };
    case 'success': return { fg: c.success, bg: c.successBg };
    case 'error': return { fg: c.error, bg: c.errorBg };
    case 'neutral': return { fg: c.textSoft, bg: c.glassTop };
    default: return { fg: c.link, bg: c.tint };
  }
}

type Props = {
  label: string;
  tone?: ChipTone;
  /** A leading dot in the tone colour (Live, Scheduled, Ongoing). */
  dot?: boolean;
  /** A trailing count (filter chips). */
  count?: number;
  onPress?: () => void;
  selected?: boolean;
  accessibilityLabel?: string;
};

export function StatusChip({ label, tone = 'primary', dot = false, count, onPress, selected = false, accessibilityLabel }: Props) {
  const styles = useStyles();
  const { colors, gradients, isDark } = useTheme();
  const { fg, bg } = chipColors(colors, gradients, isDark, tone);
  const filter = !!onPress;
  // A filter chip is quiet until selected; a status chip always shows its tone.
  const shownFg = filter && !selected ? colors.textSoft : fg;
  const body = (
    <View
      style={[
        styles.chip,
        filter && styles.chipFilter,
        { backgroundColor: filter && !selected ? colors.glassTop : bg, borderColor: filter && !selected ? colors.stroke : alpha(fg, 0.35) },
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.text, filter && styles.textFilter, { color: filter && selected ? colors.text : shownFg }]} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined ? (
        <View style={[styles.count, { backgroundColor: filter && selected ? alpha(fg, 0.22) : colors.well }]}>
          <Text style={[styles.countText, { color: filter && selected ? colors.text : shownFg }]}>{count}</Text>
        </View>
      ) : null}
    </View>
  );
  if (!filter) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? (count !== undefined ? `${label}, ${count}` : label)}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  chipFilter: { minHeight: 38, paddingHorizontal: spacing.lg },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: fontSize.xs, fontFamily: fonts.semibold },
  textFilter: { fontSize: fontSize.sm },
  count: { minWidth: 22, paddingHorizontal: 6, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: fontSize.xs, fontFamily: fonts.bold },
  pressed: { opacity: 0.85 },
}));
