import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, makeStyles, useTheme } from '@/theme';

import { FAB_RIGHT, FAB_SIZE, TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from '@/components/barMetrics';

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
    right: FAB_RIGHT,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: radii.full,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(4),
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
}));
