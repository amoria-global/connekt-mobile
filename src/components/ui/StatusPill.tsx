import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

/** Maps a free-form status string to a colour family. */
function tone(status?: string): { bg: string; fg: string } {
  const s = (status ?? '').toLowerCase();
  if (/(complet|accept|approv|paid|active|success)/.test(s))
    return { bg: colors.successBg, fg: colors.success };
  if (/(pend|await|process|hold)/.test(s)) return { bg: colors.warningBg, fg: colors.warning };
  if (/(reject|cancel|fail|declin|lock)/.test(s)) return { bg: colors.errorBg, fg: colors.error };
  return { bg: colors.infoBg, fg: colors.info };
}

export function StatusPill({ status }: { status?: string }) {
  if (!status) return null;
  const { bg, fg } = tone(status);
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  text: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, textTransform: 'capitalize' },
});
