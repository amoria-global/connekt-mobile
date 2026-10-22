/**
 * Chooses between the photographer's own workspace and the ones they were invited to. Opened from the More menu, which
 * only offers it when there is something to choose. Switching remounts the signed-in app, so nothing from one workspace
 * can linger in the other.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { selectActive, useWorkspace } from '@/store/workspace';
import { fontSize, fontWeight, radii, spacing, makeStyles, useTheme } from '@/theme';

export function WorkspaceSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const memberships = useWorkspace((s) => s.memberships);
  const activeId = useWorkspace((s) => s.activeId);
  const active = useWorkspace(selectActive);
  const switchTo = useWorkspace((s) => s.switchTo);

  const pick = async (id: string | null) => {
    onClose();
    if (id === activeId) return;
    await switchTo(id);
    router.replace('/');
  };

  const rows: { id: string | null; title: string; caption: string }[] = [
    { id: null, title: 'My workspace', caption: 'Your own bookings, wallet and settings' },
    ...memberships.map((m) => ({ id: m.workspaceId, title: `${m.owner.name}'s workspace`, caption: 'Work as a collaborator. Wallet and settings stay with them.' })),
  ];

  return (
    <Sheet visible={visible} title="Workspace" subtitle={active ? `Now in ${active.owner.name}'s workspace` : 'Now in your own workspace'} onClose={onClose}>
      <View style={styles.list}>
        {rows.map((r) => {
          const selected = r.id === activeId;
          return (
            <Pressable key={r.id ?? 'own'} onPress={() => { void pick(r.id); }} accessibilityRole="radio"
              accessibilityState={{ selected }} accessibilityLabel={r.title}
              style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}>
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textMuted} />
              <View style={styles.flex}>
                <Text style={styles.title}>{r.title}</Text>
                <Text style={styles.caption}>{r.caption}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, borderWidth: 1,
    borderColor: c.borderSoft, padding: spacing.lg, minHeight: 56,
  },
  rowSelected: { borderColor: c.primary },
  pressed: { opacity: 0.9 },
  flex: { flex: 1, flexShrink: 1, gap: 2 },
  title: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  caption: { color: c.textMuted, fontSize: fontSize.sm },
}));
