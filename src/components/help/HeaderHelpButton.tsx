/**
 * Help in a screen's header (stack screens and the tab top bar), so nothing floats over a
 * button. The floating GlobalHelpButton steps aside wherever this is shown (see helpButtonLayout).
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments, type Href } from 'expo-router';
import { Pressable } from 'react-native';
import { useSharedT } from '@/i18n/sharedStrings';
import { makeStyles, radii, useTheme } from '@/theme';
import { HELP_HREF } from './GlobalHelpButton';

const HELP_SCREENS = ['help-center', 'contact_us', 'feedback'];

export function HeaderHelpButton() {
  const styles = useStyles();
  const router = useRouter();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const segments = useSegments() as string[];
  // The Help pages are where it leads.
  if (segments.some((s) => HELP_SCREENS.includes(s))) return null;
  return (
    <Pressable
      onPress={() => router.push(HELP_HREF as Href)}
      accessibilityRole="button"
      accessibilityLabel={tr('Help')}
      hitSlop={4}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
    >
      <Ionicons name="help-circle-outline" size={20} color={colors.text} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  btn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: c.glassTop,
    borderWidth: 1,
    borderColor: c.stroke,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
}));
