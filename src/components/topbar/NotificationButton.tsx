import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radii } from '@/theme';

/** Right slot: circular bell with a live unread dot. */
export function NotificationButton({ hasUnread, onPress }: { hasUnread?: boolean; onPress: () => void }) {
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

const styles = StyleSheet.create({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  dot: {
    position: 'absolute',
    top: 11,
    right: 12,
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
});
