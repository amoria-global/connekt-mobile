/**
 * Two small ring charts for the photographer workspace, drawn with react-native-svg
 * (already a dependency). Presentational only: the caller passes real, already
 * validated figures. A ring with nothing to show draws only its track, so an
 * unknown or zero value never looks like progress.
 */
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme';

export type RingSegment = { value: number; color: string };

/**
 * Segments laid end to end around a ring. Values are shares of their own sum, so
 * the ring is always a whole composition (it is not a progress dial).
 */
export function SegmentRing({
  segments,
  size = 112,
  stroke = 14,
  children,
  label,
}: {
  segments: readonly RingSegment[];
  size?: number;
  stroke?: number;
  /** Centre content (a total and its caption). */
  children?: ReactNode;
  /** Screen-reader description of the whole ring. */
  label: string;
}) {
  const { colors } = useTheme();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const live = segments.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = live.reduce((sum, s) => sum + s.value, 0);
  const gap = live.length > 1 ? 2 : 0;
  let offset = 0;
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceMuted} strokeWidth={stroke} fill="none" />
        {total > 0
          ? live.map((s, i) => {
              const len = (s.value / total) * c;
              const dash = Math.max(0, len - gap);
              const node = (
                <Circle
                  key={`${i}-${s.color}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${dash} ${c - dash}`}
                  strokeDashoffset={-offset}
                  rotation={-90}
                  origin={`${size / 2}, ${size / 2}`}
                />
              );
              offset += len;
              return node;
            })
          : null}
      </Svg>
      {children}
    </View>
  );
}

/**
 * A single value out of a maximum (the rating out of 5). `fraction` is null when
 * there is no value yet, which draws an empty track.
 */
export function ProgressRing({
  fraction,
  color,
  size = 96,
  stroke = 9,
  children,
  label,
}: {
  fraction: number | null;
  color: string;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label: string;
}) {
  const f = fraction != null && Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  return (
    <SegmentRing
      size={size}
      stroke={stroke}
      label={label}
      segments={f > 0 ? [{ value: f, color }, { value: 1 - f, color: 'transparent' }] : []}
    >
      {children}
    </SegmentRing>
  );
}
