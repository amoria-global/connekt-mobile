import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { radii, makeStyles, useTheme } from '@/theme';

/** Right slot: circular bell with a live unread dot. */
export function NotificationButton({ hasUnread, onPress }: { hasUnread?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hasUnread ? 'Notifications, unread' : 'Notifications'}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Ionicons name="notifications-outline" size={22} color={colors.text} />
      {hasUnread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const SIZE = 46;

const useStyles = makeStyles((c, e) => ({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(2),
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: c.accent,
    borderWidth: 1.5,
    borderColor: c.surface,
  },
}));
