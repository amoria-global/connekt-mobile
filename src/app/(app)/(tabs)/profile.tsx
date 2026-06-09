import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Connekyt user';
  const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();

  return (
    <Screen padded={false}>
      <ScreenHeader title="Profile" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          {user?.profilePicture ? (
            <Image source={{ uri: user.profilePicture }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <Text style={styles.name}>{fullName}</Text>
          {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
          {user?.customerType ? (
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user.customerType}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.infoCard}>
          <Row label="Phone" value={user?.phone ?? '—'} />
          <Row
            label="Profile complete"
            value={
              user?.profileCompletionPercentage != null
                ? `${user.profileCompletionPercentage}%`
                : '—'
            }
          />
        </View>

        <View style={styles.menuCard}>
          <MenuRow icon="create-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <MenuRow icon="options-outline" label="Notification settings" onPress={() => router.push('/preferences')} />
          <MenuRow icon="lock-closed-outline" label="Two-factor authentication" onPress={() => router.push('/two-factor')} />
          <MenuRow icon="shield-checkmark-outline" label="Identity verification" onPress={() => router.push('/kyc')} />
          <MenuRow icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
          <MenuRow icon="images-outline" label="Gallery" onPress={() => router.push('/gallery')} last />
        </View>

        <Button title="Log out" variant="ghost" onPress={() => logout()} />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable style={[styles.menuRow, !last && styles.menuBorder]} onPress={onPress}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg },
  card: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  avatar: { width: 88, height: 88, borderRadius: radii.full, backgroundColor: colors.surfaceMuted },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  avatarText: { color: colors.textOnPrimary, fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold },
  name: { fontSize: fontSize.xl, fontWeight: fontWeight.bold, color: colors.text },
  email: { fontSize: fontSize.sm, color: colors.textMuted },
  roleBadge: {
    backgroundColor: colors.infoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    marginTop: spacing.xs,
  },
  roleText: { color: colors.info, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  rowLabel: { fontSize: fontSize.sm, color: colors.textMuted },
  rowValue: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.text },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  menuBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSoft },
  menuLabel: { flex: 1, fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.semibold },
});
