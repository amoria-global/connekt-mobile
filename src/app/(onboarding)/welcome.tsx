import { useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useOnboarding } from '@/store/onboarding';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

type Slide = {
  key: string;
  /** Remote cover photo (fills the screen). */
  photo?: string;
  /** Local transparent cutout, composited over the gradient. */
  subject?: number;
  /** Render the photo as a centered circle on the gradient (not full-bleed). */
  circle?: boolean;
  /** Looping muted video to show inside the circle (overrides the photo). */
  video?: number;
  gradient: readonly [string, string];
  title: string;
  body: string;
  cta: string;
};

/** Full-bleed photo intro. Copy mirrors the Connekyt landing value props. */
const SLIDES: Slide[] = [
  {
    key: 'book',
    subject: require('../../../assets/images/photographer.png'),
    gradient: ['#1E63D0', '#062B63'],
    title: 'Find your perfect\nphotographer',
    body: 'Browse photographers and videographers for any style, budget, or occasion. See their work and book the right one for you.',
    cta: 'Next',
  },
  {
    key: 'live',
    photo: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1000&q=80',
    gradient: ['#5B1A8A', '#062B63'],
    title: 'Go live,\ntogether',
    body: 'Stream your events live so guests anywhere can join the celebration with reactions, wishes, and gifts.',
    cta: 'Next',
  },
  {
    key: 'find',
    video: require('../../../assets/images/screen3.mp4'),
    gradient: ['#1E63D0', '#062B63'],
    title: 'Find your\nphotos',
    body: "Snap a selfie and we'll find every photo you're in across all events. Got an invite code? Jump straight to that event's gallery.",
    cta: 'Next',
  },
  {
    key: 'grow',
    subject: require('../../../assets/images/photographer2.png'),
    gradient: ['#2563EB', '#062B63'],
    title: 'Turn your passion\ninto income',
    body: 'Behind the camera? Join Connekyt to show off your work, get booked, and get paid securely.',
    cta: 'Get started',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const complete = useOnboarding((s) => s.complete);
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const scrollX = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const listRef = useRef<Animated.FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  // Leave room at the bottom for the fixed footer (dots + CTA).
  const contentPadBottom = insets.bottom + 168;

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 650,
      delay: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter, reduceMotion]);

  const finish = async () => {
    await complete();
    router.replace('/login');
  };

  const next = () => {
    if (isLast) return finish();
    const target = index + 1;
    setIndex(target);
    listRef.current?.scrollToOffset({ offset: target * width, animated: true });
  };

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const enterY = reduceMotion ? 0 : enter.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });

  return (
    <View style={styles.container}>
      <Animated.FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
        })}
        onMomentumScrollEnd={onMomentumEnd}
        scrollEventThrottle={16}
        renderItem={({ item, index: i }) => {
          const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
          const imgScale = reduceMotion
            ? 1
            : scrollX.interpolate({ inputRange, outputRange: [1.12, 1, 1.12], extrapolate: 'clamp' });
          const textShift = reduceMotion
            ? 0
            : scrollX.interpolate({ inputRange, outputRange: [width * 0.16, 0, -width * 0.16], extrapolate: 'clamp' });

          const a11y = `${item.title.replace('\n', ' ')}. ${item.body}`;

          // Centered circular layout (e.g. Find Your Photos).
          if (item.circle) {
            return (
              <View style={[styles.slide, { width, height }]}>
                <LinearGradient colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                <Animated.View
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={a11y}
                  style={[
                    styles.circleContent,
                    { paddingBottom: contentPadBottom, opacity: enter, transform: [{ translateX: textShift }, { translateY: enterY }] },
                  ]}
                >
                  <View style={styles.circleOuter}>
                    <View style={styles.circleRing} />
                    <View style={styles.circleImageWrap}>
                      {item.video != null ? (
                        <VideoFill source={item.video} />
                      ) : (
                        <Image source={{ uri: item.photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={450} />
                      )}
                    </View>
                    <View style={styles.circleDot} />
                  </View>
                  <Text style={[styles.title, styles.center]} accessibilityRole="header">
                    {item.title}
                  </Text>
                  <Text style={[styles.body, styles.center]}>{item.body}</Text>
                </Animated.View>
              </View>
            );
          }

          return (
            <View style={[styles.slide, { width, height }]}>
              {/* Brand gradient base */}
              <LinearGradient
                colors={item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {/* Full-screen media. Video is "contain" (show whole frame, no crop);
                  photos "cover" with a subtle zoom. */}
              {item.video != null ? (
                <View style={[StyleSheet.absoluteFill, { bottom: height * 0.3 }]}>
                  <VideoFill source={item.video} contentFit="contain" />
                </View>
              ) : (
                <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: imgScale }] }]}>
                  <Image
                    source={item.subject != null ? item.subject : { uri: item.photo }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={450}
                  />
                </Animated.View>
              )}
              {/* Brand tint over scene photos → unifies warm/cool images with the brand. */}
              {item.subject == null && item.video == null ? <View pointerEvents="none" style={styles.tint} /> : null}
              {/* Legibility scrim: darken top (status bar / Skip) and bottom (text). */}
              <LinearGradient
                colors={['rgba(6,28,63,0.45)', 'rgba(6,28,63,0.12)', 'rgba(6,28,63,0.6)', 'rgba(6,28,63,0.95)']}
                locations={[0, 0.32, 0.66, 1]}
                style={StyleSheet.absoluteFill}
              />

              {/* Per-slide copy */}
              <Animated.View
                accessible
                accessibilityRole="text"
                accessibilityLabel={a11y}
                style={[
                  styles.copy,
                  { paddingBottom: contentPadBottom, opacity: enter, transform: [{ translateX: textShift }, { translateY: enterY }] },
                ]}
              >
                <Text style={styles.title} accessibilityRole="header">
                  {item.title}
                </Text>
                <Text style={styles.body}>{item.body}</Text>
              </Animated.View>
            </View>
          );
        }}
      />

      {/* Fixed: Skip */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          hitSlop={8}
          style={({ pressed }) => [styles.skipPill, pressed && styles.pressed]}
        >
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      {/* Fixed: dots + CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {SLIDES.map((s, i) => (
            <Dash key={s.key} active={i === index} />
          ))}
        </View>

        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityHint={isLast ? 'Finishes the intro and opens sign in' : 'Goes to the next slide'}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{SLIDES[index]?.cta ?? 'Next'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Looping, muted video that fills its parent (full-bleed or circle). */
function VideoFill({ source, contentFit = 'cover' }: { source: number; contentFit?: 'cover' | 'contain' }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit={contentFit} nativeControls={false} />
    </View>
  );
}

/** Pagination dash that animates its real width (reserves layout space → no overlap). */
function Dash({ active }: { active: boolean }) {
  const w = useRef(new Animated.Value(active ? 26 : 8)).current;
  const o = useRef(new Animated.Value(active ? 1 : 0.4)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(w, { toValue: active ? 26 : 8, duration: 240, useNativeDriver: false }),
      Animated.timing(o, { toValue: active ? 1 : 0.4, duration: 240, useNativeDriver: false }),
    ]).start();
  }, [active, w, o]);
  return <Animated.View style={[styles.dash, { width: w, opacity: o }]} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  slide: { overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,58,133,0.28)' },

  topBar: { position: 'absolute', top: 0, right: 0, left: 0, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg },
  skipPill: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  skip: { color: colors.textOnPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  pressed: { opacity: 0.6 },

  copy: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.xl, gap: spacing.md },

  circleContent: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.xl },
  circleOuter: { width: 248, height: 248, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  circleRing: {
    position: 'absolute',
    width: 248,
    height: 248,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  circleImageWrap: {
    width: 216,
    height: 216,
    borderRadius: radii.full,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: colors.surfaceMuted,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  circleDot: {
    position: 'absolute',
    top: 8,
    right: 18,
    width: 22,
    height: 22,
    borderRadius: radii.full,
    backgroundColor: colors.accent,
  },
  center: { textAlign: 'center' },
  title: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: fontWeight.extrabold,
    color: colors.textOnPrimary,
    letterSpacing: -0.6,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  body: {
    fontSize: fontSize.md,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 360,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, gap: spacing.lg },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  dash: { height: 6, borderRadius: radii.full, backgroundColor: colors.textOnPrimary },

  cta: {
    height: 56,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
