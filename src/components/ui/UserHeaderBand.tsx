import React from 'react';
import { Text, View } from 'react-native';
import { useRole } from '@/features/auth/role';
import { spacing, fontSize, fontWeight, fonts, makeStyles } from '@/theme';

/**
 * Page header with an optional eyebrow, styled like the app's standard page
 * headers. Optional `children` render below it (e.g. filter chips).
 */
export function UserHeaderBand({
  eyebrow,
  title,
  subtitle,
  duplicatesHeader,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** The native stack header already shows `title`; photographer screens then drop the repeat. */
  duplicatesHeader?: boolean;
  children?: React.ReactNode;
}) {
  const styles = useStyles();
  const hideTitle = useRole().isPhotographer && duplicatesHeader;

  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      {hideTitle ? null : <Text style={styles.title} accessibilityRole="header">{title}</Text>}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: c.accent },
  title: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
}));

export default UserHeaderBand;
