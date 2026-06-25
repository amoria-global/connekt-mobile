/**
 * Web-only HLS player. Chrome / Firefox / Edge can't decode HLS in the
 * native <video> element ("PipelineStatus::DEMUXER_ERROR_COULD_NOT_PARSE"
 * is what they spit out when you try). Safari + iOS Safari can, but
 * we use hls.js universally on web so we don't have to split code paths.
 *
 * This module is resolved only on web (via the `.web.tsx` extension);
 * iOS and Android pick up `HlsPlayer.tsx` which delegates to
 * expo-video's native HLS support.
 *
 * Auto-recovery is built-in: hls.js' ERROR event covers transient
 * network drops + media decode failures + manifest 404s while OBS is
 * reconnecting. Latency target is ~10s (Cloudflare HLS default segment
 * size). For sub-second latency we'd need WebRTC + WHEPClient like the
 * web app, but that's a separate native dependency.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Hls from 'hls.js';

export function HlsPlayer({ url, style }: { url: string; style?: any }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    // Safari + iOS Safari can play HLS natively — use the simple path.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.muted = true; // browser autoplay policy
      video
        .play()
        .then(() => {
          // Try to unmute once playback is active so the viewer gets
          // sound without a manual tap.
          setTimeout(() => {
            if (video) video.muted = false;
          }, 400);
        })
        .catch(() => {
          /* user gesture required; controls visible */
        });
      return () => {
        try {
          video.pause();
          video.src = '';
        } catch {
          /* ignore */
        }
      };
    }

    if (!Hls.isSupported()) {
      // Last-resort: nothing we can do besides set src and hope
      video.src = url;
      return;
    }

    const hls = new Hls({
      // Live-stream friendly defaults
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
      maxBufferLength: 30,
      liveSyncDurationCount: 3,
      // Aggressive recovery — mirrors knockout WHEPClient's
      // "never stop retrying" pattern.
      manifestLoadingMaxRetry: 6,
      manifestLoadingRetryDelay: 1500,
      manifestLoadingMaxRetryTimeout: 64_000,
      levelLoadingMaxRetry: 6,
      levelLoadingRetryDelay: 1500,
      levelLoadingMaxRetryTimeout: 64_000,
      fragLoadingMaxRetry: 6,
      fragLoadingRetryDelay: 1500,
      fragLoadingMaxRetryTimeout: 64_000,
    });
    hlsRef.current = hls;
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.muted = true;
      video
        .play()
        .then(() => {
          setTimeout(() => {
            if (video) video.muted = false;
          }, 400);
        })
        .catch(() => {
          /* autoplay denied; controls visible */
        });
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        // hls.js' built-in recovery: re-trigger loading
        try {
          hls.startLoad();
        } catch {
          /* ignore */
        }
        return;
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try {
          hls.recoverMediaError();
        } catch {
          /* ignore */
        }
        return;
      }
      // Last-resort: destroy + recreate the player after 3s
      try {
        hls.destroy();
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        const fresh = new Hls();
        hlsRef.current = fresh;
        fresh.loadSource(url);
        fresh.attachMedia(video);
      }, 3000);
    });

    return () => {
      try {
        hls.destroy();
      } catch {
        /* ignore */
      }
      hlsRef.current = null;
    };
  }, [url]);

  // React Native Web flattens <View> to a <div>. We render the <video>
  // as a native HTML element inside it so hls.js can attach to it via
  // ref. The wrapping View keeps the React Native layout system happy.
  const VideoTag = 'video' as any;
  return (
    <View style={[styles.wrap, style]}>
      <VideoTag
        ref={videoRef}
        style={styles.video as any}
        controls
        playsInline
        autoPlay
        muted
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
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  } as any,
});
