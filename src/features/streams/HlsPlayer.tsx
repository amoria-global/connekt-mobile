/**
 * Native HLS player for iOS / Android. AVPlayer (iOS) and ExoPlayer
 * (Android) both decode HLS natively, so expo-video does the work.
 * Web platform uses HlsPlayer.web.tsx via the `.web.tsx` extension
 * with hls.js.
 *
 * Auto-recovery: statusChange listener retries on `error` / `idle`
 * by re-sourcing after a 3s backoff, mirroring the web's reconnect
 * pattern (knockout/lib/streaming/WHEPClient.ts: maxReconnectAttempts
 * effectively unbounded).
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

export function HlsPlayer({ url, style }: { url: string; style?: any }) {
  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = false;
    p.muted = true; // browser autoplay parity; native is fine too
    p.audioMixingMode = 'auto';
    p.staysActiveInBackground = false;
    p.play();
  });

  useEffect(() => {
    let isMounted = true;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const tryUnmute = () => {
      setTimeout(() => {
        if (!isMounted) return;
        try {
          player.muted = false;
        } catch {
          /* ignore */
        }
      }, 400);
    };

    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (!isMounted) return;
      if (status === 'readyToPlay') {
        try {
          player.play();
          tryUnmute();
        } catch {
          /* ignore */
        }
      } else if (status === 'error' || status === 'idle') {
        if (error?.message) console.warn('[stream] playback', status, error.message);
        if (retry) clearTimeout(retry);
        retry = setTimeout(() => {
          if (!isMounted) return;
          try {
            player.replace({ uri: url });
            player.play();
          } catch {
            /* ignore */
          }
        }, 3000);
      }
    });
    tryUnmute();
    return () => {
      isMounted = false;
      if (retry) clearTimeout(retry);
      sub.remove();
    };
  }, [player, url]);

  return (
    <View style={[styles.wrap, style]}>
      <VideoView
        player={player}
        style={styles.video}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    aspectRatio: 16 / 9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: { width: '100%', height: '100%' },
});
