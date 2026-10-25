import { memo } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, onFill } from '@/theme';
import { V } from '../viewerTheme';
import type { FloatingReaction } from '../hooks/useFloatingReactions';
import { REACTIONS } from '../utils';

/** Rising reactions layer. Non-interactive; never blocks the video. */
export const ReactionOverlay = memo(function ReactionOverlay({
  items,
  rise = 170,
  rightInset = 14,
  bottom = 24,
}: {
  items: FloatingReaction[];
  rise?: number;
  rightInset?: number;
  bottom?: number;
}) {
  if (items.length === 0) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants">
      {items.map((fx) => (
        <Animated.View
          key={fx.id}
          style={[
            styles.floater,
            {
              bottom,
              right: rightInset + fx.lane * 44,
              opacity: fx.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: fx.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -rise] }) },
                { scale: fx.anim.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.6, 1.1, 1] }) },
              ],
            },
          ]}
        >
          <Ionicons name={fx.icon} size={26} color={fx.color} />
        </Animated.View>
      ))}
    </View>
  );
});

type RailProps = {
  onReact: (key: string) => void;
  onGift?: () => void;
  vertical?: boolean;
};

/** Quick-reaction buttons (existing reaction keys) + optional gift trigger. */
export const ReactionRail = memo(function ReactionRail({ onReact, onGift, vertical }: RailProps) {
  return (
    <View style={[styles.rail, vertical && styles.railV]}>
      {REACTIONS.map((r) => (
        <Pressable
          key={r.key}
          onPress={() => onReact(r.key)}
          accessibilityRole="button"
          accessibilityLabel={`Send ${r.label} reaction`}
          style={({ pressed }) => [styles.react, pressed && styles.reactPressed]}
        >
          <Ionicons name={r.icon} size={22} color={r.color} />
        </Pressable>
      ))}
      {onGift ? (
        <Pressable
          onPress={onGift}
          accessibilityRole="button"
          accessibilityLabel="Send gift to broadcaster"
          style={({ pressed }) => [styles.gift, vertical && styles.giftV, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="gift" size={18} color={onFill} />
          {vertical ? null : <Text style={styles.giftText}>Gift</Text>}
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  floater: { position: 'absolute' },
  rail: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  railV: { flexDirection: 'column' },
  react: {
    width: V.hit,
    height: V.hit,
    borderRadius: V.hit / 2,
    backgroundColor: V.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactPressed: { transform: [{ scale: 0.92 }], backgroundColor: 'rgba(255,255,255,0.2)' },
  gift: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: V.hit,
    paddingHorizontal: 16,
    borderRadius: V.hit / 2,
    backgroundColor: V.accent,
    marginLeft: 'auto',
  },
  giftV: { width: V.hit, paddingHorizontal: 0, justifyContent: 'center', marginLeft: 0 },
  giftText: { fontFamily: fonts.bold, fontSize: 15, color: onFill },
});
