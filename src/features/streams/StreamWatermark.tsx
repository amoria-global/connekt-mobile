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
  opacity = 0.20,
}: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offset?: { top?: number; right?: number; bottom?: number; left?: number };
  opacity?: number;
}) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.top]}>
      {/* Centered clean brand watermark: Logo with "CONNEKYT" underneath */}
      <View style={[styles.center, { opacity }]} pointerEvents="none">
        <Image source={{ uri: logoBase64 }} style={styles.centerLogo} contentFit="contain" />
        <Text style={styles.centerLabel}>CONNEKYT</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { zIndex: 999, elevation: 999 },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  centerLogo: {
    width: 46,
    height: 46,
  },
  centerLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

export default StreamWatermark;
