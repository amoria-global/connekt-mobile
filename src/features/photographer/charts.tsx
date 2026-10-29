/**
 * Two small ring charts for the photographer workspace, drawn with react-native-svg
 * (already a dependency). Presentational only: the caller passes real, already
 * validated figures. A ring with nothing to show draws only its track, so an
 * unknown or zero value never looks like progress.
 */
import { useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
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
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
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

// ── Trend (area) chart ──────────────────────────────────────────────────────

export type TrendPoint = { x: number; y: number };

/**
 * Geometry for a smooth area chart. Points sit at the centre of equal columns so a
 * label row of equal flex cells lines up under them. `values` are relative sizes
 * (the caller decides what they mean); the largest value reaches `padTop` and zero
 * sits on the baseline. The curve uses horizontal control points, so it never dips
 * below the baseline or overshoots a peak.
 */
export function trendGeometry(values: readonly number[], width: number, height: number, padTop = 26, padBottom = 6) {
  const n = values.length;
  const max = Math.max(0, ...values);
  const base = height - padBottom;
  const span = base - padTop;
  const pts: TrendPoint[] = values.map((v, i) => ({
    x: ((i + 0.5) * width) / n,
    y: max > 0 ? base - (Math.max(0, v) / max) * span : base,
  }));
  if (n === 0) return { pts, line: '', area: '', base };
  let line = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < n; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const mx = (a.x + b.x) / 2;
    line += ` C ${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`;
  }
  const area = `${line} L ${pts[n - 1].x} ${base} L ${pts[0].x} ${base} Z`;
  return { pts, line, area, base };
}

/** Smooth area chart with a gradient fill, faint rules, a dot per interval and the peak called out. */
export function TrendChart({
  values,
  height = 150,
  peakIndex,
  peakLabel = 'Peak',
}: {
  values: readonly number[];
  height?: number;
  /** Index of the highest interval, drawn larger in the accent colour. */
  peakIndex: number;
  peakLabel?: string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const geo = trendGeometry(values, width, height);
  return (
    <View onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))} style={{ height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.5} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.6].map((f) => (
            <Line key={f} x1={0} x2={width} y1={26 + (geo.base - 26) * f} y2={26 + (geo.base - 26) * f} stroke={colors.borderSoft} strokeWidth={1} strokeDasharray="4 5" />
          ))}
          <Line x1={0} x2={width} y1={geo.base} y2={geo.base} stroke={colors.border} strokeWidth={1} />
          <Path d={geo.area} fill="url(#trendFill)" />
          <Path d={geo.line} stroke={colors.link} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          {geo.pts.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === peakIndex ? 6 : 4}
              fill={i === peakIndex ? colors.accent : colors.card}
              stroke={i === peakIndex ? colors.card : colors.link}
              strokeWidth={i === peakIndex ? 2.5 : 2}
            />
          ))}
        </Svg>
      ) : null}
      {width > 0 && geo.pts[peakIndex] ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: Math.max(0, geo.pts[peakIndex].y - 25),
            left: Math.min(Math.max(0, geo.pts[peakIndex].x - 24), Math.max(0, width - 48)),
            width: 48,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '800' }} maxFontSizeMultiplier={1.6}>
            {peakLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
