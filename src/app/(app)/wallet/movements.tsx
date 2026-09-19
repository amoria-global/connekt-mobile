/**
 * Wallet movements — the transaction feed behind the wallet card.
 *
 * Reuses `listWalletMovements()` which already calls
 * /wallet/me/movements?page=0&size=50 and maps the Spring Page envelope.
 * The wallet tab itself shows totals; this screen surfaces the line
 * items so a photographer can audit individual credits/debits.
 */
import { useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { listWalletMovements, type Movement } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

export default function WalletMovementsScreen() {
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listWalletMovements(), []),
  );

  return (
    <Screen padded={false}>
      <ScreenHeader title="Wallet movements" subtitle="Every credit and debit on your wallet" />
      <DataList<Movement>
        data={data}
        loading={loading}
        error={error}
        onRefresh={refresh}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <MovementRow movement={item} />}
        emptyIcon="swap-vertical-outline"
        emptyTitle="No movements yet"
        emptyMessage="Payouts, tips and donations will show up here as they happen."
      />
    </Screen>
  );
}

function MovementRow({ movement }: { movement: Movement }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const isIn = movement.direction === 'in';
  return (
    <View style={styles.row}>
      <View style={[styles.icon, { backgroundColor: isIn ? colors.successBg : colors.errorBg }]}>
        <Ionicons
          name={isIn ? 'arrow-down' : 'arrow-up'}
          size={16}
          color={isIn ? colors.success : colors.error}
        />
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>
          {movement.description || movement.category || (isIn ? 'Credit' : 'Debit')}
        </Text>
        {movement.createdAt ? (
          <Text style={styles.meta}>{formatDate(movement.createdAt)}</Text>
        ) : null}
      </View>
      <Text style={[styles.amount, { color: isIn ? colors.success : colors.error }]}>
        {isIn ? '+' : '−'} {formatMoney(movement.amount, movement.currency)}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  meta: { fontSize: fontSize.xs, color: c.textMuted },
  amount: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold },
}));
