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
import { LinearGradient } from 'expo-linear-gradient';
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

type Link = { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href };

export default function WalletScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();

  const { isPhotographer, isCoordinator, role } = useRole();
  const user = useAuth((s) => s.user);
  const canWithdraw = isPhotographer || isCoordinator;

  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedItem, setSelectedItem] = useState<MoneyItem | null>(null);

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
              {canWithdraw ? (
                <Pressable
                  style={({ pressed }) => [styles.headerWithdrawBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push('/withdraw' as Href)}
                >
                  <Ionicons name="cash-outline" size={15} color="#fff" />
                  <Text style={styles.headerWithdrawText}>Withdraw</Text>
                </Pressable>
              ) : null}
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

          {/* MoneyHero Card (Connekyt brand gradient with hero figure & chips) */}
          {stats && (
            <LinearGradient
              colors={['#083A85', '#0a4da8', '#1654b8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              {/* Glowing background circles for depth */}
              <View style={styles.heroGlowPink} />
              <View style={styles.heroGlowWhite} />

              <View style={styles.heroContent}>
                <View style={styles.heroLabelPill}>
                  <Ionicons name="wallet-outline" size={12} color="#ffffff" />
                  <Text style={styles.heroLabelText}>{stats.hero.label}</Text>
                </View>

                <Text style={styles.heroAmount}>
                  {formatMoney(stats.hero.value, data?.wallet.currency)}
                </Text>

                {stats.pendingChip && stats.pendingChip.value > 0 ? (
                  <View style={styles.pendingChip}>
                    <Ionicons name="time-outline" size={12} color="#FCD34D" />
                    <Text style={styles.pendingChipText}>
                      {stats.pendingChip.label}: {formatMoney(stats.pendingChip.value, data?.wallet.currency)}
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
                    <Ionicons name="shield-outline" size={12} color="#FCD34D" />
                    <Text style={styles.statusChipText}>Wallet {stats.status.toLowerCase()}</Text>
                  </View>
                ) : null}

                {canWithdraw ? (
                  <Pressable
                    style={({ pressed }) => [styles.heroWithdrawBtn, pressed && { opacity: 0.9 }]}
                    onPress={() => router.push('/withdraw' as Href)}
                  >
                    <Ionicons name="cash-outline" size={16} color="#083A85" />
                    <Text style={styles.heroWithdrawText}>Withdraw funds</Text>
                  </Pressable>
                ) : null}
              </View>
            </LinearGradient>
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
                      <View style={[styles.potAccent, { backgroundColor: p.bar }]} />
                      <View style={styles.potHeader}>
                        <View style={[styles.potIconWrap, { backgroundColor: p.tint }]}>
                          <Ionicons
                            name={p.icon as keyof typeof Ionicons.glyphMap}
                            size={14}
                            color={p.bar}
                          />
                        </View>
                        <Text style={styles.potLabel} numberOfLines={1}>
                          {card.label}
                        </Text>
                      </View>
                      <Text style={[styles.potAmount, { color: p.bar }]}>
                        {formatMoney(card.value, data?.wallet.currency)}
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
              <View style={styles.activityList}>
                {activityItems.map((item, idx) => {
                  const palette = COLOR_MAP[item.color] ?? COLOR_MAP.neutral;
                  const isIn = item.direction === 'in';
                  const sign = isIn ? '+' : '−';
                  const amountColor = isIn ? '#10B981' : colors.text;
                  const timeStr = formatRelativeTime(item.timestamp);

                  return (
                    <Pressable
                      key={item.id}
                      style={({ pressed }) => [
                        styles.activityRow,
                        idx > 0 && styles.activityBorderTop,
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

                      {/* Amount */}
                      <View style={styles.activityAmountWrap}>
                        <Text style={[styles.activityAmount, { color: amountColor }]}>
                          {sign}{formatMoney(item.amount, item.originalCurrency || data?.wallet.currency)}
                        </Text>
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

      {/* Activity Item Detail Modal */}
      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedItem(null)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
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
                  style={styles.modalDoneBtn}
                  onPress={() => setSelectedItem(null)}
                >
                  <Text style={styles.modalDoneBtnText}>Done</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

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
  headerWithdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: radii.full,
    marginTop: 4,
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

  // Hero Card
  heroCard: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  heroGlowPink: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(242,12,143,0.22)',
  },
  heroGlowWhite: {
    position: 'absolute',
    bottom: -80,
    left: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroContent: {
    alignItems: 'center',
    textAlign: 'center',
    gap: 8,
    position: 'relative',
    zIndex: 1,
  },
  heroLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  heroLabelText: {
    fontFamily: fonts.bold,
    color: '#ffffff',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontFamily: fonts.bold,
    color: '#ffffff',
    fontSize: 36,
    letterSpacing: -0.8,
    lineHeight: 44,
    marginTop: 2,
  },
  pendingChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(245, 158, 11, 0.20)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    marginTop: 2,
  },
  pendingChipText: { fontFamily: fonts.bold, fontSize: 12, color: '#FCD34D' },
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
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
  statusBlocked: {
    backgroundColor: 'rgba(220, 38, 38, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.45)',
  },
  statusChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#FCD34D',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroWithdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    height: 38,
    borderRadius: radii.md,
    marginTop: 8,
  },
  heroWithdrawText: { fontFamily: fonts.bold, fontSize: 13, color: '#083A85' },

  // Breakdown StatCards
  sectionBlock: { gap: spacing.sm },
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
    paddingTop: 14,
    overflow: 'hidden',
    gap: 6,
  },
  potAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  potHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  potIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
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
  potAmount: { fontFamily: fonts.bold, fontSize: 20, letterSpacing: -0.3 },

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

  activityList: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  activityRowPressed: { backgroundColor: c.infoBg },
  activityBorderTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.borderSoft },
  directionCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activityBody: { flex: 1, minWidth: 0, gap: 2 },
  activityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityTitle: {
    flexShrink: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
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
  activityAmountWrap: { flexShrink: 0, alignItems: 'flex-end' },
  activityAmount: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.2 },

  // Quick Links
  menuCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
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

  // Detail Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: 4,
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
