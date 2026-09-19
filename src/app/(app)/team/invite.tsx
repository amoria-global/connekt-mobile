/**
 * Team — invite member.
 *
 * Mirrors the salo-run invite dialog: collects email, first/last name,
 * department and assigns one of the org's roles. POST /team/users on
 * the backend; on success the screen jumps back to the team list.
 */
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
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
import { inviteMember, listRoles, type TeamRole } from '@/features/teams/api';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function TeamInviteScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [roleId, setRoleId] = useState<string>('');

  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRoles = useCallback(async () => {
    setRolesLoading(true);
    try {
      const list = await listRoles();
      setRoles(list);
      if (list.length > 0 && !roleId) setRoleId(list[0].id);
    } finally {
      setRolesLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  const formOk =
    /\S+@\S+\.\S+/.test(email) && firstName.trim() && lastName.trim() && roleId;

  const onSubmit = async () => {
    if (!formOk) return;
    setSubmitting(true);
    setError(null);
    try {
      await inviteMember({
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        roleId,
        department: department.trim() || undefined,
      });
      router.back();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not send the invite. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Invite member" />
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
          <View style={styles.hint}>
            <Ionicons name="information-circle" size={16} color={colors.info} />
            <Text style={styles.hintText}>
              The new member will receive an email with a temporary password and must change it on
              first sign-in.
            </Text>
          </View>

          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="teammate@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={styles.row}>
            <View style={styles.col}>
              <Input
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Jane"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.col}>
              <Input
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                placeholder="Doe"
                autoCapitalize="words"
              />
            </View>
          </View>
          <Input
            label="Department (optional)"
            value={department}
            onChangeText={setDepartment}
            placeholder="Operations"
          />

          <Text style={styles.label}>Role</Text>
          {rolesLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : roles.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                You don&apos;t have any roles yet. Create one in Roles &amp; permissions before
                inviting a member.
              </Text>
            </View>
          ) : (
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
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={submitting ? 'Sending…' : 'Send invite'}
            onPress={onSubmit}
            loading={submitting}
            disabled={!formOk || submitting}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.xl, paddingBottom: 80, gap: spacing.md },
  hint: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: c.infoBg,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  hintText: { flex: 1, color: c.info, fontSize: fontSize.xs, fontWeight: fontWeight.semibold, lineHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.sm },
  col: { flex: 1 },
  label: { fontSize: fontSize.sm, color: c.textSoft, fontWeight: fontWeight.semibold, marginTop: spacing.sm },
  empty: { padding: spacing.lg, backgroundColor: c.surface, borderRadius: radii.md, borderWidth: 1, borderColor: c.borderSoft },
  emptyText: { color: c.textMuted, fontSize: fontSize.sm },
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
}));
