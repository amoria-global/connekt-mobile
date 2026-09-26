import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fonts, fontSize, makeStyles, radii, spacing, useTheme } from '@/theme';

const LOGO = require('../../../assets/images/logo.png');
const SPLASH_VIDEO = require('../../../assets/splash.mp4');

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
}

/**
 * Branded preloader / splash screen shown while the root layout bootstraps
 * authentication state, loads Google Fonts, and verifies onboarding status.
 *
 * Uses assets/splash.mp4 with audioMixingMode='mixWithOthers' and muted=true.
 * This guarantees that when a user opens the app while listening to music
 * (Spotify, Apple Music, podcasts, YouTube Music, etc.), the music continues
 * playing without being paused, muted, or ducked.
 */
export function AppPreloader({ fontsLoaded = false, message }: AppPreloaderProps) {
  const styles = useStyles();
  const { colors, gradients, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Sliding indeterminate loading bar
  const [slideAnim] = useState(() => new Animated.Value(0));

  // Initialize expo-video with non-interrupting audio settings
  const player = useVideoPlayer(SPLASH_VIDEO, configurePreloaderPlayer);

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

  const videoCardWidth = Math.min(width - 48, 340);
  const videoCardHeight = Math.round(videoCardWidth * (464 / 832));

  return (
    <View
      style={styles.container}
      accessibilityRole="progressbar"
      accessibilityLabel="Loading Connekyt"
      accessible={true}
    >
      <LinearGradient
        colors={[...gradients.wash]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.wash}
        pointerEvents="none"
      />

      <View style={styles.center}>
        {!reduceMotion ? (
          <View
            style={[
              styles.videoFrame,
              {
                width: videoCardWidth,
                height: videoCardHeight,
                borderColor: isDark ? colors.border : 'transparent',
              },
            ]}
          >
            <VideoView
              player={player}
              style={styles.video}
              contentFit="contain"
              nativeControls={false}
            />
          </View>
        ) : (
          <View style={styles.staticWrap}>
            <Image
              source={LOGO}
              style={styles.mark}
              contentFit="contain"
              transition={0}
              accessible={false}
            />
            <View style={styles.copy}>
              <Text
                style={[
                  styles.wordmark,
                  fontsLoaded ? { fontFamily: fonts.bold } : { fontWeight: '700' },
                ]}
              >
                Amoria Connekyt.
              </Text>
              <Text
                style={[
                  styles.tagline,
                  fontsLoaded ? { fontFamily: fonts.regular } : undefined,
                ]}
              >
                Capture life, Own the moment
              </Text>
            </View>
          </View>
        )}

        {/* Sleek branded progress track */}
        <View style={styles.track}>
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
              fontsLoaded ? { fontFamily: fonts.regular } : undefined,
            ]}
          >
            {message}
          </Text>
        ) : null}
      </View>

      <StatusBar style={isDark ? 'light' : 'dark'} />
    </View>
  );
}

export default AppPreloader;

const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  wash: StyleSheet.absoluteFill,
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  videoFrame: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    shadowColor: c.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 3,
  },
  video: {
    width: '100%',
    height: '100%',
  },
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
    color: c.text,
    textAlign: 'center',
  },
  tagline: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
  },
  track: {
    width: PRELOADER_TRACK_WIDTH,
    height: 4,
    borderRadius: 999,
    backgroundColor: c.borderSoft,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  bar: {
    width: PRELOADER_BAR_WIDTH,
    height: '100%',
    borderRadius: 999,
  },
  message: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
}));
