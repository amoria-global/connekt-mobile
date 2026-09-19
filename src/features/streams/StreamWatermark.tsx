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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { logoBase64 } from '@/utils/logoBase64';

export function StreamWatermark({
  position = 'top-right',
  offset,
}: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  offset?: { top?: number; right?: number; bottom?: number; left?: number };
}) {
  const insets = useSafeAreaInsets();
  const defaultTop = Math.max(14, (insets?.top || 0) + 10);
  const defaultBottom = Math.max(14, (insets?.bottom || 0) + 10);
  const defaultLeft = Math.max(14, (insets?.left || 0) + 14);
  const defaultRight = Math.max(14, (insets?.right || 0) + 14);

  const corner = {
    ...(position.startsWith('top') ? { top: offset?.top ?? defaultTop } : { bottom: offset?.bottom ?? defaultBottom }),
    ...(position.endsWith('left') ? { left: offset?.left ?? defaultLeft } : { right: offset?.right ?? defaultRight }),
  } as const;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.top]}>
      {/* Layer 1 — faint full-frame diagonal wordmark (muted). */}
      <View style={styles.centerWrap} pointerEvents="none">
        <Text style={styles.diagonal} numberOfLines={1}>
          AMORIA CONNEKYT
        </Text>
      </View>

      {/* Layer 2 — muted corner bug on top-right: logo icon + logo wordmark */}
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
    opacity: 0.07,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: 3,
    transform: [{ rotate: '-22deg' }],
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  // Burned-in corner bug (logo icon + logo text) — muted subtle broadcast bug
  bug: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    opacity: 0.40,
  },
  logo: { width: 18, height: 18 },
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
