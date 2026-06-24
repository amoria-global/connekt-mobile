import { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { getWallet } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

export default function WalletScreen() {
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const { isPhotographer } = useRole();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getWallet(), []));

  return (
    <Screen padded={false} edges={['bottom']}>
      {loading && !data ? (
        <View style={[styles.centered, { paddingTop: topBarHeight }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && !data ? (
        <View style={[styles.centered, { paddingTop: topBarHeight }]}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.primary}
              progressViewOffset={topBarHeight}
            />
          }
        >
          <View style={styles.headerBlock}>
            <Text style={styles.screenTitle}>Wallet</Text>
            <Text style={styles.screenSubtitle}>Balance, earnings and payouts</Text>
          </View>

          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total balance</Text>
            <Text style={styles.balanceValue}>
              {formatMoney(data?.total, data?.currency)}
            </Text>
          </View>

          {isPhotographer ? (
            <Button title="Withdraw funds" onPress={() => router.push('/withdraw')} />
          ) : null}

          <View style={styles.menuCard}>
            <Pressable style={styles.menuRow} onPress={() => router.push('/transactions')}>
              <Ionicons name="swap-horizontal-outline" size={20} color={colors.primary} />
              <Text style={styles.menuLabel}>Transactions</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable
              style={[styles.menuRow, styles.menuBorderTop]}
              onPress={() => router.push('/wallet/movements')}
            >
              <Ionicons name="list-outline" size={20} color={colors.primary} />
              <Text style={styles.menuLabel}>Wallet movements</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            <Pressable style={[styles.menuRow, styles.menuBorderTop]} onPress={() => router.push('/payments')}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
              <Text style={styles.menuLabel}>Payments</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            {isPhotographer ? (
              <Pressable style={[styles.menuRow, styles.menuBorderTop]} onPress={() => router.push('/payroll')}>
                <Ionicons name="bar-chart-outline" size={20} color={colors.primary} />
                <Text style={styles.menuLabel}>Payroll report</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {data?.pots.length ? (
            <View style={styles.breakdown}>
              <Text style={styles.sectionTitle}>Breakdown</Text>
              {data.pots.map((pot) => (
                <View key={pot.key} style={styles.potRow}>
                  <Text style={styles.potLabel}>{pot.label}</Text>
                  <Text style={styles.potAmount}>{formatMoney(pot.amount, data.currency)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>
              No earnings yet. Booking income, tips, and donations will show here.
            </Text>
          )}
        </ScrollView>
      )}
      <TopBar />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 120, gap: spacing.xl },
  headerBlock: { gap: 2 },
  screenTitle: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  screenSubtitle: { fontSize: fontSize.sm, color: colors.textMuted },
  menuCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  menuBorderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft },
  menuLabel: { flex: 1, fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.semibold },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  balanceLabel: { color: '#C7D2FE', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  balanceValue: { color: colors.textOnPrimary, fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold },
  breakdown: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  potRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
  },
  potLabel: { fontSize: fontSize.md, color: colors.textSoft },
  potAmount: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  emptyHint: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
});
