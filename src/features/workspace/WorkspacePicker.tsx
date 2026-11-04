/**
 * The workspace picker: "Where do you want to work?". A collaborator login lands here after signing in when it belongs
 * to more than one workspace (with exactly one it opens straight away), and anyone can open it from the workspace banner.
 * A login with a business of its own also gets "My business". The server checks a live membership on every call, so
 * picking only chooses which workspace the next requests name.
 */
import { useEffect, useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { useAuth } from '@/store/auth';
import { useWorkspace } from '@/store/workspace';
import { fontSize, fontWeight, fonts, makeStyles, radii, spacing, useTheme } from '@/theme';

export function WorkspacePicker() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { isCollaboratorLogin } = useRole();
  const logout = useAuth((s) => s.logout);
  const memberships = useWorkspace((s) => s.memberships);
  const loading = useWorkspace((s) => s.loading);
  const hydrated = useWorkspace((s) => s.hydrated);
  const activeId = useWorkspace((s) => s.activeId);
  const refresh = useWorkspace((s) => s.refresh);
  const switchTo = useWorkspace((s) => s.switchTo);
  const loadedOnce = useRef(false);

  useEffect(() => {
    if (!hydrated) return;
    void refresh().finally(() => { loadedOnce.current = true; });
  }, [hydrated, refresh]);

  const open = async (id: string | null) => {
    if (id !== activeId) await switchTo(id);
    router.replace('/');
  };

  // Nothing to choose between: a collaborator with one workspace goes straight in.
  useEffect(() => {
    if (isCollaboratorLogin && !activeId && memberships.length === 1 && !loading) void switchTo(memberships[0].workspaceId);
  }, [isCollaboratorLogin, activeId, memberships, loading, switchTo]);

  const waiting = !hydrated || (loading && memberships.length === 0) || (isCollaboratorLogin && memberships.length === 1);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>WORKSPACES</Text>
        <Text style={styles.title} accessibilityRole="header">Where do you want to work?</Text>

        {waiting ? (
          <View style={styles.centered} accessibilityLabel="Loading your workspaces">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : memberships.length === 0 && isCollaboratorLogin ? (
          <>
            <EmptyState icon="briefcase-outline" title="You do not belong to a workspace yet"
              message="Ask the owner to invite you again. Their invitation email has a link that opens it."
              action={{ label: 'Sign out', onPress: () => { void logout(); } }} />
          </>
        ) : (
          <View style={styles.list}>
            {!isCollaboratorLogin ? (
              <Row icon="briefcase" title="My business" caption="Your own account" selected={activeId === null} onPress={() => { void open(null); }} />
            ) : null}
            {memberships.map((m) => (
              <Row key={m.workspaceId} icon="people" title={`${m.owner.name}'s workspace`}
                caption={m.role === 'COLLABORATOR' ? 'Workspace collaborator' : 'Photographer workspace'}
                selected={activeId === m.workspaceId} onPress={() => { void open(m.workspaceId); }} />
            ))}
          </View>
        )}

        {isCollaboratorLogin && memberships.length > 0 ? (
          <Button title="Sign out" variant="ghost" onPress={() => { void logout(); }} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, title, caption, selected, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; caption: string; selected: boolean; onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${caption}`}
      accessibilityState={{ selected }} style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}>
      <View style={styles.badge}><Ionicons name={icon} size={18} color={colors.primary} /></View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowCaption}>{caption}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing['3xl'] },
  eyebrow: { color: c.accent, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1 },
  title: { color: c.text, fontSize: fontSize['2xl'], fontFamily: fonts.display },
  centered: { paddingVertical: spacing['3xl'], alignItems: 'center', justifyContent: 'center' },
  list: { gap: spacing.sm },
  flex: { flex: 1, flexShrink: 1, gap: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, borderWidth: 1,
    borderColor: c.borderSoft, backgroundColor: c.card, padding: spacing.md, minHeight: 56,
  },
  rowSelected: { borderColor: c.primary },
  pressed: { opacity: 0.9 },
  badge: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.tint },
  rowTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  rowCaption: { color: c.textMuted, fontSize: fontSize.sm },
}));
