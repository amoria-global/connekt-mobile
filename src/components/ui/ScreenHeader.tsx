import { Text, View } from 'react-native';
import { spacing, fontSize, fontWeight, fonts, makeStyles } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';

/**
 * Standard page header.
 */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useStyles();
  const { tr } = useSharedT();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{tr(title)}</Text>
      {subtitle ? <Text style={styles.subtitle}>{tr(subtitle)}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
}));
