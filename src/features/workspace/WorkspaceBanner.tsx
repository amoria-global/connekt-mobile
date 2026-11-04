/**
 * "You're working in <Owner>'s workspace": a slim banner at the top of Home while someone is working inside another
 * person's workspace, so nobody acts on the wrong business without knowing it. A collaborator is also told what stays
 * with the owner. Renders nothing in a person's own workspace.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useRole } from '@/features/auth/role';
import { selectActive, selectIsShared, useWorkspace } from '@/store/workspace';
import { fontSize, fontWeight, makeStyles, radii, spacing, useTheme } from '@/theme';

export function WorkspaceBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const { isCollaboratorWorkspace, isCollaboratorLogin } = useRole();
  const isShared = useWorkspace(selectIsShared);
  const active = useWorkspace(selectActive);
  if (!isShared) return null;
  const name = active ? `${active.owner.name}'s workspace` : 'a shared workspace';
  return (
    <View style={styles.bar} accessibilityRole="summary" accessibilityLabel={`You're working in ${name}`}>
      <Ionicons name="business-outline" size={18} color={colors.primary} />
      <View style={styles.flex}>
        <Text style={styles.title}>You&apos;re working in {name}</Text>
        <Text style={styles.caption}>
          {isCollaboratorWorkspace ? 'Money, the wallet and account settings stay with the owner.' : 'Your own account and wallet are separate.'}
        </Text>
      </View>
      <Pressable onPress={() => router.push('/workspace-picker' as Href)} accessibilityRole="button" hitSlop={8}
        accessibilityLabel={isCollaboratorLogin ? 'Switch workspace' : 'Back to my workspace'} style={styles.action}>
        <Text style={styles.actionText}>{isCollaboratorLogin ? 'Switch' : 'My workspace'}</Text>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, borderWidth: 1,
    borderColor: c.primary, backgroundColor: c.tint, padding: spacing.md,
  },
  flex: { flex: 1, flexShrink: 1, gap: 2 },
  title: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  caption: { color: c.textMuted, fontSize: fontSize.xs },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
}));
