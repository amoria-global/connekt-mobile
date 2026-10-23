/**
 * Chart blocks for the client screens, built from the photographer workspace's own parts
 * (`SegmentRing`, `Card`) so a client and a photographer see the same visual language.
 * Presentational only: the caller passes real, already validated counts. A part with nothing
 * to draw says so in words rather than drawing an empty ring that reads as progress.
 */
import { Text, View } from 'react-native';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
import { Card } from '@/features/photographer/kit';
import { SegmentRing } from '@/features/photographer/charts';
import { percentOf } from '@/features/photographer/money';

export type BreakdownSegment = { key: string; label: string; value: number; color: string };

/**
 * A whole split into parts: a ring with the total in its centre, and one row per part with its
 * count and share. Same composition as the photographer wallet's "Where your balance comes from".
 * Parts are always named in words, never by colour alone.
 */
export function StatusBreakdownCard({
  segments,
  centerLabel,
  emptyText,
  summary,
}: {
  segments: readonly BreakdownSegment[];
  /** Caption under the total in the ring ("events", "payments"). */
  centerLabel: string;
  emptyText: string;
  /** Spoken description of the whole chart, e.g. "Events by stage". */
  summary: string;
}) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const live = segments.filter((s) => Number.isFinite(s.value) && s.value > 0);
  const total = live.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return (
      <Card>
        <Text style={styles.muted}>{tr(emptyText)}</Text>
      </Card>
    );
  }
  return (
    <Card>
      <View style={styles.wrap}>
        <SegmentRing
          size={108}
          stroke={14}
          label={`${summary}: ${live.map((s) => `${s.label} ${s.value}, ${percentOf(s.value, total) ?? 0} percent`).join('; ')}`}
          segments={live.map((s) => ({ value: s.value, color: s.color }))}
        >
          <View style={styles.centre}>
            <Text style={styles.centreValue} maxFontSizeMultiplier={1.6}>
              {total}
            </Text>
            <Text style={styles.centreCaption} numberOfLines={1} maxFontSizeMultiplier={1.6}>
              {tr(centerLabel)}
            </Text>
          </View>
        </SegmentRing>
        <View style={styles.list}>
          {live.map((s) => {
            const pct = percentOf(s.value, total);
            return (
              <View key={s.key} style={styles.row} accessible accessibilityLabel={`${s.label}, ${s.value}${pct != null ? `, ${pct} percent` : ''}`}>
                <View style={[styles.swatch, { backgroundColor: s.color }]} />
                <Text style={styles.label} numberOfLines={2}>
                  {tr(s.label)}
                </Text>
                <Text style={styles.value} numberOfLines={1}>
                  {s.value}
                </Text>
                <Text style={styles.pct}>{pct != null ? `${pct}%` : ''}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

/**
 * A histogram of whole counts per interval (events per day, say). Unlike a money chart these are real
 * numbers in one unit, so each bar is labelled with its count. The tallest bar takes the accent.
 */
export function CountBars({
  values,
  labels,
  label,
  height = 124,
}: {
  values: readonly number[];
  labels: readonly string[];
  /** Spoken description of the whole chart. */
  label: string;
  height?: number;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const max = Math.max(0, ...values);
  const top = max > 0 ? values.indexOf(max) : -1;
  const plot = height - 20;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <View style={[styles.bars, { height }]}>
        {values.map((v, i) => {
          const h = v > 0 && max > 0 ? Math.max(4, Math.round((v / max) * plot)) : 0;
          return (
            <View key={`${labels[i] ?? i}-${i}`} style={styles.col}>
              <Text style={styles.count} maxFontSizeMultiplier={1.6}>
                {v > 0 ? String(v) : ''}
              </Text>
              <View style={[styles.bar, { height: h, backgroundColor: i === top ? colors.accent : colors.primary }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.baseline} />
      <View style={styles.axis}>
        {labels.map((l, i) => (
          <Text key={`${l}-${i}`} style={[styles.axisLabel, i === top && styles.axisLabelTop]} numberOfLines={1} maxFontSizeMultiplier={1.6}>
            {l}
          </Text>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  centre: { alignItems: 'center', maxWidth: 80 },
  centreValue: { color: c.text, fontSize: 22, fontWeight: '800', lineHeight: 26 },
  centreCaption: { color: c.textMuted, fontSize: 11 },
  list: { flex: 1, minWidth: 180, gap: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  label: { flex: 1, color: c.text, fontSize: 13.5, fontWeight: '600' },
  value: { color: c.text, fontSize: 13.5, fontWeight: '700' },
  pct: { color: c.textMuted, fontSize: 12.5, minWidth: 34, textAlign: 'right' },

  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  col: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  count: { color: c.textSoft, fontSize: 11, fontWeight: '700', height: 16 },
  bar: { width: '46%', maxWidth: 34, alignSelf: 'center', borderTopLeftRadius: radii.sm, borderTopRightRadius: radii.sm },
  baseline: { height: 1, backgroundColor: c.border },
  axis: { flexDirection: 'row', gap: spacing.sm, marginTop: 6 },
  axisLabel: { flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 11 },
  axisLabelTop: { color: c.text, fontWeight: '700' },
}));
