import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { VideoView, type VideoPlayer } from 'expo-video';

type Props = {
  player: VideoPlayer;
  hasSource: boolean;
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
export const LiveVideoSurface = memo(function LiveVideoSurface({ player, hasSource, fullscreen, onTap, children }: Props) {
  return (
    <View style={styles.root}>
      {hasSource ? (
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
