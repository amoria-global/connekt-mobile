/**
 * Wallet tab — balance, earnings breakdown, and payouts.
 *
 * Mobile port of the salo-run wallet pages (client / coordinator /
 * photographer). Coordinators & photographers can withdraw; clients see a
 * read-only balance. Brand design: LIBRARY-style eyebrow header, gradient
 * balance hero, pot stat cards, and quick links — all Pragati Narrow.
 */
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
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { getWallet } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';

type Link = { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href };

export default function WalletScreen() {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const { isPhotographer, isCoordinator, isClient } = useRole();
  const canWithdraw = isPhotographer || isCoordinator;
  const { data, loading, error, refresh } = useAsync(useCallback(() => getWallet(), []));

  const subtitle = isCoordinator
    ? 'Your event payments, stream revenue, and balance.'
    : isPhotographer
      ? 'Your earnings, bonuses and payouts.'
      : 'Your balance, payments and receipts.';

  const links: Link[] = [
    { label: 'Transactions', icon: 'swap-horizontal-outline', href: '/transactions' as Href },
    { label: 'Wallet movements', icon: 'list-outline', href: '/wallet/movements' as Href },
    { label: 'Payments', icon: 'card-outline', href: '/payments' as Href },
    ...(isPhotographer
      ? [{ label: 'Payroll report', icon: 'bar-chart-outline' as const, href: '/payroll' as Href }]
      : []),
  ];

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
            <Text style={styles.eyebrow}>WALLET</Text>
            <Text style={styles.title}>Wallet</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* Balance hero */}
          <LinearGradient
            colors={[...gradients.brand]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <Text style={styles.balanceLabel}>{isClient ? 'WALLET BALANCE' : 'AVAILABLE BALANCE'}</Text>
            <Text style={styles.balanceValue}>{formatMoney(data?.total, data?.currency)}</Text>
            {canWithdraw ? (
              <Pressable
                style={({ pressed }) => [styles.withdrawBtn, pressed && { opacity: 0.9 }]}
                onPress={() => router.push('/withdraw' as Href)}
              >
                <Ionicons name="cash-outline" size={16} color={colors.primary} />
                <Text style={styles.withdrawText}>Withdraw funds</Text>
              </Pressable>
            ) : null}
          </LinearGradient>

          {/* Pots as stat cards */}
          {data?.pots.length ? (
            <>
              <Text style={styles.sectionTitle}>Breakdown</Text>
              <View style={styles.potGrid}>
                {data.pots.map((pot, i) => {
                  const accent = POT_ACCENTS[i % POT_ACCENTS.length];
                  return (
                    <View key={pot.key} style={styles.potCard}>
                      <View style={[styles.potAccent, { backgroundColor: accent }]} />
                      <Text style={styles.potLabel}>{pot.label}</Text>
                      <Text style={styles.potAmount}>{formatMoney(pot.amount, data.currency)}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.emptyHint}>
              No earnings yet. Booking income, tips, and donations will show here.
            </Text>
          )}

          {/* Quick links */}
          <View style={styles.menuCard}>
            {links.map((l, i) => (
              <Pressable
                key={l.label}
                style={[styles.menuRow, i > 0 && styles.menuBorderTop]}
                onPress={() => router.push(l.href)}
              >
                <View style={styles.menuIcon}>
                  <Ionicons name={l.icon} size={18} color={colors.primary} />
                </View>
                <Text style={styles.menuLabel}>{l.label}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
      <TopBar />
    </Screen>
  );
}

const POT_ACCENTS = ['#083A85', '#F59E0B', '#10B981', '#8B5CF6', '#3B82F6'];

const useStyles = makeStyles((c) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorText: { fontFamily: fonts.regular, color: c.textMuted, fontSize: 14, textAlign: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.lg },

  headerBlock: { gap: 2 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 12, color: c.accent, letterSpacing: 1.2 },
  title: { fontFamily: fonts.bold, fontSize: 28, color: c.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted },

  balanceCard: { borderRadius: radii.xl, padding: spacing.xl, gap: 6 },
  balanceLabel: { fontFamily: fonts.bold, color: 'rgba(255,255,255,0.8)', fontSize: 11, letterSpacing: 1 },
  balanceValue: { fontFamily: fonts.bold, color: '#fff', fontSize: 34, letterSpacing: -0.5 },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    height: 40,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  withdrawText: { fontFamily: fonts.bold, fontSize: 14, color: c.primary },

  sectionTitle: { fontFamily: fonts.bold, fontSize: 17, color: c.text },
  potGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  potCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    paddingTop: 16,
    overflow: 'hidden',
    gap: 2,
  },
  potAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  potLabel: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted },
  potAmount: { fontFamily: fonts.bold, fontSize: 20, color: c.text },

  menuCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  menuBorderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: c.text },

  emptyHint: { fontFamily: fonts.regular, color: c.textMuted, fontSize: 14, textAlign: 'center' },
}));
