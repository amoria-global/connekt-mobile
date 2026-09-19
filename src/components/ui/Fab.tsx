import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, makeStyles, useTheme } from '@/theme';

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_MARGIN = 20;

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function Fab({ icon = 'add', onPress }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarBottom = insets.bottom > 0 ? insets.bottom : TAB_BAR_MARGIN;
  const bottom = tabBarBottom + TAB_BAR_HEIGHT + 12;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.fab, { bottom }, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={28} color={colors.textOnPrimary} />
    </Pressable>
  );
}

const useStyles = makeStyles((c, e) => ({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(4),
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
