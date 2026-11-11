import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, useTheme } from '@/theme';

/**
 * Light / dark switch for the top bar's glass pill, so the appearance can be changed from any
 * screen that carries the bar, not only from Profile. It saves per device through
 * `useTheme().setPreference`, the same call the Profile button makes.
 */
export function AppearanceButton() {
  const styles = useStyles();
  const { colors, isDark, setPreference } = useTheme();

  return (
    <Pressable
      onPress={() => setPreference(isDark ? 'light' : 'dark')}
      accessibilityRole="switch"
      accessibilityLabel="Dark appearance"
      accessibilityState={{ checked: isDark }}
      style={({ pressed }) => [styles.half, pressed && styles.pressed]}
    >
      <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={colors.text} />
    </Pressable>
  );
}

const useStyles = makeStyles(() => ({
  half: { minHeight: 44, minWidth: 34, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
