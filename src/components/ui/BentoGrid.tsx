/**
 * BentoGrid: two columns, 12pt gaps; a hero tile spans both (design/brief.png, recipe 2).
 * Rules: one job per tile, one accent per tile, number above label, tap the whole tile.
 *
 * Tiles stagger in 40ms apart on first mount, and simply appear under reduced motion.
 */
import { Children, isValidElement, useEffect, useRef, type ReactElement, type ReactNode } from 'react';
import { Animated, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fonts, fontSize, makeStyles, motion, radii, spacing, tracking, useReducedMotion } from '@/theme';
import { GlassCard } from './GlassCard';

type TileProps = {
  children?: ReactNode;
  /** 2 makes this the hero tile, spanning both columns. */
  span?: 1 | 2;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function BentoTile({ children, onPress, accessibilityLabel, style }: TileProps) {
  const styles = useStyles();
  const card = (
    <GlassCard style={[styles.tile, style]} elevated containerStyle={styles.fill}>
      {children}
    </GlassCard>
  );
  if (!onPress) return card;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.fill, pressed && styles.pressed]}
    >
      {card}
    </Pressable>
  );
}

/** A tile's number (Space Grotesk, above its label). */
export function BentoValue({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.value}>{children}</Text>;
}

export function BentoTitle({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function BentoCaption({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <Text style={styles.caption} numberOfLines={2}>
      {children}
    </Text>
  );
}

export function BentoGrid({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  // Group tiles into rows: a span-2 tile stands alone, the rest pair up in order.
  const rows: ReactElement<TileProps>[][] = [];
  let open: ReactElement<TileProps>[] | null = null;
  Children.forEach(children, (child) => {
    if (!isValidElement<TileProps>(child)) return;
    if (child.props.span === 2) {
      rows.push([child]);
      open = null;
    } else if (open && open.length === 1) {
      open.push(child);
      open = null;
    } else {
      open = [child];
      rows.push(open);
    }
  });
  return (
    <View style={[styles.grid, style]}>
      {rows.map((row, i) => (
        <StaggerRow key={i} index={i} reduced={reduced}>
          {row.map((tile, j) => (
            <View key={j} style={styles.cell}>
              {tile}
            </View>
          ))}
          {/* A lone half tile keeps its half width. */}
          {row.length === 1 && row[0].props.span !== 2 ? <View style={styles.cell} /> : null}
        </StaggerRow>
      ))}
    </View>
  );
}

function StaggerRow({ children, index, reduced }: { children: ReactNode; index: number; reduced: boolean }) {
  const styles = useStyles();
  const t = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      t.setValue(1);
      return;
    }
    Animated.timing(t, {
      toValue: 1,
      duration: motion.base,
      delay: index * motion.stagger,
      easing: motion.easing,
      useNativeDriver: true,
    }).start();
  }, [t, index, reduced]);
  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return <Animated.View style={[styles.row, { opacity: t, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

const useStyles = makeStyles((c) => ({
  grid: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  cell: { flex: 1 },
  fill: { flex: 1 },
  tile: { flex: 1, borderRadius: radii.lg, padding: spacing.lg, gap: spacing.xs, minHeight: 112 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  value: { fontFamily: fonts.display, fontSize: 40, lineHeight: 44, letterSpacing: tracking(40, -0.035), color: c.text },
  title: { fontFamily: fonts.display, fontSize: fontSize.lg, letterSpacing: tracking(fontSize.lg, -0.02), color: c.text, marginTop: spacing.sm },
  caption: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted },
}));
