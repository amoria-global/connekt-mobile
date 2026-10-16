/**
 * Live-event look, matching the web `ev-card-live` / `ev-card.is-live` / `ev-story-*`
 * styles and going a little further on a phone: haptic-free, native-driver motion only.
 *
 *  - LiveDot:     white dot that blinks, with an expanding halo.
 *  - LivePill:    red gradient pill, breathing halo, optional sparkle glints.
 *  - LiveButton:  full-size call to action (Watch live) with ripple rings and glints.
 *  - LiveTwinkle: wraps a card; red border that brightens, plus two outward ripples.
 *  - LiveRing:    story ring whose gradient spins, with a pulsing halo.
 *
 * Sizes are tokens (`xs` to `lg`) and every piece also takes `style`, so a pill can sit
 * in a 24pt chip or stretch across a full-width button without per-screen styles.
 */
import { memo, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { LIVE_RED, LIVE_RED_GLOW, LIVE_RED_LIGHT, useLoop, useReducedMotion } from './motion';

export type LiveSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<LiveSize, { padH: number; padV: number; font: number; dot: number; gap: number; icon: number }> = {
  xs: { padH: 6, padV: 2.5, font: 8.5, dot: 5, gap: 3, icon: 9 },
  sm: { padH: 9, padV: 4, font: 10, dot: 6, gap: 4, icon: 11 },
  md: { padH: 14, padV: 7, font: 11.5, dot: 8, gap: 7, icon: 13 },
  lg: { padH: 22, padV: 14, font: 15, dot: 9, gap: 9, icon: 18 },
};

/** Blinking white dot with a halo that grows and fades, like a recording light. */
export const LiveDot = memo(function LiveDot({ size = 6, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const blink = useLoop({ duration: 1200, yoyo: true });
  const halo = useLoop({ duration: 1500 });
  const opacity = blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size,
          backgroundColor: color,
          opacity: haloOpacity,
          transform: [{ scale: haloScale }],
        }}
      />
      <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />
    </View>
  );
});

/** A four-point glint that scales and fades on its own schedule. */
const Glint = memo(function Glint({
  left,
  top,
  size,
  delay,
}: {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  delay: number;
}) {
  const t = useLoop({ duration: 1800, delay, yoyo: true });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.1] });
  const opacity = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 1] });
  const rotate = t.interpolate({ inputRange: [0, 1], outputRange: ['-20deg', '20deg'] });
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left, top, opacity, transform: [{ scale }, { rotate }] }}
    >
      <Ionicons name="sparkles" size={size} color="#FFFFFF" />
    </Animated.View>
  );
});

function Ripple({ delay, radius, grow }: { delay: number; radius: number; grow: number }) {
  const t = useLoop({ duration: 1800, delay });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, grow] });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, borderWidth: 2, borderColor: LIVE_RED_LIGHT, opacity, transform: [{ scale }] },
      ]}
    />
  );
}

type PillProps = {
  label?: string;
  size?: LiveSize;
  /** Show the glints. Off for tiny badges where they would be noise. */
  sparkle?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The red "LIVE" pill. */
export const LivePill = memo(function LivePill({ label = 'LIVE', size = 'sm', sparkle = false, style }: PillProps) {
  const s = SIZES[size];
  return (
    <View style={[styles.pillWrap, style]} accessible accessibilityLabel="Live now" accessibilityRole="text">
      <Ripple delay={0} radius={999} grow={size === 'xs' ? 1.25 : 1.35} />
      <LinearGradient
        colors={[LIVE_RED_LIGHT, LIVE_RED]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.pill, { paddingHorizontal: s.padH, paddingVertical: s.padV, gap: s.gap }]}
      >
        <LiveDot size={s.dot} />
        <Text style={[styles.pillText, { fontSize: s.font }]} allowFontScaling={false}>
          {label}
        </Text>
        {sparkle ? (
          <>
            <Glint left="82%" top="-12%" size={s.icon} delay={0} />
            <Glint left="6%" top="70%" size={Math.max(7, s.icon - 4)} delay={700} />
          </>
        ) : null}
      </LinearGradient>
    </View>
  );
});

type ButtonProps = {
  label: string;
  /** Second line under the label (a price, a hint). */
  sub?: string;
  onPress: () => void;
  size?: LiveSize;
  /** Fill the row instead of hugging the label. */
  stretch?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Full-size "Watch live" call to action: gradient, rippling halo, sparkle glints. */
export const LiveButton = memo(function LiveButton({
  label,
  sub,
  onPress,
  size = 'lg',
  stretch = true,
  icon = 'play-circle',
  accessibilityLabel,
  disabled,
  style,
}: ButtonProps) {
  const s = SIZES[size];
  const breathe = useLoop({ duration: 1800, yoyo: true });
  const lift = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] });
  const radius = s.padV + s.font * 0.9;
  return (
    <Animated.View style={[stretch ? styles.stretch : styles.hug, { transform: [{ scale: lift }] }, style]}>
      <Ripple delay={0} radius={radius} grow={stretch ? 1.06 : 1.18} />
      <Ripple delay={900} radius={radius} grow={stretch ? 1.1 : 1.3} />
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [{ opacity: disabled ? 0.55 : pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <LinearGradient
          colors={[LIVE_RED_LIGHT, LIVE_RED, '#B91C1C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.button, { paddingHorizontal: s.padH, paddingVertical: s.padV, gap: s.gap, borderRadius: radius }]}
        >
          <View style={styles.sheen} pointerEvents="none" />
          <LiveDot size={s.dot} />
          <View style={styles.buttonCopy}>
            <Text style={[styles.buttonText, { fontSize: s.font }]} numberOfLines={1}>
              {label}
            </Text>
            {sub ? (
              <Text style={[styles.buttonSub, { fontSize: Math.max(10, s.font - 3) }]} numberOfLines={1}>
                {sub}
              </Text>
            ) : null}
          </View>
          <Ionicons name={icon} size={s.icon + 3} color="#FFFFFF" />
          <Glint left="88%" top="6%" size={s.icon} delay={0} />
          <Glint left="12%" top="62%" size={Math.max(8, s.icon - 3)} delay={600} />
          <Glint left="52%" top="-6%" size={Math.max(7, s.icon - 5)} delay={1200} />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
});

/**
 * Wraps a card that is live: two ripples travel outward and a bright border breathes.
 * The wrapper adds no layout of its own, so pass the card's radius.
 */
export const LiveTwinkle = memo(function LiveTwinkle({
  active,
  radius = 16,
  style,
  children,
}: {
  active: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const border = useLoop({ duration: 1000, yoyo: true, active, rest: 1 });
  const borderOpacity = border.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  if (!active) return <View style={style}>{children}</View>;
  return (
    <View style={[styles.twinkle, style]}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: radius, borderWidth: 2, borderColor: LIVE_RED_GLOW, opacity: reduced ? 1 : borderOpacity },
        ]}
      />
      {!reduced ? (
        <>
          <Ripple delay={0} radius={radius} grow={1.05} />
          <Ripple delay={900} radius={radius} grow={1.09} />
        </>
      ) : null}
    </View>
  );
});

/** Story ring: spinning gradient behind the avatar, with a pulsing halo when live. */
export const LiveRing = memo(function LiveRing({
  size,
  colors,
  live,
  children,
}: {
  size: number;
  colors: readonly [string, string, ...string[]];
  live: boolean;
  children: ReactNode;
}) {
  const spin = useLoop({ duration: 4000, easing: (v) => v, active: live });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const half = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      {live ? <Ripple delay={0} radius={half} grow={1.3} /> : null}
      <View style={{ width: size, height: size, borderRadius: half, overflow: 'hidden' }}>
        <Animated.View
          style={{
            position: 'absolute',
            // the gradient square is larger than the circle so its corners never show while it turns
            left: -size * 0.21,
            top: -size * 0.21,
            width: size * 1.42,
            height: size * 1.42,
            transform: [{ rotate }],
          }}
        >
          <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  pillWrap: { alignSelf: 'flex-start' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    shadowColor: LIVE_RED,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  pillText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  stretch: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    minHeight: 48,
    shadowColor: LIVE_RED,
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    overflow: 'visible',
  },
  buttonCopy: { flexShrink: 1, alignItems: 'center' },
  buttonSub: { color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 1 },
  buttonText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: 0.6, flexShrink: 1 },
  sheen: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '48%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  twinkle: { position: 'relative' },
});
