import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRole } from '@/features/auth/role';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles } from '@/theme';

/**
 * Standard page header.
 *
 * For the consumer `User` role it renders a navy→pink gradient brand band
 * (matching the salo-run User dashboard hero), so every User page shares the
 * same branded look. All other roles keep the plain header — the gradient is
 * gated on the role, so shared screens aren't restyled for anyone else.
 */
export function ScreenHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useStyles();
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
        <Text style={styles.brandTitle}>{title}</Text>
        {subtitle ? <Text style={styles.brandSubtitle}>{subtitle}</Text> : null}
      </LinearGradient>
    );
  }

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

  // Branded (User) variant
  brandWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: 3,
    borderBottomLeftRadius: radii.xl,
    borderBottomRightRadius: radii.xl,
  },
  brandTitle: { fontFamily: fonts.bold, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: '#fff', letterSpacing: -0.3 },
  brandSubtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: 'rgba(255,255,255,0.82)' },
}));
