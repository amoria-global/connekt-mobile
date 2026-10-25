import { onFill } from '@/theme';
import { memo, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { V } from '../viewerTheme';
import type { IconName } from '../types';
import { LiveBadge, ViewerCount } from './LiveBadge';

export const RoundButton = memo(function RoundButton({
  icon,
  label,
  onPress,
  active,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.round, active && styles.roundActive, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={22} color={onFill} />
    </Pressable>
  );
});

type Props = {
  opacity: Animated.Value;
  visible: boolean;
  insetTop: number;
  insetLeft: number;
  insetRight: number;
  live: boolean;
  statusLabel?: string;
  viewerCount: number | null;
  muted: boolean;
  playing: boolean;
  fullscreen: boolean;
  canControl: boolean;
  onBack: () => void;
  onMore: () => void;
  onShare: () => void;
  onToggleMute: () => void;
  onTogglePlay: () => void;
  onToggleFullscreen: () => void;
  children?: ReactNode;
};

/** Top bar (back / LIVE / viewers / actions) + bottom bar, fading on inactivity. */
export const LiveOverlay = memo(function LiveOverlay(p: Props) {
  const pe = p.visible ? 'box-none' : 'none';
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: p.opacity }]} pointerEvents={pe}>
      <LinearGradient
        colors={['rgba(0,0,0,0.65)', 'transparent']}
        style={[styles.topGrad, { height: 84 + p.insetTop }]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={styles.bottomGrad}
        pointerEvents="none"
      />

      <View
        style={[styles.top, { paddingTop: p.insetTop + 6, paddingLeft: p.insetLeft + 8, paddingRight: p.insetRight + 8 }]}
        pointerEvents={pe}
      >
        <RoundButton icon="chevron-back" label="Back" onPress={p.onBack} />
        <View style={styles.badges}>
          <LiveBadge live={p.live} label={p.statusLabel} />
          {p.viewerCount != null ? <ViewerCount count={p.viewerCount} /> : null}
        </View>
        <View style={styles.right}>
          {p.fullscreen ? <RoundButton icon="share-social-outline" label="Share stream" onPress={p.onShare} /> : null}
          <RoundButton icon="ellipsis-vertical" label="More options" onPress={p.onMore} />
        </View>
      </View>

      {p.canControl ? (
        <View
          style={[styles.bottom, { paddingLeft: p.insetLeft + 8, paddingRight: p.insetRight + 8 }]}
          pointerEvents={pe}
        >
          <RoundButton
            icon={p.playing ? 'pause' : 'play'}
            label={p.playing ? 'Pause' : 'Play'}
            onPress={p.onTogglePlay}
          />
          <RoundButton
            icon={p.muted ? 'volume-mute' : 'volume-high'}
            label={p.muted ? 'Unmute' : 'Mute'}
            onPress={p.onToggleMute}
          />
          <View style={{ flex: 1 }} />
          <RoundButton
            icon={p.fullscreen ? 'contract' : 'expand'}
            label={p.fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            onPress={p.onToggleFullscreen}
          />
        </View>
      ) : null}
      {p.children}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  topGrad: { position: 'absolute', top: 0, left: 0, right: 0 },
  bottomGrad: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 70 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badges: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  right: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bottom: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  round: {
    width: V.hit,
    height: V.hit,
    borderRadius: V.hit / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
