/**
 * One photo tile that can be picked up with a long press and dragged to a new place in the grid (gesture-handler and
 * reanimated are already in the installed native build, so this is JavaScript only). The tile follows the finger and,
 * on release, the parent decides where it landed. Tap still opens the photo; the parent keeps hold-then-tap as the
 * accessible alternative, and reduced motion drops the lift and spring.
 */
import type { ReactNode } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

export function DragTile({
  enabled,
  onDrop,
  onLift,
  children,
}: {
  enabled: boolean;
  /** Called when the tile is released, with how far it moved. */
  onDrop: (dx: number, dy: number) => void;
  onLift?: () => void;
  children: ReactNode;
}) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const lift = useSharedValue(0);
  const reduce = useReducedMotion();

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activateAfterLongPress(250)
    .onStart(() => {
      lift.value = reduce ? 1 : withSpring(1);
      if (onLift) runOnJS(onLift)();
    })
    .onUpdate((e) => {
      x.value = e.translationX;
      y.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(onDrop)(e.translationX, e.translationY);
    })
    .onFinalize(() => {
      x.value = 0;
      y.value = 0;
      lift.value = reduce ? 0 : withSpring(0);
    });

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: 1 + lift.value * 0.06 }],
    zIndex: lift.value > 0 ? 10 : 0,
    opacity: lift.value > 0 ? 0.92 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>{children}</Animated.View>
    </GestureDetector>
  );
}
