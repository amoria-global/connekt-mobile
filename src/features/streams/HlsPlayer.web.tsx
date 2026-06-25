/**
 * Web live-stream player (Expo web / browser).
 *
 * Mirrors knockout/lib/streaming/WHEPClient.ts EXACTLY: these Cloudflare
 * Live Inputs are WebRTC-ingested, so we play them over WHEP (raw
 * WebRTC) — NOT via Cloudflare's iframe and NOT via HLS. The iframe
 * defaults to HLS/DASH, which for these inputs lags or 204s, which is
 * why it showed "Stream has not started yet" / "An unknown error
 * occurred" while the stream was actually live over WebRTC.
 *
 * The browser has native RTCPeerConnection, so this is a direct port of
 * the web app's player: recvonly offer → POST SDP to `.../webRTC/play`
 * → set answer → attach the MediaStream to <video>. Capped-backoff
 * reconnect + getStats() stall watchdog included, same as the web.
 *
 * For non-Cloudflare URLs that are genuinely HLS we keep the hls.js
 * path (Chrome/Firefox/Edge can't decode HLS in a bare <video>).
 */
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Hls from 'hls.js';

function toWhepUrl(url: string): string | null {
  if (!url) return null;
  if (url.includes('/webRTC/play')) return url.split('?')[0];
  if (url.includes('/manifest/video.m3u8')) {
    return url.replace(/\/manifest\/video\.m3u8.*$/i, '/webRTC/play');
  }
  if (url.endsWith('/iframe') || url.includes('/iframe?')) {
    return url.replace(/\/iframe.*$/i, '/webRTC/play');
  }
  const m = url.match(/^(https:\/\/[a-z0-9.-]*cloudflarestream\.com\/[a-f0-9-]+)/i);
  if (m) return `${m[1]}/webRTC/play`;
  return null;
}

export function HlsPlayer({ url, style }: { url: string; style?: any }) {
  const whepUrl = toWhepUrl(url);
  if (whepUrl) return <WhepVideo whepUrl={whepUrl} style={style} />;
  return <HlsVideo url={url} style={style} />;
}

/**
 * Faithful port of WHEPClient.ts to a React component. One peer
 * connection per whepUrl; reconnect + stall watchdog self-heal an
 * encoder drop without a page reload.
 */
function WhepVideo({ whepUrl, style }: { whepUrl: string; style?: any }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof RTCPeerConnection === 'undefined') return;

    let pc: RTCPeerConnection | null = null;
    let resourceUrl: string | null = null;
    let destroyed = false;
    let reconnectAttempts = 0;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let statsTimer: ReturnType<typeof setInterval> | null = null;
    let lastBytes = 0;
    let lastAdvance = Date.now();
    const STALL_MS = 5000;

    const cleanup = () => {
      if (statsTimer) {
        clearInterval(statsTimer);
        statsTimer = null;
      }
      if (pc) {
        try {
          pc.ontrack = null;
          pc.onconnectionstatechange = null;
          pc.close();
        } catch {
          /* ignore */
        }
        pc = null;
      }
    };

    const scheduleReconnect = () => {
      if (destroyed) return;
      cleanup();
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttempts - 1, 3)), 5000);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, delay);
    };

    const startStallWatchdog = () => {
      if (statsTimer) clearInterval(statsTimer);
      lastBytes = 0;
      lastAdvance = Date.now();
      statsTimer = setInterval(async () => {
        if (destroyed || !pc) return;
        try {
          const stats = await pc.getStats();
          let total = 0;
          stats.forEach((r: any) => {
            if (r.type === 'inbound-rtp' && typeof r.bytesReceived === 'number') total += r.bytesReceived;
          });
          if (total > lastBytes) {
            lastBytes = total;
            lastAdvance = Date.now();
            return;
          }
          if (pc.connectionState === 'connected' && Date.now() - lastAdvance > STALL_MS) {
            scheduleReconnect();
          }
        } catch {
          /* getStats can throw mid-transition */
        }
      }, 2000);
    };

    const waitIce = (timeout: number) =>
      new Promise<void>((resolve) => {
        if (!pc) return resolve();
        if (pc.iceGatheringState === 'complete') return resolve();
        const t = setTimeout(resolve, timeout);
        pc.addEventListener('icegatheringstatechange', () => {
          if (pc?.iceGatheringState === 'complete') {
            clearTimeout(t);
            resolve();
          }
        });
      });

    async function connect() {
      if (destroyed || !video) return;
      try {
        pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
          bundlePolicy: 'max-bundle',
        });
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });
        const stream = new MediaStream();
        pc.ontrack = (e) => {
          stream.addTrack(e.track);
          if (video.srcObject !== stream) video.srcObject = stream;
        };
        pc.onconnectionstatechange = () => {
          const s = pc?.connectionState;
          if (s === 'failed' || s === 'disconnected') scheduleReconnect();
          if (s === 'connected') {
            reconnectAttempts = 0;
            startStallWatchdog();
          }
        };

        const offer = await pc.createOffer();
        if (!pc || destroyed) return;
        await pc.setLocalDescription(offer);
        await waitIce(3000);
        if (!pc || destroyed) return;
        const sdp = pc.localDescription?.sdp;
        if (!sdp) throw new Error('no-local-sdp');

        const res = await fetch(whepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: sdp,
        });
        if (!res.ok) throw new Error(`whep-${res.status}`);
        const loc = res.headers.get('Location');
        if (loc) {
          try {
            resourceUrl = new URL(loc, whepUrl).toString();
          } catch {
            /* ignore */
          }
        }
        const answer = await res.text();
        if (!pc || destroyed) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: answer });

        video.muted = true;
        video
          .play()
          .then(() => {
            setTimeout(() => {
              if (video) video.muted = false;
            }, 400);
          })
          .catch(() => {
            /* autoplay-with-sound blocked; stays muted */
          });
      } catch {
        scheduleReconnect();
      }
    }

    connect();

    return () => {
      destroyed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (resourceUrl) fetch(resourceUrl, { method: 'DELETE' }).catch(() => {});
      cleanup();
      if (video) {
        try {
          video.srcObject = null;
        } catch {
          /* ignore */
        }
      }
    };
  }, [whepUrl]);

  const VideoTag = 'video' as any;
  return (
    <View style={[styles.wrap, style]}>
      <VideoTag ref={videoRef} style={styles.video as any} controls playsInline autoPlay muted />
    </View>
  );
}

function HlsVideo({ url, style }: { url: string; style?: any }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return;

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.muted = true;
      video
        .play()
        .then(() => setTimeout(() => { if (video) video.muted = false; }, 400))
        .catch(() => {});
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
        .then(() => setTimeout(() => { if (video) video.muted = false; }, 400))
        .catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return;
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        try { hls.startLoad(); } catch { /* ignore */ }
        return;
      }
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        try { hls.recoverMediaError(); } catch { /* ignore */ }
        return;
      }
      try { hls.destroy(); } catch { /* ignore */ }
      setTimeout(() => {
        if (!videoRef.current) return;
        const fresh = new Hls();
        hlsRef.current = fresh;
        fresh.loadSource(url);
        fresh.attachMedia(videoRef.current);
      }, 3000);
    });

    return () => {
      try { hls.destroy(); } catch { /* ignore */ }
      hlsRef.current = null;
    };
  }, [url]);

  const VideoTag = 'video' as any;
  return (
    <View style={[styles.wrap, style]}>
      <VideoTag ref={videoRef} style={styles.video as any} controls playsInline autoPlay muted />
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
