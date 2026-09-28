import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fonts, fontSize, makeStyles, spacing, useTheme } from '@/theme';

const LOGO = require('../../../assets/images/logo.png');
const SPLASH_LIGHT = require('../../../assets/splash.mp4');
const SPLASH_DARK = require('../../../assets/splash-dark.mp4');

export const PRELOADER_TRACK_WIDTH = 140;
export const PRELOADER_BAR_WIDTH = 46;

/**
 * Configures the splash video player so it plays silently in a loop while
 * guaranteeing that external audio (Spotify, Apple Music, podcasts) is never
 * paused or muted.
 */
export function configurePreloaderPlayer(player: {
  loop: boolean;
  muted: boolean;
  audioMixingMode: string;
  play: () => void;
}) {
  player.loop = true;
  player.muted = true;
  // CRITICAL: audioMixingMode = 'mixWithOthers' prevents AVAudioSession (iOS)
  // and AudioManager (Android) from requesting exclusive audio focus or activating
  // an interrupting session.
  player.audioMixingMode = 'mixWithOthers';
  player.play();
}

export interface AppPreloaderProps {
  /**
   * Whether Google Fonts (Pragati Narrow) have finished loading.
   * If false, falls back cleanly to the system font so text renders immediately
   * without wait or glyph mismatch.
   */
  fontsLoaded?: boolean;
  /** Optional message or status shown beneath the brand tagline. */
  message?: string;
  /**
   * Optional callback invoked when preloader video playback duration completes
   * or when the user taps the screen to advance.
   */
  onFinish?: () => void;
}

/**
 * Branded preloader / splash screen shown while the root layout bootstraps
 * authentication state, loads Google Fonts, and verifies onboarding status.
 *
 * Plays full-screen `assets/splash.mp4` with `audioMixingMode='mixWithOthers'`
 * and `muted=true` so that music playing in other apps (Spotify, Apple Music, etc.)
 * continues playing without interruption.
 */
export function AppPreloader({ fontsLoaded = false, message, onFinish }: AppPreloaderProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  // Sliding indeterminate loading bar
  const [slideAnim] = useState(() => new Animated.Value(0));
  // Dark mode gentle breathing pulse animation on logo (used only if reduceMotion is on)
  const [scaleAnim] = useState(() => new Animated.Value(1));

  // Smooth fade-out animation when transitioning into the app
  const [fadeAnim] = useState(() => new Animated.Value(1));
  const dismissed = useRef(false);

  // Initialize expo-video with theme-matched video source and non-interrupting audio
  const videoSource = isDark ? SPLASH_DARK : SPLASH_LIGHT;
  const player = useVideoPlayer(videoSource, configurePreloaderPlayer);

  const handleFinish = useCallback(() => {
    if (dismissed.current) return;
    dismissed.current = true;
    if (reduceMotion) {
      onFinish?.();
      return;
    }
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 350,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      onFinish?.();
    });
  }, [fadeAnim, onFinish, reduceMotion]);

  // Settle at 3.2s (when full brand animation finishes) and smoothly fade out
  useEffect(() => {
    if (!onFinish) return;
    const timer = setTimeout(handleFinish, reduceMotion ? 500 : 3200);
    return () => clearTimeout(timer);
  }, [handleFinish, onFinish, reduceMotion]);

  useEffect(() => {
    if (isDark && !reduceMotion) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.05,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 0.97,
            duration: 1100,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [isDark, reduceMotion, scaleAnim]);

  useEffect(() => {
    if (reduceMotion) {
      slideAnim.setValue(0.5);
      return;
    }

    // Sliding indicator bar
    const slideLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    slideLoop.start();
    return () => slideLoop.stop();
  }, [reduceMotion, slideAnim]);

  // Interpolate slide across track width
  const barTranslateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-PRELOADER_BAR_WIDTH, PRELOADER_TRACK_WIDTH],
  });

  // Always show video unless user enabled reduce-motion accessibility setting
  const showVideo = !reduceMotion;

  return (
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <Pressable
        style={[
          styles.container,
          { backgroundColor: isDark ? '#0E1117' : '#FFFFFF' },
        ]}
        onPress={handleFinish}
        accessibilityRole="progressbar"
        accessibilityLabel="Amoria Connekyt. Tap to continue"
        accessible={true}
      >
        {showVideo ? (
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          <View style={styles.staticWrap}>
            <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
              <Image
                source={LOGO}
                style={styles.mark}
                contentFit="contain"
                transition={0}
                accessible={false}
              />
            </Animated.View>
            <View style={styles.copy}>
              <Text
                style={[
                  styles.wordmark,
                  { color: isDark ? colors.text : '#0F1217' },
                  fontsLoaded ? { fontFamily: fonts.bold } : { fontWeight: '700' },
                ]}
              >
                Amoria Connekyt.
              </Text>
              <Text
                style={[
                  styles.tagline,
                  { color: isDark ? colors.textMuted : '#6A6D76' },
                  fontsLoaded ? { fontFamily: fonts.regular } : undefined,
                ]}
              >
                Capture life, Own the moment
              </Text>
            </View>
          </View>
        )}

        {/* Sleek branded progress track at the bottom */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={[styles.track, { backgroundColor: isDark ? colors.border : '#E6E7EC' }]}>
            <Animated.View
              style={[
                styles.bar,
                {
                  backgroundColor: colors.accent,
                  transform: [{ translateX: barTranslateX }],
                },
              ]}
            />
          </View>

          {message ? (
            <Text
              style={[
                styles.message,
                { color: isDark ? colors.textMuted : '#6A6D76' },
                fontsLoaded ? { fontFamily: fonts.regular } : undefined,
              ]}
            >
              {message}
            </Text>
          ) : null}
        </View>

        <StatusBar style={isDark ? 'light' : 'dark'} />
      </Pressable>
    </Animated.View>
  );
}

export default AppPreloader;

const useStyles = makeStyles((c) => ({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wash: StyleSheet.absoluteFill,
  staticWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  mark: {
    width: 104,
    height: 104,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  wordmark: {
    fontSize: 24,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  tagline: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  track: {
    width: PRELOADER_TRACK_WIDTH,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  bar: {
    width: PRELOADER_BAR_WIDTH,
    height: '100%',
    borderRadius: 999,
  },
  message: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
}));
