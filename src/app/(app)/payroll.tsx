import { useCallback } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card, EmptyNote, ErrorNotice, IconTile, SectionHeader, Skeleton, StatusText } from '@/features/photographer/kit';
import { statusTone } from '@/features/payments/statusBucket';
import { getPayrollReport } from '@/features/wallet/api';
import { payrollView } from '@/features/wallet/payrollView';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';

export default function PayrollScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors } = useTheme();
  const { t } = useLanguage();
  const styles = useStyles();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getPayrollReport(), []));

  const refreshControl = <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />;

  if (loading && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.scroll} accessibilityLabel="Loading earnings report">
          <View style={styles.cards}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.statCard}>
                <Skeleton height={10} width="60%" />
                <Skeleton height={20} width="80%" />
              </View>
            ))}
          </View>
          <View style={styles.skel}><Skeleton height={64} radius={radii.md} /></View>
          <View style={styles.skel}><Skeleton height={64} radius={radii.md} /></View>
        </View>
      </Screen>
    );
  }

  // A failed request is never drawn as an empty report.
  if (!data) {
    return (
      <Screen padded={false} edges={[]}>
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
          <ErrorNotice message={error ?? 'The earnings report could not be loaded.'} onRetry={refresh} />
        </ScrollView>
      </Screen>
    );
  }

  const view = payrollView(data);
  const cur = data.currency;
  const tints = { total: colors.link, paid: colors.success, pending: colors.warning };

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={refreshControl}>
        <Text style={styles.lead}>What you have earned from bookings, and what is still waiting to be released.</Text>

        {view.unavailable ? (
          <ErrorNotice message="The earnings report came back without figures, so nothing can be shown yet." onRetry={refresh} />
        ) : null}

        <View style={styles.cards}>
          {view.stats.map((s) => (
            <View key={s.key} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              {s.value == null ? (
                <Text style={styles.statUnknown} accessibilityLabel={`${s.label} unavailable`} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  Unavailable
                </Text>
              ) : (
                <Text style={[styles.statValue, { color: tints[s.key] }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatPrice(s.value, cur)}
                </Text>
              )}
            </View>
          ))}
        </View>

        {view.unavailable ? null : <SectionHeader title="Earnings" />}
        {view.listUnavailable ? (
          view.unavailable ? null : <ErrorNotice message="The list of earnings was not included in this report." onRetry={refresh} compact />
        ) : view.confirmedEmpty ? (
          <EmptyNote icon="cash-outline" title="No earnings yet" body="Released booking payments will be listed here." />
        ) : (
          <Card style={styles.listCard}>
            {data.entries?.map((e, i) => {
              const tone = e.status ? statusTone(e.status) : undefined;
              return (
                <View key={e.id} style={[styles.row, i > 0 && styles.rowRule]}>
                  <IconTile icon="cash-outline" tone={tone === 'error' ? 'error' : tone === 'warning' ? 'warning' : 'success'} />
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={2}>
                      {e.description || e.type || 'Earning'}
                    </Text>
                    {e.date ? <Text style={styles.rowDate}>{formatDate(e.date)}</Text> : null}
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowAmount}>{formatPrice(e.amount, cur)}</Text>
                    {e.status ? <StatusText label={e.status} tone={tone === 'info' ? 'info' : (tone ?? 'neutral')} /> : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { paddingVertical: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  skel: { marginHorizontal: spacing.lg },
  lead: { color: c.textMuted, fontSize: fontSize.sm, marginHorizontal: spacing.lg },
  cards: { flexDirection: 'row', gap: spacing.sm, marginHorizontal: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: c.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 68,
    justifyContent: 'center',
  },
  statLabel: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: fontWeight.semibold },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  statUnknown: { fontSize: fontSize.sm, color: c.textMuted, fontWeight: fontWeight.semibold },
  listCard: { padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  rowRule: { borderTopWidth: 1, borderTopColor: c.borderSoft },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: c.text, lineHeight: 19 },
  rowDate: { fontSize: fontSize.xs, color: c.textMuted },
  rowRight: { alignItems: 'flex-end', gap: 3 },
  rowAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
}));
