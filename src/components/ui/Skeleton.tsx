/**
 * SkeletonLoader: the loading state for every list. Blocks pulse softly; under reduced motion they
 * hold still. Shape the skeleton like the content it stands in for, so nothing jumps on arrival.
 */
import { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { makeStyles, motion, radii, spacing, useReducedMotion } from '@/theme';
import { GlassCard } from './GlassCard';

export function Skeleton({ width = '100%', height = 14, radius = radii.sm, style }: { width?: DimensionValue; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: motion.slow * 3, easing: motion.easing, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: motion.slow * 3, easing: motion.easing, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduced]);
  return <Animated.View style={[styles.block, { width, height, borderRadius: radius, opacity: reduced ? 0.7 : pulse }, style]} />;
}

/** A glass card of skeleton rows: icon, title and a caption line, `rows` times. */
export function SkeletonList({ rows = 3, accessibilityLabel = 'Loading' }: { rows?: number; accessibilityLabel?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.list} accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}>
      {Array.from({ length: rows }, (_, i) => (
        <GlassCard key={i} style={styles.card}>
          <Skeleton width={44} height={44} radius={radii.md} />
          <View style={styles.lines}>
            <Skeleton width="62%" height={16} />
            <Skeleton width="38%" height={12} />
          </View>
        </GlassCard>
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  block: { backgroundColor: c.surfaceMuted },
  list: { gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg },
  lines: { flex: 1, gap: spacing.sm },
}));
