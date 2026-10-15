/**
 * WHEP (WebRTC) playback for the live viewer, ported from the web's
 * `lib/streaming/WHEPClient.ts` (connekyt-landing) so the phone gets the same
 * feed path as the website: WebRTC straight from Cloudflare, sub-second delay,
 * instead of HLS segments.
 *
 * React Native has no WebRTC engine, so the player runs inside a WebView (the
 * same approach as the streamer's CameraPublisher). The behaviour below is the
 * web's, line for line:
 *   - receive-only video and audio transceivers, ICE gathering capped at 3 s;
 *   - connection "failed" or "disconnected" triggers a reconnect;
 *   - reconnects never give up, with a backoff that tops out at 5 s, so a host
 *     whose encoder drops and returns is picked up again without a reload;
 *   - a stall watchdog: if no inbound bytes arrive for 5 s while the peer still
 *     says "connected" (Cloudflare keeps the session warm), tear it down and
 *     negotiate a fresh one.
 */

export type WhepStatus = 'connecting' | 'playing' | 'buffering' | 'reconnecting';

/** No inbound bytes for this long while "connected" means the source went quiet. */
export const WHEP_STALL_THRESHOLD_MS = 5000;
/** How often the watchdog samples the inbound byte counter. */
export const WHEP_STATS_INTERVAL_MS = 2000;
/** Max time to wait for ICE gathering before sending the offer anyway. */
export const WHEP_ICE_TIMEOUT_MS = 3000;
/** Backoff ceiling between reconnect attempts. */
export const WHEP_MAX_BACKOFF_MS = 5000;
/**
 * Mobile-only safety net, not in the web: if WebRTC never produces a first frame
 * (an old or restricted WebView), fall back to HLS instead of a black screen.
 * Once a frame has played, this never triggers again and reconnects stay unbounded.
 */
export const WHEP_FIRST_FRAME_TIMEOUT_MS = 20_000;

/** Delay before reconnect attempt `attempt` (1-based): 1 s, 2 s, 4 s, then 5 s. */
export function whepBackoffMs(attempt: number): number {
  const exp = Math.min(Math.max(attempt, 1) - 1, 3);
  return Math.min(1000 * Math.pow(2, exp), WHEP_MAX_BACKOFF_MS);
}

/** Messages the page posts to React Native. */
export type WhepMessage = { t: 'status'; s: WhepStatus };

export function parseWhepMessage(raw: string): WhepMessage | null {
  try {
    const m = JSON.parse(raw) as { t?: string; s?: string };
    if (
      m?.t === 'status' &&
      (m.s === 'connecting' || m.s === 'playing' || m.s === 'buffering' || m.s === 'reconnecting')
    ) {
      return { t: 'status', s: m.s };
    }
  } catch {
    /* not ours */
  }
  return null;
}

/** JSON for embedding inside an inline script: `<` is escaped so a URL cannot close the tag. */
function jsonForScript(value: unknown): string {
  return JSON.stringify(value).split('<').join('\\u003c');
}

export function buildWhepHtml(whepUrl: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}
video{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}</style></head>
<body><video id="v" playsinline autoplay></video><script>
(function(){
  var WHEP_URL = ${jsonForScript(whepUrl)};
  var STALL_MS = ${WHEP_STALL_THRESHOLD_MS};
  var STATS_MS = ${WHEP_STATS_INTERVAL_MS};
  var ICE_MS = ${WHEP_ICE_TIMEOUT_MS};
  var MAX_BACKOFF = ${WHEP_MAX_BACKOFF_MS};
  var video = document.getElementById('v');
  var pc = null, resourceUrl = null, destroyed = false;
  var reconnectTimer = null, statsTimer = null;
  var attempts = 0, lastBytes = 0, lastAdvanceAt = 0;
  var wantMuted = false, userPaused = false, everPlayed = false;

  function post(s){
    try { window.ReactNativeWebView.postMessage(JSON.stringify({ t: 'status', s: s })); } catch(e){}
  }

  function waitIce(ms){
    return new Promise(function(resolve){
      if (!pc || pc.iceGatheringState === 'complete') return resolve();
      var t = setTimeout(resolve, ms);
      pc.addEventListener('icegatheringstatechange', function(){
        if (pc && pc.iceGatheringState === 'complete'){ clearTimeout(t); resolve(); }
      });
    });
  }

  function stopWatchdog(){ if (statsTimer){ clearInterval(statsTimer); statsTimer = null; } }

  function cleanup(){
    stopWatchdog();
    if (resourceUrl){ try { fetch(resourceUrl, { method: 'DELETE' }); } catch(e){} resourceUrl = null; }
    if (pc){
      pc.onconnectionstatechange = null;
      pc.ontrack = null;
      try { pc.close(); } catch(e){}
      pc = null;
    }
  }

  function startWatchdog(){
    stopWatchdog();
    lastBytes = 0;
    lastAdvanceAt = Date.now();
    statsTimer = setInterval(function(){
      if (destroyed || !pc) return;
      pc.getStats().then(function(stats){
        var total = 0;
        stats.forEach(function(r){
          if (r.type === 'inbound-rtp' && typeof r.bytesReceived === 'number') total += r.bytesReceived;
        });
        if (total > lastBytes){ lastBytes = total; lastAdvanceAt = Date.now(); return; }
        if (pc && pc.connectionState === 'connected' && Date.now() - lastAdvanceAt > STALL_MS) onDrop();
      }).catch(function(){});
    }, STATS_MS);
  }

  function onDrop(){
    if (destroyed || reconnectTimer) return;
    cleanup();
    attempts += 1;
    var delay = Math.min(1000 * Math.pow(2, Math.min(attempts - 1, 3)), MAX_BACKOFF);
    post('reconnecting');
    reconnectTimer = setTimeout(function(){ reconnectTimer = null; connect(); }, delay);
  }

  function playVideo(){
    if (userPaused) return;
    video.muted = wantMuted;
    var p = video.play();
    if (p && p.catch){
      p.catch(function(){
        // Autoplay with sound refused: start muted so the picture still shows.
        video.muted = true;
        video.play().catch(function(){});
      });
    }
  }

  function connect(){
    if (destroyed) return;
    post(attempts > 0 ? 'reconnecting' : 'connecting');
    pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }], bundlePolicy: 'max-bundle' });
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });
    var remote = new MediaStream();
    pc.ontrack = function(e){
      remote.addTrack(e.track);
      if (video.srcObject !== remote) video.srcObject = remote;
      playVideo();
    };
    pc.onconnectionstatechange = function(){
      var st = pc && pc.connectionState;
      if (st === 'failed' || st === 'disconnected') onDrop();
      else if (st === 'connected'){ attempts = 0; startWatchdog(); }
    };
    pc.createOffer().then(function(offer){
      return pc.setLocalDescription(offer);
    }).then(function(){
      return waitIce(ICE_MS);
    }).then(function(){
      return fetch(WHEP_URL, { method: 'POST', headers: { 'Content-Type': 'application/sdp' }, body: pc.localDescription.sdp });
    }).then(function(res){
      if (!res.ok) throw new Error('whep-' + res.status);
      var loc = res.headers.get('Location');
      if (loc){ try { resourceUrl = new URL(loc, WHEP_URL).toString(); } catch(e){} }
      return res.text();
    }).then(function(answer){
      return pc.setRemoteDescription({ type: 'answer', sdp: answer });
    }).catch(function(){ onDrop(); });
  }

  video.addEventListener('playing', function(){ everPlayed = true; post('playing'); });
  video.addEventListener('waiting', function(){ if (everPlayed) post('buffering'); });

  window.__whep = {
    setMuted: function(m){ wantMuted = !!m; video.muted = wantMuted; },
    setPlaying: function(p){
      userPaused = !p;
      if (p) playVideo(); else video.pause();
    },
    destroy: function(){ destroyed = true; if (reconnectTimer) clearTimeout(reconnectTimer); cleanup(); }
  };
  window.addEventListener('pagehide', function(){ if (window.__whep) window.__whep.destroy(); });
  connect();
})();
</script></body></html>`;
}

/**
 * UI phase for the WebRTC engine. Unlike HLS it never reports a permanent
 * error: the page keeps reconnecting, so a drop reads as "reconnecting" until
 * the host's feed returns, as on the web.
 */
export function whepPhase(
  status: WhepStatus,
  everPlayed: boolean,
): 'connecting' | 'playing' | 'buffering' | 'reconnecting' {
  if (status === 'playing') return 'playing';
  if (status === 'reconnecting') return 'reconnecting';
  if (status === 'buffering' || everPlayed) return 'buffering';
  return 'connecting';
}
