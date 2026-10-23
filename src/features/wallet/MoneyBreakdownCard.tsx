/**
 * The ring and legend that split a wallet's figures by source, shared by the photographer, client and coordinator
 * Analytics tabs so all three read the same. Every value is formatted in the wallet's currency; the ring's centre
 * shows the combined total, shrunk to fit so a long amount never runs into the ring.
 */
import { Text, View } from 'react-native';
import { makeStyles, spacing } from '@/theme';
import { Card } from '@/features/photographer/kit';
import { SegmentRing } from '@/features/photographer/charts';
import { moneyText, percentOf } from '@/features/photographer/money';

export type MoneySegment = { label: string; value: number };

export function MoneyBreakdownCard({
  segments,
  hues,
  currency,
  centerLabel = 'Combined',
  summary,
  emptyText,
}: {
  segments: readonly MoneySegment[];
  /** One colour per source, in order, so a source keeps its colour while the list changes length. */
  hues: readonly string[];
  currency: string | null | undefined;
  centerLabel?: string;
  /** Spoken description of the whole chart. */
  summary: string;
  emptyText: string;
}) {
  const styles = useStyles();
  const live = segments.filter((s) => Number.isFinite(s.value) && s.value > 0);
  if (live.length === 0) {
    return (
      <Card>
        <Text style={styles.muted}>{emptyText}</Text>
      </Card>
    );
  }
  const total = live.reduce((sum, s) => sum + s.value, 0);
  const rows = live.map((s) => ({ ...s, pct: percentOf(s.value, total) }));
  return (
    <Card>
      <View style={styles.wrap}>
        <SegmentRing
          size={108}
          stroke={14}
          label={`${summary}: ${rows.map((x) => `${x.label} ${x.pct ?? 0} percent`).join(', ')}`}
          segments={rows.map((x, i) => ({ value: x.value, color: hues[i % hues.length] }))}
        >
          <View style={styles.centre}>
            <Text style={styles.centreTotal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} maxFontSizeMultiplier={1.6}>
              {moneyText(total, currency)}
            </Text>
            <Text style={styles.centreCaption} numberOfLines={1} maxFontSizeMultiplier={1.6}>
              {centerLabel}
            </Text>
          </View>
        </SegmentRing>
        <View style={styles.list}>
          {rows.map((x, i) => (
            <View
              key={x.label}
              style={styles.row}
              accessible
              accessibilityLabel={`${x.label}, ${moneyText(x.value, currency)}${x.pct != null ? `, ${x.pct} percent` : ''}`}
            >
              <View style={[styles.swatch, { backgroundColor: hues[i % hues.length] }]} />
              <Text style={styles.label} numberOfLines={2}>
                {x.label}
              </Text>
              <Text style={styles.value} numberOfLines={1}>
                {moneyText(x.value, currency)}
              </Text>
              <Text style={styles.pct}>{x.pct != null ? `${x.pct}%` : ''}</Text>
            </View>
          ))}
        </View>
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  // The hole of a 108 ring with a 14 stroke is about 80 wide; keep the text inside it.
  centre: { alignItems: 'center', width: 70 },
  centreTotal: { color: c.text, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  centreCaption: { color: c.textMuted, fontSize: 11 },
  list: { flex: 1, minWidth: 180, gap: spacing.sm + 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  label: { flex: 1, color: c.text, fontSize: 13.5, fontWeight: '600' },
  value: { color: c.text, fontSize: 13.5, fontWeight: '700', maxWidth: '45%' },
  pct: { color: c.textMuted, fontSize: 12.5, minWidth: 34, textAlign: 'right' },
}));
