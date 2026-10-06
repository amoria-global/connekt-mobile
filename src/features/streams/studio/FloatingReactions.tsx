import { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type FloatingReaction = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  anim: Animated.Value;
  offset: number;
};

/** Reactions floating up beside the action rail (native-driver, auto-removed by the owner). */
function FloatingReactionsBase({
  items,
  bottom,
  travel,
}: {
  items: FloatingReaction[];
  bottom: number;
  travel: number;
}) {
  const insets = useSafeAreaInsets();
  if (items.length === 0) return null;
  return (
    <View pointerEvents="none" style={[styles.layer, { bottom, right: insets.right + 76 }]}>
      {items.map((fx) => (
        <Animated.View
          key={fx.id}
          style={[
            styles.item,
            {
              right: fx.offset,
              opacity: fx.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: fx.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -travel] }) },
              ],
            },
          ]}
        >
          <Ionicons name={fx.icon} size={28} color={fx.color} />
        </Animated.View>
      ))}
    </View>
  );
}

export const FloatingReactions = memo(FloatingReactionsBase);

const styles = StyleSheet.create({
  layer: { position: 'absolute', width: 70, height: 1, zIndex: 7 },
  item: { position: 'absolute', bottom: 0 },
});
