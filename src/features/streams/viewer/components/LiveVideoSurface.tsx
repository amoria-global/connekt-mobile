import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { VideoView, type VideoPlayer } from 'expo-video';
import type { Ref } from 'react';
import { WhepVideo, type WhepHandle } from './WhepVideo';
import type { WhepStatus } from '../whep';

type Props = {
  player: VideoPlayer;
  hasSource: boolean;
  /** When set, play the WebRTC feed (the web's path) instead of the HLS player. */
  whep?: { url: string; nonce: number; handleRef: Ref<WhepHandle>; onStatus: (s: WhepStatus) => void };
  fullscreen: boolean;
  onTap: () => void;
  /** Overlays (state, reactions, controls) rendered above the video. */
  children?: ReactNode;
};

/**
 * Presentation wrapper around the existing expo-video player.
 * Native controls are replaced by our tap-to-reveal overlay; the playback
 * engine, source and player instance are untouched.
 */
export const LiveVideoSurface = memo(function LiveVideoSurface({ player, hasSource, whep, fullscreen, onTap, children }: Props) {
  return (
    <View style={styles.root}>
      {whep ? (
        <WhepVideo key={`${whep.url}:${whep.nonce}`} ref={whep.handleRef} url={whep.url} onStatus={whep.onStatus} />
      ) : hasSource ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture
        />
      ) : null}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onTap}
        accessibilityRole="button"
        accessibilityLabel="Live video, tap to show controls"
      />
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
});
