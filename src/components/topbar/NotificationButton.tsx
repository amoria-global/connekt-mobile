import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';
import { radii, makeStyles, useTheme } from '@/theme';

/** Right slot: circular bell with a live unread dot. */
export function NotificationButton({ hasUnread, onPress, compact }: { hasUnread?: boolean; onPress: () => void; compact?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hasUnread ? 'Notifications, unread' : 'Notifications'}
      style={({ pressed }) => [styles.btn, compact && styles.btnCompact, pressed && styles.pressed]}
    >
      <Ionicons name="notifications-outline" size={compact ? 20 : 22} color={colors.text} />
      {hasUnread ? <View style={[styles.dot, compact && styles.dotCompact]} /> : null}
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
  btnCompact: { width: 40, height: 40, backgroundColor: 'transparent', shadowOpacity: 0, elevation: 0 },
  dotCompact: { top: 7, right: 9, borderColor: c.card },
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
