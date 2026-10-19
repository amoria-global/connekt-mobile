/**
 * Glassmorphism: frosted surfaces over soft coloured light.
 *
 * Glass only reads when there is colour behind it. Over the flat app
 * background a blur has nothing to soften and the card just looks grey, so
 * pair glass with a `GlassBackdrop` (or a photo / gradient) underneath.
 *
 * THE PIECES
 * ----------
 *   GlassScene      a screen's aurora; every glass inside blurs it, no wiring
 *   GlassBackdrop   soft brand glows; `variant="aurora"` fills a whole screen
 *   GlassCard       a frosted card (thin / regular / thick)
 *   GlassSurface    the same glass as a bare layer, for an existing view such
 *                   as an animated bottom sheet; pair with `useGlassEdge()`
 *   GlassOnMedia    dark glass for pills and panels on photos and video
 *   GlassLayer      GlassOnMedia's glass alone, for a Pressable; add glassClear
 *
 * Strength is how much of the background survives: `thin` for chips over
 * colour, `regular` for content cards, `thick` wherever people read or type
 * (forms, sheets). Light mode frosts with white, dark mode smokes with the
 * palette's surface colour, so the glass always sits inside the theme.
 *
 * ANDROID
 * -------
 * expo-blur blurs nothing on Android unless it is told what to blur: the
 * content behind must sit in a `BlurTargetView`, passed as `blurTarget`.
 * `GlassBackdrop` is that target. Without one (a Modal, for instance, cannot
 * reach the screen behind it), or below Android 12, the glass falls back to a
 * near-solid fill: see-through without blur makes text collide with whatever
 * is behind it.
 *
 *   const target = useRef<View>(null);
 *   <View>
 *     <GlassBackdrop ref={target} />
 *     <GlassCard blurTarget={target}>…</GlassCard>
 *   </View>
 */
import { createContext, useContext, useId, useRef, type ReactNode, type RefObject } from 'react';
import {
  Image,
  Platform,
  StyleSheet,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { darkPalette, radii, spacing, useTheme, type Palette } from '@/theme';

export type GlassStrength = 'thin' | 'regular' | 'thick';

/** Fill opacity over a real blur, per scheme and strength. */
const FILL_OVER_BLUR = {
  light: { thin: 0.3, regular: 0.48, thick: 0.7 },
  dark: { thin: 0.32, regular: 0.5, thick: 0.72 },
} as const;
/** Fill opacity where nothing is blurred: near-solid, so text stays clean. */
const FILL_NO_BLUR = { light: 0.9, dark: 0.94 } as const;
const BLUR_INTENSITY = { thin: 30, regular: 45, thick: 60 } as const;

/** Light frosts with white; dark smokes with the palette's `surface` (#161B24). */
const fillRgb = (isDark: boolean) => (isDark ? '22,27,36' : '255,255,255');

/**
 * Glass catches light on its rim: bright at the top, fading toward the bottom.
 * Spread it onto any view that carries a `GlassSurface`.
 */
export function useGlassEdge(): ViewStyle {
  const { isDark } = useTheme();
  return isDark
    ? { borderColor: 'rgba(255,255,255,0.12)', borderBottomColor: 'rgba(255,255,255,0.05)' }
    : { borderColor: 'rgba(255,255,255,0.9)', borderBottomColor: 'rgba(255,255,255,0.45)' };
}

/**
 * For a `makeStyles` factory: a row or option tile sitting ON glass. A solid
 * card there would read as a sticker; this lets the frost carry through.
 */
export function glassTile(c: Palette): { backgroundColor: string; borderColor: string } {
  return c === darkPalette
    ? { backgroundColor: 'rgba(255,255,255,0.045)', borderColor: 'rgba(255,255,255,0.09)' }
    : { backgroundColor: 'rgba(255,255,255,0.58)', borderColor: 'rgba(15,18,23,0.08)' };
}

/**
 * For a `makeStyles` factory: the dim behind a glass sheet, inside the 40–60%
 * range that keeps the sheet clearly in front of the screen it covers.
 */
export function glassScrim(c: Palette): string {
  return c === darkPalette ? 'rgba(0,0,0,0.6)' : 'rgba(8,16,36,0.42)';
}

/** Corner radii for a `GlassSurface` inside a bottom sheet. */
export const sheetGlassRadius = (r: number): ViewStyle => ({
  borderTopLeftRadius: r,
  borderTopRightRadius: r,
});

/** The nearest `GlassScene`'s aurora, which glass inside it blurs by default. */
const GlassTargetContext = createContext<RefObject<View | null> | undefined>(undefined);

type GlassSceneProps = {
  children?: ReactNode;
  /**
   * A photo to sit behind the glass. Photography is what makes glass read as
   * glass; without one the scene falls back to the soft brand aurora.
   */
  image?: ImageSourcePropType;
  /** Run the backdrop up under the status bar (when the host Screen pads the top). */
  bleedTop?: boolean;
  /** Horizontal page gutter for the content (the light itself is full-bleed). */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A full-screen aurora for glass to sit on. Put it directly inside a
 * `<Screen padded={false}>`; the light runs up under the status bar, and any
 * `GlassCard` / `GlassSurface` inside blurs it on Android with no ref wiring.
 */
export function GlassScene({ children, image, bleedTop = true, padded = false, style }: GlassSceneProps) {
  const target = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const bleed = {
    top: bleedTop ? -insets.top : 0,
    left: padded ? -spacing.xl : 0,
    right: padded ? -spacing.xl : 0,
  };
  return (
    <View style={[styles.scene, padded && styles.scenePadded, style]}>
      {image ? (
        <BlurTargetView ref={target} style={[StyleSheet.absoluteFill, bleed]} pointerEvents="none">
          <Image source={image} style={styles.photo} resizeMode="cover" />
          {/* Dark mode calms the photo so the smoked glass and its text stay quiet. */}
          {isDark ? <View style={[StyleSheet.absoluteFill, styles.photoDim]} /> : null}
        </BlurTargetView>
      ) : (
        <GlassBackdrop ref={target} variant="aurora" style={bleed} />
      )}
      <GlassTargetContext.Provider value={target}>{children}</GlassTargetContext.Provider>
    </View>
  );
}

/** The standard glass form panel: thick, roomy, generously rounded. */
export const GLASS_PANEL: ViewStyle = { padding: spacing.xl, gap: spacing.lg, borderRadius: 28 };

type GlassSurfaceProps = {
  strength?: GlassStrength;
  /** The `GlassBackdrop` behind this surface. Android only. Defaults to the enclosing `GlassScene`'s. */
  blurTarget?: RefObject<View | null>;
  /**
   * Ignore the enclosing `GlassScene`. Set it inside a `Modal`: on Android a
   * modal is its own window and cannot blur a view in the screen below.
   */
  detached?: boolean;
  /** Overrides the strength's default blur, 1–100. */
  intensity?: number;
  /** Corner radii for the layer; match the host view's, since the layer clips itself. */
  style?: StyleProp<ViewStyle>;
};

/**
 * The glass itself as an absolutely-filling layer: blur, frost and a sheen of
 * light across the top. Put it first inside the host and make the host's own
 * background transparent.
 */
export function GlassSurface({
  strength = 'regular',
  blurTarget: explicitTarget,
  detached = false,
  intensity,
  style,
}: GlassSurfaceProps) {
  const { isDark } = useTheme();
  const sceneTarget = useContext(GlassTargetContext);
  const blurTarget = detached ? undefined : (explicitTarget ?? sceneTarget);
  const scheme = isDark ? 'dark' : 'light';
  const realBlur = Platform.OS !== 'android' || !!blurTarget;
  const alpha = realBlur ? FILL_OVER_BLUR[scheme][strength] : FILL_NO_BLUR[scheme];
  const sheen = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.55)';

  return (
    <View style={[StyleSheet.absoluteFill, styles.clip, style]} pointerEvents="none">
      {realBlur ? (
        <BlurView
          intensity={intensity ?? BLUR_INTENSITY[strength]}
          tint={isDark ? 'dark' : 'light'}
          blurTarget={blurTarget}
          blurMethod={blurTarget ? 'dimezisBlurViewSdk31Plus' : 'none'}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(${fillRgb(isDark)},${alpha})` }]} />
      <LinearGradient
        colors={[sheen, 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

type GlassCardProps = {
  children?: ReactNode;
  /** Layout of the card itself: padding, direction, radius. */
  style?: StyleProp<ViewStyle>;
  strength?: GlassStrength;
  /** Overrides the strength's default blur, 1–100. */
  intensity?: number;
  /** The `GlassBackdrop` (or other `BlurTargetView`) behind this card. Android only. */
  blurTarget?: RefObject<View | null>;
  /**
   * Lift the card off the page with a soft, wide, brand-tinted shadow. The
   * shadow needs an unclipped wrapper, so position the card with
   * `containerStyle` when this is on.
   */
  elevated?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export function GlassCard({
  children,
  style,
  strength = 'regular',
  intensity,
  blurTarget,
  elevated = false,
  containerStyle,
}: GlassCardProps) {
  const { isDark } = useTheme();
  const edge = useGlassEdge();
  const radius = StyleSheet.flatten(style)?.borderRadius ?? radii.lg;

  const card = (
    <View style={[styles.card, edge, style]}>
      <GlassSurface strength={strength} intensity={intensity} blurTarget={blurTarget} style={{ borderRadius: radius }} />
      {children}
    </View>
  );
  if (!elevated) return card;
  // Android's elevation shadow shows through translucent views as a dark
  // smudge, so the lift is iOS and web only; Android keeps the rim.
  return (
    <View
      style={[
        { borderRadius: radius },
        Platform.OS !== 'android' && (isDark ? styles.liftDark : styles.liftLight),
        containerStyle,
      ]}
    >
      {card}
    </View>
  );
}

type GlassOnMediaProps = {
  children?: ReactNode;
  /** The overlay's existing style, including its Android/fallback `backgroundColor`. */
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  /** Smoke laid over the blur so white text stays legible on bright photos. */
  fill?: string;
  /** A light hairline edge; right for pills, wrong for a panel flush with the card. */
  edge?: boolean;
  /** Render the plain overlay instead, e.g. while a pill shows a solid status colour. */
  off?: boolean;
};

/**
 * Dark frosted glass for pills and panels sitting on a photo or video. Always
 * dark, whatever the scheme, because the text on media is white.
 *
 * Android keeps the overlay's own translucent `backgroundColor`: blurring there
 * needs a `BlurTargetView` around every image, too costly across a list.
 */
export function GlassOnMedia({
  children,
  style,
  intensity = 30,
  fill = MEDIA_FILL,
  edge = false,
  off = false,
}: GlassOnMediaProps) {
  if (off || !MEDIA_BLUR) return <View style={style}>{children}</View>;
  return (
    <View style={[style, styles.onMedia, edge && styles.onMediaEdge]}>
      <GlassLayer intensity={intensity} fill={fill} />
      {children}
    </View>
  );
}

const MEDIA_FILL = 'rgba(5,10,24,0.32)';

/**
 * Where small media glass gets a real blur. Not Android (no BlurTargetView
 * around every photo) and not web: Chrome paints a backdrop blur as a square
 * behind a rounded chip, which reads as a halo. Both keep the overlay's own
 * translucent fill instead.
 */
const MEDIA_BLUR = Platform.OS === 'ios';

/**
 * The glass of `GlassOnMedia` on its own, for an element that has to stay
 * what it is (a `Pressable`, say). Put it first inside, and add `glassClear`
 * to the element's style so its fallback colour does not sit under the blur:
 *
 *   <Pressable style={[styles.btn, glassClear]}>
 *     <GlassLayer />
 *     <Ionicons … />
 *   </Pressable>
 */
export function GlassLayer({ intensity = 30, fill = MEDIA_FILL }: { intensity?: number; fill?: string }) {
  if (!MEDIA_BLUR) return null;
  return (
    <>
      <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} pointerEvents="none" />
    </>
  );
}

type Orb = { color: 'primary' | 'accent'; cx: string; cy: string; r: string; boost?: number };

const ORBS: Record<'panel' | 'aurora', Orb[]> = {
  // Behind a single card: three glows, weighted to the corners.
  panel: [
    { color: 'primary', cx: '12%', cy: '18%', r: '55%' },
    { color: 'accent', cx: '92%', cy: '62%', r: '50%' },
    { color: 'primary', cx: '40%', cy: '110%', r: '40%' },
  ],
  // Behind a whole screen: large, slow light that never sits under the
  // densest text (the middle third stays the calmest).
  aurora: [
    { color: 'primary', cx: '0%', cy: '4%', r: '48%', boost: 1.1 },
    { color: 'accent', cx: '105%', cy: '22%', r: '38%' },
    { color: 'primary', cx: '100%', cy: '78%', r: '42%', boost: 0.8 },
    { color: 'accent', cx: '-5%', cy: '96%', r: '40%', boost: 0.9 },
  ],
};

type GlassBackdropProps = {
  ref?: RefObject<View | null>;
  style?: StyleProp<ViewStyle>;
  /** `panel` behind one card; `aurora` behind a full screen. */
  variant?: 'panel' | 'aurora';
};

/**
 * Soft brand-coloured glows to sit behind glass. Fills its parent absolutely,
 * so put it first inside a container with `overflow: 'hidden'`.
 */
export function GlassBackdrop({ ref, style, variant = 'panel' }: GlassBackdropProps) {
  const { colors, isDark } = useTheme();
  const id = useId().replace(/:/g, '');
  const strength = (variant === 'aurora' ? 0.85 : 1) * (isDark ? 0.55 : 0.4);
  const orbs = ORBS[variant];

  return (
    <BlurTargetView ref={ref} style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {orbs.map((o, i) => (
            <RadialGradient key={i} id={`${id}${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors[o.color]} stopOpacity={Math.min(1, strength * (o.boost ?? 1))} />
              <Stop offset="1" stopColor={colors[o.color]} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {orbs.map((o, i) => (
          <Circle key={i} cx={o.cx} cy={o.cy} r={o.r} fill={`url(#${id}${i})`} />
        ))}
      </Svg>
    </BlurTargetView>
  );
}

/**
 * The frosted top and bottom bars. They cover the whole screen's content, so
 * Android has no single `BlurTargetView` to blur and stays near-solid there.
 */
export const GLASS_BAR = {
  intensity: 60,
  fillOpacity: Platform.OS === 'ios' ? 0.6 : 0.97,
} as const;

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  clip: { overflow: 'hidden' },
  scene: { flex: 1 },
  photoDim: { backgroundColor: 'rgba(8,10,16,0.38)' },
  // Explicit size as well as absoluteFill: react-native-web otherwise lays the
  // image out at its intrinsic size and shows only its top-left corner.
  photo: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  scenePadded: { paddingHorizontal: spacing.xl },
  liftLight: {
    shadowColor: '#0B2A66',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
  liftDark: {
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 14 },
  },
  onMedia: { backgroundColor: 'transparent', overflow: 'hidden' },
  onMediaEdge: { borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.28)' },
});

/** Style to pair with `GlassLayer`; nothing on Android, where the fallback colour stays. */
export const glassClear = MEDIA_BLUR ? [styles.onMedia, styles.onMediaEdge] : undefined;
