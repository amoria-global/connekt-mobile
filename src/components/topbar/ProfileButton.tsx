import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { User } from '@/features/auth/types';
import { radii, fontSize, fontWeight, makeStyles } from '@/theme';

/** Left slot: circular avatar (photo or initials). Tap → profile. */
export function ProfileButton({ user, onPress }: { user: User | null; onPress: () => void }) {
  const styles = useStyles();
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

const useStyles = makeStyles((c, e) => ({
  btn: {
    width: SIZE,
    height: SIZE,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: c.surface,
    backgroundColor: c.surface,
    ...e(2),
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  avatar: { width: '100%', height: '100%', borderRadius: radii.full },
  fallback: { backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  initials: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
}));
