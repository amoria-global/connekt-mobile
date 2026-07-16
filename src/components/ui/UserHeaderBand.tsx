import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRole } from '@/features/auth/role';
import { colors, fonts, fontSize, fontWeight, radii, spacing } from '@/theme';

/**
 * Page header band. For the consumer `User` role it renders a navy→pink
 * gradient brand band (matching the salo-run User dashboard), so every User
 * page shares the same branded look. Other roles get a plain header styled
 * like the app's standard page headers, so their pages are unchanged.
 *
 * Optional `children` render inside the band (e.g. filter chips) for User and
 * below the plain header for other roles.
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
  const { isUser } = useRole();

  if (isUser) {
    return (
      <LinearGradient
        colors={['#083A85', '#0a4da3', '#F20C8F']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.brandWrap}
      >
        {eyebrow ? <Text style={styles.brandEyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.brandTitle}>{title}</Text>
        {subtitle ? <Text style={styles.brandSubtitle}>{subtitle}</Text> : null}
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.accent },
  title: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },

  brandWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 3,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  brandEyebrow: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1.4, color: 'rgba(255,255,255,0.72)' },
  brandTitle: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: '#fff', letterSpacing: -0.3 },
  brandSubtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: 'rgba(255,255,255,0.82)' },
});

export default UserHeaderBand;
