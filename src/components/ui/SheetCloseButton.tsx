import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';

/**
 * The close control for a screen presented as a sheet. A native sheet has no back chevron, so without this the only
 * way out is to drag it down, which is not obvious. Dismisses the sheet by going back.
 */
export function SheetCloseButton() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityRole="button"
      accessibilityLabel="Close"
      hitSlop={8}
      style={styles.btn}
    >
      <Ionicons name="close" size={22} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', top: 6, right: 8, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
});

/**
 * A close X pinned to the top right corner of a bottom sheet that a host draws itself (an action menu or a picker).
 * Those sheets otherwise close only by tapping the dim area, which is not obvious. Place it as the first child of the
 * sheet host; it floats above the content and does not change its layout.
 */
export function SheetCornerClose({ onPress, label = 'Close' }: { onPress: () => void; label?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={styles.corner}
    >
      <Ionicons name="close" size={20} color={colors.textMuted} />
    </Pressable>
  );
}
