import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRole } from '@/features/auth/role';
import { useSharedT } from '@/i18n/sharedStrings';
import { spacing, radii, fontSize, fontWeight, makeStyles } from '@/theme';

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
            style={[styles.seg, flat && styles.segFlat, active && (flat ? styles.segOn : styles.segActive)]}
          >
            <Text style={[styles.segText, active && (flat ? styles.segTextOn : styles.segTextActive)]}>{tr(o.label)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((c, e) => ({
  wrap: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    padding: 4,
    gap: 4,
  },
  seg: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radii.full },
  segActive: {
    backgroundColor: c.surface,
    ...e(2),
  },
  wrapFlat: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: radii.md, padding: 3, gap: 3 },
  segFlat: { minHeight: 42, justifyContent: 'center', paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radii.md - 2 },
  segOn: { backgroundColor: c.primary },
  segTextOn: { color: c.textOnPrimary, fontWeight: fontWeight.extrabold },
  segText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textMuted, textAlign: 'center' },
  segTextActive: { color: c.primary, fontWeight: fontWeight.bold },
}));
