/**
 * PerformanceWaveCard — Infographic Wave Curve Data Visualization for Coordinators.
 * Directly styled after the Pinterest Wave Energy Infographic reference:
 * (https://www.pinterest.com/pin/299067231493891387/)
 *
 * Visual highlights from reference:
 *   1. Midnight slate/navy card container (#070D18) with subtle high-contrast border (#1E293B).
 *   2. Header with uppercase metric label ("ENERGY - (km)" in ref -> "PRODUCTION WAVE METRICS").
 *   3. Organic rolling cyan/teal gradient wave swells underneath the curve.
 *   4. Crisp white bezier trend curve traversing 6 temporal data points.
 *   5. Dual anchor needles at endpoints with baseline value callouts ("0").
 *   6. Prominent vertical cyan beacon needle rising to an active floating value label (e.g. "60").
 *   7. Interactive tap-to-inspect on any point across the wave or timeline.
 *   8. Date timeline axis (e.g. "11/10  12/10  13/10  14/10  15/10  16/10") with active date highlighted in cyan.
 *   9. Dashed baseline timeline with circular node ticks ("---•---•---•---•---•---•---").
 *  10. Metric switcher tabs (Revenue, Events, Clients, Talent, Pending) + Period selector (Today, Week, Month).
 */

import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { fonts, fontSize, fontWeight, radii, spacing, useTheme, onFill } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { HIDDEN_AMOUNT } from '@/features/photographer/money';
import { useSharedT } from '@/i18n/sharedStrings';
import type {
  AnalyticsPeriod,
  CoordinatorAnalytics,
  PerformancePoint,
  TrendsMap,
} from '@/features/analytics/api';

export type MetricKey =
  | 'totalRevenue'
  | 'totalEvents'
  | 'totalCustomers'
  | 'totalPhotographers'
  | 'totalPending';

export interface PerformanceWaveCardProps {
  /** Lifetime figures keyed like `metrics`; null while unknown. Coordinator and client Home both pass theirs. */
  analytics: Partial<Record<string, number>> | null;
  /** The metric switcher. Defaults to the coordinator's; the client Home passes its own. */
  metrics?: Record<string, WaveMetricMeta>;
  trends: TrendsMap;
  period: AnalyticsPeriod;
  onPeriodChange: (period: AnalyticsPeriod) => void;
  /** The currency money is labelled in. Without it money is N/A: it is never guessed. */
  currency?: string;
  selectedMetric?: string;
  onSelectMetric?: (key: string) => void;
  performanceData?: PerformancePoint[] | null;
  /** Mask money figures, like the rest of the Home. Counts are not money and stay visible. */
  hidden?: boolean;
  /** What to say when there is no series. Pass a failure sentence when the read failed, so a failure is not read as "no activity". */
  emptyText?: string;
}

interface DataPoint {
  x: number;
  y: number;
  label: string;
  value: number;
  displayValue: string;
}

export type WaveMetricMeta = {
    title: string;
    shortTitle: string;
    unit: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    accentGlow: string;
    isMoney: boolean;
  /** Which column of the performance feed draws this metric. Absent means the feed has no series for it. */
  series?: 'value1' | 'value2';
  /** Keys this metric may arrive under in the trends feed, most specific first. */
  trendKeys?: string[];
};

export const METRICS_META: Record<MetricKey, WaveMetricMeta> = {
  totalRevenue: {
    title: 'TOTAL REVENUE',
    shortTitle: 'Revenue',
    unit: 'USD',
    icon: 'cash-outline',
    color: '#00E5FF',
    accentGlow: '#00E5FF',
    isMoney: true,
    series: 'value1',
    trendKeys: ['totalRevenue', 'revenue'],
  },
  totalEvents: {
    title: 'EVENTS MANAGED',
    shortTitle: 'Events',
    unit: 'Productions',
    icon: 'calendar-outline',
    color: '#38BDF8',
    accentGlow: '#38BDF8',
    isMoney: false,
    series: 'value2',
    trendKeys: ['totalEvents', 'events'],
  },
  totalCustomers: {
    title: 'TOTAL CLIENTS',
    shortTitle: 'Clients',
    unit: 'Accounts',
    icon: 'people-outline',
    color: '#10B981',
    accentGlow: '#10B981',
    isMoney: false,
    trendKeys: ['totalCustomers', 'clients', 'customers'],
  },
  totalPhotographers: {
    title: 'PHOTOGRAPHERS',
    shortTitle: 'Photographers',
    unit: 'Creators',
    icon: 'camera-outline',
    color: '#A855F7',
    accentGlow: '#A855F7',
    isMoney: false,
    trendKeys: ['totalPhotographers', 'photographers'],
  },
  totalPending: {
    title: 'PENDING INVOICES',
    shortTitle: 'Pending',
    unit: 'USD',
    icon: 'time-outline',
    color: '#F59E0B',
    accentGlow: '#F59E0B',
    isMoney: true,
    trendKeys: ['totalPending', 'pending'],
  },
};

export const PERIOD_LABELS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

/**
 * Catmull-Rom to Cubic Bezier curve path generator.
 * Produces smooth, continuous curves passing through every control point.
 */
export function catmullRomToBezier(points: { x: number; y: number }[]): string {
  const n = points.length;
  if (n < 2) return '';
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 < n ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) / 6.0;
    const cp1y = p1.y + (p2.y - p0.y) / 6.0;
    const cp2x = p2.x - (p3.x - p1.x) / 6.0;
    const cp2y = p2.y - (p3.y - p1.y) / 6.0;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function PerformanceWaveCard({
  analytics,
  metrics = METRICS_META,
  trends,
  period,
  onPeriodChange,
  currency,
  selectedMetric: externalSelectedMetric,
  onSelectMetric,
  performanceData,
  hidden = false,
  emptyText = 'No trend data for this period',
}: PerformanceWaveCardProps) {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const [internalMetric, setInternalMetric] = useState<string>(Object.keys(metrics)[0] ?? 'totalRevenue');
  const [activeIndex, setActiveIndex] = useState<number>(3); // Matches 14/10 index in reference image

  const activeMetric = externalSelectedMetric ?? internalMetric;
  const meta = metrics[activeMetric] ?? metrics[Object.keys(metrics)[0]];

  const handleSelectMetric = (m: string) => {
    setInternalMetric(m);
    onSelectMetric?.(m);
  };

  // SVG Canvas dimensions
  const SVG_WIDTH = 340;
  const SVG_HEIGHT = 160;
  const CHART_TOP = 42;
  const CHART_BOTTOM = 135;
  const CHART_HEIGHT = CHART_BOTTOM - CHART_TOP;

  // One point per bucket the feed returned (today 6, week 7, month 4), evenly spread from x=24 to x=316. With no
  // feed there are six placeholder positions on a flat baseline. Buckets were once squeezed into six, which dropped
  // Friday from a week and invented a leading zero and a repeated last value for a month.
  const bucketCount = performanceData && performanceData.length >= 2 ? Math.min(performanceData.length, 8) : 6;
  const X_COORDS = useMemo(
    () => Array.from({ length: bucketCount }, (_, i) => 24 + (i * (316 - 24)) / (bucketCount - 1)),
    [bucketCount],
  );

  // Compute 6 temporal date labels based on period or real performance data
  const dateLabels = useMemo(() => {
    if (performanceData && performanceData.length >= 2) {
      return performanceData.slice(0, 8).map((p) => p.day);
    }

    const now = new Date();
    if (period === 'today') {
      return ['12AM', '4AM', '8AM', '12PM', '4PM', '8PM'];
    }
    if (period === 'month') {
      const m = now.getMonth() + 1;
      const mStr = m < 10 ? `0${m}` : `${m}`;
      return [`01/${mStr}`, `06/${mStr}`, `12/${mStr}`, `18/${mStr}`, `24/${mStr}`, `30/${mStr}`];
    }
    // Default: 6 days leading to current day
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const day = d.getDate();
      const month = d.getMonth() + 1;
      const dayStr = day < 10 ? `0${day}` : `${day}`;
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      labels.push(`${dayStr}/${monthStr}`);
    }
    return labels;
  }, [period, performanceData]);

  // Extract trend data for active metric (with fallback key aliases)
  const trendData = useMemo(() => {
    if (!trends) return undefined;
    for (const k of [activeMetric, ...(meta.trendKeys ?? [])]) if (trends[k]) return trends[k];
    return undefined;
  }, [trends, activeMetric, meta]);

  const trendDir = trendData?.direction ?? 'up';
  const trendPct = trendData?.percentage;

  // Extract raw metric value: use the period-specific trend value if returned from API,
  // falling back to analytics snapshot if not set.
  const totalValue = useMemo<number | null>(() => {
    if (trendData?.value != null) {
      return trendData.value;
    }
    // Not loaded or failed: unknown, never a zero.
    if (!analytics) return null;
    return analytics[activeMetric] ?? null;
  }, [trendData?.value, analytics, activeMetric]);

  // Generate the 6 data points with heights matching the organic wave shape or real performance data
  const points: DataPoint[] = useMemo(() => {
    const hasPerfData = performanceData && performanceData.length > 0 && !!meta.series;

    let perfValues: number[] | null = null;
    if (hasPerfData && performanceData) {
      const rawVals = performanceData.map((p) => (meta.series === 'value1' ? p.value1 : p.value2));
      if (rawVals.length >= 2 && rawVals.some((v) => v > 0)) perfValues = rawVals.slice(0, 8);
    }

    // No real series means a flat baseline with no values. This used to draw
    // an invented curve and label its points as money (a share of the total).
    const relativeRatios = X_COORDS.map(() => 0);

    const maxPerf = perfValues ? Math.max(...perfValues, 1) : 0;

    // Compute display values
    return X_COORDS.map((x, idx) => {
      let ratio = relativeRatios[idx];
      let pointVal = 0;

      if (perfValues && perfValues[idx] !== undefined) {
        pointVal = perfValues[idx];
        ratio = Math.min(1, Math.max(0.05, pointVal / maxPerf));
      }

      const y = perfValues ? CHART_BOTTOM - ratio * CHART_HEIGHT : CHART_BOTTOM;

      let displayValue = '';
      if (!perfValues) {
        displayValue = '';
      } else if (meta.isMoney) {
        displayValue = hidden ? HIDDEN_AMOUNT : currency ? formatPrice(pointVal, currency) : '';
      } else {
        displayValue = String(pointVal);
      }

      return {
        x,
        y,
        label: dateLabels[idx] ?? '',
        value: pointVal,
        displayValue,
      };
    });
  }, [
    X_COORDS,
    totalValue,
    trendDir,
    CHART_BOTTOM,
    CHART_HEIGHT,
    meta.isMoney,
    currency,
    dateLabels,
    performanceData,
    activeMetric,
    hidden,
    meta.series,
  ]);

  // Trend line curve path (white line in reference)
  const trendCurvePath = useMemo(() => {
    return catmullRomToBezier(points);
  }, [points]);

  // Organic background filled wave path (teal/cyan rolling swells in reference)
  const backgroundWavePath = useMemo(() => {
    // We construct 9-point organic rolling swells underneath the trend line
    // Peaks around x=60, x=155, x=220, x=290
    const waveControlPoints = [
      { x: 10, y: CHART_BOTTOM },
      { x: 50, y: CHART_TOP + CHART_HEIGHT * 0.45 },
      { x: 95, y: CHART_TOP + CHART_HEIGHT * 0.55 },
      { x: 150, y: CHART_TOP + CHART_HEIGHT * 0.2 },
      { x: 185, y: CHART_TOP + CHART_HEIGHT * 0.4 },
      { x: 215, y: CHART_TOP + CHART_HEIGHT * 0.12 },
      { x: 250, y: CHART_TOP + CHART_HEIGHT * 0.65 },
      { x: 290, y: CHART_TOP + CHART_HEIGHT * 0.35 },
      { x: 335, y: CHART_BOTTOM },
    ];

    const waveBezier = catmullRomToBezier(waveControlPoints);
    return `${waveBezier} L 335 ${CHART_BOTTOM + 10} L 10 ${CHART_BOTTOM + 10} Z`;
  }, [CHART_TOP, CHART_HEIGHT, CHART_BOTTOM]);

  const activeIdx = Math.min(activeIndex, points.length - 1);
  const activePoint = points[activeIdx];
  const startPoint = points[0];
  const endPoint = points[points.length - 1];

  // Formatted active metric headline
  const formattedHeadline =
    totalValue == null || (meta.isMoney && !currency)
      ? 'N/A'
      : meta.isMoney
        ? hidden
          ? HIDDEN_AMOUNT
          : formatPrice(totalValue, currency)
        : `${totalValue} ${meta.unit}`;
  // Only a real series gets a wave, anchor values and an apex label; otherwise the chart is a flat baseline and says so.
  const hasSeries = points.some((p) => p.displayValue !== '');

  return (
    <View style={styles.cardContainer} testID="performance-wave-card">
      {/* ── 1. Top Bar: Metric Title & Period Switcher ─────────────────── */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <View style={styles.eyebrowRow}>
            <View style={[styles.glowingDot, { backgroundColor: meta.color }]} />
            <Text style={styles.eyebrowText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} maxFontSizeMultiplier={1.6}>
              {meta.title}
            </Text>
          </View>
          <View style={styles.headlineRow}>
            <Text style={styles.headlineValue}>{formattedHeadline}</Text>
            {trendPct ? (
              <View
                style={[
                  styles.trendChip,
                  {
                    backgroundColor:
                      trendDir === 'up' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  },
                ]}
              >
                <Ionicons
                  name={trendDir === 'up' ? 'trending-up' : 'trending-down'}
                  size={12}
                  color={trendDir === 'up' ? '#10B981' : '#EF4444'}
                />
                <Text
                  style={[
                    styles.trendChipText,
                    { color: trendDir === 'up' ? '#10B981' : '#EF4444' },
                  ]}
                >
                  {trendPct}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Period Selector Tabs (Today, Week, Month) */}
        <View style={styles.periodTabsWrap}>
          {PERIOD_LABELS.map((p) => {
            const isSelected = period === p.value;
            return (
              <Pressable
                key={p.value}
                style={[styles.periodTab, isSelected && styles.periodTabSelected]}
                onPress={() => onPeriodChange(p.value)}
                accessibilityRole="button"
                accessibilityLabel={`Select period ${p.label}`}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    isSelected && styles.periodTabTextSelected,
                  ]}
                >
                  {tr(p.label)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── 2. Metric Category Pill Switcher ────────────────────────────── */}
      <View style={styles.metricChipsRow}>
        {Object.keys(metrics).map((mKey) => {
          const m = metrics[mKey];
          const isSelected = activeMetric === mKey;
          return (
            <Pressable
              key={mKey}
              style={[
                styles.metricChip,
                isSelected && {
                  backgroundColor: `${m.color}22`,
                  borderColor: m.color,
                },
              ]}
              onPress={() => handleSelectMetric(mKey)}
              accessibilityRole="button"
              accessibilityLabel={`View ${m.shortTitle} wave graph`}
            >
              <Ionicons
                name={m.icon}
                size={11}
                color={isSelected ? m.color : '#94A3B8'}
              />
              <Text
                style={[
                  styles.metricChipText,
                  isSelected && { color: m.color, fontWeight: fontWeight.bold },
                ]}
              >
                {tr(m.shortTitle)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── 3. SVG Infographic Wave Canvas ──────────────────────────────── */}
      <View style={styles.canvasContainer}>
        <Svg
          width="100%"
          height={SVG_HEIGHT}
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          style={styles.svg}
        >
          <Defs>
            {/* Background rolling wave gradient (Cyan/Teal to Transparent) */}
            <SvgLinearGradient id="waveGlowGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#00E5FF" stopOpacity="0.55" />
              <Stop offset="50%" stopColor="#0891B2" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#070D18" stopOpacity="0.0" />
            </SvgLinearGradient>

            {/* Active needle gradient */}
            <SvgLinearGradient id="needleGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#00E5FF" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#00E5FF" stopOpacity="0.3" />
            </SvgLinearGradient>
          </Defs>

          {/* Layer 1: Background Translucent Rolling Cyan Wave */}
          {hasSeries ? <Path d={backgroundWavePath} fill="url(#waveGlowGradient)" /> : null}

          {/* Layer 2: Foreground Crisp White Trend Line Curve */}
          <Path
            d={trendCurvePath}
            stroke={onFill}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />

          {/* Layer 3: Start Anchor Point (p0) Needle & Label */}
          {startPoint ? (
            <>
              {/* Vertical needle line */}
              <Line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={startPoint.x}
                y2={startPoint.y - 32}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="1.2"
              />
              {/* Start anchor value ("0") */}
              <SvgText
                x={startPoint.x}
                y={startPoint.y - 38}
                fill={onFill}
                fontSize="12.5"
                fontFamily={fonts.bold}
                fontWeight="700"
                textAnchor="middle"
              >
                {startPoint.displayValue}
              </SvgText>
              {/* Start circle dot */}
              <Circle cx={startPoint.x} cy={startPoint.y} r="5" fill={onFill} />
            </>
          ) : null}

          {/* Layer 4: End Anchor Point (p5) Needle & Label */}
          {endPoint ? (
            <>
              {/* Vertical needle line */}
              <Line
                x1={endPoint.x}
                y1={endPoint.y}
                x2={endPoint.x}
                y2={endPoint.y - 32}
                stroke="rgba(255, 255, 255, 0.45)"
                strokeWidth="1.2"
              />
              {/* End anchor value ("0") */}
              <SvgText
                x={endPoint.x}
                y={endPoint.y - 38}
                fill={onFill}
                fontSize="12.5"
                fontFamily={fonts.bold}
                fontWeight="700"
                textAnchor="middle"
              >
                {endPoint.displayValue}
              </SvgText>
              {/* End circle dot */}
              <Circle cx={endPoint.x} cy={endPoint.y} r="5" fill={onFill} />
            </>
          ) : null}

          {/* Layer 5: Active Beacon Point (Highlight needle & glowing cyan pin) */}
          {activePoint && hasSeries ? (
            <>
              {/* Vertical needle line extending up from active point to apex */}
              <Line
                x1={activePoint.x}
                y1={activePoint.y}
                x2={activePoint.x}
                y2={18}
                stroke="#00E5FF"
                strokeWidth="1.5"
              />

              {/* Apex floating value callout badge (e.g. "60" in reference) */}
              <SvgText
                x={activePoint.x}
                y={12}
                fill={onFill}
                fontSize="15.5"
                fontFamily={fonts.bold}
                fontWeight="800"
                textAnchor="middle"
              >
                {activePoint.displayValue}
              </SvgText>

              {/* Outer glow beacon aura */}
              <Circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="10"
                fill="#00E5FF"
                fillOpacity="0.28"
              />

              {/* Inner bright cyan circle */}
              <Circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="5.5"
                fill="#00E5FF"
                stroke={onFill}
                strokeWidth="1.5"
              />
            </>
          ) : null}

          {/* Layer 6: Intermediate Node Dots on the Curve */}
          {points.map((pt, idx) => {
            if (idx === 0 || idx === points.length - 1 || idx === activeIdx) {
              return null;
            }
            return (
              <Circle
                key={`node-${idx}`}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="rgba(255, 255, 255, 0.65)"
              />
            );
          })}

          {/* Layer 7: Interactive tap hit regions for each column */}
          {points.map((pt, idx) => {
            const colWidth = SVG_WIDTH / points.length;
            const colX = pt.x - colWidth / 2;
            return (
              <Rect
                key={`hit-${idx}`}
                x={colX}
                y={0}
                width={colWidth}
                height={SVG_HEIGHT}
                fill="transparent"
                onPress={() => setActiveIndex(idx)}
              />
            );
          })}
        </Svg>
        {hasSeries ? null : (
          <Text style={styles.noSeries} accessibilityLiveRegion="polite">
            {emptyText}
          </Text>
        )}
      </View>

      {/* ── 4. X-Axis Timeline Dates (11/10  12/10  13/10  14/10 ...) ───── */}
      <View style={styles.datesRow}>
        {points.map((pt, idx) => {
          const isActive = idx === activeIdx;
          return (
            <Pressable
              key={`date-${idx}`}
              style={styles.dateItem}
              onPress={() => setActiveIndex(idx)}
              accessibilityRole="button"
              accessibilityLabel={`Select date ${pt.label}`}
            >
              <Text
                style={[
                  styles.dateText,
                  isActive && styles.dateTextActive,
                ]}
              >
                {pt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ── 5. Dashed Baseline with Circular Timeline Nodes (---•---•---) ─ */}
      <View style={styles.timelineAxisContainer}>
        <Svg width="100%" height={16} viewBox={`0 0 ${SVG_WIDTH} 16`}>
          {/* Dashed line across entire timeline */}
          <Line
            x1="14"
            y1="8"
            x2={SVG_WIDTH - 14}
            y2="8"
            stroke="#1E293B"
            strokeWidth="1.2"
            strokeDasharray="4, 4"
          />

          {/* Circular node ticks under each date column */}
          {points.map((pt, idx) => {
            const isActive = idx === activeIdx;
            return (
              <Circle
                key={`tick-${idx}`}
                cx={pt.x}
                cy={8}
                r={isActive ? 4 : 2.5}
                fill={isActive ? '#00E5FF' : '#334155'}
                stroke={isActive ? '#080E1C' : 'none'}
                strokeWidth={isActive ? 1.5 : 0}
              />
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: '#070D18',
    borderRadius: radii.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flex: 1,
    gap: 2,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  glowingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  eyebrowText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  headlineValue: {
    fontFamily: fonts.bold,
    fontSize: 19,
    fontWeight: fontWeight.extrabold,
    color: onFill,
    letterSpacing: -0.4,
  },
  trendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  trendChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.bold,
  },
  periodTabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderRadius: radii.full,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  periodTab: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  periodTabSelected: {
    backgroundColor: '#083A85',
  },
  periodTabText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    color: '#64748B',
  },
  periodTabTextSelected: {
    color: onFill,
  },
  metricChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.xs,
  },
  metricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0D1527',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  metricChipText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.medium,
    color: '#94A3B8',
  },
  canvasContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    overflow: 'visible',
  },
  noSeries: {
    position: 'absolute',
    top: 60,
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  datesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: -2,
  },
  dateItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dateText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: '#64748B',
  },
  dateTextActive: {
    color: '#00E5FF',
    textShadowColor: 'rgba(0, 229, 255, 0.4)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  timelineAxisContainer: {
    width: '100%',
    height: 16,
    marginTop: 2,
  },
});
