/**
 * A small pill that says whose workspace this is, shown in every screen header while the photographer is working
 * inside someone else's workspace, so nobody acts on the wrong photographer's records without knowing it. Renders
 * nothing in the photographer's own workspace.
 */
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';
import { selectActive, selectIsShared, useWorkspace } from '@/store/workspace';
import { fontSize, fontWeight, radii, spacing, makeStyles, useTheme } from '@/theme';

export function WorkspaceChip() {
  const styles = useStyles();
  const { colors } = useTheme();
  const isShared = useWorkspace(selectIsShared);
  const active = useWorkspace(selectActive);
  if (!isShared) return null;
  const label = active ? `${active.owner.name}'s workspace` : 'Shared workspace';
  return (
    <View style={styles.chip} accessible accessibilityLabel={`Working in ${label}`}>
      <Ionicons name="business-outline" size={13} color={colors.primary} />
      <Text style={styles.text} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: 190,
    borderRadius: radii.full, borderWidth: 1, borderColor: c.primary, paddingHorizontal: spacing.sm + 2, paddingVertical: 4,
    backgroundColor: c.tint,
  },
  text: { color: c.primary, fontSize: fontSize.xs, fontWeight: fontWeight.bold, flexShrink: 1 },
}));
