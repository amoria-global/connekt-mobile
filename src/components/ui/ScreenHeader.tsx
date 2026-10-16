import { Text, View } from 'react-native';
import { useRole } from '@/features/auth/role';
import { spacing, fontSize, fontWeight, fonts, makeStyles } from '@/theme';

/**
 * Standard page header.
 */
/**
 * `duplicatesHeader`: the native stack header already shows this exact title. Photographer screens then keep only
 * the subtitle, as a lead line, instead of saying the same words twice. Other roles are unchanged.
 */
export function ScreenHeader({
  title,
  subtitle,
  duplicatesHeader,
}: {
  title: string;
  subtitle?: string;
  duplicatesHeader?: boolean;
}) {
  const styles = useStyles();
  const flat = useRole().isPhotographer;
  if (flat && duplicatesHeader) {
    return subtitle ? (
      <View style={styles.leadWrap}>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    ) : null;
  }

  return (
    <View style={[styles.wrap, flat && styles.wrapFlat]}>
      <Text style={[styles.title, flat && styles.titleFlat]} accessibilityRole="header">{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  leadWrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.xs },
  wrapFlat: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  titleFlat: { fontSize: fontSize.xl },
  title: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
}));
