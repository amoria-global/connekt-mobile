import { darkPalette, onFill, onMedia } from '@/theme';
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
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Hls from 'hls.js';
import { StreamWatermark } from './StreamWatermark';

/**
 * Branded control overlay for the live <video>. We hide the browser's
 * default HTML5 controls (they show a bogus 0:00 scrubber on a live feed)
 * and render our own: a LIVE badge, a tap-to-play affordance when paused,
 * a mute toggle, and fullscreen.
 */
function PlayerControls({
  videoRef,
  bottomOffset = 10,
  showLive = true,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Distance of the mute/fullscreen bar from the bottom edge. Lifted in the
   *  live viewer so it clears the chat composer. */
  bottomOffset?: number;
  showLive?: boolean;
}) {
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const sync = () => {
      setMuted(v.muted);
      setPaused(v.paused);
    };
    v.addEventListener('play', sync);
    v.addEventListener('pause', sync);
    v.addEventListener('volumechange', sync);
    sync();
    return () => {
      v.removeEventListener('play', sync);
      v.removeEventListener('pause', sync);
      v.removeEventListener('volumechange', sync);
    };
  }, [videoRef]);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const toggleFullscreen = () => {
    const v = videoRef.current as (HTMLVideoElement & { requestFullscreen?: () => Promise<void> }) | null;
    if (!v) return;
    const el = (v.parentElement ?? v) as HTMLElement & { requestFullscreen?: () => Promise<void> };
    if (document.fullscreenElement) document.exitFullscreen?.();
    else (el.requestFullscreen ?? v.requestFullscreen)?.call(el);
  };

  return (
    <>
      {showLive ? (
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      ) : null}
      {paused ? (
        <Pressable style={styles.centerPlay} onPress={togglePlay}>
          <Ionicons name="play" size={30} color={onFill} />
        </Pressable>
      ) : null}
      <View style={[styles.controlsBar, { bottom: bottomOffset }]}>
        <Pressable style={styles.ctrlBtn} onPress={toggleMute} hitSlop={6}>
          <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color={onFill} />
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={toggleFullscreen} hitSlop={6}>
          <Ionicons name="expand" size={16} color={onFill} />
        </Pressable>
      </View>
    </>
  );
}

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

/** The HLS manifest sibling of a Cloudflare WHEP URL (same input, .m3u8). */
function toHlsUrl(url: string): string {
  if (url.includes('/webRTC/play')) return url.replace(/\/webRTC\/play.*$/i, '/manifest/video.m3u8');
  return url;
}

/**
 * Prefer low-latency WHEP (WebRTC), but fall back to HLS when WHEP can't
 * establish. Cloudflare's WHEP `/webRTC/play` returns 409 Conflict when the
 * session/encoder state isn't cleanly playable yet; without a fallback the
 * client just retried forever and the viewer saw nothing. HLS is served for
 * the same input, is far more tolerant, and never 409s — so after a few
 * failed WHEP attempts we switch to it.
 */
export function HlsPlayer({
  url,
  style,
  controls = true,
  controlsBottomOffset,
  showLiveBadge = true,
  muted,
}: {
  url: string;
  style?: any;
  /** Render the branded in-video controls overlay. Set false when the screen
   *  supplies its own controls (e.g. the full-bleed live viewer). */
  controls?: boolean;
  /** Lift the mute/fullscreen bar off the bottom edge (px). */
  controlsBottomOffset?: number;
  /** Show the in-video LIVE badge. Hidden where the screen already shows one. */
  showLiveBadge?: boolean;
  /** Programmatic audio mute state. */
  muted?: boolean;
}) {
  const whepUrl = toWhepUrl(url);
  const [whepFailed, setWhepFailed] = useState(false);

  // Reset the fallback if the URL changes (new stream / reset).
  useEffect(() => {
    setWhepFailed(false);
  }, [url]);

  const ctrl = { controls, controlsBottomOffset, showLiveBadge, muted };
  if (whepUrl && !whepFailed) {
    return <WhepVideo whepUrl={whepUrl} style={style} {...ctrl} onFatal={() => setWhepFailed(true)} />;
  }
  return <HlsVideo url={whepUrl ? toHlsUrl(whepUrl) : url} style={style} {...ctrl} />;
}

/**
 * Faithful port of WHEPClient.ts to a React component. One peer
 * connection per whepUrl; reconnect + stall watchdog self-heal an
 * encoder drop without a page reload.
 */
function WhepVideo({
  whepUrl,
  style,
  onFatal,
  controls = true,
  controlsBottomOffset,
  showLiveBadge = true,
  muted,
}: {
  whepUrl: string;
  style?: any;
  onFatal?: () => void;
  controls?: boolean;
  controlsBottomOffset?: number;
  showLiveBadge?: boolean;
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (typeof muted === 'boolean' && videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof RTCPeerConnection === 'undefined') return;

    let pc: RTCPeerConnection | null = null;
    let resourceUrl: string | null = null;
    let destroyed = false;
    let reconnectAttempts = 0;
    let everConnected = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let statsTimer: ReturnType<typeof setInterval> | null = null;
    let lastBytes = 0;
    let lastAdvance = Date.now();
    const STALL_MS = 5000;
    // Give up on WHEP after this many failed attempts WITHOUT ever connecting
    // (e.g. Cloudflare returning 409) and let the parent fall back to HLS.
    const MAX_INITIAL_ATTEMPTS = 3;

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
      // Release the previous WHEP resource so a fresh POST doesn't collide
      // (a lingering session is one cause of the 409 Conflict loop).
      if (resourceUrl) {
        fetch(resourceUrl, { method: 'DELETE' }).catch(() => {});
        resourceUrl = null;
      }
      reconnectAttempts++;
      // Never managed to connect after several tries (WHEP 409 / offline
      // input) → stop and let the parent switch to HLS.
      if (!everConnected && reconnectAttempts >= MAX_INITIAL_ATTEMPTS) {
        destroyed = true;
        onFatal?.();
        return;
      }
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
            everConnected = true;
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
      <VideoTag ref={videoRef} style={styles.video as any} playsInline autoPlay muted />
      <StreamWatermark position="top-right" />
      {controls ? (
        <PlayerControls videoRef={videoRef} bottomOffset={controlsBottomOffset} showLive={showLiveBadge} />
      ) : null}
    </View>
  );
}

function HlsVideo({
  url,
  style,
  controls = true,
  controlsBottomOffset,
  showLiveBadge = true,
  muted,
}: {
  url: string;
  style?: any;
  controls?: boolean;
  controlsBottomOffset?: number;
  showLiveBadge?: boolean;
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (typeof muted === 'boolean' && videoRef.current) {
      videoRef.current.muted = muted;
    }
  }, [muted]);

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
      <VideoTag ref={videoRef} style={styles.video as any} playsInline autoPlay muted />
      <StreamWatermark position="top-right" />
      {controls ? (
        <PlayerControls videoRef={videoRef} bottomOffset={controlsBottomOffset} showLive={showLiveBadge} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // No intrinsic aspect-ratio: the wrap fills whatever box the caller sizes
  // (full-bleed stage via absoluteFill, or a 16:9 preview via its own
  // style). A hard-coded aspectRatio here pinned the video to 16:9 even when
  // absolute-filled, leaving the live stage short and chat spilling below.
  wrap: {
    overflow: 'hidden',
    backgroundColor: onMedia.black,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    border: 0,
  } as any,

  liveBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: darkPalette.live,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: onMedia.text },
  liveText: { color: onFill, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },

  centerPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 32,
    backgroundColor: 'rgba(8,58,133,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },

  controlsBar: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  ctrlBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
