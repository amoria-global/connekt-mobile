import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View } from 'react-native';
import type { User } from '@/features/auth/types';
import { fonts, fontSize, makeStyles, radii, useTheme } from '@/theme';

/** Left slot: the avatar (photo or initials) inside the blue-to-magenta ring (design/home.png). Tap → profile. */
export function ProfileButton({ user, onPress }: { user: User | null; onPress: () => void; compact?: boolean }) {
  const styles = useStyles();
  const { gradients } = useTheme();
  const initials = `${user?.firstName?.[0] ?? user?.email?.[0] ?? '?'}${user?.lastName?.[0] ?? ''}`.toUpperCase();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open your profile"
      style={({ pressed }) => pressed && styles.pressed}
    >
      <LinearGradient colors={gradients.ring as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
        {user?.profilePicture ? (
          <Image source={{ uri: user.profilePicture }} style={styles.avatar} contentFit="cover" transition={200} />
        ) : (
          <View style={[styles.avatar, styles.fallback]}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const SIZE = 44;

const useStyles = makeStyles((c) => ({
  ring: { width: SIZE, height: SIZE, borderRadius: radii.full, padding: 2 },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  avatar: { width: '100%', height: '100%', borderRadius: radii.full, borderWidth: 2, borderColor: c.background },
  fallback: { backgroundColor: c.card, alignItems: 'center', justifyContent: 'center' },
  initials: { color: c.text, fontSize: fontSize.sm, fontFamily: fonts.display },
}));
