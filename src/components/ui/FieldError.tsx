import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { fontSize, fontWeight, makeStyles, spacing, useTheme } from '@/theme';

/**
 * The message under (or beside) an input that has a problem. The field keeps what the person typed; this only says
 * what is wrong and how to fix it. Icon plus text, never colour alone, and announced to screen readers as it appears.
 *
 * Pair it with `invalidFieldStyle(colors)` on the input's own border so the red outline and the message arrive together.
 */
export function FieldError({ message, id }: { message?: string | null; id?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!message) return null;
  return (
    <View style={styles.row} nativeID={id} accessibilityLiveRegion="polite" accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={16} color={colors.error} style={styles.icon} importantForAccessibility="no" />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

/** The red outline for an input with a problem. Spread it after the input's normal border. */
export function invalidFieldStyle(c: { error: string }) {
  return { borderColor: c.error, borderWidth: 1.5 } as const;
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm },
  icon: { marginTop: 2 },
  text: { flex: 1, color: c.error, fontSize: fontSize.sm, lineHeight: 20, fontWeight: fontWeight.medium },
}));
