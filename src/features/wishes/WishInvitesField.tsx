/**
 * The required "Wish invites" field: a label, the question, an Enable | Disable choice with nothing pre-selected on a new
 * event, and the helper. The choice is a radio group; an error is shown under it and announced. One component for every
 * role's create and edit form (the web has the same field with the same copy).
 */
import { useId } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';
import { WISH_INVITES_HELPER, WISH_INVITES_LABEL, WISH_INVITES_QUESTION } from './wishInvites';

export function WishInvitesField({
  value,
  onChange,
  error,
  disabled,
  onLayout,
  containerRef,
}: {
  value: boolean | null;
  onChange: (next: boolean) => void;
  error?: string | null;
  disabled?: boolean;
  /** Lets a form scroll to the field when it blocks a submit. */
  onLayout?: (e: LayoutChangeEvent) => void;
  /** For a form that scrolls to the field (useScrollToField). */
  containerRef?: React.Ref<View>;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const id = useId();
  const option = (label: string, on: boolean) => {
    const selected = value === on;
    return (
      <Pressable
        key={label}
        onPress={() => onChange(on)}
        disabled={disabled}
        hitSlop={{ top: 4, bottom: 4 }}
        accessibilityRole="radio"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected, disabled: !!disabled }}
        style={[styles.opt, selected && (on ? styles.optOn : styles.optOff)]}
      >
        {selected ? <Ionicons name="checkmark" size={16} color={colors.textOnPrimary} /> : null}
        <Text style={[styles.optText, selected && styles.optTextOn]}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View ref={containerRef} onLayout={onLayout} style={[styles.card, !!error && styles.cardError]} nativeID={id}>
      <Text style={styles.label} accessibilityRole="header">
        {WISH_INVITES_LABEL}
        <Text style={styles.required}> *</Text>
      </Text>
      <Text style={styles.question}>{WISH_INVITES_QUESTION}</Text>
      <View
        style={[styles.well, !!error && styles.wellError]}
        accessibilityRole="radiogroup"
        accessibilityLabel={`${WISH_INVITES_LABEL}. ${WISH_INVITES_QUESTION}`}
        accessibilityHint={error ?? undefined}
      >
        {option('Enable', true)}
        {option('Disable', false)}
      </View>
      {error ? (
        <View style={styles.errRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <Text style={styles.err}>{error}</Text>
        </View>
      ) : (
        <Text style={styles.helper}>{WISH_INVITES_HELPER}</Text>
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
    question: { color: c.textSoft, fontSize: fontSize.sm, lineHeight: 20 },
    well: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radii.md, backgroundColor: c.well, borderWidth: 1, borderColor: c.stroke },
    wellError: { borderColor: c.error },
    opt: { flex: 1, minHeight: 44, borderRadius: radii.sm, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' },
    optOn: { backgroundColor: c.active },
    optOff: { backgroundColor: c.primary },
    optText: { color: c.textSoft, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
    optTextOn: { color: c.textOnPrimary },
    helper: { color: c.textMuted, fontSize: fontSize.xs, lineHeight: 18 },
    errRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    err: { color: c.error, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, flex: 1 },
  }),
);
