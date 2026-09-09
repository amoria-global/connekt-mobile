/**
 * Team — edit a team member.
 *
 * Lets the owner change a member's role + department and remove them
 * entirely. Activate / deactivate lives on the list screen (`/team`).
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import {
  listMembers,
  listRoles,
  removeMember,
  updateMember,
  type TeamMember,
  type TeamRole,
} from '@/features/teams/api';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function TeamMemberEditorScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [member, setMember] = useState<TeamMember | null>(null);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [department, setDepartment] = useState('');
  const [roleId, setRoleId] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allRoles, members] = await Promise.all([listRoles(), listMembers()]);
      setRoles(allRoles);
      const found = members.find((m) => m.id === id) ?? null;
      if (!found) {
        setError('Member not found.');
        return;
      }
      setMember(found);
      setDepartment(found.department ?? '');
      setRoleId(found.role?.id ?? allRoles[0]?.id ?? '');
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load the member.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onSave = async () => {
    if (!member) return;
    setSaving(true);
    setError(null);
    try {
      await updateMember(member.id, {
        roleId: roleId || undefined,
        department: department.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const onRemove = () => {
    if (!member) return;
    Alert.alert(
      'Remove member',
      `Remove ${member.firstName ?? member.email} from the team? They'll lose access immediately.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await removeMember(member.id);
              router.back();
            } catch (e) {
              Alert.alert('Could not remove', isApiError(e) ? e.message : 'Please try again.');
              setSaving(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Edit member" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !member) {
    return (
      <Screen>
        <ScreenHeader title="Edit member" />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
          <Button title="Try again" onPress={load} />
        </View>
      </Screen>
    );
  }

  if (!member) return null;

  return (
    <Screen padded={false}>
      <ScreenHeader title="Edit member" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
        >
          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>
                {(member.firstName?.charAt(0) || member.email.charAt(0) || '?').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>
                {[member.firstName, member.lastName].filter(Boolean).join(' ') || member.email}
              </Text>
              <Text style={styles.profileEmail}>{member.email}</Text>
              {member.invitedAt ? (
                <Text style={styles.profileMeta}>
                  Invited {new Date(member.invitedAt).toLocaleDateString()}
                </Text>
              ) : null}
            </View>
          </View>

          <Input
            label="Department"
            value={department}
            onChangeText={setDepartment}
            placeholder="Operations"
          />

          <Text style={styles.label}>Role</Text>
          <View style={styles.roleList}>
            {roles.map((r) => {
              const active = r.id === roleId;
              return (
                <Pressable
                  key={r.id}
                  style={[styles.roleCard, active && styles.roleCardActive]}
                  onPress={() => setRoleId(r.id)}
                >
                  <View style={[styles.radio, active && styles.radioActive]}>
                    {active ? <View style={styles.radioInner} /> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roleName}>{r.name}</Text>
                    {r.description ? (
                      <Text style={styles.roleDescription}>{r.description}</Text>
                    ) : null}
                    <Text style={styles.rolePerms}>
                      {r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Save changes" onPress={onSave} loading={saving} disabled={saving} />

          <Pressable style={styles.dangerRow} onPress={onRemove} disabled={saving}>
            <Ionicons name="person-remove" size={18} color={colors.error} />
            <Text style={styles.dangerText}>Remove from team</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: 80, gap: spacing.md },

  profileCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: c.primary, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold },
  profileName: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  profileEmail: { color: c.textSoft, fontSize: fontSize.sm, marginTop: 2 },
  profileMeta: { color: c.textMuted, fontSize: fontSize.xs, marginTop: 2 },

  label: { fontSize: fontSize.sm, color: c.textSoft, fontWeight: fontWeight.semibold, marginTop: spacing.sm },

  roleList: { gap: spacing.sm },
  roleCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
  roleCardActive: { borderColor: c.primary, backgroundColor: c.infoBg },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioActive: { borderColor: c.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },
  roleName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  roleDescription: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
  rolePerms: { fontSize: fontSize.xs, color: c.accent, fontWeight: fontWeight.bold, marginTop: 4 },

  error: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },

  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: c.errorBg,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  dangerText: { color: c.error, fontSize: fontSize.md, fontWeight: fontWeight.bold },
}));
