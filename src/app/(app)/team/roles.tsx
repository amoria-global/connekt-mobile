/**
 * Team — roles management. List existing roles, create new ones,
 * delete unused ones. Editing the permission set on a role lives on
 * `/team/role/[id]` (web parity: salo-run RoleEditor modal).
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
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { deleteRole, listRoles, type TeamRole } from '@/features/teams/api';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function TeamRolesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRoles(await listRoles());
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load roles.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = (role: TeamRole) => {
    Alert.alert(
      'Delete role',
      `Delete "${role.name}"? Members holding this role will need to be reassigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(role.id);
            try {
              await deleteRole(role.id);
              await load();
            } catch (e) {
              Alert.alert('Could not delete', isApiError(e) ? e.message : 'Please try again.');
            } finally {
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen padded={false}>
      <ScreenHeader title="Roles & permissions" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />
        }
      >
        <Pressable
          style={({ pressed }) => [styles.newRow, pressed && styles.pressed]}
          onPress={() => router.push('/team/role/new' as never)}
        >
          <Ionicons name="add-circle" size={20} color={colors.primary} />
          <Text style={styles.newRowText}>Create a new role</Text>
        </Pressable>

        {loading && roles.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : error ? (
          <View style={styles.empty}>
            <Text style={styles.muted}>{error}</Text>
          </View>
        ) : roles.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shield-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No roles yet</Text>
            <Text style={styles.muted}>
              Create roles like "Operations", "Finance" or "Coordinator" with the permissions each
              team needs, then assign them to invited members.
            </Text>
          </View>
        ) : (
          roles.map((r) => (
            <View key={r.id} style={styles.roleCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roleName}>{r.name}</Text>
                {r.description ? <Text style={styles.roleSub}>{r.description}</Text> : null}
                <Text style={styles.rolePerms}>
                  {r.permissions.length} permission{r.permissions.length === 1 ? '' : 's'}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push(`/team/role/${r.id}` as never)}
                style={styles.rowBtn}
                hitSlop={6}
              >
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => onDelete(r)}
                disabled={busy === r.id}
                style={styles.rowBtn}
                hitSlop={6}
              >
                {busy === r.id ? (
                  <ActivityIndicator size="small" color={colors.error} />
                ) : (
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                )}
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.xl, paddingBottom: 80, gap: spacing.md },
  newRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: c.infoBg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.primary,
    borderStyle: 'dashed',
  },
  pressed: { opacity: 0.6 },
  newRowText: { color: c.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  empty: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: c.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: c.borderSoft },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },

  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  roleName: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  roleSub: { color: c.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  rolePerms: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, marginTop: 4 },
  rowBtn: { padding: 8 },
}));
