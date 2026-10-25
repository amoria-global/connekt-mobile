/**
 * SegmentedControl: an inset well with the selected option as a flat blue fill (design/events.png,
 * Month · Week · Agenda · List). No glow: the screen's glows belong to its raised button and tab bar.
 */
import { Pressable, Text, View } from 'react-native';
import { useRole } from '@/features/auth/role';
import { useSharedT } from '@/i18n/sharedStrings';
import { darkPalette, fonts, fontSize, makeStyles, radii, shadows, spacing } from '@/theme';

type Option<T extends string> = { label: string; value: T };

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Option<T>[];
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  const { tr } = useSharedT();
  // Photographer screens keep the prototype's squarer corners; other roles keep the pill.
  const flat = useRole().isPhotographer;
  return (
    <View style={[styles.wrap, flat && styles.wrapFlat]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.seg, flat && styles.segFlat, active && styles.segOn]}
          >
            <Text style={[styles.segText, active && styles.segTextOn]}>{tr(o.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The kit name. */
export const SegmentedControl = Segmented;

const useStyles = makeStyles((c) => ({
  wrap: {
    flexDirection: 'row',
    backgroundColor: c.well,
    borderWidth: 1,
    borderColor: c.stroke,
    boxShadow: c === darkPalette ? shadows.inset : shadows.insetLight,
    borderRadius: radii.full,
    padding: 4,
    gap: 4,
  },
  wrapFlat: { borderRadius: radii.md },
  // 44pt minimum touch target.
  seg: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.full,
  },
  segFlat: { borderRadius: radii.md - 4 },
  segOn: { backgroundColor: c.primary, boxShadow: shadows.highlight },
  segText: { fontSize: fontSize.sm, fontFamily: fonts.semibold, color: c.textMuted, textAlign: 'center' },
  segTextOn: { color: c.textOnPrimary },
}));
