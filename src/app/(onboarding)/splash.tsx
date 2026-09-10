import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fonts, fontSize, makeStyles, spacing, useTheme } from '@/theme';

const LOGO = require('../../../assets/images/logo.png');

/**
 * Brand splash.
 *
 * Replaces the previous `splash.mp4` for three reasons:
 *
 *  1. AUDIO. expo-video activates an iOS audio session when a player starts.
 *     With the default `audioMixingMode: 'auto'` that INTERRUPTS whatever the
 *     user is listening to — and `player.muted = true` does not prevent it,
 *     because the interruption comes from the session, not the volume. Opening
 *     the app stopped your music. Rendering the splash natively touches no
 *     audio session at all.
 *  2. THEME. The video had a white background baked into the file, so it could
 *     never follow the phone's Light/Dark setting. `logo.png` is a transparent
 *     500x500 PNG, so the mark sits on a themed surface instead.
 *  3. WEIGHT. Drops a 541 KB video from the bundle, and shortens the hold from
 *     ~6.5 s to ~1.5 s — a splash should confirm the brand, not detain anyone.
 */

/** How long the brand holds before routing on (ms). */
const HOLD_MS = 1500;
/** Near-instant when the user has asked for reduced motion. */
const HOLD_MS_REDUCED = 600;

export default function SplashScreen() {
  const styles = useStyles();
  const { gradients, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const advanced = useRef(false);

  const advance = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    router.replace('/welcome');
  }, [router]);

  // Mark: settles in. Wordmark: follows a beat later so the eye lands on the
  // logo first. Both are no-ops under reduced motion (start at their end state).
  const markIn = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const textIn = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (!reduceMotion) {
      Animated.sequence([
        Animated.timing(markIn, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(textIn, {
          toValue: 1,
          duration: 380,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
    const timer = setTimeout(advance, reduceMotion ? HOLD_MS_REDUCED : HOLD_MS);
    return () => clearTimeout(timer);
  }, [advance, reduceMotion, markIn, textIn]);

  const markStyle = {
    opacity: markIn,
    transform: [
      { scale: markIn.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) },
    ],
  };
  const textStyle = {
    opacity: textIn,
    transform: [
      { translateY: textIn.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) },
    ],
  };

  return (
    <Pressable
      style={styles.container}
      onPress={advance}
      accessibilityRole="button"
      accessibilityLabel="Amoria Connekyt. Tap to continue"
    >
      {/* Faint brand wash — gives the surface depth without competing with the
          mark. Stops differ per scheme (see gradientsFor). */}
      <LinearGradient
        colors={[...gradients.wash]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.wash}
        pointerEvents="none"
      />

      <View style={styles.center}>
        <Animated.View style={markStyle}>
          <Image
            source={LOGO}
            style={styles.mark}
            contentFit="contain"
            transition={0}
            accessible={false}
          />
        </Animated.View>

        <Animated.View style={[styles.copy, textStyle]}>
          <Text style={styles.wordmark}>Amoria Connekyt.</Text>
          <Text style={styles.tagline}>Capture life, Own the moment</Text>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.rule} />
      </View>

      {/* The surface is themed now, so the icons follow the scheme. */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.background,
  },
  wash: StyleSheet.absoluteFill,

  center: { alignItems: 'center', justifyContent: 'center', gap: spacing.xl },
  mark: { width: 132, height: 132 },

  copy: { alignItems: 'center', gap: spacing.xs },
  wordmark: {
    fontFamily: fonts.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    color: c.text,
    textAlign: 'center',
  },
  tagline: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textMuted,
    textAlign: 'center',
  },

  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  /** Quiet brand rule — a full spinner would imply the user is waiting on work. */
  rule: { width: 44, height: 3, borderRadius: 999, backgroundColor: c.accent, opacity: 0.7 },
}));
