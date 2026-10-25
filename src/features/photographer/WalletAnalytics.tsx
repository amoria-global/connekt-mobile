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
import { makeStyles, spacing, useTheme } from '@/theme';
import { useSharedT } from '@/i18n/sharedStrings';
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
import { ActionButton, Card, ErrorNotice, IconTile, MetricCard, SectionHeader, SegmentedTabs, SkeletonCard } from './kit';
import { TrendChart } from './charts';
import { MoneyBreakdownCard } from '@/features/wallet/MoneyBreakdownCard';
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
  const { language, tr } = useSharedT();
  const stats = useMemo(() => (wallet ? selectWalletStats(wallet, 'photographer') : null), [wallet, language]);
  const currency = wallet?.currency;

  const sources = useMemo(() => {
    if (!stats) return [];
    const cards = stats.cards.filter((c) => !c.hidden && c.label !== tr('Withdrawn to date') && c.label !== 'Total withdrawn' && c.label !== tr('In escrow') && c.label !== 'In escrow' && c.value > 0);
    const total = cards.reduce((sum, c) => sum + c.value, 0);
    return cards.map((c) => ({ label: c.label, value: c.value, pct: percentOf(c.value, total) }));
  }, [stats, tr]);

  const { colors, isDark } = useTheme();
  // One hue per source, in a fixed order, so a source keeps its colour while the list changes length.
  const hues = [colors.primary, colors.accent, isDark ? colors.live : '#0E7490', colors.warning, colors.success];

  return (
    <View>
      <Card>
        <View style={styles.availTop}>
          <IconTile icon="wallet-outline" tone="primary" size={34} />
          <View style={styles.availText}>
            <Text style={styles.cardLabel}>{tr('Available to withdraw')}</Text>
            <Text style={styles.muted}>{tr('Current balance, not a period figure.')}</Text>
          </View>
        </View>
        <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {moneyText(stats?.hero.value, currency)}
        </Text>
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
      <MoneyBreakdownCard
        segments={sources}
        hues={hues}
        currency={currency}
        summary="Available balance by source"
        emptyText={tr('Nothing in your available balance yet.')}
      />

      <SectionHeader title="Activity" subtitle="Pick a period" />
      <SegmentedTabs tabs={PERIODS} value={period} onChange={setPeriod} label="Reporting period" />
      <View style={styles.tabsGap} />
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

  // ErrorNotice has no vertical margin of its own; under the period tabs it touched them.
  if (trends.error && !trends.data) {
    return (
      <View style={styles.noticeGap}>
        <ErrorNotice message={trends.error} onRetry={trends.refresh} />
      </View>
    );
  }
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
      <SectionHeader title="Payment trend" subtitle="Relative size of payments received in each interval" />
      {perf.error && !perf.data ? (
        <View style={styles.noticeGap}>
          <ErrorNotice message={perf.error} onRetry={perf.refresh} />
        </View>
      ) : perf.loading && !perf.data ? (
        <SkeletonCard height={150} />
      ) : (
        <PaymentTrendChart points={perf.data ?? []} />
      )}
    </View>
  );
}

export function PaymentTrendChart({ points }: { points: readonly PerformancePoint[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const max = Math.max(0, ...points.map((p) => p.value1));
  if (points.length === 0 || max === 0) {
    return (
      <Card>
        <View style={styles.emptyChart}>
          <Ionicons name="bar-chart-outline" size={24} color={colors.textMuted} />
          <Text style={styles.muted}>{tr('No payments received in this period.')}</Text>
        </View>
      </Card>
    );
  }
  const top = points.reduce((best, p) => (p.value1 > best.value1 ? p : best), points[0]);
  return (
    <Card>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Payment activity over ${points.length} intervals. Highest: ${top.day}.`}
      >
        <TrendChart values={points.map((p) => p.value1)} peakIndex={points.indexOf(top)} />
        <View style={styles.labels}>
          {points.map((p, i) => (
            <Text key={`${p.day}-${i}`} style={[styles.barLabel, p === top && styles.barLabelTop]} numberOfLines={1} maxFontSizeMultiplier={1.6}>
              {p.day}
            </Text>
          ))}
        </View>
      </View>
      <Text style={styles.chartNote}>
        {tr('The curve shows relative size, with the highest interval marked in pink. Payments arrive in different currencies, so no amount is labelled.')}
      </Text>
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  noticeGap: { marginTop: spacing.md },
  tabsGap: { height: spacing.md },

  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  availTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  availText: { flex: 1, minWidth: 0 },
  cardLabel: { color: c.textSoft, fontSize: 14, fontWeight: '700' },
  big: { color: c.text, fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
  sourceWrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  ringCentre: { alignItems: 'center', maxWidth: 80 },
  ringTotal: { color: c.text, fontSize: 14, fontWeight: '800' },
  ringCaption: { color: c.textMuted, fontSize: 11 },
  sourceList: { flex: 1, minWidth: 180, gap: spacing.sm + 2 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  sourceLabel: { flex: 1, color: c.text, fontSize: 13.5, fontWeight: '600' },
  sourceValue: { color: c.text, fontSize: 13.5, fontWeight: '700', maxWidth: '45%' },
  sourcePct: { color: c.textMuted, fontSize: 12.5, minWidth: 34, textAlign: 'right' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 120 },
  rules: { ...{ position: 'absolute' as const, top: 0, bottom: 0, left: 0, right: 0 }, justifyContent: 'space-between' },
  rule: { height: 1, backgroundColor: c.borderSoft },
  ruleBase: { backgroundColor: c.border },
  barCol: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  barSlot: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  // A bar the full width of a third of the screen read as a slab; slimmer bars keep the relative sizes legible.
  bar: { width: '46%', maxWidth: 34, alignSelf: 'center', borderTopLeftRadius: 6, borderTopRightRadius: 6, minHeight: 3 },
  labels: { flexDirection: 'row', marginTop: 6 },
  barLabel: { flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 11 },
  barLabelTop: { color: c.text, fontWeight: '700' },
  chartNote: { color: c.textMuted, fontSize: 11.5, lineHeight: 16, marginTop: spacing.md },
  emptyChart: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  exportWrap: { gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
}));
