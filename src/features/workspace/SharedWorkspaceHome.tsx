/**
 * The Home of a workspace you were invited to. The owner's own Home is built around their earnings, balance and
 * payments, none of which a collaborator may see, so it is never loaded here: no money request is made and no figure
 * is drawn. What a collaborator can do is listed, and so is what stays with the owner, so nobody wonders where the
 * wallet went. Mirrors the dashboard's SharedWorkspaceHome.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useTabBarClearance } from '@/hooks/useScrollClearance';
import { selectActive, useWorkspace } from '@/store/workspace';
import { fontSize, fontWeight, radii, spacing, makeStyles, useTheme } from '@/theme';

const CAN_DO: { href: string; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { href: '/events', icon: 'calendar-outline', title: 'Events and bookings', body: 'Accept or decline requests, run events and streams, and deliver albums.' },
  { href: '/clients', icon: 'people-outline', title: 'Clients', body: 'See the clients of this workspace and their work.' },
];

export const STAYS_WITH_OWNER = [
  'Wallet, balance and earnings',
  'Payments, withdrawals and payout details',
  'Account settings, security and verification',
  'Notifications',
  'Who else has access',
];

export function SharedWorkspaceHome() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const clearance = useTabBarClearance();
  const active = useWorkspace(selectActive);
  const switchTo = useWorkspace((s) => s.switchTo);
  const ownerName = active?.owner.name ?? 'this photographer';

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: topBarHeight + spacing.lg, paddingBottom: clearance + spacing.xl }]}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>SHARED WORKSPACE</Text>
          <Text style={styles.title} accessibilityRole="header">{ownerName}&apos;s workspace</Text>
          <Text style={styles.muted}>You are working here as a collaborator, signed in as yourself.</Text>
        </View>

        <Button title="Back to my workspace" variant="outline" onPress={() => { void switchTo(null); }} />

        <Text style={styles.section} accessibilityRole="header">What you can do here</Text>
        {CAN_DO.map((c) => (
          <Pressable key={c.href} onPress={() => router.push(c.href as Href)} accessibilityRole="button" accessibilityLabel={c.title}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
            <View style={styles.iconCircle}><Ionicons name={c.icon} size={20} color={colors.primary} /></View>
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{c.title}</Text>
              <Text style={styles.muted}>{c.body}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        ))}

        <Text style={styles.section} accessibilityRole="header">What stays with {ownerName}</Text>
        <View style={styles.card}>
          <View style={styles.flex}>
            {STAYS_WITH_OWNER.map((t) => (
              <View key={t} style={styles.lockRow}>
                <Ionicons name="lock-closed-outline" size={15} color={colors.textMuted} />
                <Text style={styles.muted}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
      <TopBar />
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  content: { paddingHorizontal: spacing.xl, gap: spacing.lg },
  intro: { gap: spacing.xs },
  eyebrow: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  title: { color: c.text, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  muted: { color: c.textMuted, fontSize: fontSize.sm, lineHeight: 20 },
  section: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: spacing.sm },
  flex: { flex: 1, flexShrink: 1, gap: 2 },
  card: {
    ...e(1), flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: c.card,
    borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft, padding: spacing.lg, minHeight: 56,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 3 },
}));
