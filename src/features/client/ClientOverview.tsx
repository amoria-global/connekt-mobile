/**
 * ClientOverview: the client Home's counterpart to the photographer's "Business overview".
 *
 * Lifetime figures, laid out the same way: two metric cards (what you have spent, what you still
 * owe), the events split as a ring with its legend, and three count tiles. Every figure comes from
 * an API call. One that has not loaded, or failed, reads "N/A" (never a zero), and money is only
 * drawn with a currency it can be labelled with:
 *   - Total spent comes from the wallet, in the wallet's own currency (the analytics endpoint
 *     sums in either the wallet currency or USD depending on a cache, so it is not used for money).
 *   - Payments due is the pending-payments feed, which is USD ledger values.
 */
import { Text, View } from 'react-native';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import type { CustomerAnalytics } from '@/features/analytics/api';
import { Card, IconTile, MetricCard } from '@/features/photographer/kit';
import { moneyText, type Known } from '@/features/photographer/money';
import { StatusBreakdownCard, type BreakdownSegment } from './ClientCharts';

type IconName = Parameters<typeof IconTile>[0]['icon'];

/** Events split by stage. `other` is whatever the total holds beyond the three named stages. */
export function eventStageSegments(a: CustomerAnalytics, colors: { primary: string; success: string; error: string; textMuted: string }): BreakdownSegment[] {
  const upcoming = a.upcomingEvents ?? 0;
  const completed = a.completedEvents ?? 0;
  const cancelled = a.cancelledEvents ?? 0;
  const other = Math.max((a.totalEvents ?? 0) - upcoming - completed - cancelled, 0);
  return [
    { key: 'upcoming', label: 'Upcoming', value: upcoming, color: colors.primary },
    { key: 'completed', label: 'Completed', value: completed, color: colors.success },
    { key: 'cancelled', label: 'Cancelled', value: cancelled, color: colors.error },
    { key: 'other', label: 'Other', value: other, color: colors.textMuted },
  ];
}

export function ClientOverview({
  analytics,
  loading,
  spent,
  walletCurrency,
  walletLoading,
  due,
  hidden,
  onOpenWallet,
  onOpenPayments,
}: {
  analytics: CustomerAnalytics | null;
  loading: boolean;
  /** Lifetime spend from the wallet, or undefined while unknown. */
  spent: Known;
  walletCurrency: string | undefined;
  walletLoading: boolean;
  /** Remaining on open payments (USD ledger), or undefined while unknown. */
  due: { amount: number; count: number } | undefined;
  hidden: boolean;
  onOpenWallet: () => void;
  onOpenPayments: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tiles: { key: string; label: string; value: string; icon: IconName }[] = [
    { key: 'bookings', label: 'Bookings', icon: 'calendar-outline', value: analytics ? String(analytics.totalBookings) : 'N/A' },
    { key: 'photos', label: 'Photos delivered', icon: 'images-outline', value: analytics ? String(analytics.totalPhotos) : 'N/A' },
    { key: 'saved', label: 'Saved photographers', icon: 'bookmark-outline', value: analytics ? String(analytics.bookmarkedPhotographers) : 'N/A' },
  ];
  return (
    <View>
      <View style={styles.top}>
        <MetricCard
          label="Total spent"
          icon="wallet-outline"
          tone="success"
          loading={walletLoading && spent === undefined}
          value={moneyText(spent, walletCurrency, hidden)}
          caption="Lifetime, from your wallet"
          onPress={onOpenWallet}
          accessibilityHint="Opens your wallet"
        />
        <MetricCard
          label="Payments due"
          icon="time-outline"
          tone="warning"
          value={due ? (due.count === 0 ? moneyText(0, 'USD', hidden) : moneyText(due.amount, 'USD', hidden)) : 'N/A'}
          caption={due ? (due.count === 0 ? 'Nothing owed' : `${due.count} payment${due.count === 1 ? '' : 's'} waiting`) : undefined}
          onPress={onOpenPayments}
          accessibilityHint="Opens your payments"
        />
      </View>
      <View style={styles.ringGap}>
        {loading && !analytics ? (
          <Card>
            <Text style={styles.muted}>Loading your events…</Text>
          </Card>
        ) : analytics ? (
          <StatusBreakdownCard
            segments={eventStageSegments(analytics, colors)}
            centerLabel="events"
            summary="Your events by stage"
            emptyText="No events yet. Book a photographer and your events appear here."
          />
        ) : null}
      </View>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.key} style={styles.tile} accessible accessibilityLabel={`${t.label}, ${loading && !analytics ? 'loading' : t.value}`}>
            <IconTile icon={t.icon} tone="primary" size={28} />
            <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {loading && !analytics ? ' ' : t.value}
            </Text>
            <Text style={styles.tileLabel} numberOfLines={2} maxFontSizeMultiplier={1.6}>
              {t.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  top: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg },
  ringGap: { marginTop: spacing.md },
  muted: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
  tiles: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  tile: {
    flex: 1,
    gap: 5,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  tileValue: { color: c.text, fontSize: 20, fontWeight: '800' },
  tileLabel: { color: c.textMuted, fontSize: 12, lineHeight: 15 },
}));
