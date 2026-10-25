import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts, onFill, onMedia } from '@/theme';
import { LiveDot } from '@/components/ui/live';
import { V } from '../viewerTheme';
import { formatCount } from '../utils';

/** Compact status pill. Text + dot (never colour alone). */
export const LiveBadge = memo(function LiveBadge({
  live,
  label,
}: {
  live: boolean;
  /** Overrides default LIVE / OFFLINE wording (e.g. "CONNECTING"). */
  label?: string;
}) {
  return (
    <View
      style={[styles.pill, live ? styles.live : styles.off]}
      accessible
      accessibilityLabel={live ? 'Live' : label ?? 'Not live'}
    >
      {live ? <LiveDot size={6} /> : <View style={[styles.dot, styles.dotOff]} />}
      <Text style={styles.text}>{label ?? (live ? 'LIVE' : 'OFFLINE')}</Text>
    </View>
  );
});

export const ViewerCount = memo(function ViewerCount({ count }: { count: number }) {
  return (
    <View style={styles.count} accessible accessibilityLabel={`${count} watching`}>
      <Ionicons name="eye-outline" size={13} color={V.text} />
      <Text style={styles.countText}>{formatCount(count)} watching</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
  },
  live: { backgroundColor: V.live },
  off: { backgroundColor: 'rgba(255,255,255,0.18)' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: onMedia.text },
  dotOff: { opacity: 0.6 },
  text: { fontFamily: fonts.bold, fontSize: 12, color: onFill, letterSpacing: 0.6 },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 12,
    backgroundColor: V.chip,
  },
  countText: { fontFamily: fonts.bold, fontSize: 12, color: V.text },
});
