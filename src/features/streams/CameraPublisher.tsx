/**
 * Browser-camera publisher for native (iOS + Android).
 *
 * Same idea as the native HlsPlayer: react-native-webview is a real
 * browser engine, so we run the web photographer's WHIP browser-capture
 * flow (salo-run/lib/whip-client.ts `WHIPClient`) INSIDE the WebView —
 * getUserMedia → publish the camera/mic to Cloudflare's WHIP endpoint
 * over WebRTC, with a live local preview. No react-native-webrtc needed.
 *
 * Capture needs camera + mic permission: iOS is granted with
 * `mediaCapturePermissionGrantState="grant"`; Android auto-grants the
 * WebView once the app holds CAMERA / RECORD_AUDIO (declared in app
 * config). The inline HTML reports status back to RN via postMessage and
 * carries its own mic / camera / flip overlay controls.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { PublishStatus } from './CameraPublisher.web';

export type { PublishStatus } from './CameraPublisher.web';

type Props = {
  whipUrl: string;
  publish: boolean;
  onStatusChange?: (status: PublishStatus) => void;
  style?: any;
};

function buildPublisherHtml(whipUrl: string): string {
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
  #bar{position:absolute;bottom:12px;left:0;right:0;display:flex;gap:12px;justify-content:center;}
  .b{width:44px;height:44px;border-radius:22px;background:rgba(0,0,0,0.55);border:none;
     color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;}
</style>
</head>
<body>
<video id="v" playsinline autoplay muted></video>
<div id="msg">Starting camera…</div>
<div id="bar" style="display:none">
  <button class="b" id="mic">🎤</button>
  <button class="b" id="cam">🎥</button>
  <button class="b" id="flip">🔄</button>
</div>
<script>
(function(){
  var WHIP_URL = ${JSON.stringify(whipUrl)};
  var video = document.getElementById('v');
  var msgEl = document.getElementById('msg');
  var bar = document.getElementById('bar');
  var pc = null, resourceUrl = null, stream = null, destroyed = false;
  var facing = 'user', micOff = false, camOff = false;

  function post(s){ try{ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(s); }catch(e){} }
  function setMsg(t){ if(msgEl){ msgEl.style.display = t ? 'flex' : 'none'; msgEl.textContent = t || ''; } }

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
      setMsg('This device cannot access the camera.'); post('error'); return;
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
      bar.style.display = 'flex';

      pc = new RTCPeerConnection({ iceServers:[{urls:'stun:stun.cloudflare.com:3478'}], bundlePolicy:'max-bundle' });
      s.getTracks().forEach(function(t){ pc.addTrack(t, s); });
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
      if (/Permission|NotAllowed/i.test(m)) setMsg('Camera / microphone permission denied.');
      else if (/NotFound/i.test(m)) setMsg('No camera or microphone found.');
      else setMsg('Could not start the camera.');
      post('error'); teardown();
    });
  }

  document.getElementById('mic').addEventListener('click', function(){
    micOff = !micOff;
    if (stream) stream.getAudioTracks().forEach(function(t){ t.enabled = !micOff; });
    this.style.opacity = micOff ? '0.5' : '1';
  });
  document.getElementById('cam').addEventListener('click', function(){
    camOff = !camOff;
    if (stream) stream.getVideoTracks().forEach(function(t){ t.enabled = !camOff; });
    this.style.opacity = camOff ? '0.5' : '1';
  });
  document.getElementById('flip').addEventListener('click', function(){
    facing = facing === 'user' ? 'environment' : 'user';
    teardown(); start();
  });

  window.addEventListener('pagehide', function(){ destroyed = true; teardown(); });
  start();
})();
</script>
</body>
</html>`;
}

export function CameraPublisher({ whipUrl, publish, onStatusChange, style }: Props) {
  const html = useMemo(() => buildPublisherHtml(whipUrl), [whipUrl]);

  if (!publish) return <View style={[styles.wrap, style]} />;

  const onMessage = (e: WebViewMessageEvent) => {
    const s = e.nativeEvent.data as PublishStatus;
    if (s === 'starting' || s === 'publishing' || s === 'error' || s === 'idle') {
      onStatusChange?.(s);
    }
  };

  return (
    <View style={[styles.wrap, style]}>
      <WebView
        key={whipUrl}
        source={{ html, baseUrl: 'https://connekyt.com' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // iOS: grant camera + mic to the WebView content (Android grants
        // automatically once the app holds CAMERA / RECORD_AUDIO).
        mediaCapturePermissionGrantState="grant"
        onMessage={onMessage}
        style={styles.webview}
        scrollEnabled={false}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  webview: { width: '100%', height: '100%', backgroundColor: '#000' },
});
