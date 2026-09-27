import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fonts, fontSize, makeStyles, spacing, useTheme } from '@/theme';

const LOGO = require('../../../assets/images/logo.png');
const SPLASH_VIDEO = require('../../../assets/splash.mp4');

/**
 * Brand splash.
 *
 * Adaptive Theme Behavior:
 * - Light Mode: Plays full-screen `assets/splash.mp4` with `audioMixingMode='mixWithOthers'`
 *   and `muted=true` so external audio (Spotify, etc.) is never interrupted.
 * - Dark Mode: Renders the themed dark `#0E1117` branded screen with gradient wash,
 *   pulsing logo mark, and light text so dark-mode users are not blinded by white at night.
 */

/** Full video playback duration (5 seconds). */
const HOLD_MS = 5000;
/** Near-instant when the user has asked for reduced motion. */
const HOLD_MS_REDUCED = 600;

export default function SplashScreen() {
  const styles = useStyles();
  const { colors, gradients, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const advanced = useRef(false);

  const advance = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    router.replace('/welcome');
  }, [router]);

  // Configure non-interrupting video player with expo-video for light mode.
  // CRITICAL: audioMixingMode = 'mixWithOthers' prevents AVAudioSession (iOS)
  // and AudioManager (Android) from requesting exclusive audio focus or activating
  // an interrupting session.
  const player = useVideoPlayer(SPLASH_VIDEO, (p) => {
    p.loop = false;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });

  // Dark mode gentle breathing pulse animation on logo
  const [scaleAnim] = useState(() => new Animated.Value(1));

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
    const timer = setTimeout(advance, reduceMotion ? HOLD_MS_REDUCED : HOLD_MS);
    return () => clearTimeout(timer);
  }, [advance, reduceMotion]);

  const showVideo = !isDark && !reduceMotion;

  return (
    <Pressable
      style={[
        styles.container,
        { backgroundColor: isDark ? colors.background : '#FFFFFF' },
      ]}
      onPress={advance}
      accessibilityRole="button"
      accessibilityLabel="Amoria Connekyt. Tap to continue"
    >
      {isDark ? (
        <LinearGradient
          colors={[...gradients.wash]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={styles.wash}
          pointerEvents="none"
        />
      ) : null}

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
            <Text style={[styles.wordmark, { color: isDark ? colors.text : '#0F1217' }]}>
              Amoria Connekyt.
            </Text>
            <Text style={[styles.tagline, { color: isDark ? colors.textMuted : '#6A6D76' }]}>
              Capture life, Own the moment
            </Text>
          </View>
        </View>
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.rule} />
      </View>

      {/* Dynamic status bar: white icons in dark mode, dark icons on white in light mode */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wash: StyleSheet.absoluteFill,
  staticWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  mark: { width: 132, height: 132 },
  copy: { alignItems: 'center', gap: spacing.xs },
  wordmark: {
    fontFamily: fonts.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    textAlign: 'center',
  },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  /** Quiet brand rule indicating active screen. */
  rule: { width: 44, height: 3, borderRadius: 999, backgroundColor: c.accent, opacity: 0.7 },
}));
