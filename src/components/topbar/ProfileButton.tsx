import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { User } from '@/features/auth/types';
import { colors, fontSize, fontWeight, radii } from '@/theme';

/** Left slot: circular avatar (photo or initials). Tap → profile. */
export function ProfileButton({ user, onPress }: { user: User | null; onPress: () => void }) {
  const initials = (user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open your profile"
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      {user?.profilePicture ? (
        <Image source={{ uri: user.profilePicture }} style={styles.avatar} contentFit="cover" transition={200} />
      ) : (
        <View style={[styles.avatar, styles.fallback]}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      )}
    </Pressable>
  );
}

const SIZE = 46;

const styles = StyleSheet.create({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  avatar: { width: '100%', height: '100%', borderRadius: radii.full },
  fallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
