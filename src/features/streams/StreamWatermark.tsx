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
  position = 'top-left',
}: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  const corner = {
    ...(position.startsWith('top') ? { top: 12 } : { bottom: 12 }),
    ...(position.endsWith('left') ? { left: 12 } : { right: 12 }),
  } as const;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.top]}>
      {/* Layer 1 — faint full-frame diagonal wordmark. */}
      <View style={styles.centerWrap} pointerEvents="none">
        <Text style={styles.diagonal} numberOfLines={1}>
          AMORIA CONNEKYT
        </Text>
      </View>

      {/* Layer 2 — corner bug, burned-in (no pill) so it reads as part of the video. */}
      <View style={[styles.bug, corner]} pointerEvents="none">
        <Image source={{ uri: logoBase64 }} style={styles.logo} contentFit="contain" />
        <Text style={styles.bugText} numberOfLines={1}>
          AMORIA CONNEKYT
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Always on top of the player surface.
  top: { zIndex: 999, elevation: 999 },
  centerWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  diagonal: {
    color: '#fff',
    opacity: 0.08,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 3,
    transform: [{ rotate: '-22deg' }],
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  // Burned-in corner bug — no pill background, so it reads as part of the video.
  bug: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.5,
  },
  logo: { width: 20, height: 20 },
  bugText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textShadowColor: 'rgba(0,0,0,0.95)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
});

export default StreamWatermark;
