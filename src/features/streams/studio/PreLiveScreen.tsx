import { memo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CameraFacing } from '@/features/streams/CameraPublisher';
import { fonts } from '@/theme';
import { RoundButton } from './RoundButton';
import { S, TOUCH } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  eventTitle: string;
  mode: 'browser' | 'obs';
  ready: boolean;
  cameraRunning: boolean;
  micOff: boolean;
  camOff: boolean;
  facing: CameraFacing;
  inviteToken?: string;
  busy: boolean;
  compact: boolean;
  onBack: () => void;
  onFlip: () => void;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onOpenSource: () => void;
  onShare: () => void;
  onShareInvite: () => void;
  onGoLive: () => void;
};

function Chip({
  icon,
  label,
  onPress,
  off,
  a11y,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  off?: boolean;
  a11y: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, off && styles.chipOff, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <Ionicons name={icon} size={17} color={off ? '#FECACA' : S.text} />
      <Text style={[styles.chipText, off && styles.chipTextOff]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Pre-live camera setup overlay. The camera preview fills the screen behind
 * it; this layer holds only: back / readiness / flip on top, and
 * title + compact setting chips + GO LIVE at the bottom.
 */
function PreLiveScreenBase({
  eventTitle,
  mode,
  ready,
  cameraRunning,
  micOff,
  camOff,
  facing,
  inviteToken,
  busy,
  compact,
  onBack,
  onFlip,
  onToggleMic,
  onToggleCam,
  onOpenSource,
  onShare,
  onShareInvite,
  onGoLive,
}: Props) {
  const insets = useSafeAreaInsets();
  const phone = mode === 'browser';
  // Same rule as the web studio: with the phone camera as the source, GO LIVE is
  // only offered once the feed is publishing (the web calls this the encoder
  // being detected). OBS stays always available, like the web's fallback button.
  const canGoLive = ready && !busy && (!phone || cameraRunning);
  const readiness = !ready
    ? 'Connecting…'
    : phone
      ? cameraRunning
        ? 'Camera ready'
        : 'Starting camera…'
      : 'Ready for OBS';

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.5)', 'transparent']}
        style={[styles.topScrim, { height: insets.top + 90 }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', 'rgba(0,0,0,0.78)']}
        style={[styles.bottomScrim, { height: compact ? 190 : 300 }]}
      />

      <View
        style={[
          styles.top,
          { paddingTop: insets.top + 6, paddingLeft: insets.left + 12, paddingRight: insets.right + 12 },
        ]}
        pointerEvents="box-none"
      >
        <RoundButton icon="chevron-back" label="Back" onPress={onBack} size={44} />
        <View style={styles.ready} accessible accessibilityLabel={readiness}>
          <View style={[styles.readyDot, { backgroundColor: ready && (cameraRunning || !phone) ? S.ok : S.warn }]} />
          <Text style={styles.readyText}>{readiness}</Text>
        </View>
        {phone ? (
          <RoundButton
            icon="camera-reverse"
            label={`Flip camera, currently ${facing === 'user' ? 'front' : 'back'}`}
            onPress={onFlip}
            size={44}
          />
        ) : (
          <View style={{ width: 44 }} />
        )}
      </View>

      <View
        style={[
          styles.bottom,
          {
            paddingBottom: Math.max(insets.bottom, 14),
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          },
        ]}
        pointerEvents="box-none"
      >
        <Text style={styles.titleLabel}>LIVE TITLE</Text>
        <Text style={styles.title} numberOfLines={2}>
          {eventTitle}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {phone ? (
            <>
              <Chip
                icon={micOff ? 'mic-off' : 'mic'}
                label={micOff ? 'Mic off' : 'Mic on'}
                off={micOff}
                onPress={onToggleMic}
                a11y={micOff ? 'Microphone off, tap to turn on' : 'Microphone on, tap to mute'}
              />
              <Chip
                icon={camOff ? 'videocam-off' : 'videocam'}
                label={camOff ? 'Video off' : 'Video on'}
                off={camOff}
                onPress={onToggleCam}
                a11y={camOff ? 'Video off, tap to turn on' : 'Video on, tap to turn off'}
              />
              <Chip
                icon="camera-reverse-outline"
                label={facing === 'user' ? 'Front' : 'Back'}
                onPress={onFlip}
                a11y="Flip camera"
              />
            </>
          ) : null}
          <Chip
            icon={phone ? 'phone-portrait-outline' : 'desktop-outline'}
            label={phone ? 'This phone' : 'External / OBS'}
            onPress={onOpenSource}
            a11y="Video source. Tap to change."
          />
          {inviteToken ? (
            <Chip icon="key-outline" label="Access code" onPress={onShareInvite} a11y="Share viewer access code" />
          ) : null}
          <Chip icon="paper-plane-outline" label="Share link" onPress={onShare} a11y="Share live link" />
        </ScrollView>

        <Pressable
          onPress={onGoLive}
          disabled={!canGoLive}
          style={({ pressed }) => [
            styles.go,
            !canGoLive && styles.goDisabled,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Preparing your live' : 'Go live'}
          accessibilityState={{ disabled: !canGoLive, busy }}
        >
          {busy ? (
            <>
              <ActivityIndicator color="#fff" />
              <Text style={styles.goText}>Preparing your LIVE…</Text>
            </>
          ) : (
            <>
              <Ionicons name="radio" size={22} color="#fff" />
              <Text style={styles.goText}>GO LIVE</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export const PreLiveScreen = memo(PreLiveScreenBase);

const styles = StyleSheet.create({
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ready: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: S.scrimStrong,
  },
  readyDot: { width: 8, height: 8, borderRadius: 4 },
  readyText: { fontFamily: fonts.bold, fontSize: 15, color: S.text },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: 10, alignItems: 'stretch' },
  titleLabel: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.9, color: S.textFaint },
  title: { fontFamily: fonts.bold, fontSize: 26, color: S.text, marginTop: -6 },
  chips: { gap: 8, paddingVertical: 2, paddingRight: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: S.glass,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: S.line,
  },
  chipOff: { backgroundColor: 'rgba(127,29,29,0.72)' },
  chipText: { fontFamily: fonts.bold, fontSize: 15, color: S.text },
  chipTextOff: { color: '#FECACA' },
  pressed: { opacity: 0.8 },
  go: {
    height: 58,
    marginTop: 4,
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: S.go,
    minWidth: TOUCH,
  },
  goDisabled: { opacity: 0.5 },
  goText: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: 0.6, color: '#fff' },
});
