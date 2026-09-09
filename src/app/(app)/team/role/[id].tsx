/**
 * Team — role editor (create or edit).
 *
 *   /team/role/new   → create a new role
 *   /team/role/{id}  → edit an existing role's name + description + permissions
 *
 * Permissions come from `/team/permissions` grouped by category (Events,
 * Payments, Streams, …). The user toggles each one with a switch; the
 * full string list is sent to `POST/PUT /team/roles[/{id}]` on save.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  createRole,
  getPermissionsCatalog,
  listRoles,
  updateRole,
  type PermissionsCatalog,
  type TeamRole,
} from '@/features/teams/api';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function TeamRoleEditorScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';

  const [catalog, setCatalog] = useState<PermissionsCatalog | null>(null);
  const [role, setRole] = useState<TeamRole | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cat = await getPermissionsCatalog();
      setCatalog(cat);
      setOpenCats(new Set(Object.keys(cat.categories).slice(0, 2)));
      if (!isNew) {
        const roles = await listRoles();
        const found = roles.find((r) => r.id === id);
        if (!found) {
          setError('Role not found.');
          return;
        }
        setRole(found);
        setName(found.name);
        setDescription(found.description ?? '');
        setSelected(new Set(found.permissions));
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not load the permissions catalog.');
    } finally {
      setLoading(false);
    }
  }, [id, isNew]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (perm: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(perm) ? next.delete(perm) : next.add(perm);
      return next;
    });
  };

  const toggleCategory = (cat: string) => {
    setOpenCats((prev) => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const onSelectAllInCategory = (cat: string, defs: { name: string }[]) => {
    const allOn = defs.every((d) => selected.has(d.name));
    setSelected((prev) => {
      const next = new Set(prev);
      defs.forEach((d) => (allOn ? next.delete(d.name) : next.add(d.name)));
      return next;
    });
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give the role a name before saving.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        await createRole({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(selected),
        });
      } else {
        await updateRole(String(id), {
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(selected),
        });
      }
      router.back();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not save the role. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const totalSelected = selected.size;
  const totalAvailable = catalog?.total ?? 0;

  const categoryEntries = useMemo(
    () => (catalog ? Object.entries(catalog.categories) : []),
    [catalog],
  );

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title={isNew ? 'New role' : 'Edit role'} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !catalog) {
    return (
      <Screen>
        <ScreenHeader title={isNew ? 'New role' : 'Edit role'} />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
          <Button title="Try again" onPress={load} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScreenHeader title={isNew ? 'New role' : `Edit · ${role?.name ?? ''}`} />
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
          <Input
            label="Role name"
            value={name}
            onChangeText={setName}
            placeholder="Operations Lead"
            autoCapitalize="sentences"
          />
          <Input
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="What this role can do"
            multiline
            style={styles.multilineInput}
          />

          <View style={styles.statusBar}>
            <Text style={styles.statusBarText}>
              {totalSelected} of {totalAvailable} permissions selected
            </Text>
          </View>

          {categoryEntries.map(([cat, defs]) => {
            const open = openCats.has(cat);
            const granted = defs.filter((d) => selected.has(d.name)).length;
            const allOn = granted === defs.length;
            return (
              <View key={cat} style={styles.categoryCard}>
                <Pressable style={styles.categoryHead} onPress={() => toggleCategory(cat)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.categoryTitle}>{cat}</Text>
                    <Text style={styles.categoryCount}>
                      {granted} / {defs.length} granted
                    </Text>
                  </View>
                  <Pressable
                    hitSlop={6}
                    onPress={() => onSelectAllInCategory(cat, defs)}
                    style={styles.selectAllBtn}
                  >
                    <Text style={styles.selectAllText}>
                      {allOn ? 'Clear all' : 'Select all'}
                    </Text>
                  </Pressable>
                  <Ionicons
                    name={open ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>

                {open ? (
                  <View style={styles.permList}>
                    {defs.map((p) => {
                      const on = selected.has(p.name);
                      return (
                        <Pressable
                          key={p.name}
                          style={styles.permRow}
                          onPress={() => toggle(p.name)}
                        >
                          <View style={[styles.check, on && styles.checkOn]}>
                            {on ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.permName}>{p.name}</Text>
                            {p.description ? (
                              <Text style={styles.permDescription}>{p.description}</Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            title={saving ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}
            onPress={onSave}
            loading={saving}
            disabled={saving || !name.trim()}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, paddingBottom: 80, gap: spacing.md },
  multilineInput: { height: 80, paddingTop: spacing.md, textAlignVertical: 'top' },

  statusBar: {
    backgroundColor: c.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusBarText: { color: c.textOnPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  categoryCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  categoryHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  categoryTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  categoryCount: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
  selectAllBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.full, backgroundColor: c.infoBg },
  selectAllText: { color: c.primary, fontSize: 11, fontWeight: fontWeight.bold },

  permList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm, borderTopWidth: 1, borderTopColor: c.borderSoft, paddingTop: spacing.md },
  permRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 6 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkOn: { backgroundColor: c.primary, borderColor: c.primary },
  permName: { fontSize: fontSize.sm, color: c.text, fontWeight: fontWeight.semibold },
  permDescription: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },

  error: { color: c.error, fontSize: fontSize.sm, textAlign: 'center' },
}));
