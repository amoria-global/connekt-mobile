import { Text, View } from 'react-native';
import { spacing, fontSize, fontWeight, fonts, makeStyles } from '@/theme';

/**
 * Standard page header.
 */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useStyles();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  title: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
}));
