/**
 * Persistent brand watermark burned onto every live-stream video (mobile).
 *
 * Mirrors knockout's StreamWatermark with two layers so it's impossible to
 * miss yet non-intrusive:
 *   1. A faint, large diagonal "AMORIA CONNEKYT" across the whole frame.
 *   2. A legible corner bug (logo + wordmark) on a translucent pill.
 *
 * It lives INSIDE the HlsPlayer wrap (rendered after the video/VideoView) so
 * every viewer sees it on every stream, regardless of role or access.
 * pointer-events: none → it never steals taps from the player/controls.
 *
 * NOTE: the native WebRTC path plays inside a WebView; there the watermark is
 * injected into the WebView's own HTML (see HlsPlayer buildWhepHtml) because
 * an RN sibling can render behind a WebView on Android. This component covers
 * the native-HLS + web players.
 */
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { logoBase64 } from '@/utils/logoBase64';

export function StreamWatermark({
  position = 'top-right',
}: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offset?: { top?: number; right?: number; bottom?: number; left?: number };
}) {
  const corner = {
    ...(position.startsWith('top') ? { top: 10 } : { bottom: 10 }),
    ...(position.endsWith('left') ? { left: 10 } : { right: 10 }),
  } as const;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.top]}>
      {/* Corner bug — logo + CONNEKYT text, fixed top-right */}
      <View style={[styles.bug, corner]} pointerEvents="none">
        <Image source={{ uri: logoBase64 }} style={styles.logo} contentFit="contain" />
        <Text style={styles.label}>CONNEKYT</Text>
      </View>
      {/* Centered ghost watermark */}
      <View style={styles.center} pointerEvents="none">
        <Text style={styles.centerLabel}>CONNEKYT</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { zIndex: 999, elevation: 999 },
  bug: {
    position: 'absolute',
    alignItems: 'center',
    opacity: 0.60,
  },
  logo: {
    width: 26,
    height: 26,
  },
  label: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 3,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  center: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.08,
  },
  centerLabel: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 6,
  },
});

export default StreamWatermark;
