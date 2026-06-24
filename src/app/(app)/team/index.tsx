/**
 * Team — members list + management entry point.
 *
 * Owner-only by gate: `getMyPermissions()` returns `isOwner === true`
 * only for the organization owner. Members see a friendly "team
 * management is restricted to the owner" notice.
 *
 * Web parity: salo-run team UI lives behind the same /team API
 * (TeamController.java). The mobile screen surfaces the same actions:
 * list, invite, edit (role + department), activate / deactivate, remove.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  activateMember,
  deactivateMember,
  getMyPermissions,
  listMembers,
  type MePermissions,
  type TeamMember,
} from '@/features/teams/api';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function TeamScreen() {
  const router = useRouter();
  const [me, setMe] = useState<MePermissions | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const meRes = await getMyPermissions();
      setMe(meRes);
      if (meRes.isOwner) {
        const list = await listMembers();
        setMembers(list);
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load the team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onToggleActive = async (member: TeamMember) => {
    setBusy(member.id);
    try {
      if (member.active) await deactivateMember(member.id);
      else await activateMember(member.id);
      await load();
    } catch (e) {
      Alert.alert('Could not update', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setBusy(null);
    }
  };

  if (loading && !me) {
    return (
      <Screen>
        <ScreenHeader title="Team" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ScreenHeader title="Team" />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
          <Button title="Try again" onPress={load} />
        </View>
      </Screen>
    );
  }

  if (!me?.isOwner) {
    // The team / RBAC surface is gated on the organization owner flag at
    // the backend (TeamController.requireOwner). This screen mirrors that
    // gate and explains what kind of account is needed.
    return (
      <Screen>
        <ScreenHeader title="Team" />
        <View style={styles.centered}>
          <Ionicons name="business-outline" size={40} color={colors.textMuted} />
          <Text style={styles.titleMuted}>Business account required</Text>
          <Text style={styles.muted}>
            Team management is for business / organization owners only. Reach out to{' '}
            {me?.organizationName ?? 'your owner'} if you need permission changes, or contact
            support to convert your account into a business workspace.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title="Team" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        <View style={styles.orgCard}>
          <Text style={styles.orgLabel}>ORGANIZATION</Text>
          <Text style={styles.orgName}>{me.organizationName ?? 'My organization'}</Text>
          <Text style={styles.orgSub}>
            {members.length} team member{members.length === 1 ? '' : 's'} · You are the owner
          </Text>
        </View>

        <View style={styles.quickRow}>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
            onPress={() => router.push('/team/invite' as never)}
          >
            <Ionicons name="person-add" size={18} color={colors.primary} />
            <Text style={styles.quickBtnText}>Invite member</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
            onPress={() => router.push('/team/roles' as never)}
          >
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={styles.quickBtnText}>Roles & permissions</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Members</Text>

        {members.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text style={styles.titleMuted}>No team members yet</Text>
            <Text style={styles.muted}>
              Invite teammates and assign them a role to delegate work.
            </Text>
          </View>
        ) : (
          members.map((m) => (
            <View key={m.id} style={styles.memberCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {(m.firstName?.charAt(0) || m.email.charAt(0) || '?').toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.memberHead}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}
                  </Text>
                  <View
                    style={[
                      styles.activeChip,
                      { backgroundColor: m.active ? colors.successBg : colors.errorBg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activeChipText,
                        { color: m.active ? colors.success : colors.error },
                      ]}
                    >
                      {m.active ? 'ACTIVE' : 'INACTIVE'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.memberSub}>
                  {m.email}
                  {m.department ? ` · ${m.department}` : ''}
                </Text>
                {m.role ? <Text style={styles.memberRole}>{m.role.name}</Text> : null}
                <View style={styles.memberActions}>
                  <Pressable
                    onPress={() => router.push(`/team/member/${m.id}` as never)}
                    hitSlop={6}
                  >
                    <Text style={styles.actionLink}>Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onToggleActive(m)}
                    disabled={busy === m.id}
                    hitSlop={6}
                  >
                    <Text style={[styles.actionLink, m.active && { color: colors.error }]}>
                      {busy === m.id ? '…' : m.active ? 'Deactivate' : 'Activate'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  titleMuted: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text, textAlign: 'center' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: 80, gap: spacing.lg },

  orgCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: 4,
  },
  orgLabel: { color: '#FFD28A', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 1.2 },
  orgName: { color: colors.textOnPrimary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  orgSub: { color: 'rgba(255,255,255,0.78)', fontSize: fontSize.xs, marginTop: 4 },

  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: spacing.md,
  },
  quickBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  pressed: { opacity: 0.6 },

  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },

  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderSoft },

  memberCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: colors.primary, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  memberHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  memberName: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  activeChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radii.full },
  activeChipText: { fontSize: 9, fontWeight: fontWeight.bold, letterSpacing: 0.6 },
  memberSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  memberRole: { color: colors.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 4 },
  memberActions: { flexDirection: 'row', gap: spacing.lg, marginTop: 6 },
  actionLink: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
});
