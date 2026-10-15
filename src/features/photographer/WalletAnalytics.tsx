/**
 * Wallet "Analytics" tab for photographers.
 *
 * What is, and is not, shown, because money labels must be true:
 *   - Available, pending and withdrawn come from the wallet, in the wallet's
 *     currency. They are balances, not period figures, and are labelled so.
 *   - "Where your balance comes from" is the composition of the current
 *     available balance by source (selectWalletStats), not "released this month".
 *   - The period section (Today / Week / Month) shows shoot and client counts
 *     with their change against the previous period, and a payment-activity
 *     chart. The backend sums client payments in each payment's own currency,
 *     so that sum is shown only as relative bars with no currency label.
 *   - Booking milestones have no photographer endpoint, so they are not shown.
 */
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { useAsync } from '@/hooks/useAsync';
import {
  getPhotographerPerformance,
  getPhotographerTrends,
  type AnalyticsPeriod,
  type PerformancePoint,
  type Trend,
} from '@/features/analytics/api';
import type { WalletDTO } from '@/features/wallet/api';
import { selectWalletStats } from '@/features/wallet/moneyView';
import { ActionButton, Card, ErrorNotice, MetricCard, SectionHeader, SegmentedTabs, SkeletonCard } from './kit';
import { moneyText, percentOf } from './money';

type PeriodKey = Exclude<AnalyticsPeriod, 'custom'>;
const PERIODS: readonly { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];
const PERIOD_VS: Record<PeriodKey, string> = { today: 'yesterday', week: 'last week', month: 'last month' };

/** "Up 12.0% vs last week". Direction is spelled out, not left to an arrow colour. */
export function trendCaption(t: Trend | undefined, period: PeriodKey): string | undefined {
  if (!t) return undefined;
  const n = Number.parseFloat(t.percentage);
  if (!Number.isFinite(n) || n === 0) return `No change vs ${PERIOD_VS[period]}`;
  return `${t.direction === 'down' ? 'Down' : 'Up'} ${t.percentage} vs ${PERIOD_VS[period]}`;
}

export function WalletAnalytics({ wallet }: { wallet: WalletDTO | null }) {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const router = useRouter();
  const styles = useStyles();
  const stats = useMemo(() => (wallet ? selectWalletStats(wallet, 'photographer') : null), [wallet]);
  const currency = wallet?.currency;

  const sources = useMemo(() => {
    if (!stats) return [];
    const cards = stats.cards.filter((c) => !c.hidden && c.label !== 'Total withdrawn' && c.label !== 'In escrow' && c.value > 0);
    const total = cards.reduce((sum, c) => sum + c.value, 0);
    return cards.map((c) => ({ label: c.label, value: c.value, pct: percentOf(c.value, total) }));
  }, [stats]);

  return (
    <View>
      <Card>
        <Text style={styles.cardLabel}>Available to withdraw</Text>
        <Text style={styles.big}>{moneyText(stats?.hero.value, currency)}</Text>
        <Text style={styles.muted}>Current balance, not a period figure.</Text>
      </Card>
      <View style={styles.row}>
        <MetricCard
          label="Pending release"
          icon="time-outline"
          tone="warning"
          value={moneyText(stats ? (stats.pendingChip?.value ?? 0) : undefined, currency)}
          caption="Not in available balance"
        />
        <MetricCard
          label="Withdrawn to date"
          icon="arrow-up-circle-outline"
          value={moneyText(wallet?.totalWithdrawn, currency)}
          caption="Lifetime"
        />
      </View>

      <SectionHeader title="Where your balance comes from" subtitle="Share of your current available balance" />
      {sources.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Nothing in your available balance yet.</Text>
        </Card>
      ) : (
        <Card style={styles.sourceCard}>
          {sources.map((s) => (
            <View
              key={s.label}
              style={styles.sourceRow}
              accessible
              accessibilityLabel={`${s.label}, ${moneyText(s.value, currency)}${s.pct != null ? `, ${s.pct} percent` : ''}`}
            >
              <View style={styles.sourceTop}>
                <Text style={styles.sourceLabel} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={styles.sourceValue}>{moneyText(s.value, currency)}</Text>
                <Text style={styles.sourcePct}>{s.pct != null ? `${s.pct}%` : ''}</Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(2, s.pct ?? 0)}%` }]} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <SectionHeader title="Activity" subtitle="Pick a period" />
      <SegmentedTabs tabs={PERIODS} value={period} onChange={setPeriod} label="Reporting period" />
      {/* Keyed by period: a new period remounts, so a slow answer for the old one can never fill the new one. */}
      <PeriodActivity key={period} period={period} />

      <View style={styles.exportWrap}>
        <ActionButton label="Open earnings report" icon="bar-chart-outline" onPress={() => router.push('/payroll' as never)} />
        <ActionButton
          label="Custom date range"
          icon="calendar-outline"
          variant="tertiary"
          onPress={() => router.push('/analytics' as never)}
        />
      </View>
    </View>
  );
}

function PeriodActivity({ period }: { period: PeriodKey }) {
  const styles = useStyles();
  const trends = useAsync(useCallback(() => getPhotographerTrends(period), [period]));
  const perf = useAsync(useCallback(() => getPhotographerPerformance(period), [period]));

  if (trends.error && !trends.data) return <ErrorNotice message={trends.error} onRetry={trends.refresh} />;
  if (trends.loading && !trends.data) return <SkeletonCard height={110} />;

  const t = trends.data ?? {};
  return (
    <View>
      <View style={styles.row}>
        <MetricCard
          label="Shoots"
          icon="camera-outline"
          value={t.events?.value != null ? String(t.events.value) : 'N/A'}
          caption={trendCaption(t.events, period)}
        />
        <MetricCard
          label="Clients"
          icon="people-outline"
          value={t.clients?.value != null ? String(t.clients.value) : 'N/A'}
          caption={trendCaption(t.clients, period)}
        />
      </View>
      <SectionHeader title="Payment activity" subtitle="Relative size of payments received in each interval" />
      {perf.error && !perf.data ? (
        <ErrorNotice message={perf.error} onRetry={perf.refresh} />
      ) : perf.loading && !perf.data ? (
        <SkeletonCard height={150} />
      ) : (
        <BarChart points={perf.data ?? []} />
      )}
    </View>
  );
}

export function BarChart({ points }: { points: readonly PerformancePoint[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const max = Math.max(0, ...points.map((p) => p.value1));
  if (points.length === 0 || max === 0) {
    return (
      <Card>
        <View style={styles.emptyChart}>
          <Ionicons name="bar-chart-outline" size={24} color={colors.textMuted} />
          <Text style={styles.muted}>No payments received in this period.</Text>
        </View>
      </Card>
    );
  }
  const top = points.reduce((best, p) => (p.value1 > best.value1 ? p : best), points[0]);
  return (
    <Card>
      <View
        style={styles.chart}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Payment activity over ${points.length} intervals. Highest: ${top.day}.`}
      >
        {points.map((p, i) => (
          <View key={`${p.day}-${i}`} style={styles.barCol}>
            <View style={styles.barSlot}>
              <View style={[styles.bar, { height: `${Math.max(3, (p.value1 / max) * 100)}%` }]} />
            </View>
            <Text style={styles.barLabel} numberOfLines={1}>
              {p.day}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  cardLabel: { color: c.textSoft, fontSize: 14, fontWeight: '600' },
  big: { color: c.text, fontSize: 30, fontWeight: '800', marginTop: 2 },
  muted: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  sourceCard: { gap: spacing.md },
  sourceRow: { gap: 6 },
  sourceTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sourceLabel: { flex: 1, color: c.text, fontSize: 14, fontWeight: '600' },
  sourceValue: { color: c.text, fontSize: 14, fontWeight: '700' },
  sourcePct: { color: c.textMuted, fontSize: 13, minWidth: 40, textAlign: 'right' },
  track: { height: 6, borderRadius: 3, backgroundColor: c.surfaceMuted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: c.primary },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 150 },
  barCol: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  barSlot: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  // A bar the full width of a third of the screen read as a slab; slimmer bars keep the relative sizes legible.
  bar: { width: '58%', alignSelf: 'center', borderRadius: radii.sm, backgroundColor: c.primary },
  barLabel: { color: c.textMuted, fontSize: 11 },
  emptyChart: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  exportWrap: { gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
}));
