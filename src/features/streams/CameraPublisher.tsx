/**
 * Browser-camera publisher for native (iOS + Android).
 *
 * Same idea as the native HlsPlayer: react-native-webview is a real
 * browser engine, so we run the web photographer's WHIP browser-capture
 * flow (salo-run/lib/whip-client.ts `WHIPClient`) INSIDE the WebView:
 * getUserMedia → publish the camera/mic to Cloudflare's WHIP endpoint
 * over WebRTC, with a live local preview. No react-native-webrtc needed.
 *
 * Capture needs camera + mic permission: iOS is granted with
 * `mediaCapturePermissionGrantState="grant"`; Android auto-grants the
 * WebView once the app holds CAMERA / RECORD_AUDIO (declared in app
 * config). The inline HTML reports status back to RN via postMessage.
 *
 * Two UI modes:
 *   • default     , the inline HTML draws its own mic / camera / flip buttons.
 *   • `nativeUi`  , the HTML draws nothing but the video; React Native owns
 *                    the controls and drives the WebView through the
 *                    `CameraPublisherHandle` ref. Device state (mic / camera
 *                    muted, facing mode) and capture errors are reported back
 *                    through `onDeviceState` / `onCameraError`.
 *
 * The publishing pipeline (getUserMedia → WHIP) is identical in both modes.
 */
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { PublishStatus } from './CameraPublisher.web';

export type { PublishStatus } from './CameraPublisher.web';

export type CameraFacing = 'user' | 'environment';
export type CameraDeviceState = { micOff: boolean; camOff: boolean; facing: CameraFacing };
export type CameraErrorKind = 'permission' | 'notfound' | 'unsupported' | 'network' | 'other';

/** Imperative controls, only effective in `nativeUi` mode or when the camera is running. */
export type CameraPublisherHandle = {
  toggleMic: () => void;
  toggleCam: () => void;
  flip: () => void;
};

type Props = {
  whipUrl: string;
  publish: boolean;
  onStatusChange?: (status: PublishStatus) => void;
  /** Hide the in-WebView buttons/messages; the parent renders its own UI. */
  nativeUi?: boolean;
  onDeviceState?: (state: CameraDeviceState) => void;
  onCameraError?: (kind: CameraErrorKind) => void;
  /** Fill the parent (edge-to-edge, no 16:9 crop box). */
  fill?: boolean;
  style?: any;
};

function buildPublisherHtml(whipUrl: string, nativeUi: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html,body{margin:0;padding:0;height:100%;width:100%;background:#000;overflow:hidden;}
  #v{width:100%;height:100%;object-fit:cover;background:#000;display:block;transform:scaleX(-1);}
  #msg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
       color:#e5e7eb;font-family:-apple-system,system-ui,'Segoe UI',sans-serif;
       font-size:14px;text-align:center;padding:24px;}
  #bar{position:absolute;bottom:14px;left:0;right:0;display:flex;gap:14px;justify-content:center;z-index:100;}
  .b{width:44px;height:44px;border-radius:22px;background:rgba(15,23,42,0.75);
     border:1px solid rgba(255,255,255,0.22);color:#ffffff;display:flex;align-items:center;
     justify-content:center;cursor:pointer;box-shadow:0 4px 10px rgba(0,0,0,0.35);outline:none;
     -webkit-tap-highlight-color:transparent;transition:transform 0.12s ease,background 0.2s ease,border-color 0.2s ease;}
  .b:active{transform:scale(0.92);}
  .b.off{background:rgba(220,38,38,0.35);border-color:rgba(239,68,68,0.65);color:#EF4444;}
  .b svg{display:block;pointer-events:none;}
</style>
</head>
<body>
<video id="v" playsinline autoplay muted></video>
<div id="msg">Starting camera…</div>
<div id="bar" style="display:none">
  <button class="b" id="mic" aria-label="Microphone" title="Toggle Microphone"></button>
  <button class="b" id="cam" aria-label="Camera" title="Toggle Camera"></button>
  <button class="b" id="flip" aria-label="Flip Camera" title="Flip Camera"></button>
</div>
<script>
(function(){
  var WHIP_URL = ${JSON.stringify(whipUrl)};
  var NATIVE_UI = ${nativeUi ? 'true' : 'false'};
  var video = document.getElementById('v');
  var msgEl = document.getElementById('msg');
  var bar = document.getElementById('bar');
  var micBtn = document.getElementById('mic');
  var camBtn = document.getElementById('cam');
  var flipBtn = document.getElementById('flip');
  var pc = null, resourceUrl = null, stream = null, destroyed = false;
  var facing = 'user', micOff = false, camOff = false;

  var ICONS = {
    micOn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    micOff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    camOn: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    camOff: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="m21 15.5-5-3.5 5-3.5v7z"/><path d="M10.5 5H15a2 2 0 0 1 2 2v4.5"/><path d="M1 5.5A2 2 0 0 1 3 5h2m11 11.5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 .5-1.3"/></svg>',
    flip: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><circle cx="12" cy="12" r="3"/><path d="m18 22-3-3 3-3"/><path d="m6 2 3 3-3 3"/></svg>'
  };

  micBtn.innerHTML = ICONS.micOn;
  camBtn.innerHTML = ICONS.camOn;
  flipBtn.innerHTML = ICONS.flip;

  function post(s){ try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(s); }catch(e){} }
  function postState(){ post(JSON.stringify({ t:'state', micOff: micOff, camOff: camOff, facing: facing })); }
  function postError(kind){ post(JSON.stringify({ t:'error', kind: kind })); }
  function setMsg(t){
    if (NATIVE_UI){ msgEl.style.display = 'none'; return; }
    if(msgEl){ msgEl.style.display = t ? 'flex' : 'none'; msgEl.textContent = t || ''; }
  }

  function waitIce(timeout){
    return new Promise(function(resolve){
      if (!pc || pc.iceGatheringState === 'complete') return resolve();
      var t = setTimeout(resolve, timeout);
      pc.addEventListener('icegatheringstatechange', function(){
        if (pc && pc.iceGatheringState === 'complete'){ clearTimeout(t); resolve(); }
      });
    });
  }

  function teardown(){
    if (resourceUrl){ try{ fetch(resourceUrl,{method:'DELETE'}); }catch(e){} resourceUrl = null; }
    if (pc){ try{ pc.close(); }catch(e){} pc = null; }
    if (stream){ stream.getTracks().forEach(function(t){ t.stop(); }); stream = null; }
  }

  function start(){
    setMsg('Starting camera…'); post('starting');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      setMsg('This device cannot access the camera.'); postError('unsupported'); post('error'); return;
    }
    navigator.mediaDevices.getUserMedia({ video:{ facingMode: facing }, audio:true })
    .then(function(s){
      if (destroyed){ s.getTracks().forEach(function(t){ t.stop(); }); return; }
      stream = s;
      video.srcObject = s;
      video.style.transform = facing === 'user' ? 'scaleX(-1)' : 'none';
      video.play().catch(function(){});
      s.getAudioTracks().forEach(function(t){ t.enabled = !micOff; });
      s.getVideoTracks().forEach(function(t){ t.enabled = !camOff; });
      if (!NATIVE_UI) bar.style.display = 'flex';
      postState();

      pc = new RTCPeerConnection({ iceServers:[{urls:'stun:stun.cloudflare.com:3478'}], bundlePolicy:'max-bundle' });
      s.getTracks().forEach(function(t){ pc.addTrack(t, s); });
      pc.addEventListener('connectionstatechange', function(){
        if (pc && pc.connectionState === 'failed'){ setMsg('Stream connection failed.'); postError('network'); post('error'); }
      });
      return pc.createOffer().then(function(offer){
        return pc.setLocalDescription(offer);
      }).then(function(){
        return waitIce(3000);
      }).then(function(){
        return fetch(WHIP_URL, { method:'POST', headers:{'Content-Type':'application/sdp'}, body: pc.localDescription.sdp });
      }).then(function(res){
        if (!res.ok) throw new Error('whip-' + res.status);
        var loc = res.headers.get('Location');
        if (loc){ try{ resourceUrl = new URL(loc, WHIP_URL).toString(); }catch(e){} }
        return res.text();
      }).then(function(answer){
        return pc.setRemoteDescription({ type:'answer', sdp: answer });
      }).then(function(){
        setMsg(''); post('publishing');
      });
    })
    .catch(function(err){
      var m = (err && err.message) || '';
      var n = (err && err.name) || '';
      var kind = 'other';
      var captured = !!stream;
      if (captured) { kind = 'network'; setMsg('Could not connect.'); }
      else if (/Permission|NotAllowed/i.test(m + ' ' + n)) { setMsg('Camera / microphone permission denied.'); kind = 'permission'; }
      else if (/NotFound/i.test(m + ' ' + n)) { setMsg('No camera or microphone found.'); kind = 'notfound'; }
      else setMsg('Could not start the camera.');
      postError(kind); post('error'); teardown();
    });
  }

  function toggleMic(){
    micOff = !micOff;
    if (stream) stream.getAudioTracks().forEach(function(t){ t.enabled = !micOff; });
    micBtn.innerHTML = micOff ? ICONS.micOff : ICONS.micOn;
    if (micOff) micBtn.classList.add('off'); else micBtn.classList.remove('off');
    postState();
  }

  function toggleCam(){
    camOff = !camOff;
    if (stream) stream.getVideoTracks().forEach(function(t){ t.enabled = !camOff; });
    camBtn.innerHTML = camOff ? ICONS.camOff : ICONS.camOn;
    if (camOff) camBtn.classList.add('off'); else camBtn.classList.remove('off');
    postState();
  }

  function flip(){
    facing = facing === 'user' ? 'environment' : 'user';
    teardown(); start();
  }

  micBtn.addEventListener('click', toggleMic);
  camBtn.addEventListener('click', toggleCam);
  flipBtn.addEventListener('click', flip);
  window.__studio = { mic: toggleMic, cam: toggleCam, flip: flip };

  window.addEventListener('pagehide', function(){ destroyed = true; teardown(); });
  start();
})();
</script>
</body>
</html>`;
}

export const CameraPublisher = forwardRef<CameraPublisherHandle, Props>(function CameraPublisher(
  { whipUrl, publish, onStatusChange, nativeUi = false, onDeviceState, onCameraError, fill, style },
  ref,
) {
  const webRef = useRef<WebView>(null);
  const html = useMemo(() => buildPublisherHtml(whipUrl, nativeUi), [whipUrl, nativeUi]);
  // Stable source object so parent re-renders (chat polling etc.) never look
  // like a source change to the WebView.
  const source = useMemo(() => ({ html, baseUrl: 'https://connekyt.com' }), [html]);

  useImperativeHandle(
    ref,
    () => {
      const run = (fn: 'mic' | 'cam' | 'flip') =>
        webRef.current?.injectJavaScript(
          `(function(){try{window.__studio&&window.__studio.${fn}();}catch(e){}})();true;`,
        );
      return {
        toggleMic: () => run('mic'),
        toggleCam: () => run('cam'),
        flip: () => run('flip'),
      };
    },
    [],
  );

  if (!publish) return <View style={[fill ? styles.fill : styles.wrap, style]} />;

  const onMessage = (e: WebViewMessageEvent) => {
    const data = e.nativeEvent.data;
    if (data.startsWith('{')) {
      try {
        const msg = JSON.parse(data);
        if (msg.t === 'state') {
          onDeviceState?.({
            micOff: !!msg.micOff,
            camOff: !!msg.camOff,
            facing: msg.facing === 'environment' ? 'environment' : 'user',
          });
        } else if (msg.t === 'error') {
          onCameraError?.(msg.kind as CameraErrorKind);
        }
      } catch {
        /* ignore malformed */
      }
      return;
    }
    const s = data as PublishStatus;
    if (s === 'starting' || s === 'publishing' || s === 'error' || s === 'idle') {
      onStatusChange?.(s);
    }
  };

  return (
    <View style={[fill ? styles.fill : styles.wrap, style]}>
      <WebView
        key={whipUrl}
        ref={webRef}
        source={source}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // iOS: grant camera + mic to the WebView content (Android grants
        // automatically once the app holds CAMERA / RECORD_AUDIO).
        mediaCapturePermissionGrantType="grant"
        onMessage={onMessage}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  fill: { ...StyleSheet.absoluteFill, backgroundColor: '#000' },
  webview: { width: '100%', height: '100%', backgroundColor: '#000' },
});
