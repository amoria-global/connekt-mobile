import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Screen } from '@/components/ui/Screen';
import { CUSTOMER_TYPES } from '@/features/auth/api';
import type { CustomerType } from '@/features/auth/types';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';

/**
 * Role selection — the SINGLE SOURCE OF TRUTH for registration.
 *
 * Every registration path downstream consumes the role chosen here:
 *   choose-role -> signup (email/phone) -> account created with that role
 *   choose-role -> signup -> Google      -> account created with that role
 *
 * Registration previously started by opening the WEB signup in a browser
 * (`openWebSignup`), which left `src/app/(auth)/signup.tsx` — a complete,
 * role-aware form — unreachable. Worse, the login screen's Google button passed
 * no role at all and `GoogleButton` defaulted to 'Client', so a Photographer
 * signing up with Google silently became a Client.
 *
 * There is deliberately NO default here. If no role is chosen, the user cannot
 * continue — a wrong role is a data defect that is invisible until someone
 * cannot find their own features.
 */

type RoleInfo = { role: CustomerType; title: string; blurb: string; icon: keyof typeof Ionicons.glyphMap };

/**
 * Only roles the mobile app genuinely supports are offered. The backend also
 * accepts 'Viewer', which is deliberately excluded: a Viewer is filtered out of
 * `ownsEvents`, so the Events tab renders as a permanent empty state. (V285's
 * Play-review seed picks 'User' over 'Viewer' for exactly this reason.)
 */
const ROLES: RoleInfo[] = [
  {
    role: 'Client',
    title: 'Client',
    blurb: 'Book photographers, host events, and share galleries with your guests.',
    icon: 'person-outline',
  },
  {
    role: 'Photographer',
    title: 'Photographer',
    blurb: 'Show your work, get booked, and get paid securely.',
    icon: 'camera-outline',
  },
  {
    role: 'Coordinator',
    title: 'Event coordinator',
    blurb: 'Run events end to end and coordinate the people working them.',
    icon: 'calendar-outline',
  },
];

export default function ChooseRoleScreen() {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  // Carried through from a Google sign-in that found no existing account, so
  // the chosen role is applied to the profile Google already gave us.
  const params = useLocalSearchParams<{ email?: string; firstName?: string; lastName?: string }>();
  const [selected, setSelected] = useState<CustomerType | null>(null);

  const onContinue = () => {
    if (!selected) return; // no default: nothing happens until a role is chosen
    router.push({
      pathname: '/signup',
      params: {
        role: selected,
        ...(params.email ? { email: params.email } : {}),
        ...(params.firstName ? { firstName: params.firstName } : {}),
        ...(params.lastName ? { lastName: params.lastName } : {}),
      },
    });
  };

  return (
    <Screen>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            How will you use Connekyt?
          </Text>
          <Text style={styles.subtitle}>
            This sets up your account. You can&apos;t change it later, so pick the one that fits.
          </Text>
        </View>

        <View style={styles.list}>
          {ROLES.map((r) => {
            const active = selected === r.role;
            return (
              <Pressable
                key={r.role}
                onPress={() => setSelected(r.role)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${r.title}. ${r.blurb}`}
                style={({ pressed }) => [
                  styles.card,
                  active && styles.cardActive,
                  pressed && styles.cardPressed,
                ]}
              >
                <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
                  <Ionicons
                    name={r.icon}
                    size={22}
                    color={active ? colors.textOnPrimary : colors.primary}
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, active && styles.cardTitleActive]}>{r.title}</Text>
                  <Text style={styles.cardBlurb}>{r.blurb}</Text>
                </View>
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={active ? colors.primary : colors.border}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={onContinue}
          disabled={!selected}
          accessibilityRole="button"
          accessibilityState={{ disabled: !selected }}
          accessibilityHint={selected ? undefined : 'Choose how you will use Connekyt first'}
          style={({ pressed }) => [
            styles.cta,
            !selected && styles.ctaDisabled,
            pressed && selected && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/login')} hitSlop={8} style={styles.signInLine}>
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInLink}>Sign in</Text>
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  content: { paddingTop: spacing.xl, paddingBottom: spacing.xl, gap: spacing['2xl'] },

  header: { gap: spacing.sm },
  title: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.5, color: c.text },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },

  list: { gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: c.card,
    borderWidth: 1,
    borderColor: c.border,
    ...e(1),
  },
  cardActive: { borderColor: c.primary, backgroundColor: c.tint },
  cardPressed: { opacity: 0.9 },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.tint,
  },
  iconWrapActive: { backgroundColor: c.primary },

  cardBody: { flex: 1, gap: 2 },
  cardTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, color: c.text },
  cardTitleActive: { color: c.primary },
  cardBlurb: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: c.textMuted, lineHeight: 17 },

  footer: { gap: spacing.md, paddingBottom: spacing.lg },
  cta: {
    height: 52,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.4 },
  ctaPressed: { opacity: 0.9 },
  ctaText: { fontFamily: fonts.bold, fontSize: fontSize.md, color: c.textOnPrimary },

  signInLine: { alignItems: 'center', paddingVertical: spacing.xs },
  signInText: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
  signInLink: { fontFamily: fonts.bold, color: c.primary },
}));
