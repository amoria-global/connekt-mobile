import React from 'react';
import { Text, View } from 'react-native';
import { spacing, fontSize, fontWeight, fonts, makeStyles } from '@/theme';

/**
 * Page header with an optional eyebrow, styled like the app's standard page
 * headers. Optional `children` render below it (e.g. filter chips).
 */
export function UserHeaderBand({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const styles = useStyles();

  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
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
