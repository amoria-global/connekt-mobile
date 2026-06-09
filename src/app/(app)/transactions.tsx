import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { listWalletMovements, type Movement } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function TransactionsScreen() {
  const { data, loading, error, refresh } = useAsync(useCallback(() => listWalletMovements(), []));

  return (
    <Screen padded={false}>
      <DataList
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        title="Transactions"
        subtitle="Your wallet activity"
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <Row movement={item} />}
        emptyIcon="swap-horizontal-outline"
        emptyTitle="No transactions yet"
        emptyMessage="Money in and out of your wallet will show up here."
      />
    </Screen>
  );
}

function Row({ movement }: { movement: Movement }) {
  const inbound = movement.direction === 'in';
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: inbound ? colors.successBg : colors.errorBg }]}>
        <Text style={[styles.sign, { color: inbound ? colors.success : colors.error }]}>
          {inbound ? '↓' : '↑'}
        </Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {movement.description || movement.category || 'Transaction'}
        </Text>
        {movement.createdAt ? <Text style={styles.date}>{formatDate(movement.createdAt)}</Text> : null}
      </View>
      <Text style={[styles.amount, { color: inbound ? colors.success : colors.text }]}>
        {inbound ? '+' : '-'}
        {formatMoney(movement.amount, movement.currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
  },
  icon: { width: 40, height: 40, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  sign: { fontSize: fontSize.lg, fontWeight: fontWeight.bold },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  date: { fontSize: fontSize.xs, color: colors.textMuted },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
