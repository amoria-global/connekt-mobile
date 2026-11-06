/**
 * The labelled create button, bottom-right above the tab bar. It shrinks to a round "+" while the list scrolls down
 * and expands on scroll up. Lists add `FAB_SPACE` to their bottom padding so it never covers the last row.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTabBarClearance } from '@/hooks/useScrollClearance';
import { glowRgb, makeStyles, radii, shadows, spacing, useReducedMotion, useTheme } from '@/theme';

/** Height of the button plus its gap, to add under the last list row. */
export const FAB_SPACE = 56 + spacing.lg;

/** Collapsed while scrolling down past the first screenful, expanded again on any scroll up. */
export function useFabCollapse() {
  const [collapsed, setCollapsed] = useState(false);
  const last = useRef(0);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = Math.max(0, e.nativeEvent.contentOffset.y);
    const dy = y - last.current;
    if (Math.abs(dy) < 6) return;
    last.current = y;
    setCollapsed(dy > 0 && y > 40);
  }, []);
  return { collapsed, onScroll };
}

export function CreateFab({ label, collapsed = false, onPress }: { label: string; collapsed?: boolean; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const clearance = useTabBarClearance();
  const reduce = useReducedMotion();
  const [grow] = useState(() => new Animated.Value(collapsed ? 0 : 1));
  useEffect(() => {
    Animated.timing(grow, { toValue: collapsed ? 0 : 1, duration: reduce ? 0 : 160, useNativeDriver: false }).start();
  }, [collapsed, grow, reduce]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.fab, { bottom: clearance - spacing.lg + spacing.md }, pressed && styles.pressed]}
    >
      <Ionicons name="add" size={24} color={colors.textOnPrimary} />
      <Animated.View style={{ maxWidth: grow.interpolate({ inputRange: [0, 1], outputRange: [0, 170] }), opacity: grow, overflow: 'hidden' }}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  fab: {
    position: 'absolute',
    right: spacing.lg,
    minWidth: 56,
    height: 56,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    backgroundColor: c.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    boxShadow: shadows.glow(glowRgb.primary, 0.35),
  },
  pressed: { opacity: 0.88 },
  label: { color: c.textOnPrimary, fontSize: 15, fontWeight: '700' },
}));
