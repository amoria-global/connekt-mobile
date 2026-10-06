import { memo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraFacing } from '@/features/streams/CameraPublisher';
import { RoundButton } from './RoundButton';

type Props = {
  /** Phone-camera controls (flip / mic / video), hidden for the OBS source. */
  showCameraControls: boolean;
  micOff: boolean;
  camOff: boolean;
  facing: CameraFacing;
  commentCount: number;
  /** Landscape / short screens: drop captions to fit. */
  compact: boolean;
  bottomOffset: number;
  opacity: Animated.Value;
  interactive: boolean;
  onFlip: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onOpenComments: () => void;
};

/** Vertical floating action rail: one tap for the frequent controls. */
function QuickActionRailBase({
  showCameraControls,
  micOff,
  camOff,
  facing,
  commentCount,
  compact,
  bottomOffset,
  opacity,
  interactive,
  onFlip,
  onToggleMic,
  onToggleCam,
  onOpenComments,
}: Props) {
  const insets = useSafeAreaInsets();
  const cap = (s: string) => (compact ? undefined : s);
  return (
    <Animated.View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[styles.rail, { right: insets.right + 12, bottom: bottomOffset, opacity }]}
    >
      {showCameraControls ? (
        <>
          <RoundButton
            icon="camera-reverse"
            label={`Flip camera, currently ${facing === 'user' ? 'front' : 'back'}`}
            caption={cap('Flip')}
            onPress={onFlip}
          />
          <RoundButton
            icon={micOff ? 'mic-off' : 'mic'}
            label={micOff ? 'Microphone off, tap to turn on' : 'Microphone on, tap to mute'}
            caption={cap(micOff ? 'Muted' : 'Mic')}
            off={micOff}
            onPress={onToggleMic}
          />
          <RoundButton
            icon={camOff ? 'videocam-off' : 'videocam'}
            label={camOff ? 'Video off, tap to turn on' : 'Video on, tap to turn off'}
            caption={cap(camOff ? 'Video off' : 'Video')}
            off={camOff}
            onPress={onToggleCam}
          />
        </>
      ) : null}
      <RoundButton
        icon="chatbubble-ellipses"
        label={`Open comments, ${commentCount} messages`}
        caption={cap('Chat')}
        onPress={onOpenComments}
      />
    </Animated.View>
  );
}

export const QuickActionRail = memo(QuickActionRailBase);

const styles = StyleSheet.create({
  rail: { position: 'absolute', gap: 12, alignItems: 'center', zIndex: 10 },
});
