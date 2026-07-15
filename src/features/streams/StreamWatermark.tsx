/**
 * Persistent brand watermark burned onto every live-stream video (mobile).
 *
 * Mirrors knockout's StreamWatermark: a low-opacity "AMORIA CONNEKYT" bug
 * (logo + wordmark) pinned to a corner of the player. It lives INSIDE the
 * HlsPlayer wrap, so every viewer sees it on every stream regardless of
 * role or access.
 *
 * pointer-events: none → it never steals taps from the player/controls.
 * It renders as a sibling AFTER the video/WebView so it layers above it.
 */
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { logoBase64 } from '@/utils/logoBase64';

export function StreamWatermark({
  position = 'top-left',
}: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}) {
  const pos: ViewStyle = {
    ...(position.startsWith('top') ? { top: 10 } : { bottom: 10 }),
    ...(position.endsWith('left') ? { left: 10 } : { right: 10 }),
  };
  return (
    <View pointerEvents="none" style={[styles.wrap, pos] as StyleProp<ViewStyle>}>
      <Image source={{ uri: logoBase64 }} style={styles.logo} contentFit="contain" />
      <Text style={styles.text} numberOfLines={1}>
        AMORIA CONNEKYT
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // Low opacity so it reads as a watermark, not UI chrome.
    opacity: 0.55,
    zIndex: 40,
  },
  logo: {
    width: 22,
    height: 22,
  },
  text: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
});

export default StreamWatermark;
