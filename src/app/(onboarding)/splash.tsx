import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/theme';

const SOURCE = require('../../../assets/splash.mp4');

/** Fallback in case the "finished" event never fires (video is ~5s). */
const MAX_MS = 6500;

export default function SplashScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const advanced = useRef(false);

  const advance = useCallback(() => {
    if (advanced.current) return;
    advanced.current = true;
    router.replace('/welcome');
  }, [router]);

  const player = useVideoPlayer(SOURCE, (p) => {
    p.muted = true;
    p.loop = false;
    if (!reduceMotion) p.play();
  });

  useEffect(() => {
    // Advance as soon as the intro video finishes.
    const sub = player.addListener('playToEnd', advance);
    // Safety net: advance after a max time (or almost immediately if motion is reduced).
    const timer = setTimeout(advance, reduceMotion ? 900 : MAX_MS);
    return () => {
      sub.remove();
      clearTimeout(timer);
    };
  }, [player, advance, reduceMotion]);

  return (
    <Pressable
      style={styles.container}
      onPress={advance}
      accessibilityRole="button"
      accessibilityLabel="Connekyt intro. Tap to skip"
    >
      <VideoView
        style={styles.video}
        player={player}
        contentFit="contain"
        nativeControls={false}
        accessible={false}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  video: { width: '100%', height: '100%' },
});
