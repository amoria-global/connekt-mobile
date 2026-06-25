/**
 * Web-only video player.
 *
 * Cloudflare Live Inputs configured with `force-flavor="whep"` (which
 * is what amoria's input 01c6d1e7... uses) do NOT serve HLS — the
 * `/manifest/video.m3u8` endpoint returns 204 No Content. The only
 * playback path Cloudflare exposes for this kind of input is its
 * iframe player, which negotiates WebRTC internally.
 *
 * Strategy:
 *   - If `url` looks like an HLS .m3u8 → use hls.js + <video>
 *   - If `url` is a Cloudflare URL (customer-*.cloudflarestream.com)
 *     OR ends with /iframe → wrap it in an <iframe> at that URL
 *     (or derive the iframe URL from a WHEP URL)
 *
 * The iframe gracefully handles WHEP / HLS / DRM / token refresh /
 * autoplay policy / picture-in-picture — none of which we'd want to
 * own client-side.
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Hls from 'hls.js';

function toIframeUrl(url: string): string | null {
  // Already an iframe URL
  if (url.endsWith('/iframe') || url.includes('/iframe?')) return url;
  // Convert a Cloudflare playback URL (HLS or WHEP) to the iframe form
  // by replacing the path component. Both URLs use the same customer
  // hash + live input id, so the substitution is safe.
  const cf = url.match(
    /^(https:\/\/customer-[a-z0-9]+\.cloudflarestream\.com\/[a-f0-9-]+)\/(webRTC\/play|manifest\/video\.m3u8.*)$/i,
  );
  if (cf) return `${cf[1]}/iframe`;
  return null;
}

export function HlsPlayer({ url, style }: { url: string; style?: any }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Decide strategy. Cloudflare live inputs without HLS enabled can only
  // be played via their iframe; raw HLS playback would return 204.
  const iframeUrl = toIframeUrl(url);

  useEffect(() => {
    if (iframeUrl) return; // iframe path doesn't need hls.js
    const video = videoRef.current;
    if (!video || !url) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.muted = true;
      video
        .play()
        .then(() => {
          setTimeout(() => {
            if (video) video.muted = false;
          }, 400);
        })
        .catch(() => {
          /* user gesture required */
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
      video.src = url;
      return;
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
      maxBufferLength: 30,
      liveSyncDurationCount: 3,
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
          /* autoplay denied */
        });
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
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
      try {
        hls.destroy();
      } catch {
        /* ignore */
      }
      setTimeout(() => {
        if (!videoRef.current) return;
        const fresh = new Hls();
        hlsRef.current = fresh;
        fresh.loadSource(url);
        fresh.attachMedia(videoRef.current);
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
  }, [url, iframeUrl]);

  const IframeTag = 'iframe' as any;
  const VideoTag = 'video' as any;

  return (
    <View style={[styles.wrap, style]}>
      {iframeUrl ? (
        <IframeTag
          src={iframeUrl}
          // Cloudflare's iframe negotiates WebRTC / HLS internally and
          // exposes a normal player UI with controls + autoplay.
          // allow=autoplay covers Chrome's permission policy so the
          // stream starts the moment it's ready.
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={styles.video as any}
          frameBorder="0"
        />
      ) : (
        <VideoTag
          ref={videoRef}
          style={styles.video as any}
          controls
          playsInline
          autoPlay
          muted
        />
      )}
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
    border: 0,
  } as any,
});
