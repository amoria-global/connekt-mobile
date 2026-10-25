import { memo } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, onFill } from '@/theme';
import { RoundButton } from './RoundButton';
import { S, TOUCH } from './theme';

type Props = {
  opacity: Animated.Value;
  interactive: boolean;
  ending: boolean;
  onOpenComposer: () => void;
  onShare: () => void;
  onSettings: () => void;
  onEnd: () => void;
};

/**
 * Bottom bar. Hierarchy: reply capsule (normal) → share / settings
 * (secondary) → End LIVE (destructive, red, labelled, separated from the
 * other controls and confirmed before it does anything).
 */
function BottomLiveControlsBase({
  opacity,
  interactive,
  ending,
  onOpenComposer,
  onShare,
  onSettings,
  onEnd,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[
        styles.bar,
        {
          opacity,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingLeft: insets.left + 12,
          paddingRight: insets.right + 12,
        },
      ]}
    >
      <Pressable
        onPress={onOpenComposer}
        style={({ pressed }) => [styles.capsule, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Reply to your audience"
      >
        <Ionicons name="chatbubble-outline" size={17} color={S.textDim} />
        <Text style={styles.capsuleText} numberOfLines={1}>
          Say something…
        </Text>
      </Pressable>

      <RoundButton icon="paper-plane" label="Share live stream" onPress={onShare} />
      <RoundButton icon="options" label="Stream settings" onPress={onSettings} />

      <Pressable
        onPress={onEnd}
        disabled={ending}
        style={({ pressed }) => [styles.end, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="End live"
        accessibilityState={{ disabled: ending, busy: ending }}
      >
        {ending ? (
          <ActivityIndicator size="small" color={onFill} />
        ) : (
          <>
            <Ionicons name="stop" size={16} color={onFill} />
            <Text style={styles.endText}>End</Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

export const BottomLiveControls = memo(BottomLiveControlsBase);

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    zIndex: 10,
  },
  pressed: { opacity: 0.75 },
  capsule: {
    flex: 1,
    height: TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: TOUCH / 2,
    backgroundColor: S.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: S.line,
  },
  capsuleText: { flex: 1, fontFamily: fonts.regular, fontSize: 16, color: S.textDim },
  end: {
    height: TOUCH,
    minWidth: 76,
    paddingHorizontal: 16,
    marginLeft: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: TOUCH / 2,
    backgroundColor: 'rgba(220,38,38,0.92)',
  },
  endText: { fontFamily: fonts.bold, fontSize: 17, color: onFill },
});
