import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import type { TimeFieldProps } from './TimeField';

/**
 * Web: a real browser time picker (`<input type="time">`), not a typed box.
 * Its native value format is already HH:mm, so no parsing is needed.
 */
export function TimeField({ label, value, onChange, error }: TimeFieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {createElement('input', {
        type: 'time',
        value: value || '',
        onChange: (e: { target: { value: string } }) => onChange(e.target.value),
        // Colours resolve per render: a module-level object froze the light palette, a white field in dark.
        style: { ...inputStyle, backgroundColor: colors.well, color: colors.text, borderColor: error ? colors.error : colors.stroke },
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
  fontSize: fontSize.md,
  outline: 'none',
};

const useStyles = makeStyles((c) => ({
  wrap: { gap: spacing.xs },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.textSoft },
  error: { fontSize: fontSize.xs, color: c.error },
}));
