/**
 * Native HLS / Cloudflare iframe player for iOS + Android.
 *
 * For Cloudflare Live Inputs configured with `force-flavor="whep"`,
 * HLS isn't available (Cloudflare's own /manifest/video.m3u8 endpoint
 * returns 204 No Content for these inputs). The only way to play
 * them is via Cloudflare's iframe player, which negotiates WebRTC
 * internally — we wrap that in a WebView.
 *
 * For inputs that DO expose HLS, we fall back to expo-video's native
 * HLS playback path (AVPlayer / ExoPlayer) which is lighter than
 * loading a WebView.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';

function toIframeUrl(url: string): string | null {
  if (url.endsWith('/iframe') || url.includes('/iframe?')) return url;
  const cf = url.match(
    /^(https:\/\/customer-[a-z0-9]+\.cloudflarestream.com\/[a-f0-9-]+)\/(webRTC\/play|manifest\/video\.m3u8.*)$/i,
  );
  if (cf) return `${cf[1]}/iframe`;
  return null;
}

export function HlsPlayer({ url, style }: { url: string; style?: any }) {
  const iframeUrl = toIframeUrl(url);
  if (iframeUrl) {
    return <CloudflareIframePlayer url={iframeUrl} style={style} />;
  }
  return <NativeHlsPlayer url={url} style={style} />;
}

function CloudflareIframePlayer({ url, style }: { url: string; style?: any }) {
  // The iframe is auto-play + muted via the URL fragment to bypass
  // mobile autoplay restrictions. The Cloudflare player picks these up.
  const playUrl = url.includes('?') ? `${url}&autoplay=true&muted=true` : `${url}?autoplay=true&muted=true`;
  return (
    <View style={[styles.wrap, style]}>
      <WebView
        source={{ uri: playUrl }}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
        // The Cloudflare iframe is self-contained — we don't need
        // bounces, scroll, or any RN gestures inside.
        scrollEnabled={false}
        bounces={false}
        scalesPageToFit
      />
    </View>
  );
}

function NativeHlsPlayer({ url, style }: { url: string; style?: any }) {
  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = false;
    p.muted = true;
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
  webview: { width: '100%', height: '100%', backgroundColor: '#000' },
});
