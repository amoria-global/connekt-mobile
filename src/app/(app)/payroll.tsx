import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { getPayrollReport } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function PayrollScreen() {
  const { data, loading, error } = useAsync(useCallback(() => getPayrollReport(), []));

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  const cur = data?.currency;

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
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
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color: tint }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  cards: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statLabel: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.semibold },
  statValue: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  rowDate: { fontSize: fontSize.xs, color: colors.textMuted },
  rowRight: { alignItems: 'flex-end', gap: spacing.xs },
  rowAmount: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.primary },
});
