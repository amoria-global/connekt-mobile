import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPayrollReport } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function PayrollScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getPayrollReport(), []));

  if (loading && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  const cur = data?.currency;

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.cards}>
          <Stat label="Total" value={formatMoney(data?.total ?? 0, cur)} tint={colors.primary} />
          <Stat label="Paid" value={formatMoney(data?.paid ?? 0, cur)} tint={colors.success} />
          <Stat label="Pending" value={formatMoney(data?.pending ?? 0, cur)} tint={colors.warning} />
        </View>

        <Text style={styles.sectionTitle}>Transactions</Text>
        {data?.entries.length ? (
          data.entries.map((e) => (
            <View key={e.id} style={styles.row}>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {e.description || e.type || 'Earning'}
                </Text>
                {e.date ? <Text style={styles.rowDate}>{formatDate(e.date)}</Text> : null}
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowAmount}>{formatMoney(e.amount, cur)}</Text>
                {e.status ? <StatusPill status={e.status} /> : null}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>No earnings yet.</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value, tint }: { label: string; value: string; tint: string }) {
  const styles = useStyles();
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tint }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  cards: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statLabel: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: fontWeight.semibold },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  rowDate: { fontSize: fontSize.xs, color: c.textMuted },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs },
  rowAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.primary },
}));
