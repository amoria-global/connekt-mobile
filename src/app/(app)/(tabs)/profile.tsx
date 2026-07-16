/**
 * Profile tab — identity hero, completion progress, and grouped settings.
 * Role-aware: owners (coordinator / photographer) get a Team shortcut.
 * Brand design + Pragati Narrow, matching the refined dashboards.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { useAuth } from '@/store/auth';
import { colors, fonts, radii, spacing } from '@/theme';

type MenuItem = { icon: keyof typeof Ionicons.glyphMap; label: string; href: Href };

export default function ProfileScreen() {
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const { isCoordinator, isPhotographer } = useRole();
  const isOwner = isCoordinator || isPhotographer;

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Connekyt user';
  const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  const completion = user?.profileCompletionPercentage ?? null;

  const account: MenuItem[] = [
    { icon: 'create-outline', label: 'Edit profile', href: '/edit-profile' as Href },
    { icon: 'shield-checkmark-outline', label: 'Identity verification', href: '/kyc' as Href },
    { icon: 'bar-chart-outline', label: 'Analytics', href: '/analytics' as Href },
    ...(isOwner ? [{ icon: 'people-circle-outline' as const, label: 'Team', href: '/team' as Href }] : []),
    { icon: 'images-outline', label: 'Gallery', href: '/gallery' as Href },
  ];
  const settings: MenuItem[] = [
    { icon: 'options-outline', label: 'Notification settings', href: '/preferences' as Href },
    { icon: 'notifications-outline', label: 'Notifications', href: '/notifications' as Href },
    { icon: 'lock-closed-outline', label: 'Two-factor authentication', href: '/two-factor' as Href },
    { icon: 'ban-outline', label: 'Blocked accounts', href: '/blocked-accounts' as Href },
    { icon: 'document-text-outline', label: 'Privacy policy', href: '/privacy-policy' as Href },
    { icon: 'reader-outline', label: 'Terms of service', href: '/terms-of-service' as Href },
  ];

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}>
        {/* Identity hero */}
        <LinearGradient
          colors={[colors.primary, '#0a4da3', colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.avatarRing}>
            {user?.profilePicture ? (
              <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{fullName}</Text>
          {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
          {user?.customerType ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user.customerType}</Text>
            </View>
          ) : null}

          {completion != null ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressHead}>
                <Text style={styles.progressLabel}>Profile completion</Text>
                <Text style={styles.progressPct}>{completion}%</Text>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, completion))}%` }]} />
              </View>
            </View>
          ) : null}
        </LinearGradient>

        {/* Contact */}
        <View style={styles.infoCard}>
          <Row icon="call-outline" label="Phone" value={user?.phone ?? '—'} />
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.menuCard}>
          {account.map((m, i) => (
            <MenuRow key={m.label} {...m} last={i === account.length - 1} onPress={() => router.push(m.href)} />
          ))}
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.menuCard}>
          {settings.map((m, i) => (
            <MenuRow key={m.label} {...m} last={i === settings.length - 1} onPress={() => router.push(m.href)} />
          ))}
        </View>

        <Pressable style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]} onPress={() => logout()}>
          <Ionicons name="log-out-outline" size={18} color={colors.error} />
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.deleteLink, pressed && { opacity: 0.6 }]}
          onPress={() => router.push('/delete-account' as Href)}
        >
          <Text style={styles.deleteLinkText}>Delete account</Text>
        </Pressable>
      </ScrollView>
      <TopBar />
    </Screen>
  );
}

function Row({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  last,
}: MenuItem & { onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={[styles.menuRow, !last && styles.menuBorder]} onPress={onPress}>
      <View style={styles.menuIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.md },

  hero: { borderRadius: radii.xl, padding: spacing.xl, alignItems: 'center', gap: 4 },
  avatarRing: {
    padding: 3,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: spacing.xs,
  },
  avatar: { width: 84, height: 84, borderRadius: radii.full, backgroundColor: 'rgba(255,255,255,0.2)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontFamily: fonts.bold, fontSize: 30 },
  name: { fontFamily: fonts.bold, fontSize: 22, color: '#fff' },
  email: { fontFamily: fonts.regular, fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: 4,
  },
  roleText: { color: '#fff', fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.4 },

  progressWrap: { alignSelf: 'stretch', marginTop: spacing.md, gap: 6 },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontFamily: fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.85)' },
  progressPct: { fontFamily: fonts.bold, fontSize: 12, color: '#fff' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },

  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.textMuted },
  rowValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.text },

  sectionTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.textMuted, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: spacing.sm, marginLeft: 2 },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  menuBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  menuIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.infoBg, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },

  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    backgroundColor: colors.errorBg,
    marginTop: spacing.sm,
  },
  logoutText: { fontFamily: fonts.bold, fontSize: 15, color: colors.error },

  deleteLink: { alignItems: 'center', paddingVertical: spacing.md },
  deleteLinkText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
