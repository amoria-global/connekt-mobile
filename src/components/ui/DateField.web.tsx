import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import type { DateFieldProps } from './DateField';

function toYMD(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Web: a real browser date picker (`<input type="date">`), not a typed box.
 * Its native value format is already YYYY-MM-DD, so no parsing is needed.
 * react-native-web renders a raw DOM element when given a string tag.
 */
export function DateField({ label, value, onChange, error, minimumDate }: DateFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {createElement('input', {
        type: 'date',
        value: value || '',
        min: minimumDate ? toYMD(minimumDate) : undefined,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        style: { ...inputStyle, borderColor: error ? colors.error : colors.border },
      })}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const inputStyle = {
  height: 52,
  width: '100%',
  boxSizing: 'border-box' as const,
  borderWidth: 1,
  borderStyle: 'solid' as const,
  borderRadius: radii.md,
  paddingLeft: spacing.lg,
  paddingRight: spacing.lg,
  backgroundColor: colors.surface,
  color: colors.text,
  fontSize: fontSize.md,
  outline: 'none',
};

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textSoft },
  error: { fontSize: fontSize.xs, color: colors.error },
});
