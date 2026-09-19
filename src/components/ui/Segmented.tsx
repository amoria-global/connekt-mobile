import { Pressable, StyleSheet, Text, View } from 'react-native';
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
  return (
    <View style={styles.wrap}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.seg, active && styles.segActive]}
          >
            <Text style={[styles.segText, active && styles.segTextActive]}>{o.label}</Text>
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
  segText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textMuted },
  segTextActive: { color: c.primary, fontWeight: fontWeight.bold },
}));
