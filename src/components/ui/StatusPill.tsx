import { StyleSheet, Text, View } from 'react-native';
import { statusTone } from '@/features/payments/statusBucket';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme, type Palette } from '@/theme';

/**
 * Maps a free-form status string to a colour family.
 * Takes the palette as an argument rather than closing over the static import,
 * because a plain helper cannot call `useTheme()`.
 */
function tone(c: Palette, status?: string): { bg: string; fg: string } {
  switch (statusTone(status)) {
    case 'success': return { bg: c.successBg, fg: c.success };
    case 'warning': return { bg: c.warningBg, fg: c.warning };
    case 'error': return { bg: c.errorBg, fg: c.error };
    default: return { bg: c.infoBg, fg: c.info };
  }
}

export function StatusPill({ status }: { status?: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!status) return null;
  const { bg, fg } = tone(colors, status);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{status}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  text: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'capitalize' },
}));
