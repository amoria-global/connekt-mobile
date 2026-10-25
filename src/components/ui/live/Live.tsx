/**
 * Broadcast red: the live-event look (design/live.png). Red means one thing only, this is on
 * air right now; upcoming stays Midnight Glass blue and ended is muted grey. Every value comes
 * from the theme (`liveFill`, the palette's live family).
 *
 *  - LiveDot:     white dot whose halo pulses, scale 1 to 1.6 and opacity 1 to 0, every 1.4s.
 *  - LivePill:    the LIVE badge: vertical red gradient, 8pt corners, inset highlight and glow.
 *  - LiveButton:  Watch Live: red gradient, a white play disc, a shine that sweeps every 3s.
 *  - LiveTwinkle: wraps a live card: the red edge and a two-layer glow that breathes (40% to
 *                 60% over 2.4s).
 *  - LiveRing:    the story ring: solid red with a glow when live, the caller's colours otherwise.
 *
 * Reduced motion turns the pulse, the breathing and the shine off; the static look stays.
 * Sizes are tokens (`xs` to `lg`) and every piece takes `style`.
 */
import { memo, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { fonts, liveFill, onFill } from '@/theme';
import { useLoop, useReducedMotion } from './motion';

export type LiveSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZES: Record<LiveSize, { padH: number; padV: number; font: number; dot: number; gap: number; icon: number; radius: number }> = {
  xs: { padH: 6, padV: 2.5, font: 9, dot: 5, gap: 4, icon: 9, radius: 6 },
  sm: { padH: 9, padV: 4, font: 11, dot: 6, gap: 5, icon: 11, radius: 8 },
  md: { padH: 11, padV: 6, font: 13, dot: 8, gap: 7, icon: 13, radius: 8 },
  lg: { padH: 22, padV: 14, font: 16, dot: 9, gap: 10, icon: 18, radius: 14 },
};

/** The white recording dot: a solid core and a halo that pulses out and fades. */
export const LiveDot = memo(function LiveDot({ size = 6, color = onFill }: { size?: number; color?: string }) {
  const pulse = useLoop({ duration: 1400 });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
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
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
});

/** A four-point glint, scaling and fading on its own schedule (the reference's sparkles). */
const Glint = memo(function Glint({ left, top, size, delay }: { left: `${number}%`; top: `${number}%`; size: number; delay: number }) {
  const t = useLoop({ duration: 1800, delay, yoyo: true, rest: 0.6 });
  const opacity = t.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.9] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left, top, opacity, transform: [{ scale }] }}>
      <Ionicons name="sparkles" size={size} color={onFill} />
    </Animated.View>
  );
});

type PillProps = {
  label?: string;
  size?: LiveSize;
  /** Kept for callers; the reference badge has no glints, so this no longer draws any. */
  sparkle?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** The LIVE badge. */
export const LivePill = memo(function LivePill({ label = 'LIVE', size = 'sm', style }: PillProps) {
  const s = SIZES[size];
  return (
    <View style={[styles.pillWrap, { borderRadius: s.radius, boxShadow: liveFill.badgeShadow }, style]} accessible accessibilityLabel="Live now" accessibilityRole="text">
      <LinearGradient
        colors={liveFill.badge as unknown as [string, string, string]}
        locations={liveFill.badgeStops as unknown as [number, number, number]}
        style={[styles.pill, { paddingHorizontal: s.padH, paddingVertical: s.padV, gap: s.gap, borderRadius: s.radius }]}
      >
        <LiveDot size={s.dot} />
        <Text style={[styles.pillText, { fontSize: s.font, letterSpacing: s.font * 0.12 }]} allowFontScaling={false}>
          {label}
        </Text>
      </LinearGradient>
    </View>
  );
});

/** A soft white band that sweeps across the button, left to right, every 3s. */
function Shine({ width }: { width: number }) {
  const t = useLoop({ duration: 3000, easing: (v) => v });
  const band = Math.max(40, width * 0.22);
  const translateX = t.interpolate({ inputRange: [0, 0.4, 1], outputRange: [-band, width + band, width + band] });
  const reduced = useReducedMotion();
  if (reduced || width <= 0) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.shine, { width: band, transform: [{ translateX }, { skewX: '-20deg' }] }]}>
      <LinearGradient
        colors={['rgba(255,255,255,0)', liveFill.shine, 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

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

/** Watch Live: the one call to action of a live card. */
export const LiveButton = memo(function LiveButton({
  label,
  sub,
  onPress,
  size = 'lg',
  stretch = true,
  icon = 'play',
  accessibilityLabel,
  disabled,
  style,
}: ButtonProps) {
  const s = SIZES[size];
  const [width, setWidth] = useState(0);
  const disc = s.icon + 10;
  return (
    <View style={[stretch ? styles.stretch : styles.hug, { borderRadius: s.radius, boxShadow: liveFill.buttonShadow }, style]}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled: !!disabled }}
        style={({ pressed }) => [{ opacity: disabled ? 0.55 : pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}
      >
        <LinearGradient
          colors={liveFill.button as unknown as [string, string, string]}
          locations={liveFill.buttonStops as unknown as [number, number, number]}
          onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
          style={[styles.button, { paddingHorizontal: s.padH, paddingVertical: s.padV, gap: s.gap, borderRadius: s.radius }]}
        >
          <View style={styles.highlight} pointerEvents="none" />
          <Shine width={width} />
          <View style={[styles.disc, { width: disc, height: disc, borderRadius: disc / 2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ionicons name={icon} size={s.icon} color={liveFill.deep} style={icon === 'play' ? { marginLeft: 2 } : undefined} />
          </View>
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
          <Glint left="8%" top="18%" size={Math.max(7, s.icon - 6)} delay={0} />
          <Glint left="86%" top="14%" size={Math.max(8, s.icon - 4)} delay={600} />
          <Glint left="74%" top="62%" size={Math.max(6, s.icon - 8)} delay={1200} />
        </LinearGradient>
      </Pressable>
    </View>
  );
});

/**
 * Wraps a card that is live: the red edge, and a two-layer glow breathing between 40% and 60%.
 * The wrapper adds no layout of its own, so pass the card's radius.
 */
export const LiveTwinkle = memo(function LiveTwinkle({
  active,
  radius = 20,
  style,
  children,
}: {
  active: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const breathe = useLoop({ duration: 2400, yoyo: true, active, rest: 0.5 });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.6] });
  if (!active) return <View style={style}>{children}</View>;
  return (
    <View style={[styles.twinkle, style]}>
      {/* The glow is the reference's two-layer shadow, steady underneath, with the same recipe breathing 40% to 60% on top. */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: liveFill.cardGlow }]} />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, boxShadow: liveFill.cardGlow, opacity: glowOpacity }]}
      />
      {children}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1.5, borderColor: liveFill.cardBorder }]}
      />
    </View>
  );
});

/** Story ring: solid red with its glow while live; the caller's gradient when not. */
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
  const half = size / 2;
  const ring = live ? ([liveFill.top, liveFill.mid, liveFill.deep] as const) : colors;
  return (
    <View style={{ width: size, height: size, borderRadius: half, boxShadow: live ? liveFill.ringGlow : undefined }}>
      <View style={{ width: size, height: size, borderRadius: half, overflow: 'hidden' }}>
        <LinearGradient colors={ring as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  pillWrap: { alignSelf: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  pillText: { color: onFill, fontFamily: fonts.bold, textTransform: 'uppercase' },
  stretch: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    minHeight: 52,
    overflow: 'hidden',
  },
  highlight: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.45)' },
  shine: { position: 'absolute', top: -8, bottom: -8, left: 0 },
  disc: { backgroundColor: onFill, alignItems: 'center', justifyContent: 'center' },
  buttonCopy: { flexShrink: 1, alignItems: 'center' },
  buttonSub: { color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, marginTop: 1 },
  buttonText: { color: onFill, fontFamily: fonts.bold, letterSpacing: 0.2, flexShrink: 1 },
  twinkle: { position: 'relative' },
});
