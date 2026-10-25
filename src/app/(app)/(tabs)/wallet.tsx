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
 *   - Quick links (Transactions, Payments, Payroll report)
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { useAuth } from '@/store/auth';
import { getWallet, listWalletMovementsPage, type MovementPage } from '@/features/wallet/api';
import { useMovementPages } from '@/features/wallet/useMovementPages';
import {
  toRole,
  selectWalletStats,
  formatWalletMovement,
  getFilterTags,
  getDirectionFilters,
  matchesDirectionFilter,
  PALETTE,
  COLOR_MAP,
  formatRelativeTime,
  type DashboardRole,
  type DirectionFilter,
  type MoneyItem,
} from '@/features/wallet/moneyView';
import { useAsync } from '@/hooks/useAsync';
import { spacing, radii, fonts, makeStyles, useTheme, onFill } from '@/theme';
import { formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';
import { canUsePaymentsScreen } from '@/features/payments/access';
import { IconTile, SegmentedTabs } from '@/features/photographer/kit';
import { WalletAnalytics } from '@/features/photographer/WalletAnalytics';
import { ClientWalletAnalytics } from '@/features/client/ClientWalletAnalytics';
import { CoordinatorWalletAnalytics } from '@/features/wallet/CoordinatorWalletAnalytics';
import { ClientPaymentsDue } from '@/features/wallet/ClientPaymentsDue';
import { useSharedT } from '@/i18n/sharedStrings';
import { WithdrawMethodPrompt } from '@/features/paymentAccounts/WithdrawMethodPrompt';
import { selectIsShared, useWorkspace } from '@/store/workspace';
import { useTabBarClearance } from '@/hooks/useScrollClearance';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';
import { glassTile } from '@/components/ui/GlassCard';

type Link = { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href };

export default function WalletScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { language } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const clearance = useTabBarClearance();
  const { tr } = useSharedT();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const insets = useSafeAreaInsets();
  // At large text two tiles per row leave "Transactions" too little width and it breaks mid-word: one per row.
  const { fontScale } = useWindowDimensions();

  const { isPhotographer, isCoordinator, isClient, role } = useRole();
  const user = useAuth((s) => s.user);
  // In a workspace the photographer was invited to, the balance and summaries are visible; withdrawing and the activity
  // list (the transaction history) stay with the owner, so they are neither offered nor requested.
  const isShared = useWorkspace(selectIsShared);
  const canWithdraw = (isPhotographer || isCoordinator) && !isShared;

  const [activeFilter, setActiveFilter] = useState('All');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityPage, setActivityPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<MoneyItem | null>(null);
  const [balanceHidden, setBalanceHidden] = useState(true);
  // Photographers get Overview / Analytics / Activity tabs; other roles see every section, as before.
  const [walletTab, setWalletTab] = useState<'overview' | 'analytics' | 'activity'>('overview');
  const PAGE_SIZE = 5;

  useEffect(() => {
    setActivityPage(1);
  }, [activeFilter, directionFilter, activitySearch]);

  // Parallel fetch: wallet summary + recent wallet movements (matching salo-run)
  const fetchData = useCallback(async () => {
    const [wallet, history] = await Promise.all([
      getWallet(),
      // A failed history read is reported, not shown as an empty history. A collaborator never asks for it.
      isShared
        ? Promise.resolve({ m: null as MovementPage | null, failed: false })
        : listWalletMovementsPage(0, 50).then((m) => ({ m, failed: false }), () => ({ m: null as MovementPage | null, failed: true })),
    ]);
    return { wallet, history: history.m, movementsFailed: history.failed };
  }, [isShared]);

  const { data, loading, error, refresh } = useAsync(fetchData);

  // Older ledger pages are appended on request; the first page stays owned by the refresh above.
  const pages = useMovementPages(data?.history);

  const dashboardRole: DashboardRole = toRole(
    role || user?.customerType || data?.wallet?.customerType,
  );

  const stats = useMemo(() => {
    if (!data?.wallet) return null;
    return selectWalletStats(data.wallet, dashboardRole);
  }, [data?.wallet, dashboardRole, language]);

  const filterTags = useMemo(() => getFilterTags(dashboardRole), [dashboardRole]);

  const filteredActivityItems = useMemo(() => {
    if (!data?.history) return [];
    const q = activitySearch.trim().toLowerCase();
    const items: MoneyItem[] = [];
    for (const m of pages.items) {
      const item = formatWalletMovement(m, dashboardRole);
      if (!item) continue;
      if (activeFilter !== 'All' && item.tag !== activeFilter) continue;
      if (!matchesDirectionFilter({ direction: item.direction, category: item.sourceType }, directionFilter)) continue;
      if (q) {
        const match =
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          item.tag.toLowerCase().includes(q) ||
          String(item.amount).includes(q);
        if (!match) continue;
      }
      items.push(item);
    }
    return items;
  }, [data?.history, pages.items, dashboardRole, activeFilter, directionFilter, activitySearch, language]);

  // The overview preview ignores the Activity tab's filters: it is simply the latest movements.
  const recentItems = useMemo(() => {
    const out: MoneyItem[] = [];
    for (const m of pages.items) {
      const item = formatWalletMovement(m, dashboardRole);
      if (item) out.push(item);
      if (out.length === 3) break;
    }
    return out;
  }, [pages.items, dashboardRole, language]);

  const totalPages = Math.max(1, Math.ceil(filteredActivityItems.length / PAGE_SIZE));
  const safePage = Math.min(activityPage, totalPages);
  const paginatedActivityItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredActivityItems.slice(start, start + PAGE_SIZE);
  }, [filteredActivityItems, safePage]);

  const links: Link[] = isShared ? [] : [
    { label: 'Transactions', icon: 'swap-horizontal-outline', href: '/transactions' as Href },
    // Photographers receive payments, they do not make them: no Payments screen for them.
    ...(canUsePaymentsScreen(role)
      ? [{ label: 'Payments', icon: 'card-outline' as const, href: '/payments' as Href }]
      : []),
    { label: 'Payment accounts', icon: 'wallet-outline', href: '/payment-accounts' as Href },
    ...(isPhotographer
      ? [{ label: 'Payroll report', icon: 'bar-chart-outline' as const, href: '/payroll' as Href }]
      : []),
  ];

  const visibleCards = stats?.cards.filter((c) => !c.hidden) ?? [];
  // The pending row appears only when the wallet reports a pending figure (a reported 0 still shows); no figure is never drawn as $0.00.
  const pendingLabel = stats?.pendingChip?.label ?? 'Pending release';
  const pendingValue = stats?.pendingChip?.value ?? 0;
  // Photographers, clients and coordinators get the sectioned wallet, each with an Analytics tab drawn from their own
  // figures (earnings, spending, or the coordinator's balance and event revenue).
  const tabbed = isPhotographer || !!isClient || isCoordinator;
  const showOverview = !tabbed || walletTab === 'overview';
  const showAnalytics = tabbed && walletTab === 'analytics';
  const showActivity = !tabbed || walletTab === 'activity';

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
          contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md, paddingBottom: clearance }]}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={refresh}
              tintColor={colors.primary}
              progressViewOffset={topBarHeight}
            />
          }
        >
          {/* A failed refresh keeps the last balance on screen; say so instead of presenting it as current. */}
          {error && data ? (
            <View style={styles.suspensionBanner} accessibilityRole="alert">
              <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
              <View style={styles.suspensionContent}>
                <Text style={styles.suspensionTitle}>Could not refresh your wallet</Text>
                <Text style={styles.suspensionDate}>The balance below is the last one we received. Pull down to try again.</Text>
              </View>
            </View>
          ) : null}

          {/* Suspension warning banner (salo-run parity) */}
          {data?.wallet?.status === 'SUSPENDED' || data?.wallet?.suspensionReason ? (
            <View style={styles.suspensionBanner}>
              <Ionicons name="alert-circle" size={18} color={colors.warning} />
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

          {tabbed ? (
            <View style={styles.walletTabs}>
              <SegmentedTabs
                label="Wallet sections"
                value={walletTab}
                onChange={setWalletTab}
                tabs={[
                  { key: 'overview', label: 'Overview' },
                  { key: 'analytics' as const, label: 'Analytics' },
                  ...(isShared ? [] : [{ key: 'activity' as const, label: 'Activity' }]),
                ]}
              />
            </View>
          ) : null}

          {/* MoneyHero Card (Clean solid card — single authoritative wallet header) */}
          {showOverview && stats && (
            <View style={[styles.heroCard, tabbed && styles.heroCardCompact]}>
              <View style={[styles.heroContent, tabbed && styles.heroContentCompact]}>
                <View style={styles.heroTopRow}>
                  <View style={styles.heroLabelPill}>
                    <Ionicons name="wallet-outline" size={13} color={colors.primary} />
                    <Text style={styles.heroLabelText}>{stats.hero.label}</Text>
                  </View>

                  <Pressable
                    style={styles.privacyToggleBtn}
                    onPress={() => setBalanceHidden((v) => !v)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={balanceHidden ? 'Show balances' : 'Hide balances'}
                  >
                    <Ionicons
                      name={balanceHidden ? 'eye-outline' : 'eye-off-outline'}
                      size={14}
                      color={colors.textMuted}
                    />
                    <Text style={styles.privacyToggleText}>
                      {tr(balanceHidden ? 'Show' : 'Hide')}
                    </Text>
                  </Pressable>
                </View>

                {/* Photographers: amount on the left and Withdraw beside it, as in the prototype, so the hero is a row and not a tall stack. */}
                <View style={tabbed ? styles.heroRow : undefined}>
                  <Text
                    style={[styles.heroAmount, tabbed && styles.heroAmountCompact]}
                    numberOfLines={tabbed ? 1 : undefined}
                    adjustsFontSizeToFit={tabbed}
                    minimumFontScale={0.6}
                  >
                    {balanceHidden
                      ? `${data?.wallet?.currency ? data.wallet.currency + ' ' : '$ '}••••••`
                      : formatPrice(stats.hero.value, data?.wallet.currency)}
                  </Text>
                  {tabbed && canWithdraw ? (
                    <Pressable
                      style={({ pressed }) => [styles.heroWithdrawBtn, styles.heroWithdrawInline, pressed && { opacity: 0.88 }]}
                      onPress={() => router.push('/withdraw' as Href)}
                      accessibilityRole="button"
                      accessibilityLabel="Withdraw funds"
                    >
                      <Ionicons name="cash-outline" size={15} color={onFill} />
                      <Text style={styles.heroWithdrawText} maxFontSizeMultiplier={1.6}>
                        Withdraw funds
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {tabbed && stats.pendingChip ? (
                  <View
                    style={styles.pendingStrip}
                    accessible
                    accessibilityLabel={`${pendingLabel}, ${
                      balanceHidden ? 'hidden' : formatPrice(pendingValue, data?.wallet.currency)
                    }, not included in your available balance`}
                  >
                    <Ionicons name="time-outline" size={15} color={colors.warning} />
                    <Text style={styles.pendingStripLabel} maxFontSizeMultiplier={1.6}>
                      {tr(pendingLabel)}
                    </Text>
                    <Text style={styles.pendingStripAmount} numberOfLines={1} maxFontSizeMultiplier={1.6}>
                      {balanceHidden ? '••••' : formatPrice(pendingValue, data?.wallet.currency)}
                    </Text>
                    <Text style={styles.pendingStripNote} numberOfLines={2} maxFontSizeMultiplier={1.6}>
                      Not in available balance
                    </Text>
                  </View>
                ) : stats.pendingChip && stats.pendingChip.value > 0 ? (
                  <View style={[styles.pendingChip, tabbed && styles.heroChipStart]}>
                    <Ionicons name="time-outline" size={12} color={colors.warning} />
                    <Text style={styles.pendingChipText}>
                      {tr(stats.pendingChip.label)}:{' '}
                      {balanceHidden
                        ? '••••'
                        : formatPrice(stats.pendingChip.value, data?.wallet.currency)}
                    </Text>
                  </View>
                ) : null}

                {stats.status !== 'ACTIVE' ? (
                  <View
                    style={[
                      styles.statusChip,
                      tabbed && styles.heroChipStart,
                      stats.status === 'SUSPENDED' ? styles.statusSuspended : styles.statusBlocked,
                    ]}
                  >
                    <Ionicons name="shield-outline" size={12} color={colors.warning} />
                    <Text style={styles.statusChipText}>{tr(`Wallet ${stats.status.toLowerCase()}`)}</Text>
                  </View>
                ) : null}

                {canWithdraw && !tabbed ? (
                  <Pressable
                    style={({ pressed }) => [styles.heroWithdrawBtn, pressed && { opacity: 0.88 }]}
                    onPress={() => router.push('/withdraw' as Href)}
                  >
                    <Ionicons name="cash-outline" size={15} color={onFill} />
                    <Text style={styles.heroWithdrawText}>{tr('Withdraw funds')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          )}

          {/* Quick Links Menu (Top placement for instant access without scrolling) */}
          {showOverview && !tabbed ? (
          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>{tr('Quick links')}</Text>
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
                  <Text style={styles.menuLabel}>{tr(l.label)}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
          ) : null}

          {showAnalytics ? (
            // The analytics blocks carry their own side margins, so cancel the scroll's padding.
            <View style={styles.walletBleed}>
              {isPhotographer ? (
                <WalletAnalytics wallet={data?.wallet ?? null} />
              ) : isCoordinator ? (
                <CoordinatorWalletAnalytics wallet={data?.wallet ?? null} />
              ) : (
                <ClientWalletAnalytics wallet={data?.wallet ?? null} />
              )}
            </View>
          ) : null}

          {/* Clients: what is still owed, with its own Pay now. */}
          {showOverview && isClient ? (
            // The kit blocks carry their own side margins, so cancel the scroll's padding.
            <View style={styles.walletBleed}>
              <ClientPaymentsDue hidden={balanceHidden} version={data} />
            </View>
          ) : null}

          {/* MoneyStatCards Grid (Sub-balance breakdown) */}
          {showOverview && tabbed && visibleCards.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>{isClient ? 'Spending breakdown' : isCoordinator ? 'Balance breakdown' : 'Earnings breakdown'}</Text>
              <View style={styles.rowsCard}>
                {visibleCards.map((card, i) => {
                  const p = PALETTE(colors)[card.color] ?? PALETTE(colors).neutral;
                  return (
                    <View
                      key={card.label}
                      style={[styles.rowItem, i < visibleCards.length - 1 && styles.rowItemDivider]}
                      accessible
                      accessibilityLabel={`${card.label}, ${
                        balanceHidden ? 'hidden' : formatPrice(card.value, data?.wallet.currency)
                      }`}
                    >
                      <View style={[styles.rowTile, { backgroundColor: p.tint }]}>
                        <Ionicons name={p.icon as keyof typeof Ionicons.glyphMap} size={15} color={p.bar} />
                      </View>
                      <Text style={styles.rowLabel} numberOfLines={3}>
                        {card.label}
                      </Text>
                      <Text style={styles.rowValue} numberOfLines={1}>
                        {balanceHidden ? '••••' : formatPrice(card.value, data?.wallet.currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* A collaborator does not see the activity list: it is the owner's transaction history. */}
          {showOverview && tabbed && isShared ? (
            <Text style={styles.recentNote} accessibilityRole="text">Withdrawals and the transaction history stay with the workspace owner.</Text>
          ) : null}

          {/* The latest movements, then the places money is managed. */}
          {showOverview && tabbed && !isShared ? (
            <>
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>{tr('Recent activity')}</Text>
                  <Pressable
                    onPress={() => setWalletTab('activity')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="View all activity"
                    style={styles.viewAll}
                  >
                    <Text style={styles.seeAllText}>{tr('View all')}</Text>
                  </Pressable>
                </View>
                {data?.movementsFailed ? (
                  <View style={styles.rowsCard}>
                    <Text style={styles.recentNote} accessibilityRole="alert">
                      {tr('Could not load your history. Pull down to try again.')}
                    </Text>
                  </View>
                ) : recentItems.length === 0 ? (
                  <View style={styles.rowsCard}>
                    <Text style={styles.recentNote}>{tr('No movements yet.')}</Text>
                  </View>
                ) : (
                  <View style={styles.rowsCard}>
                    {recentItems.map((item, i) => {
                      const palette = COLOR_MAP(colors)[item.color] ?? COLOR_MAP(colors).neutral;
                      const isIn = item.direction === 'in';
                      const amount = balanceHidden
                        ? `${isIn ? '+' : '−'}••••`
                        : `${isIn ? '+' : '−'}${formatPrice(item.amount, item.originalCurrency || data?.wallet.currency)}`;
                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => setSelectedItem(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`${item.title}, ${amount}, ${formatRelativeTime(item.timestamp)}`}
                          style={({ pressed }) => [styles.rowItem, i < recentItems.length - 1 && styles.rowItemDivider, pressed && { opacity: 0.85 }]}
                        >
                          <View style={[styles.rowTile, { backgroundColor: palette.bg }]}>
                            <Ionicons name={isIn ? 'arrow-down' : 'arrow-up'} size={15} color={palette.text} />
                          </View>
                          <View style={styles.rowBody}>
                            <Text style={styles.rowLabel} numberOfLines={3}>
                              {item.title}
                            </Text>
                            <Text style={styles.rowMeta} numberOfLines={3}>
                              {item.tag} · {formatRelativeTime(item.timestamp)}
                            </Text>
                          </View>
                          <Text style={[styles.rowValue, isIn && { color: colors.success }]} numberOfLines={1}>
                            {amount}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.tiles}>
                {links.map((l) => (
                  <Pressable
                    key={l.label}
                    onPress={() => router.push(l.href)}
                    accessibilityRole="button"
                    accessibilityLabel={l.label === 'Payroll report' ? 'Export earnings report' : l.label}
                    style={({ pressed }) => [styles.tile, fontScale > 1.3 && { flexBasis: '100%' }, pressed && { opacity: 0.85 }]}
                  >
                    <IconTile icon={l.icon} tone="primary" size={30} />
                    <Text style={styles.tileText} numberOfLines={2} maxFontSizeMultiplier={1.6}>
                      {l.label === 'Payroll report' ? 'Earnings report' : l.label}
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          {showOverview && !tabbed && visibleCards.length > 0 && (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>
                {tr(
                  dashboardRole === 'photographer'
                    ? 'Earnings breakdown'
                    : dashboardRole === 'client'
                      ? 'Spending breakdown'
                      : 'Balance breakdown'
                )}
              </Text>
              <View style={styles.potGrid}>
                {visibleCards.map((card) => {
                  const p = PALETTE(colors)[card.color] ?? PALETTE(colors).neutral;
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
                        <Text style={styles.potLabel} numberOfLines={3}>
                          {card.label}
                        </Text>
                      </View>
                      <Text style={styles.potAmount}>
                        {balanceHidden
                          ? '••••'
                          : formatPrice(card.value, data?.wallet.currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Embedded ActivityFeed (salo-run parity) */}
          {showActivity ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.activityTitleWrap}>
                <View style={styles.activityIconWrap}>
                  <Ionicons name="swap-horizontal-outline" size={15} color={colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>{tr('Activity')}</Text>
              </View>
              <Pressable
                onPress={() => router.push('/transactions' as Href)}
                hitSlop={8}
              >
                <Text style={styles.seeAllText}>{tr('See all')}</Text>
              </Pressable>
            </View>

            {/* Direction Filter Pills */}
            <View style={styles.directionFilterRow}>
              {getDirectionFilters(dashboardRole).map((d) => {
                const isSelected = directionFilter === d.value;
                return (
                  <Pressable
                    key={d.value}
                    onPress={() => setDirectionFilter(d.value)}
                    style={[styles.directionPill, isSelected && styles.directionPillActive]}
                  >
                    <Text
                      style={[
                        styles.directionPillText,
                        isSelected && styles.directionPillTextActive,
                      ]}
                    >
                      {tr(d.label)}
                    </Text>
                  </Pressable>
                );
              })}
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
                      {tr(tag)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Search Input for Activity */}
            <View style={styles.activitySearchWrap}>
              <Input
                placeholder={tr('Search activity by title or description...')}
                value={activitySearch}
                onChangeText={setActivitySearch}
                leftElement={
                  <Ionicons
                    name="search-outline"
                    size={16}
                    color={colors.textMuted}
                    style={{ marginLeft: spacing.sm, marginRight: spacing.xs }}
                  />
                }
              />
            </View>

            {/* Movements List / Empty State */}
            {filteredActivityItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyCardTitle}>{tr(data?.movementsFailed ? 'Could not load your history' : 'No movements found')}</Text>
                <Text style={styles.emptyCardDesc}>
                  {data?.movementsFailed
                    ? tr('Pull down to try again. Your balance above is still current.')
                    : activitySearch
                    ? `No transactions match "${activitySearch}".`
                    : activeFilter === 'All'
                      ? tr('Payouts, tips, bonuses, and payments will appear here.')
                      : `No ${activeFilter.toLowerCase()} transactions recorded yet.`}
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.activityCardGroup}>
                  {paginatedActivityItems.map((item, idx) => {
                    const palette = COLOR_MAP(colors)[item.color] ?? COLOR_MAP(colors).neutral;
                    const isIn = item.direction === 'in';
                    const sign = isIn ? '+' : '−';
                    const amountColor = isIn ? colors.success : colors.text;
                    const timeStr = formatRelativeTime(item.timestamp);
                    const isLast = idx === paginatedActivityItems.length - 1;

                    const displayAmount = balanceHidden
                      ? `${sign}$ ••••`
                      : `${sign}${formatPrice(item.amount, item.originalCurrency || data?.wallet.currency)}`;

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
                            <Text style={styles.activityTitle} numberOfLines={2}>
                              {item.title}
                            </Text>
                            <View style={[styles.tagBadge, { backgroundColor: palette.bg }]}>
                              <Text style={[styles.tagBadgeText, { color: palette.text }]}>
                                {tr(item.tag)}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.activityMetaRow}>
                            {item.subtitle ? (
                              <>
                                <Text style={styles.activitySubtitle} numberOfLines={2}>
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

                {/* Pagination Controls */}
                <View style={styles.paginationRow}>
                  <Text style={styles.paginationInfo}>
                    Showing {(safePage - 1) * PAGE_SIZE + 1}–
                    {Math.min(safePage * PAGE_SIZE, filteredActivityItems.length)} of {filteredActivityItems.length}
                  </Text>
                  {totalPages > 1 ? (
                    <View style={styles.paginationButtons}>
                      <Pressable
                        onPress={() => setActivityPage((p) => Math.max(1, p - 1))}
                        disabled={safePage <= 1}
                        style={[styles.pageNavBtn, safePage <= 1 && styles.pageNavBtnDisabled]}
                        hitSlop={6}
                      >
                        <Ionicons
                          name="chevron-back"
                          size={14}
                          color={safePage <= 1 ? colors.textMuted : colors.text}
                        />
                        <Text
                          style={[
                            styles.pageNavBtnText,
                            safePage <= 1 && styles.pageNavBtnTextDisabled,
                          ]}
                        >
                          Prev
                        </Text>
                      </Pressable>

                      <View style={styles.pageIndicatorPill}>
                        <Text style={styles.pageIndicatorText}>
                          {safePage} / {totalPages}
                        </Text>
                      </View>

                      <Pressable
                        onPress={() => setActivityPage((p) => Math.min(totalPages, p + 1))}
                        disabled={safePage >= totalPages}
                        style={[styles.pageNavBtn, safePage >= totalPages && styles.pageNavBtnDisabled]}
                        hitSlop={6}
                      >
                        <Text
                          style={[
                            styles.pageNavBtnText,
                            safePage >= totalPages && styles.pageNavBtnTextDisabled,
                          ]}
                        >
                          Next
                        </Text>
                        <Ionicons
                          name="chevron-forward"
                          size={14}
                          color={safePage >= totalPages ? colors.textMuted : colors.text}
                        />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
                {pages.hasMore ? (
                  <Pressable
                    onPress={pages.loadMore}
                    disabled={pages.loadingMore}
                    accessibilityRole="button"
                    accessibilityLabel="Load older transactions"
                    accessibilityState={{ disabled: pages.loadingMore, busy: pages.loadingMore }}
                    style={[styles.pageNavBtn, { alignSelf: 'center', minHeight: 44, justifyContent: 'center', marginTop: 4 }]}
                  >
                    <Text style={styles.pageNavBtnText}>{pages.loadingMore ? 'Loading older...' : 'Load older transactions'}</Text>
                  </Pressable>
                ) : null}
                {pages.moreError ? <Text style={styles.paginationInfo} accessibilityRole="alert">{pages.moreError}</Text> : null}
              </>
            )}
          </View>
          ) : null}
        </ScrollView>
      )}

      {/* Activity Item Detail Bottom Sheet */}
      <Modal
        visible={Boolean(selectedItem)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <GlassScrim onPress={() => setSelectedItem(null)} style={styles.modalSheetOverlay}>
        <GlassSheetHost
            style={[
              styles.modalSheet,
              { paddingBottom: Math.max(insets.bottom + 16, 28) },
            ]}
          >
            <View style={styles.modalHandle} />

            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderTitle}>{tr('Transaction details')}</Text>
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
                      { color: selectedItem.direction === 'in' ? colors.success : colors.text },
                    ]}
                  >
                    {selectedItem.direction === 'in' ? '+' : '−'}
                    {formatPrice(selectedItem.amount, selectedItem.originalCurrency || data?.wallet.currency)}
                  </Text>
                  <Text style={styles.modalHeroTitle}>{tr(selectedItem.title)}</Text>
                </View>

                {/* Details Breakdown */}
                <View style={styles.modalDetailsList}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{tr('Category')}</Text>
                    <View
                      style={[
                        styles.tagBadge,
                        {
                          backgroundColor:
                            COLOR_MAP(colors)[selectedItem.color]?.bg ?? COLOR_MAP(colors).neutral.bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tagBadgeText,
                          {
                            color:
                              COLOR_MAP(colors)[selectedItem.color]?.text ?? COLOR_MAP(colors).neutral.text,
                          },
                        ]}
                      >
                        {tr(selectedItem.tag)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{tr('Direction')}</Text>
                    <Text style={styles.detailValue}>
                      {tr(selectedItem.direction === 'in' ? 'Credit (Incoming)' : 'Debit (Outgoing)')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{tr('Date & Time')}</Text>
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
          </GlassSheetHost>
          </GlassScrim>
      </Modal>

      <TopBar />
      {/* Photographers and coordinators with no withdrawal method are asked to add one every time they open the wallet. */}
      {canWithdraw ? <WithdrawMethodPrompt role={role} /> : null}
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
  retryBtnText: { fontFamily: fonts.bold, fontSize: 13, color: c.textOnPrimary },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.lg },

  heroTopRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  privacyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    height: 32,
    borderRadius: radii.full,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  privacyToggleText: { fontFamily: fonts.bold, fontSize: 12, color: c.textMuted },

  suspensionBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
    borderRadius: radii.lg,
    backgroundColor: c.warningBg,
    borderWidth: 1,
    borderColor: c.warningLine,
  },
  suspensionContent: { flex: 1, gap: 2 },
  suspensionTitle: { fontFamily: fonts.bold, fontSize: 13, color: c.warning },
  suspensionDate: { fontFamily: fonts.regular, fontSize: 12, color: c.warning },

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
  heroCardCompact: { padding: spacing.md + 2, borderRadius: radii.lg, borderColor: c.border },
  heroContentCompact: { alignItems: 'stretch', gap: 10 },
  pendingStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: 2,
    paddingTop: spacing.sm + 2,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  pendingStripLabel: { fontFamily: fonts.bold, fontSize: 13, color: c.textSoft },
  pendingStripAmount: { fontFamily: fonts.bold, fontSize: 14, color: c.text },
  pendingStripNote: { flexShrink: 1, flexBasis: 120, flexGrow: 1, fontSize: 12, color: c.textMuted, textAlign: 'right' },
  rowsCard: {
    backgroundColor: c.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    overflow: 'hidden',
  },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, minHeight: 52 },
  rowItemDivider: { borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  rowTile: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: c.text },
  rowMeta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  rowValue: { fontFamily: fonts.bold, fontSize: 14, color: c.text, maxWidth: '45%' },
  recentNote: { padding: spacing.md, fontSize: 13, color: c.textMuted },
  viewAll: { minHeight: 44, justifyContent: 'center' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    flexGrow: 1,
    flexBasis: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  tileText: { flex: 1, minWidth: 0, fontFamily: fonts.bold, fontSize: 13, color: c.text },
  heroChipStart: { alignSelf: 'flex-start' },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroAmountCompact: { flex: 1, fontSize: 30, lineHeight: 38, textAlign: 'left' },
  heroWithdrawInline: { marginTop: 0, flexShrink: 0 },
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
    color: c.link,
    fontSize: 12,
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
    backgroundColor: c.warningSoft,
    borderWidth: 1,
    borderColor: c.warningLine,
    marginTop: 2,
  },
  pendingChipText: { fontFamily: fonts.bold, fontSize: 12, color: c.warning },
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
    backgroundColor: c.warningSoft,
    borderWidth: 1,
    borderColor: c.warningLine,
  },
  statusBlocked: {
    backgroundColor: c.errorSoft,
    borderWidth: 1,
    borderColor: c.errorLine,
  },
  statusChipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.warning,
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
  heroWithdrawText: { fontFamily: fonts.bold, fontSize: 13, color: c.textOnPrimary },

  // Breakdown StatCards
  walletBleed: { marginHorizontal: -spacing.lg },
  walletTabs: { marginBottom: spacing.md, marginHorizontal: -spacing.lg },
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
    fontSize: 12,
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
  seeAllText: { fontFamily: fonts.bold, fontSize: 13, color: c.link },

  directionFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  directionPill: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Selected = the same brand blue as every other selected control. `c.text` made a bright white pill in dark.
  directionPillActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  directionPillText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  directionPillTextActive: {
    color: c.textOnPrimary,
  },

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
  filterPillTextActive: { color: c.textOnPrimary },

  activitySearchWrap: {
    marginTop: 2,
    marginBottom: 2,
  },

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
    fontSize: 12,
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
  activityBullet: { fontSize: 12, color: c.textMuted },
  activityTime: { fontFamily: fonts.regular, fontSize: 12, color: c.textMuted },
  activityRightCol: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  activityAmountWrap: { flexShrink: 0, alignItems: 'flex-end' },
  activityAmount: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: -0.2 },

  // Pagination Controls
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 8,
  },
  paginationInfo: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  pageNavBtnDisabled: {
    opacity: 0.4,
  },
  pageNavBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.text,
  },
  pageNavBtnTextDisabled: {
    color: c.textMuted,
  },
  pageIndicatorPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: c.infoBg,
  },
  pageIndicatorText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.link,
  },

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
    ...glassTile(c),
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
  modalDoneBtnText: { fontFamily: fonts.bold, fontSize: 15, color: c.textOnPrimary },
}));
