/**
 * Wallet tab — role-aware balance, earnings/spending breakdown, activity feed, and payouts.
 *
 * Full mobile parity with salo-run wallet pages (client, photographer, event-coordinator).
 * Features:
 *   - Role-specific MoneyHero (Photographer: "Available to withdraw", Client: "Total spent", Coordinator: "Available balance")
 *   - Pending clearance / processing chip with live balance calculation
 *   - Wallet suspension warning banner (with reason & date)
 *   - Role-aware StatCards sub-balance breakdown (auto-hiding zero amounts)
 *   - Embedded ActivityFeed with role-filtered tag pills, direction icons, and relative times
 *   - Activity row tap detail modal showing full ledger metadata
 *   - Withdraw funds action for photographer and coordinator roles
 *   - Quick links (Transactions, All movements, Payments, Payroll report)
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { useAuth } from '@/store/auth';
import { getWallet, listWalletMovements, type Movement } from '@/features/wallet/api';
import {
  toRole,
  selectWalletStats,
  formatWalletMovement,
  getFilterTags,
  PALETTE,
  COLOR_MAP,
  formatRelativeTime,
  type DashboardRole,
  type MoneyItem,
} from '@/features/wallet/moneyView';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { formatMoney } from '@/utils/format';
import { WithdrawBottomSheet } from '@/features/withdrawals/WithdrawBottomSheet';

type Link = { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href };

export default function WalletScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const insets = useSafeAreaInsets();

  const { isPhotographer, isCoordinator, role } = useRole();
  const user = useAuth((s) => s.user);
  const canWithdraw = isPhotographer || isCoordinator;

  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState<MoneyItem | null>(null);
  const [balanceHidden, setBalanceHidden] = useState(true);
  const [showWithdrawSheet, setShowWithdrawSheet] = useState(false);

  // Parallel fetch: wallet summary + recent wallet movements (matching salo-run)
  const fetchData = useCallback(async () => {
    const [wallet, movements] = await Promise.all([
      getWallet(),
      listWalletMovements(0, 50).catch(() => [] as Movement[]),
    ]);
    return { wallet, movements };
  }, []);

  const { data, loading, error, refresh } = useAsync(fetchData);

  const dashboardRole: DashboardRole = toRole(
    role || user?.customerType || data?.wallet?.customerType,
  );

  const stats = useMemo(() => {
    if (!data?.wallet) return null;
    return selectWalletStats(data.wallet, dashboardRole);
  }, [data?.wallet, dashboardRole]);

  const filterTags = useMemo(() => getFilterTags(dashboardRole), [dashboardRole]);

  const activityItems = useMemo(() => {
    if (!data?.movements) return [];
    const items: MoneyItem[] = [];
    for (const m of data.movements) {
      const item = formatWalletMovement(m, dashboardRole);
      if (!item) continue;
      if (activeFilter !== 'All' && item.tag !== activeFilter) continue;
      items.push(item);
    }
    return items;
  }, [data?.movements, dashboardRole, activeFilter]);

  const firstName = user?.firstName || data?.wallet?.customerName?.split(' ')[0];
  const greetingPrefix = firstName ? `${firstName}, your` : 'Your';

  let subtitle = `${greetingPrefix} balance, payments and receipts.`;
  if (dashboardRole === 'photographer') {
    subtitle = `${greetingPrefix} earnings, tips, bonuses, and withdrawal history.`;
  } else if (dashboardRole === 'client') {
    subtitle = `${greetingPrefix} payments, tips, and refund history.`;
  } else if (dashboardRole === 'event-coordinator') {
    subtitle = `${greetingPrefix} event payments, stream revenue, and balance.`;
  }

  const links: Link[] = [
    { label: 'Transactions', icon: 'swap-horizontal-outline', href: '/transactions' as Href },
    { label: 'Wallet movements', icon: 'list-outline', href: '/wallet/movements' as Href },
    { label: 'Payments', icon: 'card-outline', href: '/payments' as Href },
    { label: 'Payment accounts', icon: 'wallet-outline', href: '/payment-accounts' as Href },
    ...(isPhotographer
      ? [{ label: 'Payroll report', icon: 'bar-chart-outline' as const, href: '/payroll' as Href }]
      : []),
  ];

  const visibleCards = stats?.cards.filter((c) => !c.hidden) ?? [];

  return (
    <Screen padded={false} edges={[]}>
      {loading && !data ? (
        <View style={[styles.centered, { paddingTop: topBarHeight }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && !data ? (
        <View style={[styles.centered, { paddingTop: topBarHeight }]}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
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
          {/* Header */}
          <View style={styles.headerBlock}>
            <View style={styles.headerRow}>
              <View style={styles.headerTitles}>
                <Text style={styles.eyebrow}>MONEY</Text>
                <Text style={styles.title}>My wallet</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={styles.privacyToggleBtn}
                  onPress={() => setBalanceHidden((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={balanceHidden ? 'Show balances' : 'Hide balances'}
                >
                  <Ionicons
                    name={balanceHidden ? 'eye-outline' : 'eye-off-outline'}
                    size={15}
                    color={colors.textMuted}
                  />
                  <Text style={styles.privacyToggleText}>
                    {balanceHidden ? 'Show' : 'Hide'}
                  </Text>
                </Pressable>

                {canWithdraw ? (
                  <Pressable
                    style={({ pressed }) => [styles.headerWithdrawBtn, pressed && { opacity: 0.85 }]}
                    onPress={() => setShowWithdrawSheet(true)}
                  >
                    <Ionicons name="cash-outline" size={15} color="#fff" />
                    <Text style={styles.headerWithdrawText}>Withdraw</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          {/* Suspension warning banner (salo-run parity) */}
          {data?.wallet?.status === 'SUSPENDED' || data?.wallet?.suspensionReason ? (
            <View style={styles.suspensionBanner}>
              <Ionicons name="alert-circle" size={18} color="#92400E" />
              <View style={styles.suspensionContent}>
                <Text style={styles.suspensionTitle}>
                  Suspended: {(data.wallet.suspensionReason || 'Account suspended').replace(/_/g, ' ')}
                </Text>
                {data.wallet.suspendedAt ? (
                  <Text style={styles.suspensionDate}>
                    {new Date(data.wallet.suspendedAt).toLocaleString()}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* MoneyHero Card (Clean solid card — no gradients) */}
          {stats && (
            <View style={styles.heroCard}>
              <View style={styles.heroContent}>
                <View style={styles.heroLabelPill}>
                  <Ionicons name="wallet-outline" size={13} color={colors.primary} />
                  <Text style={styles.heroLabelText}>{stats.hero.label}</Text>
                </View>

                <Text style={styles.heroAmount}>
                  {balanceHidden
                    ? `${data?.wallet?.currency ? data.wallet.currency + ' ' : '$ '}••••••`
                    : formatMoney(stats.hero.value, data?.wallet.currency)}
                </Text>

                {stats.pendingChip && stats.pendingChip.value > 0 ? (
                  <View style={styles.pendingChip}>
                    <Ionicons name="time-outline" size={12} color="#92400E" />
                    <Text style={styles.pendingChipText}>
                      {stats.pendingChip.label}:{' '}
                      {balanceHidden
                        ? '••••'
                        : formatMoney(stats.pendingChip.value, data?.wallet.currency)}
                    </Text>
                  </View>
                ) : null}

                {stats.status !== 'ACTIVE' ? (
                  <View
                    style={[
                      styles.statusChip,
                      stats.status === 'SUSPENDED' ? styles.statusSuspended : styles.statusBlocked,
                    ]}
                  >
                    <Ionicons name="shield-outline" size={12} color="#92400E" />
                    <Text style={styles.statusChipText}>Wallet {stats.status.toLowerCase()}</Text>
                  </View>
                ) : null}

                {canWithdraw ? (
                  <Pressable
                    style={({ pressed }) => [styles.heroWithdrawBtn, pressed && { opacity: 0.88 }]}
                    onPress={() => setShowWithdrawSheet(true)}
                  >
                    <Ionicons name="cash-outline" size={15} color="#ffffff" />
                    <Text style={styles.heroWithdrawText}>Withdraw funds</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}

          {/* MoneyStatCards Grid (Sub-balance breakdown) */}
          {visibleCards.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                {dashboardRole === 'photographer'
                  ? 'Earnings breakdown'
                  : dashboardRole === 'client'
                    ? 'Spending breakdown'
                    : 'Balance breakdown'}
              </Text>
              <View style={styles.potGrid}>
                {visibleCards.map((card) => {
                  const p = PALETTE[card.color] ?? PALETTE.neutral;
                  return (
                    <View key={card.label} style={styles.potCard}>
                      <View style={styles.potHeader}>
                        <View style={[styles.potIconWrap, { backgroundColor: p.tint }]}>
                          <Ionicons
                            name={p.icon as keyof typeof Ionicons.glyphMap}
                            size={15}
                            color={p.bar}
                          />
                        </View>
                        <Text style={styles.potLabel} numberOfLines={1}>
                          {card.label}
                        </Text>
                      </View>
                      <Text style={styles.potAmount}>
                        {balanceHidden
                          ? '••••'
                          : formatMoney(card.value, data?.wallet.currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Embedded ActivityFeed (salo-run parity) */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.activityTitleWrap}>
                <View style={styles.activityIconWrap}>
                  <Ionicons name="swap-horizontal-outline" size={15} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>Activity</Text>
              </View>
              <Pressable
                onPress={() => router.push('/wallet/movements' as Href)}
                hitSlop={8}
              >
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>

            {/* Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterBar}
            >
              {filterTags.map((tag) => {
                const isSelected = activeFilter === tag;
                return (
                  <Pressable
                    key={tag}
                    onPress={() => setActiveFilter(tag)}
                    style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  >
                    <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Movements List / Empty State */}
            {activityItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No movements found</Text>
                <Text style={styles.emptyCardDesc}>
                  {activeFilter === 'All'
                    ? 'Payouts, tips, bonuses, and payments will appear here.'
                    : `No ${activeFilter.toLowerCase()} transactions recorded yet.`}
                </Text>
              </View>
            ) : (
              <View style={styles.activityCardGroup}>
                {activityItems.map((item, idx) => {
                  const palette = COLOR_MAP[item.color] ?? COLOR_MAP.neutral;
                  const isIn = item.direction === 'in';
                  const sign = isIn ? '+' : '−';
                  const amountColor = isIn ? '#10B981' : colors.text;
                  const timeStr = formatRelativeTime(item.timestamp);
                  const isLast = idx === activityItems.length - 1;

                  const displayAmount = balanceHidden
                    ? `${sign}$ ••••`
                    : `${sign}${formatMoney(item.amount, item.originalCurrency || data?.wallet.currency)}`;

                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.activityRow,
                        !isLast && styles.activityRowDivider,
                        pressed && styles.activityRowPressed,
                      ]}
                      onPress={() => setSelectedItem(item)}
                    >
                      {/* Direction Circle */}
                      <View style={[styles.directionCircle, { backgroundColor: palette.bg }]}>
                        <Ionicons
                          name={isIn ? 'arrow-down' : 'arrow-up'}
                          size={15}
                          color={palette.text}
                        />
                      </View>

                      {/* Title & Metadata */}
                      <View style={styles.activityBody}>
                        <View style={styles.activityTitleRow}>
                          <Text style={styles.activityTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <View style={[styles.tagBadge, { backgroundColor: palette.bg }]}>
                            <Text style={[styles.tagBadgeText, { color: palette.text }]}>
                              {item.tag}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.activityMetaRow}>
                          {item.subtitle ? (
                            <>
                              <Text style={styles.activitySubtitle} numberOfLines={1}>
                                {item.subtitle}
                              </Text>
                              <Text style={styles.activityBullet}>•</Text>
                            </>
                          ) : null}
                          <Text style={styles.activityTime}>{timeStr}</Text>
                        </View>
                      </View>

                      {/* Amount & Chevron */}
                      <View style={styles.activityRightCol}>
                        <Text style={[styles.activityAmount, { color: amountColor }]}>
                          {displayAmount}
                        </Text>
                        <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Quick Links Menu */}
          <View style={styles.menuCard}>
            {links.map((l, i) => (
              <Pressable
                key={l.label}
                style={({ pressed }) => [
                  styles.menuRow,
                  i < links.length - 1 && styles.menuRowDivider,
                  pressed && styles.menuRowPressed,
                ]}
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

      {/* Activity Item Detail Bottom Sheet */}
      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedItem(null)} />
        <View style={styles.modalSheetOverlay} pointerEvents="box-none">
          <View
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom + 16, 28) },
            ]}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>Transaction details</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setSelectedItem(null)}
                hitSlop={8}
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {selectedItem && (
              <View style={styles.modalBody}>
                {/* Big Amount Card */}
                <View style={styles.modalHeroBox}>
                  <Text
                    style={[
                      styles.modalHeroAmount,
                      { color: selectedItem.direction === 'in' ? '#10B981' : colors.text },
                    ]}
                  >
                    {selectedItem.direction === 'in' ? '+' : '−'}
                    {formatMoney(selectedItem.amount, selectedItem.originalCurrency || data?.wallet.currency)}
                  </Text>
                  <Text style={styles.modalHeroTitle}>{selectedItem.title}</Text>
                </View>

                {/* Details Breakdown */}
                <View style={styles.modalDetailsList}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <View
                      style={[
                        styles.tagBadge,
                        {
                          backgroundColor:
                            COLOR_MAP[selectedItem.color]?.bg ?? COLOR_MAP.neutral.bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagBadgeText,
                          {
                            color:
                              COLOR_MAP[selectedItem.color]?.text ?? COLOR_MAP.neutral.text,
                          },
                        ]}
                      >
                        {selectedItem.tag}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Direction</Text>
                    <Text style={styles.detailValue}>
                      {selectedItem.direction === 'in' ? 'Credit (Incoming)' : 'Debit (Outgoing)'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedItem.timestamp).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Text>
                  </View>

                  {selectedItem.originalAmount && selectedItem.originalCurrency ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Original amount</Text>
                      <Text style={styles.detailValue}>
                        {selectedItem.originalCurrency} {selectedItem.originalAmount.toLocaleString()}
                      </Text>
                    </View>
                  ) : null}

                  {selectedItem.sourceType ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Source</Text>
                      <Text style={styles.detailValue}>
                        {selectedItem.sourceType.replace(/_/g, ' ').toLowerCase()}
                      </Text>
                    </View>
                  ) : null}

                  {selectedItem.subtitle ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Notes</Text>
                      <Text style={[styles.detailValue, { flex: 1, textAlign: 'right' }]}>
                        {selectedItem.subtitle}
                      </Text>
                    </View>
                  ) : null}

                  <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.detailLabel}>ID</Text>
                    <Text style={[styles.detailValue, styles.detailId]} numberOfLines={1}>
                      {selectedItem.id}
                    </Text>
                  </View>
                </View>

                {/* Dismiss Action */}
                <Pressable
                  style={({ pressed }) => [styles.modalDoneBtn, pressed && { opacity: 0.9 }]}
                  onPress={() => setSelectedItem(null)}
                >
                  <Text style={styles.modalDoneBtnText}>Done</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Withdraw Bottom Sheet */}
      <WithdrawBottomSheet
        visible={showWithdrawSheet}
        onClose={() => setShowWithdrawSheet(false)}
        onSuccess={refresh}
        availableBalance={stats?.hero?.value ?? 0}
        currency={data?.wallet?.currency ?? 'USD'}
      />

      <TopBar />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  errorText: { fontFamily: fonts.regular, color: c.textMuted, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: c.primary,
    borderRadius: radii.md,
  },
  retryBtnText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.lg },

  headerBlock: { gap: 4 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerTitles: { flex: 1 },
  eyebrow: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#F20C8F',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { fontFamily: fonts.bold, fontSize: 28, color: c.text, letterSpacing: -0.5 },
  subtitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  privacyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  privacyToggleText: { fontFamily: fonts.bold, fontSize: 12, color: c.textMuted },
  headerWithdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radii.full,
  },
  headerWithdrawText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },

  suspensionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  suspensionContent: { flex: 1, gap: 2 },
  suspensionTitle: { fontFamily: fonts.bold, fontSize: 13, color: '#92400E' },
  suspensionDate: { fontFamily: fonts.regular, fontSize: 11, color: '#B45309' },

  // Hero Card (Clean solid card — no gradients)
  heroCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.xl,
  },
  heroContent: {
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
  },
  heroLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: c.infoBg,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  heroLabelText: {
    fontFamily: fonts.bold,
    color: c.primary,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontFamily: fonts.bold,
    color: c.text,
    fontSize: 38,
    letterSpacing: -0.8,
    lineHeight: 46,
    marginTop: 2,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: 2,
  },
  pendingChipText: { fontFamily: fonts.bold, fontSize: 12, color: '#92400E' },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: 4,
  },
  statusSuspended: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBlocked: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  statusChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroWithdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: c.primary,
    paddingHorizontal: 20,
    height: 40,
    borderRadius: radii.full,
    marginTop: 8,
  },
  heroWithdrawText: { fontFamily: fonts.bold, fontSize: 13, color: '#ffffff' },

  // Breakdown StatCards
  sectionBlock: { gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 17, color: c.text },
  potGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  potCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    overflow: 'hidden',
    gap: 8,
  },
  potHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  potIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  potLabel: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  potAmount: { fontFamily: fonts.bold, fontSize: 20, color: c.text, letterSpacing: -0.3 },

  // Activity Feed
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  activityIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seeAllText: { fontFamily: fonts.bold, fontSize: 13, color: c.primary },

  filterBar: { gap: 6, paddingVertical: 2 },
  filterPill: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: { backgroundColor: c.primary, borderColor: c.primary },
  filterPillText: { fontFamily: fonts.bold, fontSize: 12, color: c.textMuted },
  filterPillTextActive: { color: '#ffffff' },

  emptyCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  emptyCardTitle: { fontFamily: fonts.bold, fontSize: 15, color: c.text },
  emptyCardDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
  },

  activityCardGroup: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  activityList: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  activityRowPressed: { backgroundColor: c.infoBg },
  activityRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  activityBorderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft },
  directionCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityBody: { flex: 1, minWidth: 0, gap: 3 },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  tagBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: radii.full,
    alignSelf: 'center',
  },
  tagBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  activityMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activitySubtitle: {
    maxWidth: '70%',
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  activityBullet: { fontSize: 11, color: c.textMuted },
  activityTime: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  activityRightCol: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityAmountWrap: { flexShrink: 0, alignItems: 'flex-end' },
  activityAmount: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.2 },

  // Quick Links
  menuCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
  },
  menuRowPressed: { backgroundColor: c.infoBg },
  menuRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.borderSoft },
  menuBorderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: c.text },

  // Detail Bottom Sheet Modal
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  modalSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  modalHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderTitle: { fontFamily: fonts.bold, fontSize: 17, color: c.text },
  modalCloseBtn: { padding: 4 },
  modalBody: { gap: spacing.lg },
  modalHeroBox: {
    alignItems: 'center',
    backgroundColor: c.infoBg,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    gap: 4,
  },
  modalHeroAmount: { fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.5 },
  modalHeroTitle: { fontFamily: fonts.regular, fontSize: 14, color: c.textMuted },
  modalDetailsList: {
    backgroundColor: c.background,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
    gap: 12,
  },
  detailLabel: { fontFamily: fonts.regular, fontSize: 13, color: c.textMuted },
  detailValue: { fontFamily: fonts.bold, fontSize: 13, color: c.text },
  detailId: { maxWidth: 160, fontFamily: fonts.regular, color: c.textMuted },
  modalDoneBtn: {
    height: 44,
    borderRadius: radii.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDoneBtnText: { fontFamily: fonts.bold, fontSize: 15, color: '#ffffff' },
}));
