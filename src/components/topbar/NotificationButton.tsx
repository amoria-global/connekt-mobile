import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { makeStyles, radii, useTheme } from '@/theme';

/** A round glass icon button for the top bar: 40pt drawn, 44pt to the touch. */
export function TopBarIconButton({
  icon,
  label,
  onPress,
  dot,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  /** A magenta dot: something new is waiting. */
  dot?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={2}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={colors.text} />
      {dot ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

/** Right slot: the bell with a live unread dot. */
export function NotificationButton({ hasUnread, onPress }: { hasUnread?: boolean; onPress: () => void; compact?: boolean }) {
  return (
    <TopBarIconButton
      icon="notifications-outline"
      label={hasUnread ? 'Notifications, unread' : 'Notifications'}
      onPress={onPress}
      dot={hasUnread}
    />
  );
}

const SIZE = 40;

const useStyles = makeStyles((c) => ({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    backgroundColor: c.glassTop,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  dot: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 9,
    height: 9,
    borderRadius: radii.full,
    backgroundColor: c.accent,
    borderWidth: 1.5,
    borderColor: c.background,
  },
}));
