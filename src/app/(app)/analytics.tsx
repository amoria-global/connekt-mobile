import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, Stack } from 'expo-router';
import {
  ActivityIndicator,
  Image as RNImage,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  type AnalyticsPeriod,
  type CoordinatorAnalytics,
  type CoordinatorPhotographer,
  type CustomerAnalytics,
  type DashboardActivity,
  type PerformancePoint,
  type PhotographerAnalytics,
  type PhotographerClient,
  type RecentActivity,
  type RecentPayment,
  type RecentPhotographer,
  type RecentTransaction,
  type TrendsMap,
  type PendingPayment,
  getCoordinatorAnalytics,
  getCoordinatorPerformance,
  getCoordinatorPhotographers,
  getCoordinatorRecentActivities,
  getCoordinatorTrends,
  getCoordinatorPendingPayments,
  getCustomerAnalytics,
  getCustomerPerformance,
  getCustomerPhotographers,
  getCustomerRecentActivities,
  getCustomerRecentPayments,
  getCustomerTrends,
  getCustomerPendingPayments,
  getPhotographerAnalytics,
  getPhotographerClients,
  getPhotographerPerformance,
  getPhotographerRecentTransactions,
  getPhotographerTrends,
} from '@/features/analytics/api';
import { useAuth } from '@/store/auth';
import { useRole } from '@/features/auth/role';
import { getWallet } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

// ── Salo-run Time of Day & Dynamic Greetings ────────────────────────────────
const getTimeOfDay = (): 'morning' | 'afternoon' | 'evening' | 'night' => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
};

const GREETINGS: Record<'morning' | 'afternoon' | 'evening' | 'night', string[]> = {
  morning: [
    'Good Morning',
    'Rise and Shine',
    'Beautiful Morning',
    'Lovely Morning',
    'Wonderful Morning',
    'Great Morning',
    'Happy Morning',
    'Blessed Morning',
  ],
  afternoon: [
    'Good Afternoon',
    'Lovely Afternoon',
    'Beautiful Afternoon',
    'Wonderful Afternoon',
    'Great Afternoon',
    'Happy Afternoon',
    'Blessed Afternoon',
    'Amazing Afternoon',
  ],
  evening: [
    'Good Evening',
    'Lovely Evening',
    'Beautiful Evening',
    'Wonderful Evening',
    'Great Evening',
    'Happy Evening',
    'Peaceful Evening',
    'Relaxing Evening',
  ],
  night: [
    'Good Night',
    'Peaceful Night',
    'Lovely Night',
    'Beautiful Night',
    'Wonderful Night',
    'Quiet Night',
    'Restful Night',
    'Starry Night',
  ],
};

const getRoleTagline = (
  role: 'client' | 'photographer' | 'coordinator',
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night',
): string => {
  if (role === 'photographer') {
    switch (timeOfDay) {
      case 'morning': return 'Ready to capture some beautiful moments today?';
      case 'afternoon': return 'Keep up the great work! Your clients love what you do.';
      case 'evening': return 'What a day! Time to review those amazing shots.';
      default: return 'Burning the midnight oil? Your dedication is inspiring!';
    }
  }
  if (role === 'coordinator') {
    switch (timeOfDay) {
      case 'morning': return 'Ready to manage your upcoming events?';
      case 'afternoon': return 'Perfect time to check your live stream earnings!';
      case 'evening': return "Time to review today's event performance!";
      default: return 'Late night planning? Your events dashboard awaits!';
    }
  }
  // Client
  switch (timeOfDay) {
    case 'morning': return 'Ready to discover amazing photographers for your next event?';
    case 'afternoon': return 'Perfect time to browse through your galleries!';
    case 'evening': return "Time to relive today's beautiful moments!";
    default: return 'Late night browsing? Your galleries await!';
  }
};

const PERIOD_TABS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const user = useAuth((s) => s.user);
  const { isClient, isCoordinator, isPhotographer } = useRole();
  const wallet = useAsync(useCallback(() => getWallet(), []));
  const currency = wallet.data?.currency;

  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customApplied, setCustomApplied] = useState(false);

  // Time-of-day greeting (salo-run parity)
  const timeOfDay = useMemo(() => getTimeOfDay(), []);
  const greeting = useMemo(() => {
    const list = GREETINGS[timeOfDay];
    return list[0];
  }, [timeOfDay]);

  const activeRoleKey: 'client' | 'photographer' | 'coordinator' = isPhotographer
    ? 'photographer'
    : isCoordinator
      ? 'coordinator'
      : 'client';
  const tagline = useMemo(() => getRoleTagline(activeRoleKey, timeOfDay), [activeRoleKey, timeOfDay]);

  // ── Client state ─────────────────────────────────────────────────────────
  const [clientData, setClientData] = useState<CustomerAnalytics | null>(null);
  const [clientPendingPayments, setClientPendingPayments] = useState<PendingPayment[]>([]);
  const [clientActivities, setClientActivities] = useState<RecentActivity[]>([]);
  const [clientPhotographers, setClientPhotographers] = useState<RecentPhotographer[]>([]);
  const [clientPayments, setClientPayments] = useState<RecentPayment[]>([]);
  const [clientPerf, setClientPerf] = useState<PerformancePoint[]>([]);

  // ── Coordinator state ─────────────────────────────────────────────────────
  const [coordData, setCoordData] = useState<CoordinatorAnalytics | null>(null);
  const [coordPendingPayments, setCoordPendingPayments] = useState<PendingPayment[]>([]);
  const [coordPhotographers, setCoordPhotographers] = useState<CoordinatorPhotographer[]>([]);
  const [coordActivities, setCoordActivities] = useState<DashboardActivity[]>([]);
  const [coordPerf, setCoordPerf] = useState<PerformancePoint[]>([]);

  // ── Photographer state ────────────────────────────────────────────────────
  const [photogData, setPhotogData] = useState<PhotographerAnalytics | null>(null);
  const [photogClients, setPhotogClients] = useState<PhotographerClient[]>([]);
  const [photogTransactions, setPhotogTransactions] = useState<RecentTransaction[]>([]);
  const [photogPerf, setPhotogPerf] = useState<PerformancePoint[]>([]);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [trends, setTrends] = useState<TrendsMap>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // PayNowSheet state
  const [payNowPayment, setPayNowPayment] = useState<PendingPayment | null>(null);
  const [showPayNow, setShowPayNow] = useState(false);

  const load = useCallback(async (isPull = false) => {
    if (isPull) setRefreshing(true);
    else setLoading(true);

    const from = period === 'custom' && customApplied && customFrom ? customFrom : undefined;
    const to = period === 'custom' && customApplied && customTo ? customTo : undefined;

    try {
      if (isClient) {
        const [a, t, pending, activities, photographers, payments, perf] = await Promise.allSettled([
          getCustomerAnalytics(),
          getCustomerTrends(period, from, to),
          getCustomerPendingPayments(),
          getCustomerRecentActivities(6),
          getCustomerPhotographers(5),
          getCustomerRecentPayments(5),
          getCustomerPerformance(period, from, to),
        ]);
        if (a.status === 'fulfilled') setClientData(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
        if (pending.status === 'fulfilled') setClientPendingPayments(pending.value);
        if (activities.status === 'fulfilled') setClientActivities(activities.value);
        if (photographers.status === 'fulfilled') setClientPhotographers(photographers.value);
        if (payments.status === 'fulfilled') setClientPayments(payments.value);
        if (perf.status === 'fulfilled') setClientPerf(perf.value);
      } else if (isCoordinator) {
        const [a, t, pending, photographers, activities, perf] = await Promise.allSettled([
          getCoordinatorAnalytics(),
          getCoordinatorTrends(period, from, to),
          getCoordinatorPendingPayments(),
          getCoordinatorPhotographers(5),
          getCoordinatorRecentActivities(6),
          getCoordinatorPerformance(period, from, to),
        ]);
        if (a.status === 'fulfilled') setCoordData(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
        if (pending.status === 'fulfilled') setCoordPendingPayments(pending.value);
        if (photographers.status === 'fulfilled') setCoordPhotographers(photographers.value);
        if (activities.status === 'fulfilled') setCoordActivities(activities.value);
        if (perf.status === 'fulfilled') setCoordPerf(perf.value);
      } else if (isPhotographer) {
        const [a, t, clients, transactions, perf] = await Promise.allSettled([
          getPhotographerAnalytics(),
          getPhotographerTrends(period, from, to),
          getPhotographerClients(5),
          getPhotographerRecentTransactions(5),
          getPhotographerPerformance(period, from, to),
        ]);
        if (a.status === 'fulfilled') setPhotogData(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
        if (clients.status === 'fulfilled') setPhotogClients(clients.value);
        if (transactions.status === 'fulfilled') setPhotogTransactions(transactions.value);
        if (perf.status === 'fulfilled') setPhotogPerf(perf.value);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isClient, isCoordinator, isPhotographer, period, customApplied, customFrom, customTo]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    load(true);
  }, [load]);

  // Current timeframe label (matches salo-run periodLabel)
  const periodLabel = useMemo(() => {
    if (period === 'today') return 'yesterday';
    if (period === 'month') return 'last month';
    if (period === 'custom' && customFrom && customTo) return `${customFrom} - ${customTo}`;
    return 'last week';
  }, [period, customFrom, customTo]);

  // ── Salo-run StatCards Definition ──────────────────────────────────────────
  const statCards = useMemo(() => {
    if (isClient) {
      return [
        {
          title: 'Total Spent',
          value: formatMoney(clientData?.totalSpent || 0, currency),
          percentage: trends.totalSpent?.percentage,
          trend: trends.totalSpent?.direction ?? 'up',
          iconName: 'wallet-outline' as const,
          accentColor: '#083A85',
        },
        {
          title: 'Pending',
          value: formatMoney(clientData?.pendingAmount || 0, currency),
          percentage: trends.pending?.percentage,
          trend: trends.pending?.direction ?? 'up',
          iconName: 'time-outline' as const,
          accentColor: '#F59E0B',
          href: '/payments',
        },
        {
          title: 'Bookings',
          value: String(clientData?.totalBookings || 0),
          percentage: trends.events?.percentage,
          trend: trends.events?.direction ?? 'up',
          iconName: 'people-outline' as const,
          accentColor: '#3B82F6',
          href: '/(app)/(tabs)/events',
        },
        {
          title: 'Gifts',
          value: formatMoney(clientData?.gifts || 0, currency),
          percentage: trends.gifts?.percentage,
          trend: trends.gifts?.direction ?? 'up',
          iconName: 'gift-outline' as const,
          accentColor: '#10B981',
        },
        {
          title: 'Favorites',
          value: String(clientData?.bookmarkedPhotographers || 0),
          percentage: trends.photographers?.percentage,
          trend: trends.photographers?.direction ?? 'up',
          iconName: 'star-outline' as const,
          accentColor: '#8B5CF6',
          href: '/photographers',
        },
      ];
    }

    if (isCoordinator) {
      return [
        {
          title: 'Total Revenue',
          value: formatMoney(coordData?.totalRevenue || 0, currency),
          percentage: trends.totalRevenue?.percentage,
          trend: trends.totalRevenue?.direction ?? 'up',
          iconName: 'cash-outline' as const,
          accentColor: '#083A85',
        },
        {
          title: 'Pending',
          value: formatMoney(coordData?.totalPending || 0, currency),
          percentage: trends.totalPending?.percentage,
          trend: trends.totalPending?.direction ?? 'up',
          iconName: 'time-outline' as const,
          accentColor: '#F59E0B',
          href: '/payments',
        },
        {
          title: 'Events',
          value: String(coordData?.totalEvents || 0),
          percentage: trends.totalEvents?.percentage,
          trend: trends.totalEvents?.direction ?? 'up',
          iconName: 'calendar-outline' as const,
          accentColor: '#3B82F6',
          href: '/(app)/(tabs)/events',
        },
        {
          title: 'Total Paid',
          value: formatMoney(coordData?.totalPaid || 0, currency),
          percentage: trends.totalPaid?.percentage,
          trend: trends.totalPaid?.direction ?? 'up',
          iconName: 'card-outline' as const,
          accentColor: '#10B981',
        },
        {
          title: 'Photographers',
          value: String(coordData?.totalPhotographers || 0),
          percentage: trends.totalPhotographers?.percentage,
          trend: trends.totalPhotographers?.direction ?? 'up',
          iconName: 'camera-outline' as const,
          accentColor: '#8B5CF6',
          href: '/photographers',
        },
      ];
    }

    if (isPhotographer) {
      return [
        {
          title: 'Total Earnings',
          value: formatMoney(photogData?.totalEarnings || 0, currency),
          percentage: trends.totalEarnings?.percentage,
          trend: trends.totalEarnings?.direction ?? 'up',
          iconName: 'cash-outline' as const,
          accentColor: '#083A85',
          href: '/(app)/(tabs)/wallet',
        },
        {
          title: 'Pending',
          value: formatMoney(photogData?.pendingPayments || 0, currency),
          percentage: trends.pending?.percentage,
          trend: trends.pending?.direction ?? 'up',
          iconName: 'time-outline' as const,
          accentColor: '#F59E0B',
        },
        {
          title: 'Clients',
          value: String(photogData?.totalClients || 0),
          percentage: trends.clients?.percentage,
          trend: trends.clients?.direction ?? 'up',
          iconName: 'people-outline' as const,
          accentColor: '#3B82F6',
          href: '/clients',
        },
        {
          title: 'Bonuses',
          value: formatMoney(photogData?.bonuses || 0, currency),
          percentage: trends.bonuses?.percentage,
          trend: trends.bonuses?.direction ?? 'up',
          iconName: 'gift-outline' as const,
          accentColor: '#10B981',
        },
        {
          title: 'Rating',
          value: `${(photogData?.averageRating ?? 5).toFixed(1)}/5`,
          percentage: trends.rating?.percentage,
          trend: trends.rating?.direction ?? 'up',
          iconName: 'star-outline' as const,
          accentColor: '#8B5CF6',
        },
      ];
    }

    return [];
  }, [isClient, isCoordinator, isPhotographer, clientData, coordData, photogData, trends, currency]);

  // Active performance data for chart
  const activePerf = isClient
    ? clientPerf
    : isCoordinator
      ? coordPerf
      : isPhotographer
        ? photogPerf
        : [];

  // Active pending payments (for Client and Coordinator)
  const pendingPaymentsList = isClient
    ? clientPendingPayments
    : isCoordinator
      ? coordPendingPayments
      : [];
  const totalPendingAmount = useMemo(
    () => pendingPaymentsList.reduce((sum, p) => sum + (p.amount - p.paidAmount), 0),
    [pendingPaymentsList],
  );
  const hasFailedPayments = useMemo(
    () => pendingPaymentsList.some((p) => p.status === 'failed'),
    [pendingPaymentsList],
  );

  const handlePayNow = (p: PendingPayment) => {
    setPayNowPayment(p);
    setShowPayNow(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Single Clean Top Bar (No duplicate chevron or title) ─────────── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>Analytics</Text>
        <Pressable
          onPress={() => load()}
          hitSlop={12}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Refresh"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#083A85" />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#083A85"
            colors={['#083A85', '#F20C8F']}
          />
        }
      >
        {/* ── Salo-run Hero Section ───────────────────────────────────────── */}
        <View style={styles.heroWrapper}>
          {/* 3px Top Accent Bar with Brand Gradient */}
          <LinearGradient
            colors={['#083A85', '#F20C8F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.heroTopBar}
          />

          <View style={styles.heroBody}>
            <View style={styles.heroTagRow}>
              <Text style={styles.heroTag}>YOUR DASHBOARD</Text>
            </View>

            <Text style={styles.heroGreeting}>
              {greeting},{' '}
              <Text style={styles.heroName}>{user?.firstName || user?.lastName || 'there'}</Text>
            </Text>

            <Text style={styles.heroTagline}>{tagline}</Text>

            {/* Hero mini-stats card (Exact salo-run hero-stats-card) */}
            <View style={styles.heroMiniStatsCard}>
              {isClient && (
                <>
                  <HeroMiniStatItem
                    label="SPENT"
                    value={formatMoney(clientData?.totalSpent || 0, currency)}
                    color="#083A85"
                  />
                  <View style={styles.heroStatDivider} />
                  <HeroMiniStatItem
                    label="BOOKINGS"
                    value={String(clientData?.totalBookings || 0)}
                    color="#F20C8F"
                  />
                  <View style={styles.heroStatDivider} />
                  <HeroMiniStatItem
                    label="PHOTOS"
                    value={String(clientData?.totalPhotos || 0)}
                    color="#10B981"
                  />
                </>
              )}
              {isPhotographer && (
                <>
                  <HeroMiniStatItem
                    label="EARNINGS"
                    value={formatMoney(photogData?.totalEarnings || 0, currency)}
                    color="#083A85"
                  />
                  <View style={styles.heroStatDivider} />
                  <HeroMiniStatItem
                    label="CLIENTS"
                    value={String(photogData?.totalClients || 0)}
                    color="#F20C8F"
                  />
                  <View style={styles.heroStatDivider} />
                  <HeroMiniStatItem
                    label="RATING"
                    value={`${(photogData?.averageRating ?? 5).toFixed(1)}/5`}
                    color="#10B981"
                  />
                </>
              )}
              {isCoordinator && (
                <>
                  <HeroMiniStatItem
                    label="REVENUE"
                    value={formatMoney(coordData?.totalRevenue || 0, currency)}
                    color="#083A85"
                  />
                  <View style={styles.heroStatDivider} />
                  <HeroMiniStatItem
                    label="EVENTS"
                    value={String(coordData?.totalEvents || 0)}
                    color="#F20C8F"
                  />
                  <View style={styles.heroStatDivider} />
                  <HeroMiniStatItem
                    label="ROSTER"
                    value={String(coordData?.totalPhotographers || 0)}
                    color="#10B981"
                  />
                </>
              )}
            </View>
          </View>
        </View>

        {/* ── Segmented Timeframe Filter Tabs (salo-run .ck-tabs) ─────────── */}
        <View style={styles.filterTabsContainer}>
          {PERIOD_TABS.map((tab) => {
            const isActive = period === tab.value;
            return (
              <Pressable
                key={tab.value}
                onPress={() => {
                  setPeriod(tab.value);
                  if (tab.value !== 'custom') setCustomApplied(false);
                }}
                style={[styles.filterTab, isActive && styles.filterTabActive]}
              >
                <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Custom date range inputs (salo-run mobile-custom-dates) */}
        {period === 'custom' && (
          <View style={styles.customDatesBox}>
            <View style={styles.customDateInputGroup}>
              <Text style={styles.customDateLabel}>From</Text>
              <TextInput
                style={styles.customDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={customFrom}
                onChangeText={(t) => {
                  setCustomFrom(t);
                  setCustomApplied(false);
                }}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.customDateInputGroup}>
              <Text style={styles.customDateLabel}>To</Text>
              <TextInput
                style={styles.customDateInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textMuted}
                value={customTo}
                onChangeText={(t) => {
                  setCustomTo(t);
                  setCustomApplied(false);
                }}
                autoCapitalize="none"
              />
            </View>
            <Pressable
              onPress={() => {
                if (customFrom && customTo) {
                  setCustomApplied(true);
                  load();
                }
              }}
              disabled={!customFrom || !customTo}
              style={[
                styles.customApplyBtn,
                (!customFrom || !customTo) && styles.customApplyBtnDisabled,
              ]}
            >
              <Text style={styles.customApplyBtnText}>Apply</Text>
            </Pressable>
          </View>
        )}

        {/* ── Salo-run StatCards Grid (Top 3px Accent + Squircle Icons) ───── */}
        <View style={styles.statCardsGrid}>
          {statCards.map((card, idx) => (
            <SaloStatCard
              key={`${card.title}-${idx}`}
              title={card.title}
              value={card.value}
              percentage={card.percentage}
              timeframe={periodLabel}
              iconName={card.iconName}
              trend={card.trend}
              accentColor={card.accentColor}
              href={card.href}
              onPress={card.href ? () => router.push(card.href as never) : undefined}
            />
          ))}
        </View>

        {/* ── Pending Payments Banner Alert (salo-run Parity) ─────────────── */}
        {pendingPaymentsList.length > 0 && (
          <View
            style={[
              styles.pendingAlertContainer,
              hasFailedPayments ? styles.pendingAlertFailed : styles.pendingAlertWarning,
            ]}
          >
            <View style={styles.pendingAlertHeader}>
              <View style={styles.pendingAlertTitleRow}>
                <View
                  style={[
                    styles.pendingAlertIconCircle,
                    hasFailedPayments ? styles.pendingIconFailed : styles.pendingIconWarning,
                  ]}
                >
                  <Ionicons
                    name="alert-circle"
                    size={20}
                    color={hasFailedPayments ? '#DC2626' : '#D97706'}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.pendingAlertTitle,
                      { color: hasFailedPayments ? '#DC2626' : '#D97706' },
                    ]}
                  >
                    {hasFailedPayments ? 'Payment Action Required' : 'Pending Payments'}
                  </Text>
                  <Text
                    style={[
                      styles.pendingAlertSubtitle,
                      { color: hasFailedPayments ? '#991B1B' : '#92400E' },
                    ]}
                  >
                    You have {pendingPaymentsList.length} payment
                    {pendingPaymentsList.length > 1 ? 's' : ''} totaling{' '}
                    <Text style={{ fontWeight: '700' }}>
                      {formatMoney(totalPendingAmount, currency)}
                    </Text>{' '}
                    that need attention
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/payments' as never)}
                style={styles.pendingViewAllLink}
              >
                <Text style={styles.pendingViewAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={14} color="#083A85" />
              </Pressable>
            </View>

            {/* Horizontal scroll of pending payment cards */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pendingCardsScroll}
            >
              {pendingPaymentsList.map((payment) => {
                const dueAmount = payment.amount - payment.paidAmount;
                const isFailed = payment.status === 'failed';
                return (
                  <View key={payment.id} style={styles.pendingCard}>
                    <View style={styles.pendingCardAvatar}>
                      {payment.photographerImage ? (
                        <RNImage
                          source={{ uri: payment.photographerImage }}
                          style={styles.pendingCardAvatarImg}
                        />
                      ) : (
                        <Ionicons name="person" size={18} color="#9CA3AF" />
                      )}
                    </View>
                    <View style={styles.pendingCardDetails}>
                      <View style={styles.pendingCardNameRow}>
                        <Text style={styles.pendingCardName} numberOfLines={1}>
                          {payment.photographerName}
                        </Text>
                        {isFailed && (
                          <View style={styles.pendingStatusBadgeFailed}>
                            <Text style={styles.pendingStatusBadgeTextFailed}>FAILED</Text>
                          </View>
                        )}
                        {payment.status === 'partially_paid' && (
                          <View style={styles.pendingStatusBadgePartial}>
                            <Text style={styles.pendingStatusBadgeTextPartial}>PARTIAL</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.pendingCardEvent} numberOfLines={1}>
                        {payment.eventName}
                      </Text>
                    </View>
                    <View style={styles.pendingCardActionCol}>
                      <Text
                        style={[
                          styles.pendingCardAmount,
                          { color: isFailed ? '#DC2626' : '#083A85' },
                        ]}
                      >
                        {formatMoney(dueAmount, currency)}
                      </Text>
                      <Pressable
                        onPress={() => handlePayNow(payment)}
                        style={[
                          styles.pendingPayBtn,
                          { backgroundColor: isFailed ? '#DC2626' : '#083A85' },
                        ]}
                      >
                        <Ionicons
                          name={isFailed ? 'refresh-outline' : 'card-outline'}
                          size={13}
                          color="#FFFFFF"
                        />
                        <Text style={styles.pendingPayBtnText}>
                          {isFailed ? 'Retry' : 'Pay Now'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Salo-run Performance Chart (Dual-bar Sun-Sat + Scale) ─────────── */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>Performance</Text>
          <SaloPerformanceChart data={activePerf} height={180} />
        </View>

        {/* ── CLIENT Specific Lists ───────────────────────────────────────── */}
        {isClient && (
          <>
            {/* Photographers */}
            {clientPhotographers.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeaderRow}>
                  <Text style={styles.sectionCardTitle}>Photographers</Text>
                  <Pressable
                    onPress={() => router.push('/photographers' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>See all</Text>
                  </Pressable>
                </View>
                <View style={styles.listCardBody}>
                  {clientPhotographers.map((p) => (
                    <PhotographerItemRow
                      key={p.id}
                      name={p.name}
                      event={p.event}
                      avatar={p.avatar}
                      status={p.status}
                      onPress={() => router.push('/photographers' as never)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Recent Activities */}
            {clientActivities.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>Recent Activities</Text>
                <View style={styles.listCardBody}>
                  {clientActivities.map((a) => (
                    <ActivityItemRow key={a.id} type={a.type} title={a.title} createdAt={a.createdAt} />
                  ))}
                </View>
              </View>
            )}

            {/* Recent Payments */}
            {clientPayments.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeaderRow}>
                  <Text style={styles.sectionCardTitle}>Recent payments</Text>
                  <Pressable
                    onPress={() => router.push('/payments' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>See all</Text>
                  </Pressable>
                </View>
                <View style={styles.listCardBody}>
                  {clientPayments.map((pay) => (
                    <PaymentItemRow
                      key={pay.id}
                      name={pay.name}
                      type={pay.type}
                      amount={formatMoney(pay.amount, currency)}
                      avatar={pay.avatar}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── PHOTOGRAPHER Specific Lists ─────────────────────────────────── */}
        {isPhotographer && (
          <>
            {/* Clients */}
            {photogClients.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeaderRow}>
                  <Text style={styles.sectionCardTitle}>Clients</Text>
                  <Pressable
                    onPress={() => router.push('/clients' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>See all</Text>
                  </Pressable>
                </View>
                <View style={styles.listCardBody}>
                  {photogClients.map((c) => (
                    <PhotographerItemRow
                      key={c.id}
                      name={c.name}
                      event={c.lastEvent ? formatDate(c.lastEvent) : `${c.totalEvents} event${c.totalEvents === 1 ? '' : 's'}`}
                      avatar={c.avatar}
                      onPress={() => router.push('/clients' as never)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Recent Transactions */}
            {photogTransactions.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeaderRow}>
                  <Text style={styles.sectionCardTitle}>Recent transactions</Text>
                  <Pressable
                    onPress={() => router.push('/transactions' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>See all</Text>
                  </Pressable>
                </View>
                <View style={styles.listCardBody}>
                  {photogTransactions.map((t) => (
                    <PaymentItemRow
                      key={t.id}
                      name={t.eventName}
                      type={t.status}
                      amount={formatMoney(t.amount, currency)}
                      subtitle={t.createdAt ? formatDate(t.createdAt) : undefined}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        {/* ── COORDINATOR Specific Lists ──────────────────────────────────── */}
        {isCoordinator && (
          <>
            {/* Photographers */}
            {coordPhotographers.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeaderRow}>
                  <Text style={styles.sectionCardTitle}>Photographers</Text>
                  <Pressable
                    onPress={() => router.push('/photographers' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>See all</Text>
                  </Pressable>
                </View>
                <View style={styles.listCardBody}>
                  {coordPhotographers.map((p) => (
                    <PhotographerItemRow
                      key={p.id}
                      name={p.name}
                      event={`${p.totalEvents} event${p.totalEvents === 1 ? '' : 's'}`}
                      avatar={p.avatar}
                      status={p.status}
                      onPress={() => router.push('/photographers' as never)}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Recent Activities */}
            {coordActivities.length > 0 && (
              <View style={styles.sectionCard}>
                <Text style={styles.sectionCardTitle}>Recent activity</Text>
                <View style={styles.listCardBody}>
                  {coordActivities.map((a) => (
                    <ActivityItemRow key={a.id} type={a.type} title={a.title} createdAt={a.createdAt} />
                  ))}
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* PayNowSheet for paying pending bills directly */}
      <PayNowSheet
        payment={payNowPayment}
        visible={showPayNow}
        onClose={() => setShowPayNow(false)}
        onSuccess={() => {
          setShowPayNow(false);
          load();
        }}
      />
    </View>
  );
}

// ── Hero Mini-Stat Item ───────────────────────────────────────────────────────
function HeroMiniStatItem({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={itemStyles.container}>
      <Text style={itemStyles.label}>{label}</Text>
      <Text style={[itemStyles.value, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const itemStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: '#797D86',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  value: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 4,
    lineHeight: 18,
  },
});

// ── Salo-run StatCard Component ──────────────────────────────────────────────
function SaloStatCard({
  title,
  value,
  percentage,
  timeframe,
  iconName,
  trend = 'up',
  accentColor = '#083A85',
  href,
  onPress,
}: {
  title: string;
  value: string;
  percentage?: string;
  timeframe: string;
  iconName: keyof typeof Ionicons.glyphMap;
  trend?: 'up' | 'down';
  accentColor?: string;
  href?: string;
  onPress?: () => void;
}) {
  const isUp = trend === 'up';

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        cardStyles.card,
        { borderTopColor: accentColor },
        pressed && cardStyles.cardPressed,
      ]}
    >
      {/* Top row: Title + Brand Tint Squircle Icon */}
      <View style={cardStyles.headerRow}>
        <Text style={cardStyles.title} numberOfLines={1}>
          {title}
        </Text>
        <LinearGradient
          colors={['rgba(8,58,133,0.08)', 'rgba(242,12,143,0.06)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cardStyles.iconSquircle}
        >
          <Ionicons name={iconName} size={17} color={accentColor} />
        </LinearGradient>
      </View>

      {/* Main Stat Value */}
      <Text style={cardStyles.value} numberOfLines={1}>
        {value}
      </Text>

      {/* Bottom row: Trend Pill + Timeframe + optional link arrow */}
      <View style={cardStyles.footerRow}>
        {percentage ? (
          <View style={cardStyles.trendRow}>
            <View
              style={[
                cardStyles.trendPill,
                { backgroundColor: isUp ? '#ECFDF5' : '#FEF2F2' },
              ]}
            >
              <Ionicons
                name={isUp ? 'arrow-up' : 'arrow-down'}
                size={10}
                color={isUp ? '#065F46' : '#991B1B'}
              />
              <Text
                style={[
                  cardStyles.trendText,
                  { color: isUp ? '#065F46' : '#991B1B' },
                ]}
              >
                {isUp ? '+' : ''}
                {percentage}
              </Text>
            </View>
            <Text style={cardStyles.timeframeText} numberOfLines={1}>
              vs {timeframe}
            </Text>
          </View>
        ) : (
          <View />
        )}

        {href && (
          <View style={cardStyles.arrowCircle}>
            <Ionicons name="arrow-forward" size={11} color="#083A85" />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 8,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  iconSquircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  value: {
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#0F172A',
    lineHeight: 25,
    marginBottom: 10,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 22,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
  },
  trendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  trendText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  timeframeText: {
    fontSize: 10,
    color: '#94A3B8',
    flexShrink: 1,
  },
  arrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(8,58,133,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── Salo-run Performance Chart Component (Dual-bar Sun-Sat + Scale) ─────────
const DEFAULT_DAYS = [
  { day: 'Sun', value1: 0, value2: 0 },
  { day: 'Mon', value1: 0, value2: 0 },
  { day: 'Tue', value1: 0, value2: 0 },
  { day: 'Wed', value1: 0, value2: 0 },
  { day: 'Thu', value1: 0, value2: 0 },
  { day: 'Fri', value1: 0, value2: 0 },
  { day: 'Sat', value1: 0, value2: 0 },
];

function SaloPerformanceChart({
  data,
  height = 180,
}: {
  data: PerformancePoint[];
  height?: number;
}) {
  const chartData = useMemo(() => {
    if (data.length === 7) return data;
    if (data.length > 0) {
      // Map existing points to day names
      return DEFAULT_DAYS.map((def) => {
        const found = data.find((d) => d.day.toLowerCase().startsWith(def.day.toLowerCase()));
        return found || def;
      });
    }
    return DEFAULT_DAYS;
  }, [data]);

  const allValues = chartData.flatMap((d) => [d.value1, d.value2]);
  const maxValue = Math.max(...allValues, 0);
  const roundedMax = Math.ceil(maxValue / 50) * 50 || 200;
  const scale = (height - 30) / roundedMax;
  const yAxisLabels = [roundedMax, roundedMax * 0.75, roundedMax * 0.5, roundedMax * 0.25, 0];

  return (
    <View style={perfStyles.container}>
      <View style={{ height, flexDirection: 'row' }}>
        {/* Left Y-axis scale labels */}
        <View style={[perfStyles.yAxis, { height: height - 20 }]}>
          {yAxisLabels.map((lbl, idx) => (
            <Text key={idx} style={perfStyles.yAxisLabel}>
              {Math.round(lbl)}
            </Text>
          ))}
        </View>

        {/* Chart plot area with horizontal grid lines and vertical dual-bars */}
        <View style={perfStyles.plotArea}>
          {/* Horizontal gridlines */}
          <View style={perfStyles.gridLinesWrapper}>
            {yAxisLabels.map((_, idx) => (
              <View key={idx} style={perfStyles.gridLine} />
            ))}
          </View>

          {/* 7 day columns */}
          <View style={[perfStyles.barsContainer, { height: height - 20 }]}>
            {chartData.map((item, idx) => {
              const h1 = Math.max(item.value1 * scale, item.value1 > 0 ? 4 : 2);
              const h2 = Math.max(item.value2 * scale, item.value2 > 0 ? 4 : 2);
              return (
                <View key={idx} style={perfStyles.dayCol}>
                  <View style={perfStyles.barPair}>
                    {/* Current V1 Bar (Blue gradient) */}
                    <LinearGradient
                      colors={['#3B82F6', '#93C5FD']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[perfStyles.bar, { height: h1 }]}
                    />
                    {/* Current V2 Bar (Amber gradient) */}
                    <LinearGradient
                      colors={['#F59E0B', '#FDE68A']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 1 }}
                      style={[perfStyles.bar, { height: h2 }]}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* X-axis day labels */}
      <View style={perfStyles.xAxisRow}>
        <View style={{ width: 34 }} />
        <View style={perfStyles.xAxisLabels}>
          {chartData.map((item, idx) => (
            <Text key={idx} style={perfStyles.xDayLabel}>
              {item.day.slice(0, 3)}
            </Text>
          ))}
        </View>
      </View>

      {/* Legend below chart (salo-run PerformanceChart) */}
      <View style={perfStyles.legendRow}>
        <View style={perfStyles.legendItem}>
          <LinearGradient
            colors={['#3B82F6', '#93C5FD']}
            style={perfStyles.legendDot}
          />
          <Text style={perfStyles.legendText}>Current V1</Text>
        </View>
        <View style={perfStyles.legendItem}>
          <LinearGradient
            colors={['#F59E0B', '#FDE68A']}
            style={perfStyles.legendDot}
          />
          <Text style={perfStyles.legendText}>Current V2</Text>
        </View>
      </View>
    </View>
  );
}

const perfStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 8,
  },
  yAxis: {
    width: 34,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 6,
  },
  yAxisLabel: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  plotArea: {
    flex: 1,
    position: 'relative',
  },
  gridLinesWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  gridLine: {
    width: '100%',
    height: 1,
    backgroundColor: '#F1F5F9',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  dayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barPair: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2.5,
  },
  bar: {
    width: 10,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  xAxisRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  xAxisLabels: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  xDayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 11.5,
    fontWeight: '500',
    color: '#64748B',
  },
});

// ── List Item Components (Salo-run Parity) ───────────────────────────────────
function PhotographerItemRow({
  name,
  event,
  avatar,
  status,
  onPress,
}: {
  name: string;
  event: string;
  avatar?: string;
  status?: string;
  onPress?: () => void;
}) {
  const getStatusStyle = (s?: string) => {
    switch (s) {
      case 'In Progress':
        return { bg: '#FCE7F3', text: '#DB2777' };
      case 'Completed':
        return { bg: '#D1FAE5', text: '#059669' };
      case 'Pending':
        return { bg: '#FEF3C7', text: '#D97706' };
      default:
        return { bg: '#DBEAFE', text: '#2563EB' };
    }
  };

  const badge = status ? getStatusStyle(status) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [rowStyles.row, pressed && { opacity: 0.7 }]}
    >
      <View style={rowStyles.avatarBox}>
        {avatar ? (
          <RNImage source={{ uri: avatar }} style={rowStyles.avatarImg} />
        ) : (
          <Ionicons name="person" size={18} color="#9CA3AF" />
        )}
      </View>
      <View style={rowStyles.infoCol}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={rowStyles.sub} numberOfLines={1}>
          {event}
        </Text>
      </View>
      {badge && (
        <View style={[rowStyles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[rowStyles.statusBadgeText, { color: badge.text }]}>
            {status}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
    </Pressable>
  );
}

function ActivityItemRow({
  type,
  title,
  createdAt,
}: {
  type: string;
  title: string;
  createdAt?: string;
}) {
  const label = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Activity';
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.activityDot} />
      <View style={rowStyles.infoCol}>
        <Text style={rowStyles.activityLabel}>{label}</Text>
        <Text style={rowStyles.name} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {createdAt ? (
        <Text style={rowStyles.meta}>{formatDate(createdAt)}</Text>
      ) : null}
    </View>
  );
}

function PaymentItemRow({
  name,
  type,
  amount,
  avatar,
  subtitle,
}: {
  name: string;
  type: string;
  amount: string;
  avatar?: string;
  subtitle?: string;
}) {
  const isFailed = type.toUpperCase() === 'FAILED';
  return (
    <View style={rowStyles.row}>
      <View style={rowStyles.avatarBox}>
        {avatar ? (
          <RNImage source={{ uri: avatar }} style={rowStyles.avatarImg} />
        ) : (
          <Text style={rowStyles.avatarInitial}>
            {name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={rowStyles.infoCol}>
        <Text style={rowStyles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text
          style={[
            rowStyles.sub,
            { color: isFailed ? '#DC2626' : '#64748B' },
          ]}
        >
          {subtitle || type}
        </Text>
      </View>
      <Text style={[rowStyles.amount, { color: isFailed ? '#DC2626' : '#083A85' }]}>
        {amount}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
  },
  avatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 18,
  },
  sub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F20C8F',
  },
  activityLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#F20C8F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  meta: {
    fontSize: 11,
    color: '#94A3B8',
  },
  amount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

// ── Screen Styles ─────────────────────────────────────────────────────────────
const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  topBarTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },

  // Hero Card (salo-run .dashboard-hero)
  heroWrapper: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopBar: {
    height: 3,
    width: '100%',
  },
  heroBody: {
    padding: 16,
  },
  heroTagRow: {
    marginBottom: 6,
  },
  heroTag: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#F20C8F',
    letterSpacing: 1,
  },
  heroGreeting: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: '#0F172A',
    lineHeight: 26,
  },
  heroName: {
    color: '#F20C8F',
  },
  heroTagline: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 18,
  },
  heroMiniStatsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 16,
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },

  // Segmented Timeframe Filter Tabs (salo-run .ck-tabs)
  filterTabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterTabTextActive: {
    color: '#083A85',
    fontWeight: '700',
  },

  // Custom date inputs
  customDatesBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customDateInputGroup: {
    flex: 1,
    gap: 4,
  },
  customDateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  customDateInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: '#0F172A',
  },
  customApplyBtn: {
    backgroundColor: '#F20C8F',
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customApplyBtnDisabled: {
    backgroundColor: '#CBD5E1',
  },
  customApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // StatCards Grid
  statCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },

  // Pending Payments Alert (salo-run .mobile-pending-payments)
  pendingAlertContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  pendingAlertWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  pendingAlertFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  pendingAlertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pendingAlertTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    flex: 1,
    paddingRight: 8,
  },
  pendingAlertIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingIconWarning: {
    backgroundColor: '#FEF3C7',
  },
  pendingIconFailed: {
    backgroundColor: '#FEE2E2',
  },
  pendingAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  pendingAlertSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  pendingViewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
  },
  pendingViewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#083A85',
  },
  pendingCardsScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
    minWidth: 260,
  },
  pendingCardAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pendingCardAvatarImg: {
    width: 38,
    height: 38,
  },
  pendingCardDetails: {
    flex: 1,
    minWidth: 0,
  },
  pendingCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pendingCardName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  pendingStatusBadgeFailed: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pendingStatusBadgeTextFailed: {
    fontSize: 9,
    fontWeight: '700',
    color: '#DC2626',
  },
  pendingStatusBadgePartial: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pendingStatusBadgeTextPartial: {
    fontSize: 9,
    fontWeight: '700',
    color: '#2563EB',
  },
  pendingCardEvent: {
    fontSize: 11.5,
    color: '#64748B',
    marginTop: 2,
  },
  pendingCardActionCol: {
    alignItems: 'flex-end',
    gap: 4,
  },
  pendingCardAmount: {
    fontSize: 13.5,
    fontWeight: '800',
  },
  pendingPayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingPayBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Section Cards
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: '#0F172A',
    marginBottom: 10,
  },
  sectionCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionCardSeeAll: {
    fontSize: 13,
    fontWeight: '600',
    color: '#083A85',
  },
  listCardBody: {
    gap: 2,
  },
}));
