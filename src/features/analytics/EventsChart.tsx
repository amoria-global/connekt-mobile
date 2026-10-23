import { Text, View } from 'react-native';

import { useSharedT } from '@/i18n/sharedStrings';
import { fontSize, fontWeight, makeStyles, radii, spacing } from '@/theme';
import type { PerformancePoint } from './api';
import { eventsChartSummary, eventsChartView, PAYMENTS_NOT_CHARTED_NOTE } from './eventsChartView';

const PLOT_HEIGHT = 140;

/**
 * Events per bucket for the photographer Performance card, on a whole number axis of its own. The payment series is
 * deliberately not drawn (see `eventsChartView.ts`): the note says why instead of showing a figure that may mix currencies.
 */
export function EventsChart({ points }: { points: PerformancePoint[] | null }) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const view = eventsChartView(points);

  return (
    <View>
      {view.state === 'unavailable' ? (
        <View style={styles.stateBox} accessibilityRole="text">
          <Text style={styles.stateTitle}>{tr('Events chart unavailable')}</Text>
          <Text style={styles.stateBody}>{tr('We could not load this period. Pull down to refresh.')}</Text>
        </View>
      ) : view.state === 'empty' ? (
        <View style={styles.stateBox} accessibilityRole="text">
          <Text style={styles.stateTitle}>{tr('No events in this period')}</Text>
          <Text style={styles.stateBody}>{tr('Events you cover will appear here.')}</Text>
        </View>
      ) : (
        <View accessible accessibilityRole="image" accessibilityLabel={eventsChartSummary(view)}>
          <View style={styles.plot}>
            <View style={styles.yAxis}>
              {view.ticks.map((t) => (
                <Text key={t} style={styles.tick}>
                  {t}
                </Text>
              ))}
            </View>
            <View style={styles.area}>
              <View style={styles.grid} pointerEvents="none">
                {view.ticks.map((t) => (
                  <View key={t} style={styles.gridLine} />
                ))}
              </View>
              <View style={styles.bars}>
                {view.bars.map((b, i) => (
                  <View key={`${b.label}-${i}`} style={styles.col}>
                    {b.count > 0 ? <Text style={styles.count}>{b.count}</Text> : null}
                    <View style={[styles.bar, { height: Math.max(4, (b.count / view.ticks[0]) * PLOT_HEIGHT) }, b.count === 0 && styles.barZero]} />
                  </View>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.xRow}>
            <View style={styles.yAxisSpacer} />
            <View style={styles.xLabels}>
              {view.bars.map((b, i) => (
                <Text key={`${b.label}-${i}`} style={styles.xLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {b.label}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}
      <Text style={styles.note}>{tr(PAYMENTS_NOT_CHARTED_NOTE)}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  stateBox: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    padding: spacing.lg,
  },
  stateTitle: { color: c.text, fontSize: fontSize.md, fontWeight: fontWeight.bold, textAlign: 'center' },
  stateBody: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  plot: { flexDirection: 'row', height: PLOT_HEIGHT + 18, paddingTop: 18 },
  yAxis: { width: 30, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6, height: PLOT_HEIGHT },
  tick: { color: c.textMuted, fontSize: 10, fontWeight: fontWeight.semibold },
  area: { flex: 1 },
  grid: { position: 'absolute', top: 0, left: 0, right: 0, height: PLOT_HEIGHT, justifyContent: 'space-between' },
  gridLine: { height: 1, backgroundColor: c.borderSoft },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: PLOT_HEIGHT, justifyContent: 'space-between', paddingHorizontal: 2 },
  col: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: 16, backgroundColor: c.primary, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barZero: { backgroundColor: c.borderSoft },
  count: { color: c.text, fontSize: 11, fontWeight: fontWeight.bold, marginBottom: 2 },
  xRow: { flexDirection: 'row', marginTop: spacing.xs },
  yAxisSpacer: { width: 30 },
  xLabels: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  xLabel: { flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 11 },
  note: { color: c.textMuted, fontSize: fontSize.xs, lineHeight: 17, marginTop: spacing.md },
}));
