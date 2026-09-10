/**
 * Native live-stream player for iOS + Android.
 *
 * WHY THIS IS A WEBVIEW RUNNING WEBRTC (not the Cloudflare iframe, not HLS):
 *
 * The web (knockout/lib/streaming/WHEPClient.ts) plays these Cloudflare
 * Live Inputs over WHEP — raw WebRTC: create an RTCPeerConnection, POST
 * the offer SDP to `.../webRTC/play`, attach the returned MediaStream to
 * a <video>. Sub-second latency, works the instant OBS connects.
 *
 * These live inputs are WebRTC-ingested, so the HLS manifest
 * (`.../manifest/video.m3u8`) lags badly or returns 204 until Cloudflare
 * finishes packaging — and Cloudflare's own iframe player defaults to
 * HLS/DASH, which is why it showed "Stream has not started yet" /
 * "An unknown error occurred" even while the stream was live over WebRTC.
 *
 * expo-video has no WebRTC codec and react-native-webrtc isn't installed
 * (it's a native module needing a fresh build). BUT react-native-webview
 * is a full browser engine — WKWebView (iOS ≥ 14.3) and the Android
 * System WebView (Chromium) both support RTCPeerConnection. So we run the
 * web's exact WHEP negotiation INSIDE the WebView, pointed at
 * `.../webRTC/play`. That's true web parity with no native module.
 *
 * recvonly playback needs no camera/mic permission. The inline HTML is
 * served with a real https baseUrl so the cross-origin POST to
 * cloudflarestream.com isn't a null-origin request.
 *
 * For non-Cloudflare URLs that are genuinely HLS, we fall back to
 * expo-video's native AVPlayer / ExoPlayer path.
 */
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { WebView } from 'react-native-webview';
import { StreamWatermark } from './StreamWatermark';

/**
 * Normalize any Cloudflare playback URL to its WHEP endpoint
 * (`.../webRTC/play`). Returns null for non-Cloudflare URLs so the
 * caller can fall back to the HLS player.
 *   webRTC/play          → as-is
 *   manifest/video.m3u8  → swap path
 *   iframe               → swap path
 *   bare {base}/{uid}    → append /webRTC/play
 */
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

export function HlsPlayer({
  url,
  style,
  controls = true,
}: {
  url: string;
  style?: any;
  /** Show player controls. The native WHEP WebView has none regardless; this
   *  toggles expo-video's nativeControls for the HLS path. */
  controls?: boolean;
  /** Web-only: lift the mute/fullscreen bar off the bottom edge (px). Accepted
   *  here so the shared call site typechecks; native controls are OS-drawn. */
  controlsBottomOffset?: number;
  /** Web-only: toggle the in-video LIVE badge. No-op on native. */
  showLiveBadge?: boolean;
}) {
  const whepUrl = toWhepUrl(url);
  if (whepUrl) {
    return <CloudflareWhepPlayer whepUrl={whepUrl} style={style} />;
  }
  return <NativeHlsPlayer url={url} style={style} controls={controls} />;
}

/**
 * Inline HTML that runs the web's WHEPClient WebRTC flow verbatim:
 * recvonly offer → POST SDP to the WHEP URL → set answer → attach
 * srcObject → muted autoplay then unmute. Includes the same capped
 * exponential-backoff reconnect and the getStats() stall watchdog the
 * web uses, so an encoder drop / silent stall self-heals.
 */
function buildWhepHtml(whepUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;height:100%;width:100%;background:#000;overflow:hidden;}
  #v{width:100%;height:100%;object-fit:contain;background:#000;display:block;}
  #msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
       color:#9aa3b2;font-family:-apple-system,system-ui,'Segoe UI',sans-serif;
       font-size:14px;text-align:center;padding:16px;pointer-events:none;}
  /* Brand watermark — burned into the player, always on top (z-index),
     low opacity, no pill so it reads as part of the video. */
  #wm-center{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
       overflow:hidden;pointer-events:none;z-index:999;}
  #wm-center span{transform:rotate(-22deg);color:#fff;opacity:0.08;font-weight:900;
       letter-spacing:3px;font-size:9vw;white-space:nowrap;text-transform:uppercase;
       text-shadow:0 2px 14px rgba(0,0,0,.35);
       font-family:-apple-system,system-ui,'Segoe UI',sans-serif;}
  #wm-bug{position:absolute;top:12px;left:12px;display:flex;align-items:center;
       color:#fff;opacity:0.5;font-weight:800;letter-spacing:1.1px;font-size:12px;
       text-transform:uppercase;pointer-events:none;z-index:999;
       text-shadow:0 1px 5px rgba(0,0,0,.95);
       font-family:-apple-system,system-ui,'Segoe UI',sans-serif;}
</style>
</head>
<body>
<video id="v" playsinline autoplay muted></video>
<div id="wm-center"><span>Amoria Connekyt</span></div>
<div id="wm-bug">Amoria Connekyt</div>
<div id="msg">Connecting…</div>
<script>
(function(){
  var WHEP_URL = ${JSON.stringify(whepUrl)};
  var video = document.getElementById('v');
  var msgEl = document.getElementById('msg');
  var pc = null, resourceUrl = null, destroyed = false;
  var reconnectAttempts = 0, reconnectTimer = null, statsTimer = null;
  var lastBytes = 0, lastAdvance = Date.now();
  var STALL_MS = 5000;

  function setMsg(t){ if(!msgEl) return; msgEl.style.display = t ? 'flex' : 'none'; msgEl.textContent = t || ''; }

  function cleanup(){
    if (statsTimer){ clearInterval(statsTimer); statsTimer = null; }
    if (pc){ try{ pc.ontrack=null; pc.onconnectionstatechange=null; pc.close(); }catch(e){} pc = null; }
  }

  function scheduleReconnect(){
    if (destroyed) return;
    cleanup();
    reconnectAttempts++;
    var delay = Math.min(1000 * Math.pow(2, Math.min(reconnectAttempts-1,3)), 5000);
    setMsg('Reconnecting…');
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, delay);
  }

  function startStallWatchdog(){
    if (statsTimer) clearInterval(statsTimer);
    lastBytes = 0; lastAdvance = Date.now();
    statsTimer = setInterval(function(){
      if (destroyed || !pc) return;
      pc.getStats().then(function(stats){
        var total = 0;
        stats.forEach(function(r){
          if (r.type === 'inbound-rtp' && typeof r.bytesReceived === 'number') total += r.bytesReceived;
        });
        if (total > lastBytes){ lastBytes = total; lastAdvance = Date.now(); return; }
        if (pc.connectionState === 'connected' && Date.now()-lastAdvance > STALL_MS){
          scheduleReconnect();
        }
      }).catch(function(){});
    }, 2000);
  }

  function waitIce(timeout){
    return new Promise(function(resolve){
      if (!pc) return resolve();
      if (pc.iceGatheringState === 'complete') return resolve();
      var t = setTimeout(resolve, timeout);
      pc.addEventListener('icegatheringstatechange', function(){
        if (pc && pc.iceGatheringState === 'complete'){ clearTimeout(t); resolve(); }
      });
    });
  }

  function connect(){
    if (destroyed) return;
    if (typeof RTCPeerConnection === 'undefined'){
      setMsg('This device cannot play the live stream.');
      return;
    }
    try {
      pc = new RTCPeerConnection({ iceServers:[{urls:'stun:stun.cloudflare.com:3478'}], bundlePolicy:'max-bundle' });
      pc.addTransceiver('video', { direction:'recvonly' });
      pc.addTransceiver('audio', { direction:'recvonly' });
      var stream = new MediaStream();
      pc.ontrack = function(e){
        try { stream.addTrack(e.track); } catch(err){}
        if (video.srcObject !== stream) video.srcObject = stream;
      };
      pc.onconnectionstatechange = function(){
        var s = pc ? pc.connectionState : '';
        if (s === 'failed' || s === 'disconnected') scheduleReconnect();
        if (s === 'connected'){ reconnectAttempts = 0; setMsg(''); startStallWatchdog(); }
      };
      pc.createOffer().then(function(offer){
        if (!pc || destroyed) return;
        return pc.setLocalDescription(offer);
      }).then(function(){
        return waitIce(3000);
      }).then(function(){
        if (!pc || destroyed) return;
        var sdp = pc.localDescription ? pc.localDescription.sdp : null;
        if (!sdp) throw new Error('no-local-sdp');
        return fetch(WHEP_URL, { method:'POST', headers:{'Content-Type':'application/sdp'}, body: sdp });
      }).then(function(res){
        if (!res) return;
        if (!res.ok) throw new Error('whep-' + res.status);
        var loc = res.headers.get('Location');
        if (loc){ try{ resourceUrl = new URL(loc, WHEP_URL).toString(); }catch(e){} }
        return res.text();
      }).then(function(answer){
        if (!answer || !pc || destroyed) return;
        return pc.setRemoteDescription({ type:'answer', sdp: answer });
      }).then(function(){
        video.muted = true;
        var p = video.play();
        if (p && p.then) p.then(function(){
          setTimeout(function(){ try{ video.muted = false; }catch(e){} }, 400);
        }).catch(function(){});
      }).catch(function(){
        scheduleReconnect();
      });
    } catch(e){
      scheduleReconnect();
    }
  }

  window.addEventListener('pagehide', function(){
    destroyed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (resourceUrl){ try{ fetch(resourceUrl, { method:'DELETE' }); }catch(e){} }
    cleanup();
  });

  connect();
})();
</script>
</body>
</html>`;
}

function CloudflareWhepPlayer({ whepUrl, style }: { whepUrl: string; style?: any }) {
  const html = useMemo(() => buildWhepHtml(whepUrl), [whepUrl]);
  return (
    <View style={[styles.wrap, style]}>
      <WebView
        // Remount on URL change so a rotated/reset stream re-negotiates.
        key={whepUrl}
        // Real https baseUrl → the cross-origin POST to cloudflarestream.com
        // runs from a proper origin (not null), matching how the web does it.
        source={{ html, baseUrl: 'https://connekyt.com' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsProtectedMedia
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
        // Surface negotiation/network failures during dev without crashing.
        onError={(e) => console.warn('[stream] webview', e.nativeEvent?.description)}
      />
      {/* Watermark is injected into the WebView's HTML (buildWhepHtml) — an RN
          overlay here can render behind the WebView on Android. */}
    </View>
  );
}

function NativeHlsPlayer({ url, style, controls = true }: { url: string; style?: any; controls?: boolean }) {
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
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
        contentFit="contain"
        nativeControls={controls}
      />
      <StreamWatermark position="top-left" />
    </View>
  );
}

const styles = StyleSheet.create({
  // No intrinsic aspect-ratio — the caller sizes the box (full-bleed stage or
  // a 16:9 preview). A fixed aspectRatio here kept the video 16:9 even when
  // absolute-filled, so the live stage never reached full screen height.
  wrap: {
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  video: { width: '100%', height: '100%' },
  webview: { width: '100%', height: '100%', backgroundColor: '#000' },
});
