/**
 * Browser-camera publisher (Expo web).
 *
 * Direct port of salo-run/lib/whip-client.ts `WHIPClient`: grab the
 * camera + mic with getUserMedia, publish the MediaStream to the
 * Cloudflare WHIP endpoint over raw WebRTC, and show a local preview.
 * This is the "go live straight from this device" path the web
 * photographer dashboard offers (StreamPreview browser-capture mode).
 *
 * The parent drives it with a `publish` boolean — flip it true to
 * acquire the camera and start publishing, false (or unmount) to tear
 * everything down. Local flip / mute / camera-off toggles match what a
 * photographer expects on a phone.
 */
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeStyles, onFill } from '@/theme';

export type PublishStatus = 'idle' | 'starting' | 'publishing' | 'error';

type Props = {
  whipUrl: string;
  publish: boolean;
  onStatusChange?: (status: PublishStatus) => void;
  style?: any;
};

function waitIce(pc: RTCPeerConnection, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const t = setTimeout(resolve, timeout);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        resolve();
      }
    });
  });
}

export function CameraPublisher({ whipUrl, publish, onStatusChange, style }: Props) {
  const styles = useStyles();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const resourceRef = useRef<string | null>(null);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [micOff, setMicOff] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusRef = useRef(onStatusChange);
  statusRef.current = onStatusChange;

  useEffect(() => {
    let cancelled = false;

    const teardown = async () => {
      if (resourceRef.current) {
        fetch(resourceRef.current, { method: 'DELETE' }).catch(() => {});
        resourceRef.current = null;
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {
          /* ignore */
        }
        pcRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const start = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
        setError('This browser cannot access the camera.');
        statusRef.current?.('error');
        return;
      }
      setError(null);
      statusRef.current?.('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
        // Apply current mute/cam toggles to the fresh tracks.
        stream.getAudioTracks().forEach((t) => (t.enabled = !micOff));
        stream.getVideoTracks().forEach((t) => (t.enabled = !camOff));

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }],
          bundlePolicy: 'max-bundle',
        });
        pcRef.current = pc;
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));

        const offer = await pc.createOffer();
        if (cancelled) return;
        await pc.setLocalDescription(offer);
        await waitIce(pc, 3000);
        if (cancelled) return;

        const res = await fetch(whipUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription?.sdp,
        });
        if (!res.ok) throw new Error(`Publish failed (${res.status})`);
        const loc = res.headers.get('Location');
        if (loc) {
          try {
            resourceRef.current = new URL(loc, whipUrl).toString();
          } catch {
            /* ignore */
          }
        }
        const answer = await res.text();
        if (cancelled) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: answer });
        statusRef.current?.('publishing');
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'Could not start the camera.';
        setError(
          /Permission|NotAllowed/i.test(msg)
            ? 'Camera / microphone permission denied. Allow access and try again.'
            : /NotFound|DevicesNotFound/i.test(msg)
              ? 'No camera or microphone found on this device.'
              : msg,
        );
        statusRef.current?.('error');
        await teardown();
      }
    };

    if (publish) {
      start();
    } else {
      teardown();
      statusRef.current?.('idle');
    }

    return () => {
      cancelled = true;
      teardown();
    };
    // Re-acquire when the camera is flipped while publishing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whipUrl, publish, facing]);

  const toggleMic = () => {
    const next = !micOff;
    setMicOff(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };
  const toggleCam = () => {
    const next = !camOff;
    setCamOff(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = !next));
  };

  const VideoTag = 'video' as any;
  return (
    <View style={[styles.wrap, style]}>
      <VideoTag ref={videoRef} style={styles.video as any} playsInline autoPlay muted />
      {error ? (
        <View style={styles.errorOverlay}>
          <Ionicons name="alert-circle" size={26} color={onFill} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {publish && !error ? (
        <View style={styles.controls}>
          <Pressable style={styles.ctrlBtn} onPress={toggleMic}>
            <Ionicons name={micOff ? 'mic-off' : 'mic'} size={18} color={onFill} />
          </Pressable>
          <Pressable style={styles.ctrlBtn} onPress={toggleCam}>
            <Ionicons name={camOff ? 'videocam-off' : 'videocam'} size={18} color={onFill} />
          </Pressable>
          <Pressable
            style={styles.ctrlBtn}
            onPress={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
          >
            <Ionicons name="camera-reverse" size={18} color={onFill} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' },
  video: { width: '100%', height: '100%', objectFit: 'cover', border: 0 } as any,
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  errorText: { color: c.textOnPrimary, fontSize: 13, textAlign: 'center' },
  controls: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  ctrlBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
