/**
 * The required "How can guests attend?" field: In person + live stream | Live stream only, with nothing pre-selected on a
 * new event (like Wish invites). It decides whether the venue fields are asked for, so the two can never disagree.
 */
import { useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import type { AttendanceChoice } from './eventFormRules';

export const ATTENDANCE_LABEL = 'How can guests attend?';
export const ATTENDANCE_HELPER = 'Stream-only viewers get the live stream as their ticket. In person guests also need a venue.';

export function AttendanceField({
  value,
  onChange,
  error,
  disabled,
  containerRef,
}: {
  value: AttendanceChoice | null;
  onChange: (next: AttendanceChoice) => void;
  error?: string | null;
  disabled?: boolean;
  containerRef?: React.Ref<View>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const id = useId();
  const option = (label: string, choice: AttendanceChoice) => {
    const selected = value === choice;
    return (
      <Pressable
        key={choice}
        onPress={() => onChange(choice)}
        disabled={disabled}
        hitSlop={{ top: 4, bottom: 4 }}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected, disabled: !!disabled }}
        style={[styles.opt, selected && styles.optOn]}
      >
        {selected ? <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} /> : null}
        <Text style={[styles.optText, selected && styles.optTextOn]} numberOfLines={2}>
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View ref={containerRef} style={[styles.card, !!error && styles.cardError]} nativeID={id}>
      <Text style={styles.label} accessibilityRole="header">
        {ATTENDANCE_LABEL}
        <Text style={styles.required}> *</Text>
      </Text>
      <View
        style={[styles.well, !!error && styles.wellError]}
        accessibilityRole="radiogroup"
        accessibilityLabel={ATTENDANCE_LABEL}
        accessibilityHint={error ?? undefined}
      >
        {option('In person + live stream', 'IN_PERSON')}
        {option('Live stream only', 'STREAM_ONLY')}
      </View>
      {error ? (
        <View style={styles.errRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <Text style={styles.err}>{error}</Text>
        </View>
      ) : (
        <Text style={styles.helper}>{ATTENDANCE_HELPER}</Text>
      )}
    </View>
  );
}

const useStyles = makeStyles((c) =>
  StyleSheet.create({
    card: { borderRadius: radii.lg, borderWidth: 1, borderColor: c.stroke, backgroundColor: c.surface, padding: spacing.md, gap: spacing.sm },
    cardError: { borderColor: c.error },
    label: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
    required: { color: c.accent },
    well: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.md, backgroundColor: c.well, borderWidth: 1, borderColor: c.stroke },
    wellError: { borderColor: c.error },
    opt: { flex: 1, minHeight: 44, borderRadius: radii.sm, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
    optOn: { backgroundColor: c.primary },
    optText: { color: c.textSoft, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'center', flexShrink: 1 },
    optTextOn: { color: c.textOnPrimary },
    helper: { color: c.textMuted, fontSize: fontSize.xs, lineHeight: 18 },
    errRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    err: { color: c.error, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, flex: 1 },
  }),
);
