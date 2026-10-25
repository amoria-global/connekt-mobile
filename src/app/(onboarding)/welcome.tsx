import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
import { GlassLayer, glassClear } from '@/components/ui/GlassCard';
import { PhotoLanguagePill } from '@/features/auth/AuthGlassLayout';
import { useLanguage } from '@/store/language';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useOnboarding } from '@/store/onboarding';
import { fonts, spacing, radii, fontSize, fontWeight, makeStyles, onFill } from '@/theme';

type Slide = {
  key: string;
  /** Remote cover photo (fills the screen). */
  photo?: string;
  /** Local transparent cutout, composited over the gradient. */
  subject?: number;
  /** Local full-bleed scene photo (no cutout), brand-tinted for cohesion. */
  scene?: number;
  /**
   * Horizontal crop focus for a wide scene on a tall screen, 0 (left edge)
   * to 1 (right edge): only a narrow slice of a landscape photo fits.
   */
  focus?: number;
  /** Vertical crop focus, 0 (top) to 1 (bottom). Defaults to 0.5 (center). */
  verticalFocus?: number;
  /** Render the photo as a centered circle on the gradient (not full-bleed). */
  circle?: boolean;
  /** Looping muted video to show inside the slide. */
  video?: number;
  /** Whether the video should cover the whole screen as a full-bleed live backdrop. */
  videoCover?: boolean;
  gradient: readonly [string, string];
  title: string;
  body: string;
  cta: string;
};

export default function WelcomeScreen() {
  const styles = useStyles();
  const router = useRouter();
  const complete = useOnboarding((s) => s.complete);
  const reduceMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { language, t } = useLanguage();

  const slides: Slide[] = useMemo(
    () => [
      {
        key: 'photographer',
        subject: require('../../../assets/images/photographer.png'),
        gradient: ['#1E63D0', '#062B63'],
        title: t('onboardingTitle1'),
        body: t('onboardingBody1'),
        cta: t('next'),
      },
      {
        key: 'coordinator',
        scene: require('../../../assets/images/onboarding-coordinator.jpg'),
        focus: 0.5,
        verticalFocus: 0.45,
        gradient: ['#1E3A8A', '#062B63'],
        title: t('onboardingTitle2'),
        body: t('onboardingBody2'),
        cta: t('next'),
      },
      {
        key: 'client',
        video: require('../../../assets/images/onboarding-live-blue.mp4'),
        videoCover: true,
        gradient: ['#1E63D0', '#062B63'],
        title: t('onboardingTitle3'),
        body: t('onboardingBody3'),
        cta: t('next'),
      },
      {
        key: 'guest',
        video: require('../../../assets/images/screen3.mp4'),
        // Starts on the video's own black, so the frame has no visible edge.
        gradient: ['#000000', '#03122B'],
        title: t('onboardingTitle4'),
        body: t('onboardingBody4'),
        cta: t('getStarted'),
      },
    ],
    [language, t],
  );

  const scrollX = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const [copyIn] = useState(() => new Animated.Value(1));
  const listRef = useRef<Animated.FlatList<Slide>>(null);
  const [index, setIndex] = useState(0);
  // Height of the copy + dots + button block, so the video frame stops above it.
  const [footerHeight, setFooterHeight] = useState(Math.round(height * 0.38));
  const isLast = index === slides.length - 1;
  const slide = slides[index] ?? slides[0];

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

  // Each slide's copy settles in as the imagery arrives.
  useEffect(() => {
    if (reduceMotion) return;
    copyIn.setValue(0);
    Animated.timing(copyIn, {
      toValue: 1,
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [index, copyIn, reduceMotion]);

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

  const copyY = reduceMotion ? 0 : copyIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });

  return (
    <View style={styles.container}>
    <Animated.FlatList
        ref={listRef}
        data={slides}
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
          return (
            <View style={[styles.slide, { width, height }]}>
              <LinearGradient
                colors={item.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
                {item.video != null ? (
                  item.videoCover ? (
                    <View style={StyleSheet.absoluteFill}>
                      <VideoFill source={item.video} contentFit="cover" />
                    </View>
                  ) : (
                    // The whole frame, centred in the space above the copy.
                    <View style={[StyleSheet.absoluteFill, { top: insets.top + 56, bottom: footerHeight }]}>
                      <VideoFill source={item.video} contentFit="contain" />
                    </View>
                  )
                ) : (
                  <Animated.View style={[StyleSheet.absoluteFill, { opacity: enter, transform: [{ scale: imgScale }] }]}>
                    <Image
                      source={item.scene ?? item.subject ?? { uri: item.photo }}
                      style={styles.fill}
                      contentFit="cover"
                      contentPosition={
                        item.focus != null || item.verticalFocus != null
                          ? {
                              left: `${Math.round((item.focus ?? 0.5) * 100)}%`,
                              top: `${Math.round((item.verticalFocus ?? 0.5) * 100)}%`,
                            }
                          : 'center'
                      }
                      transition={450}
                    />
                  </Animated.View>
                )}
                {/* Legibility scrim: darkens the top (Skip, status bar) and the
                    bottom, where the copy sits straight on the imagery. */}
                <LinearGradient
                  colors={['rgba(6,28,63,0.45)', 'rgba(6,28,63,0)', 'rgba(6,28,63,0.7)', 'rgba(6,28,63,0.96)']}
                  locations={[0, 0.28, 0.6, 1]}
                  style={StyleSheet.absoluteFill}
                />
              </View>
            );
          }}
        />

      {/* Imagery under the status bar in both schemes, so its icons stay light. */}
      <StatusBar style="light" />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={finish}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          hitSlop={8}
          style={({ pressed }) => [styles.skipPill, glassClear, pressed && styles.pressed]}
        >
          <GlassLayer fill="rgba(0,0,0,0.22)" />
          <Text style={styles.skip}>{t('skip')}</Text>
        </Pressable>
        <PhotoLanguagePill />
      </View>

      {/* Copy, dots and button, straight on the imagery. */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}
        onLayout={(e) => setFooterHeight(Math.round(e.nativeEvent.layout.height))}
      >
        <Animated.View
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${slide.title.replace('\n', ' ')}. ${slide.body}`}
          style={[styles.copy, { opacity: copyIn, transform: [{ translateY: copyY }] }]}
        >
          <Text
            style={styles.title}
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {slide.title}
          </Text>
          <Text style={styles.body}>{slide.body}</Text>
        </Animated.View>

        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {slides.map((s, i) => (
            <Dash key={s.key} active={i === index} />
          ))}
        </View>

        <Pressable
          onPress={next}
          accessibilityRole="button"
          accessibilityHint={isLast ? 'Finishes the intro and opens sign in' : 'Goes to the next slide'}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>{slide.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Looping, muted video that fills its parent (full-bleed or circle). */
function VideoFill({ source, contentFit = 'cover' }: { source: number; contentFit?: 'cover' | 'contain' }) {
  const styles = useStyles();
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    // Decorative, silent video. Without this it still activates an iOS audio
    // session and PAUSES the user's music — `muted` alone does not prevent
    // that, because the interruption comes from the session, not the volume.
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView player={player} style={styles.fill} contentFit={contentFit} nativeControls={false} />
    </View>
  );
}

/** Pagination dash that animates its real width (reserves layout space → no overlap). */
function Dash({ active }: { active: boolean }) {
  const styles = useStyles();
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

/**
 * This screen is a FIXED-DARK media hero: brand-navy imagery under a legibility
 * scrim, with white type straight on it. Its chrome therefore stays light-on-
 * dark in BOTH schemes, so the values below are deliberately literal, keyed to
 * the scrim rather than the app palette.
 */
const SCRIM_NAVY = '#062B63';
const ON_MEDIA = onFill;     // CTA surface, always over imagery
const ON_MEDIA_INK = '#083A85'; // brand navy, reads on the white CTA

const useStyles = makeStyles((c, e) => ({
  container: { flex: 1, backgroundColor: SCRIM_NAVY },
  slide: { overflow: 'hidden' },
  // Explicit size as well as absoluteFill: react-native-web otherwise lays
  // media out at its intrinsic size.
  fill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },

  topBar: {
    position: 'absolute',
    top: 0,
    right: 0,
    left: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    zIndex: 10,
  },
  skipPill: {
    height: 36,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    // Android fallback: no blur there, so a plain smoked chip.
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  skip: { color: ON_MEDIA, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  pressed: { opacity: 0.7 },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  // A fixed floor for the copy, so the button does not jump between slides.
  copy: { gap: spacing.sm, minHeight: 160, justifyContent: 'flex-end' },
  title: {
    fontFamily: fonts.bold,
    fontSize: 27,
    lineHeight: 33,
    fontWeight: fontWeight.extrabold,
    color: ON_MEDIA,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  body: {
    fontSize: fontSize.md,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.95)',
    maxWidth: '100%',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },

  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dash: { height: 6, borderRadius: radii.full, backgroundColor: ON_MEDIA },

  cta: {
    height: 56,
    borderRadius: radii.full,
    backgroundColor: ON_MEDIA,
    alignItems: 'center',
    justifyContent: 'center',
    ...e(4),
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaText: { color: ON_MEDIA_INK, fontSize: fontSize.md, fontWeight: fontWeight.bold },
}));
