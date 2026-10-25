import { memo } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts, darkPalette } from '@/theme';
import { RoundButton } from './RoundButton';
import { S } from './theme';
import { CONNECTION_COPY, formatCount, formatDuration, type ConnectionState } from './viewModel';

export function ViewerCount({ count }: { count: number }) {
  return (
    <View
      style={styles.viewers}
      accessible
      accessibilityLabel={`${count.toLocaleString()} viewers`}
    >
      <Ionicons name="eye" size={14} color={S.text} />
      <Text style={styles.viewersText}>{formatCount(count)}</Text>
    </View>
  );
}

export function ConnectionIndicator({ state }: { state: ConnectionState }) {
  const c = CONNECTION_COPY[state];
  return (
    <View style={styles.chip} accessible accessibilityLabel={c.label}>
      <Ionicons name={c.icon} size={13} color={c.color} />
      <Text style={styles.chipText}>{c.label}</Text>
    </View>
  );
}

function DeviceChip({ kind, off }: { kind: 'mic' | 'cam'; off: boolean }) {
  const icon = kind === 'mic' ? (off ? 'mic-off' : 'mic') : off ? 'videocam-off' : 'videocam';
  const name = kind === 'mic' ? 'Microphone' : 'Camera';
  return (
    <View
      style={[styles.chip, off && styles.chipOff]}
      accessible
      accessibilityLabel={`${name} ${off ? 'off' : 'on'}`}
    >
      <Ionicons name={icon} size={13} color={off ? darkPalette.error : S.text} />
      <Text style={[styles.chipText, off && styles.chipTextOff]}>{off ? 'OFF' : 'ON'}</Text>
    </View>
  );
}

type Props = {
  seconds: number;
  viewerCount: number;
  connection: ConnectionState;
  /** Device state is only meaningful for the phone-camera source. */
  showDevices: boolean;
  micOff: boolean;
  camOff: boolean;
  /** Fades back / more buttons with the rest of the controls. */
  controlsOpacity: Animated.Value;
  controlsInteractive: boolean;
  onBack: () => void;
  onMore: () => void;
};

/**
 * Compact top overlay: [back]   ● LIVE 05:12 | 👁 1,284   [⋯]
 * with a thin chip row for connection / mic / camera. The status pill and
 * chips never auto-hide; only the buttons do.
 */
function LiveStatusBarBase({
  seconds,
  viewerCount,
  connection,
  showDevices,
  micOff,
  camOff,
  controlsOpacity,
  controlsInteractive,
  onBack,
  onMore,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + 6,
          paddingLeft: insets.left + 12,
          paddingRight: insets.right + 12,
        },
      ]}
    >
      <View style={styles.row} pointerEvents="box-none">
        <Animated.View
          style={{ opacity: controlsOpacity }}
          pointerEvents={controlsInteractive ? 'auto' : 'none'}
        >
          <RoundButton icon="chevron-back" label="Leave live studio" onPress={onBack} size={44} />
        </Animated.View>

        <View
          style={styles.pill}
          accessible
          accessibilityLabel={`Live, ${formatDuration(seconds)} on air, ${viewerCount.toLocaleString()} viewers`}
        >
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
          <Text style={styles.timer}>{formatDuration(seconds)}</Text>
          <View style={styles.sep} />
          <ViewerCount count={viewerCount} />
        </View>

        <Animated.View
          style={{ opacity: controlsOpacity }}
          pointerEvents={controlsInteractive ? 'auto' : 'none'}
        >
          <RoundButton icon="ellipsis-horizontal" label="Stream settings" onPress={onMore} size={44} />
        </Animated.View>
      </View>

      <View style={styles.chips} pointerEvents="none">
        <ConnectionIndicator state={connection} />
        {showDevices ? (
          <>
            <DeviceChip kind="mic" off={micOff} />
            <DeviceChip kind="cam" off={camOff} />
          </>
        ) : null}
      </View>
    </View>
  );
}

export const LiveStatusBar = memo(LiveStatusBarBase);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 38,
    borderRadius: 19,
    backgroundColor: S.scrimStrong,
  },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: S.live },
  liveText: { fontFamily: fonts.bold, fontSize: 16, color: S.text, letterSpacing: 0.8 },
  timer: { fontFamily: fonts.regular, fontSize: 15, color: S.textDim },
  sep: { width: 1, height: 16, backgroundColor: S.line },
  viewers: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewersText: { fontFamily: fonts.bold, fontSize: 16, color: S.text },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
    backgroundColor: S.scrim,
  },
  chipOff: { backgroundColor: 'rgba(127,29,29,0.72)' },
  chipText: { fontFamily: fonts.bold, fontSize: 13, color: S.text },
  chipTextOff: { color: darkPalette.error },
});
