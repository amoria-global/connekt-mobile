/**
 * Wallet "Analytics" tab for clients, laid out like the photographer's.
 *
 * What is, and is not, shown, because money labels must be true:
 *   - Total spent and Processing come from the wallet, in the wallet's own currency. They are
 *     lifetime / current figures, and are labelled so.
 *   - "Where your wallet stands" splits the figures the wallet reports (total spent, balance, refunds, tips, gifts,
 *     donations, processing). The wallet gives lifetime spend as one number, so it is not split by kind.
 *   - The period section (Today / Week / Month) shows event and photographer counts with their
 *     change against the previous period, a spending trend and an events-per-interval histogram.
 *     The backend sums payments across currencies, so the spending curve is relative only and
 *     carries no currency label. Event counts are real counts and are labelled.
 */
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { makeStyles, spacing, useTheme } from '@/theme';
import { useAsync } from '@/hooks/useAsync';
import {
  getCustomerPerformance,
  getCustomerTrends,
  type AnalyticsPeriod,
  type PerformancePoint,
} from '@/features/analytics/api';
import type { WalletDTO } from '@/features/wallet/api';
import { selectWalletStats } from '@/features/wallet/moneyView';
import { ActionButton, Card, ErrorNotice, IconTile, MetricCard, SectionHeader, SegmentedTabs, SkeletonCard } from '@/features/photographer/kit';
import { TrendChart } from '@/features/photographer/charts';
import { moneyText } from '@/features/photographer/money';
import { trendCaption } from '@/features/photographer/WalletAnalytics';
import { CountBars } from './ClientCharts';
import { MoneyBreakdownCard } from '@/features/wallet/MoneyBreakdownCard';

type PeriodKey = Exclude<AnalyticsPeriod, 'custom'>;
const PERIODS: readonly { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export function ClientWalletAnalytics({ wallet }: { wallet: WalletDTO | null }) {
  const [period, setPeriod] = useState<PeriodKey>('month');
  const router = useRouter();
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const stats = useMemo(() => (wallet ? selectWalletStats(wallet, 'client') : null), [wallet]);
  const currency = wallet?.currency;

  const hues = [colors.primary, colors.accent, isDark ? '#2DD4E4' : '#0E7490', colors.warning, colors.success];
  // Total spent and Processing are wallet figures like the rest, so a client who has spent money but holds no balance
  // still gets a ring (it used to show only an empty-state line for them).
  const segments = useMemo(
    () =>
      [
        ...(stats ? [{ label: stats.hero.label, value: stats.hero.value }] : []),
        ...(stats?.cards ?? []).filter((c) => !c.hidden).map((c) => ({ label: c.label, value: c.value })),
        ...(stats?.pendingChip ? [{ label: stats.pendingChip.label, value: stats.pendingChip.value }] : []),
      ].filter((x) => x.value > 0),
    [stats],
  );

  return (
    <View>
      <Card>
        <View style={styles.top}>
          <IconTile icon="wallet-outline" tone="primary" size={34} />
          <View style={styles.topText}>
            <Text style={styles.cardLabel}>Total spent</Text>
            <Text style={styles.muted}>Lifetime, not a period figure.</Text>
          </View>
        </View>
        <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {moneyText(stats?.hero.value, currency)}
        </Text>
      </Card>
      <View style={styles.row}>
        <MetricCard
          label="Processing"
          icon="time-outline"
          tone="warning"
          value={moneyText(stats ? (stats.pendingChip?.value ?? 0) : undefined, currency)}
          caption="Not yet settled"
        />
      </View>

      <SectionHeader title="Where your wallet stands" subtitle="Share of the figures your wallet reports" />
      <MoneyBreakdownCard
        segments={segments}
        hues={hues}
        currency={currency}
        centerLabel="Combined"
        summary="Wallet figures by source"
        emptyText="Nothing in your wallet yet."
      />

      <SectionHeader title="Activity" subtitle="Pick a period" />
      <SegmentedTabs tabs={PERIODS} value={period} onChange={setPeriod} label="Reporting period" />
      <View style={styles.tabsGap} />
      {/* Keyed by period: a new period remounts, so a slow answer for the old one can never fill the new one. */}
      <PeriodActivity key={period} period={period} />

      <View style={styles.buttons}>
        <ActionButton label="Open payments" icon="card-outline" onPress={() => router.push('/payments' as never)} />
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
  const trends = useAsync(useCallback(() => getCustomerTrends(period), [period]));
  const perf = useAsync(useCallback(() => getCustomerPerformance(period), [period]));

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
          label="Events"
          icon="calendar-outline"
          value={t.events?.value != null ? String(t.events.value) : 'N/A'}
          caption={trendCaption(t.events, period)}
        />
        <MetricCard
          label="Photographers"
          icon="people-outline"
          value={t.photographers?.value != null ? String(t.photographers.value) : 'N/A'}
          caption={trendCaption(t.photographers, period)}
        />
      </View>
      <SectionHeader title="Spending trend" subtitle="Relative size of payments in each interval" />
      {perf.error && !perf.data ? (
        <View style={styles.noticeGap}>
          <ErrorNotice message={perf.error} onRetry={perf.refresh} />
        </View>
      ) : perf.loading && !perf.data ? (
        <SkeletonCard height={150} />
      ) : (
        <>
          <SpendingTrendChart points={perf.data ?? []} />
          <SectionHeader title="Events in this period" subtitle="Number of events in each interval" />
          <EventsHistogram points={perf.data ?? []} />
        </>
      )}
    </View>
  );
}

export function SpendingTrendChart({ points }: { points: readonly PerformancePoint[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const max = Math.max(0, ...points.map((p) => p.value1));
  if (points.length === 0 || max === 0) {
    return (
      <Card>
        <View style={styles.emptyChart}>
          <Ionicons name="bar-chart-outline" size={24} color={colors.textMuted} />
          <Text style={styles.muted}>No payments in this period.</Text>
        </View>
      </Card>
    );
  }
  const top = points.reduce((best, p) => (p.value1 > best.value1 ? p : best), points[0]);
  return (
    <Card>
      <View accessible accessibilityRole="image" accessibilityLabel={`Spending over ${points.length} intervals. Highest: ${top.day}.`}>
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
        The curve shows relative size, with the highest interval marked in pink. Payments are made in different currencies, so no amount is labelled.
      </Text>
    </Card>
  );
}

export function EventsHistogram({ points }: { points: readonly PerformancePoint[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = points.reduce((s, p) => s + (p.value2 || 0), 0);
  if (points.length === 0 || total === 0) {
    return (
      <Card>
        <View style={styles.emptyChart}>
          <Ionicons name="calendar-outline" size={24} color={colors.textMuted} />
          <Text style={styles.muted}>No events in this period.</Text>
        </View>
      </Card>
    );
  }
  return (
    <CountBars
      values={points.map((p) => p.value2 || 0)}
      labels={points.map((p) => p.day)}
      label={`Events per interval: ${points.map((p) => `${p.day} ${p.value2 || 0}`).join(', ')}`}
    />
  );
}

const useStyles = makeStyles((c) => ({
  noticeGap: { marginTop: spacing.md },
  tabsGap: { height: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  topText: { flex: 1, minWidth: 0 },
  cardLabel: { color: c.textSoft, fontSize: 14, fontWeight: '700' },
  big: { color: c.text, fontSize: 28, fontWeight: '800', marginTop: spacing.sm },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
  labels: { flexDirection: 'row', marginTop: 6 },
  barLabel: { flex: 1, textAlign: 'center', color: c.textMuted, fontSize: 11 },
  barLabelTop: { color: c.text, fontWeight: '700' },
  chartNote: { color: c.textMuted, fontSize: 12, lineHeight: 16, marginTop: spacing.md },
  emptyChart: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  buttons: { gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.xl },
}));
