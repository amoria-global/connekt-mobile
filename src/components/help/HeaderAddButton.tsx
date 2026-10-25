/**
 * The create action in a header ("+"), beside Help. It replaces the floating add buttons, which
 * sat over list rows: Midnight Glass lets nothing float over a button. Flat blue, not raised:
 * the screen's raised action, if any, is its own.
 */
import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { makeStyles, radii, shadows } from '@/theme';
import { HeaderHelpButton } from './HeaderHelpButton';

export function HeaderAddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={22} color={styles.icon.color as string} />
    </Pressable>
  );
}

/** Help and the create action together, for a stack header's `headerRight`. */
export function HeaderHelpAndAdd({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <HeaderHelpButton />
      <HeaderAddButton label={label} onPress={onPress} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    boxShadow: shadows.highlight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: c.textOnPrimary },
  pressed: { opacity: 0.85 },
}));
