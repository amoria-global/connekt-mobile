import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EventsChart } from '@/features/analytics/EventsChart';
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
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Path } from 'react-native-svg';
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
  cleanTransactionTitle,
  cleanTransactionStatus,
} from '@/features/analytics/api';
import { useRole } from '@/features/auth/role';
import { getWallet } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { ErrorNotice } from '@/features/photographer/kit';

import { useLanguage } from '@/hooks/useLanguage';
import { translate, type TranslationKey } from '@/i18n/translations';
const tr = (k: TranslationKey) => translate(useLanguage.getState().language, k);

const DEFAULT_DAYS = [
  { day: 'Sun', value1: 0, value2: 0 },
  { day: 'Mon', value1: 0, value2: 0 },
  { day: 'Tue', value1: 0, value2: 0 },
  { day: 'Wed', value1: 0, value2: 0 },
  { day: 'Thu', value1: 0, value2: 0 },
  { day: 'Fri', value1: 0, value2: 0 },
  { day: 'Sat', value1: 0, value2: 0 },
];

const PERIOD_TABS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

export default function AnalyticsScreen() {
  useLanguage();
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useStyles();
  const router = useRouter();

  const { isClient, isCoordinator, isPhotographer } = useRole();
  const wallet = useAsync(useCallback(() => getWallet(), []));
  const currency = wallet.data?.currency;

  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [customApplied, setCustomApplied] = useState(false);

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
  // null: not loaded or failed. Never drawn as zeros.
  const [photogPerf, setPhotogPerf] = useState<PerformancePoint[] | null>(null);
  // Why the headline figures are missing, so a failed load is not shown as zeros.
  const [photogError, setPhotogError] = useState<string | null>(null);
  // Only the newest load may write state: switching period quickly must not let a slow old answer win.
  const loadTicket = useRef(0);

  // ── Shared ────────────────────────────────────────────────────────────────
  const [trends, setTrends] = useState<TrendsMap>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // PayNowSheet state
  const [payNowPayment, setPayNowPayment] = useState<PendingPayment | null>(null);
  const [showPayNow, setShowPayNow] = useState(false);

  const load = useCallback(async (isPull = false) => {
    const ticket = ++loadTicket.current;
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
        if (ticket !== loadTicket.current) return;
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
        if (ticket !== loadTicket.current) return;
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
        if (ticket !== loadTicket.current) return;
        setPhotogError(
          a.status === 'rejected'
            ? ((a.reason as { message?: string } | undefined)?.message ?? 'Could not load your analytics.')
            : null,
        );
        if (a.status === 'fulfilled') setPhotogData(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
        if (clients.status === 'fulfilled') setPhotogClients(clients.value);
        if (transactions.status === 'fulfilled') setPhotogTransactions(transactions.value);
        setPhotogPerf(perf.status === 'fulfilled' ? perf.value : null);
      }
    } finally {
      if (ticket === loadTicket.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isClient, isCoordinator, isPhotographer, period, customApplied, customFrom, customTo]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    load(true);
  }, [load]);

  const photogUnavailable = isPhotographer && !!photogError && !photogData;

  // Current timeframe label (matches salo-run periodLabel)
  const periodLabel = useMemo(() => {
    if (period === 'today') return 'yesterday';
    if (period === 'month') return 'last month';
    if (period === 'custom' && customFrom && customTo) return `${customFrom} - ${customTo}`;
    return 'last week';
  }, [period, customFrom, customTo]);

  // Active performance data for chart
  const activePerf = isClient
    ? clientPerf
    : isCoordinator
      ? coordPerf
      : isPhotographer
        ? (photogPerf ?? [])
        : [];

type StatCardItem = {
  title: string;
  value: string;
  percentage?: string;
  trend?: 'up' | 'down';
  iconName: any;
  accentColor: string;
  href?: string;
  chartType?: 'histogram' | 'donut';
  histogramData?: number[];
  donutData?: {
    value: number;
    total: number;
    color?: string;
  };
};

  // ── Salo-run StatCards Definition with Embedded Mini-Charts ─────────────────
  const statCards: StatCardItem[] = useMemo(() => {
    if (isClient) {
      return [
        {
          title: 'Total Spent',
          value: formatPrice(clientData?.totalSpent || 0, currency),
          percentage: trends.totalSpent?.percentage,
          trend: trends.totalSpent?.direction ?? 'up',
          iconName: 'wallet-outline' as const,
          accentColor: colors.primary,
          chartType: 'histogram' as const,
          histogramData: activePerf.map((p) => (p.value1 || 0) + (p.value2 || 0)),
        },
        {
          title: 'Pending',
          value: formatPrice(clientData?.pendingAmount || 0, currency),
          percentage: trends.pending?.percentage,
          trend: trends.pending?.direction ?? 'up',
          iconName: 'time-outline' as const,
          accentColor: colors.warning,
          href: '/payments',
          chartType: 'donut' as const,
          donutData: {
            value: clientData?.pendingAmount || 0,
            total: (clientData?.totalSpent || 0) + (clientData?.pendingAmount || 0),
            color: colors.warning,
          },
        },
        {
          title: 'Bookings',
          value: String(clientData?.totalBookings || 0),
          percentage: trends.events?.percentage,
          trend: trends.events?.direction ?? 'up',
          iconName: 'people-outline' as const,
          accentColor: colors.primary,
          href: '/events',
          chartType: 'histogram' as const,
          histogramData: activePerf.map((p) => p.value1 || 0),
        },
        {
          title: 'Gifts',
          value: formatPrice(clientData?.gifts || 0, currency),
          percentage: trends.gifts?.percentage,
          trend: trends.gifts?.direction ?? 'up',
          iconName: 'gift-outline' as const,
          accentColor: colors.accent,
          chartType: 'donut' as const,
          donutData: {
            value: clientData?.gifts || 0,
            total: (clientData?.totalSpent || 0) + (clientData?.gifts || 0),
            color: colors.accent,
          },
        },
        {
          title: 'Favorites',
          value: String(clientData?.bookmarkedPhotographers || 0),
          percentage: trends.photographers?.percentage,
          trend: trends.photographers?.direction ?? 'up',
          iconName: 'star-outline' as const,
          accentColor: colors.accent,
          href: '/photographers',
        },
      ];
    }

    if (isCoordinator) {
      return [
        {
          title: 'Total Revenue',
          value: formatPrice(coordData?.totalRevenue || 0, currency),
          percentage: trends.totalRevenue?.percentage,
          trend: trends.totalRevenue?.direction ?? 'up',
          iconName: 'cash-outline' as const,
          accentColor: colors.primary,
          chartType: 'histogram' as const,
          histogramData: activePerf.map((p) => (p.value1 || 0) + (p.value2 || 0)),
        },
        {
          title: 'Pending',
          value: formatPrice(coordData?.totalPending || 0, currency),
          percentage: trends.totalPending?.percentage,
          trend: trends.totalPending?.direction ?? 'up',
          iconName: 'time-outline' as const,
          accentColor: colors.warning,
          href: '/payments',
          chartType: 'donut' as const,
          donutData: {
            value: coordData?.totalPending || 0,
            total: (coordData?.totalRevenue || 0) + (coordData?.totalPending || 0),
            color: colors.warning,
          },
        },
        {
          title: 'Events',
          value: String(coordData?.totalEvents || 0),
          percentage: trends.totalEvents?.percentage,
          trend: trends.totalEvents?.direction ?? 'up',
          iconName: 'calendar-outline' as const,
          accentColor: colors.primary,
          href: '/events',
          chartType: 'histogram' as const,
          histogramData: activePerf.map((p) => p.value1 || 0),
        },
        {
          title: 'Total Paid',
          value: formatPrice(coordData?.totalPaid || 0, currency),
          percentage: trends.totalPaid?.percentage,
          trend: trends.totalPaid?.direction ?? 'up',
          iconName: 'card-outline' as const,
          accentColor: colors.success,
          chartType: 'donut' as const,
          donutData: {
            value: coordData?.totalPaid || 0,
            total: coordData?.totalRevenue || 0,
            color: colors.success,
          },
        },
        {
          title: 'Photographers',
          value: String(coordData?.totalPhotographers || 0),
          percentage: trends.totalPhotographers?.percentage,
          trend: trends.totalPhotographers?.direction ?? 'up',
          iconName: 'camera-outline' as const,
          accentColor: colors.accent,
          href: '/photographers',
        },
      ];
    }

    if (isPhotographer) {
      return [
        {
          // The earnings endpoint has no period: this is lifetime, so the title says so (the tabs above only move the
          // change percentages and charts).
          title: 'Lifetime earnings',
          value: formatPrice(photogData?.totalEarnings, currency),
          iconName: 'cash-outline' as const,
          accentColor: colors.primary,
          href: '/wallet',
          // No sparkline here: the figure is lifetime, and a period chart beside it would read as its history.
        },
        {
          title: 'Pending release',
          value: formatPrice(photogData?.pendingPayments, currency),
          iconName: 'time-outline' as const,
          accentColor: colors.warning,
          chartType: 'donut' as const,
          donutData: {
            value: photogData?.pendingPayments || 0,
            total: (photogData?.totalEarnings || 0) + (photogData?.pendingPayments || 0),
            color: colors.warning,
          },
        },
        {
          title: 'Clients served',
          value: photogData ? String(photogData.totalClients) : 'N/A',
          iconName: 'people-outline' as const,
          accentColor: colors.primary,
          href: '/clients',
        },
        {
          title: 'Lifetime bonuses',
          value: formatPrice(photogData?.bonuses, currency),
          iconName: 'gift-outline' as const,
          accentColor: colors.accent,
          chartType: 'donut' as const,
          donutData: {
            value: photogData?.bonuses || 0,
            total: (photogData?.totalEarnings || 0) + (photogData?.bonuses || 0),
            color: colors.accent,
          },
        },
        {
          title: 'Rating',
          // No rating is not a 5.0: say so instead of inventing one.
          value: !photogData ? 'N/A' : photogData.averageRating > 0 ? `${photogData.averageRating.toFixed(1)}/5` : 'No reviews yet',
          iconName: 'star-outline' as const,
          accentColor: colors.accent,
        },
      ];
    }

    return [];
  }, [isClient, isCoordinator, isPhotographer, clientData, coordData, photogData, trends, currency, activePerf, colors.primary, colors.warning, colors.accent, colors.success]);



  // Donut chart breakdown data (Exact real backend data - No fake mock fallbacks)
  const donutData = useMemo(() => {
    if (isClient) {
      const completed = clientData?.completedEvents ?? 0;
      const upcoming = clientData?.upcomingEvents ?? 0;
      const cancelled = clientData?.cancelledEvents ?? 0;
      const other = Math.max((clientData?.totalEvents ?? 0) - completed - upcoming - cancelled, 0);
      const totalEventsCount = clientData?.totalEvents ?? (completed + upcoming + cancelled);
      return {
        title: 'Events Allocation',
        subtitle: 'Distribution by booking lifecycle',
        centerValue: String(totalEventsCount),
        centerLabel: 'EVENTS',
        segments: [
          {
            label: 'Completed',
            value: completed,
            color: colors.success,
            formatted: `${completed} events`,
          },
          {
            label: 'Upcoming',
            value: upcoming,
            color: colors.primary,
            formatted: `${upcoming} events`,
          },
          {
            label: 'Cancelled / Other',
            value: cancelled + other,
            color: colors.accent,
            formatted: `${cancelled + other} events`,
          },
        ],
      };
    }

    if (isCoordinator) {
      const rev = coordData?.totalRevenue ?? 0;
      const paid = coordData?.totalPaid ?? 0;
      const pending = coordData?.totalPending ?? 0;
      return {
        title: 'Financial Allocation',
        subtitle: 'Cashflow & revenue breakdown',
        centerValue: formatPrice(rev, currency),
        centerLabel: 'VOLUME',
        segments: [
          {
            label: 'Gross Revenue',
            value: rev,
            color: colors.primary,
            formatted: formatPrice(rev, currency),
          },
          {
            label: 'Paid Out',
            value: paid,
            color: colors.success,
            formatted: formatPrice(paid, currency),
          },
          {
            label: 'Pending Escrow',
            value: pending,
            color: colors.warning,
            formatted: formatPrice(pending, currency),
          },
        ],
      };
    }

    // Photographer
    const earnings = photogData?.totalEarnings ?? 0;
    const tips = photogData?.totalTips ?? 0;
    const bonuses = photogData?.bonuses ?? 0;
    const totalEarned = earnings + tips + bonuses;
    return {
      title: 'Earnings Composition',
      subtitle: 'Income distribution across streams',
      centerValue: formatPrice(totalEarned, currency),
      centerLabel: 'EARNED',
      segments: [
        {
          label: 'Shoot Earnings',
          value: earnings,
          color: colors.primary,
          formatted: formatPrice(earnings, currency),
        },
        {
          label: 'Tips & Gratuity',
          value: tips,
          color: colors.success,
          formatted: formatPrice(tips, currency),
        },
        {
          label: 'Bonuses',
          value: bonuses,
          color: colors.accent,
          formatted: formatPrice(bonuses, currency),
        },
      ],
    };
  }, [isClient, isCoordinator, isPhotographer, clientData, coordData, photogData, currency, colors]);

  // Horizontal ratio bar data (Exact real backend data - No fake mock fallbacks)
  const ratioData = useMemo(() => {
    if (isClient) {
      const photos = clientData?.totalPhotos ?? 0;
      const videos = clientData?.totalVideos ?? 0;
      const bookmarks = clientData?.bookmarkedPhotographers ?? 0;
      return {
        title: 'Media & Asset Portfolio',
        segments: [
          { label: 'Photos', value: photos, color: colors.primary },
          { label: 'Videos', value: videos, color: colors.accent },
          { label: 'Saved Creators', value: bookmarks, color: colors.warning },
        ],
      };
    }

    if (isCoordinator) {
      const photogs = coordData?.totalPhotographers ?? 0;
      const customers = coordData?.totalCustomers ?? 0;
      const streams = coordData?.activeStreams ?? 0;
      return {
        title: 'Network & Service Share',
        segments: [
          { label: 'Photographers', value: photogs, color: colors.primary },
          { label: 'Clients', value: customers, color: colors.accent },
          { label: 'Live Streams', value: streams, color: colors.warning },
        ],
      };
    }

    // Photographer
    const completed = photogData?.completedEvents ?? 0;
    const upcoming = photogData?.upcomingEvents ?? 0;
    const clients = photogData?.totalClients ?? 0;
    return {
      title: 'Shoots & Client Ratios',
      segments: [
        { label: 'Completed', value: completed, color: colors.primary },
        { label: 'Upcoming', value: upcoming, color: colors.accent },
        { label: 'Active Clients', value: clients, color: colors.warning },
      ],
    };
  }, [isClient, isCoordinator, isPhotographer, clientData, coordData, photogData, colors]);

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
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Single Clean Top Bar (No duplicate chevron or title) ─────────── */}
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={tr('b2_analyticsBack')}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.topBarTitle}>{tr('b2_analyticsTitle')}</Text>
        <Pressable
          onPress={() => load()}
          hitSlop={12}
          style={({ pressed }) => [styles.refreshBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel={tr('b2_analyticsRefresh')}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={colors.text} />
          )}
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary, colors.accent]}
          />
        }
      >
        {isPhotographer && photogError ? (
          <ErrorNotice message={photogError} onRetry={() => load()} />
        ) : null}

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
                style={[
                  styles.filterTab,
                  isActive && styles.filterTabActive,
                  // Dark: the light-mode "white card on a grey track" inverts into a dim selected pill. Selected = brand fill,
                  // like every other segmented control on the photographer screens.
                  isActive && isDark && { backgroundColor: colors.primary },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    isActive && styles.filterTabTextActive,
                    isActive && isDark && { color: colors.textOnPrimary },
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isPhotographer ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: spacing.sm }}>
            Totals are all time. The period above changes the trends and charts.
          </Text>
        ) : null}

        {/* Custom date range inputs (salo-run mobile-custom-dates) */}
        {period === 'custom' && (
          <View style={styles.customDatesBox}>
            <View style={styles.customDateInputGroup}>
              <Text style={styles.customDateLabel}>{tr('b2_analyticsFrom')}</Text>
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
              <Text style={styles.customDateLabel}>{tr('b2_analyticsTo')}</Text>
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
              <Text style={styles.customApplyBtnText}>{tr('b2_analyticsApply')}</Text>
            </Pressable>
          </View>
        )}


        {/* ── StatCards Grid (Clean Unified Cards) ───── */}
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
              chartType={card.chartType}
              histogramData={card.histogramData}
              donutData={card.donutData}
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
                    color={hasFailedPayments ? colors.error : colors.warning}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.pendingAlertTitle,
                      { color: hasFailedPayments ? colors.error : colors.warning },
                    ]}
                  >
                    {hasFailedPayments ? 'Payment Action Required' : 'Pending Payments'}
                  </Text>
                  <Text style={styles.pendingAlertSubtitle}>
                    You have {pendingPaymentsList.length} payment
                    {pendingPaymentsList.length > 1 ? 's' : ''} totaling{' '}
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {formatPrice(totalPendingAmount, currency)}
                    </Text>{' '}
                    that need attention
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/payments' as never)}
                style={styles.pendingViewAllLink}
              >
                <Text style={styles.pendingViewAllText}>{tr('b2_analyticsViewAll')}</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
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
                        <Ionicons name="person" size={18} color={colors.textMuted} />
                      )}
                    </View>
                    <View style={styles.pendingCardDetails}>
                      <View style={styles.pendingCardNameRow}>
                        <Text style={styles.pendingCardName} numberOfLines={1}>
                          {payment.photographerName}
                        </Text>
                        {isFailed && (
                          <View style={styles.pendingStatusBadgeFailed}>
                            <Text style={styles.pendingStatusBadgeTextFailed}>{tr('b2_analyticsBadgeFailed')}</Text>
                          </View>
                        )}
                        {payment.status === 'partially_paid' && (
                          <View style={styles.pendingStatusBadgePartial}>
                            <Text style={styles.pendingStatusBadgeTextPartial}>{tr('b2_analyticsBadgePartial')}</Text>
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
                          { color: isFailed ? colors.error : colors.primary },
                        ]}
                      >
                        {formatPrice(dueAmount, currency)}
                      </Text>
                      <Pressable
                        onPress={() => handlePayNow(payment)}
                        style={[
                          styles.pendingPayBtn,
                          { backgroundColor: isFailed ? colors.error : colors.primary },
                        ]}
                      >
                        <Ionicons
                          name={isFailed ? 'refresh-outline' : 'card-outline'}
                          size={13}
                          color={colors.textOnPrimary}
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

        {/* ── Diverse Shapes Analytics Charts ─────────────────────────────── */}
        {/* A failed photographer load has no data to chart; the error above says so. */}
        {photogUnavailable ? null : (
        <>
        {/* Shape 1: Curved Wave Spline Area Chart */}
        <View style={styles.sectionCard}>
          <TrendCurveChart data={activePerf} height={160} />
        </View>

        {/* Shape 2: Concentric Circular Donut Ring Chart */}
        <View style={styles.sectionCard}>
          <DonutBreakdownChart
            title={donutData.title}
            subtitle={donutData.subtitle}
            segments={donutData.segments}
            centerValue={donutData.centerValue}
            centerLabel={donutData.centerLabel}
          />
        </View>

        {/* Shape 3: Vertical Dual-Column Bar Chart */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>{tr('b2_analyticsPerformance')}</Text>
          {isPhotographer ? <EventsChart points={photogPerf} /> : <SaloPerformanceChart data={activePerf} height={180} />}
        </View>

        {/* Shape 4: Horizontal Proportion Ribbon Bar */}
        <View style={styles.sectionCard}>
          <HorizontalRatioBar
            title={ratioData.title}
            segments={ratioData.segments}
          />
        </View>
        </>
        )}

        {/* ── CLIENT Specific Lists ───────────────────────────────────────── */}
        {isClient && (
          <>
            {/* Photographers */}
            {clientPhotographers.length > 0 && (
              <View style={styles.sectionCard}>
                <View style={styles.sectionCardHeaderRow}>
                  <Text style={styles.sectionCardTitle}>{tr('b2_analyticsStatPhotographers')}</Text>
                  <Pressable
                    onPress={() => router.push('/photographers' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>{tr('b2_analyticsSeeAll')}</Text>
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
                <Text style={styles.sectionCardTitle}>{tr('b2_analyticsRecentActivities')}</Text>
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
                  <Text style={styles.sectionCardTitle}>{tr('b2_analyticsRecentPayments')}</Text>
                  <Pressable
                    onPress={() => router.push('/payments' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>{tr('b2_analyticsSeeAll')}</Text>
                  </Pressable>
                </View>
                <View style={styles.listCardBody}>
                  {clientPayments.map((pay) => (
                    <PaymentItemRow
                      key={pay.id}
                      name={pay.name}
                      type={pay.type}
                      amount={formatPrice(pay.amount, currency)}
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
                  <Text style={styles.sectionCardTitle}>{tr('b2_analyticsStatClients')}</Text>
                  <Pressable
                    onPress={() => router.push('/clients' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>{tr('b2_analyticsSeeAll')}</Text>
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
                  <Text style={styles.sectionCardTitle}>{tr('b2_analyticsRecentTransactions')}</Text>
                  <Pressable
                    onPress={() => router.push('/transactions' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>{tr('b2_analyticsSeeAll')}</Text>
                  </Pressable>
                </View>
                <View style={styles.listCardBody}>
                  {photogTransactions.map((t) => (
                    <PaymentItemRow
                      key={t.id}
                      name={t.eventName}
                      type={t.status}
                      amount={formatPrice(t.amount, currency)}
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
                  <Text style={styles.sectionCardTitle}>{tr('b2_analyticsStatPhotographers')}</Text>
                  <Pressable
                    onPress={() => router.push('/photographers' as never)}
                    hitSlop={8}
                  >
                    <Text style={styles.sectionCardSeeAll}>{tr('b2_analyticsSeeAll')}</Text>
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
                <Text style={styles.sectionCardTitle}>{tr('b2_analyticsRecentActivity')}</Text>
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



// ── Card Micro-Histogram Component ───────────────────────────────────────────
function CardHistogramChart({
  data,
  color,
  height = 22,
}: {
  data: number[];
  color: string;
  height?: number;
}) {
  const { colors } = useTheme();
  const points = data.length > 0 ? data : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...points, 0);

  return (
    <View style={cardHistoStyles.container}>
      <View style={[cardHistoStyles.barsRow, { height }]}>
        {points.map((val, idx) => {
          const isNonZero = val > 0;
          const pct = max > 0 ? Math.max((val / max) * 100, 16) : 22;
          const isLatest = idx === points.length - 1;
          return (
            <View key={idx} style={cardHistoStyles.barCol}>
              <View
                style={[
                  cardHistoStyles.barFill,
                  {
                    height: `${pct}%`,
                    backgroundColor: isNonZero ? color : colors.borderSoft,
                    opacity: isNonZero ? (isLatest ? 1 : 0.7) : 0.6,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={[cardHistoStyles.baseline, { backgroundColor: colors.borderSoft }]} />
    </View>
  );
}

const cardHistoStyles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 4,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 3,
  },
  barCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 3,
  },
  baseline: {
    height: 1,
    width: '100%',
    marginTop: 2,
    opacity: 0.6,
  },
});

// ── Card Micro-Donut Component ────────────────────────────────────────────────
function CardMicroDonut({
  value,
  total,
  color,
  size = 32,
}: {
  value: number;
  total: number;
  color: string;
  size?: number;
}) {
  const { colors, isDark } = useTheme();
  const strokeWidth = 3.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  const strokeDashoffset = circumference * (1 - pct);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={isDark ? colors.surfaceMuted : colors.borderSoft}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {pct > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
    </View>
  );
}

// ── Salo-run StatCard Component ──────────────────────────────────────────────
function SaloStatCard({
  title,
  value,
  percentage,
  timeframe,
  iconName,
  trend = 'up',
  accentColor,
  href,
  onPress,
  chartType,
  histogramData,
  donutData,
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
  chartType?: 'histogram' | 'donut';
  histogramData?: number[];
  donutData?: { value: number; total: number; color?: string };
}) {
  const { colors } = useTheme();
  const isUp = trend === 'up';
  const effectiveAccent = accentColor || colors.primary;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        cardStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.borderSoft,
        },
        pressed && cardStyles.cardPressed,
      ]}
    >
      {/* Top row: Title + Brand Tint Squircle Icon (or Micro-Donut) */}
      <View style={cardStyles.headerRow}>
        <Text style={[cardStyles.title, { color: colors.textMuted }]} numberOfLines={1}>
          {title}
        </Text>
        {chartType === 'donut' && donutData ? (
          <CardMicroDonut
            value={donutData.value}
            total={donutData.total}
            color={donutData.color || effectiveAccent}
          />
        ) : (
          <View
            style={[
              cardStyles.iconSquircle,
              { backgroundColor: colors.surfaceMuted },
            ]}
          >
            <Ionicons name={iconName} size={17} color={effectiveAccent} />
          </View>
        )}
      </View>

      {/* Main Stat Value */}
      <Text
        style={[cardStyles.value, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {value}
      </Text>

      {/* Embedded Histogram Chart (when chartType is histogram) */}
      {chartType === 'histogram' && histogramData && (
        <CardHistogramChart data={histogramData} color={effectiveAccent} />
      )}

      {/* Bottom row: Trend Pill + Timeframe + optional link arrow */}
      <View style={cardStyles.footerRow}>
        {percentage ? (
          <View style={cardStyles.trendRow}>
            <View
              style={[
                cardStyles.trendPill,
                { backgroundColor: isUp ? colors.successBg : colors.errorBg },
              ]}
            >
              <Ionicons
                name={isUp ? 'arrow-up' : 'arrow-down'}
                size={10}
                color={isUp ? colors.success : colors.error}
              />
              <Text
                style={[
                  cardStyles.trendText,
                  { color: isUp ? colors.success : colors.error },
                ]}
              >
                {isUp ? '+' : ''}
                {percentage}
              </Text>
            </View>
            <Text style={[cardStyles.timeframeText, { color: colors.textMuted }]} numberOfLines={1}>
              vs {timeframe}
            </Text>
          </View>
        ) : (
          <View />
        )}

        {href && (
          <View style={[cardStyles.arrowCircle, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="arrow-forward" size={11} color={colors.primary} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    minHeight: 126,
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '600',
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
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 24,
    marginBottom: 8,
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
    flexShrink: 1,
  },
  arrowCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ── 1. Wave Spline Curve Chart (Organic Fluid Shape) ─────────────────────────
function TrendCurveChart({
  data,
  height = 155,
}: {
  data: PerformancePoint[];
  height?: number;
}) {
  const { colors } = useTheme();
  const [layoutWidth, setLayoutWidth] = useState(320);

  const chartData = useMemo(() => {
    if (data.length === 7) return data;
    if (data.length > 0) {
      return DEFAULT_DAYS.map((def) => {
        const found = data.find((d) => d.day.toLowerCase().startsWith(def.day.toLowerCase()));
        return found || def;
      });
    }
    return DEFAULT_DAYS;
  }, [data]);

  const points = useMemo(() => {
    const rawValues = chartData.map((d) => (d.value1 || 0) + (d.value2 || 0));
    const isAllZero = rawValues.every((v) => v === 0);
    const maxVal = Math.max(...rawValues, 10);
    const plotWidth = Math.max(layoutWidth - 40, 240);
    const plotHeight = height - 42;
    const step = plotWidth / (chartData.length - 1 || 1);

    const coords = rawValues.map((v, i) => {
      const x = 20 + i * step;
      const y = plotHeight + 10 - (v / maxVal) * (plotHeight - 15);
      return { x, y, value: v, day: chartData[i].day };
    });

    let peakIdx = 0;
    rawValues.forEach((v, i) => {
      if (v > rawValues[peakIdx]) peakIdx = i;
    });

    return {
      coords,
      maxVal,
      isAllZero,
      peak: isAllZero ? null : coords[peakIdx],
      plotHeight,
      baseY: plotHeight + 10,
    };
  }, [chartData, layoutWidth, height]);

  const curvePath = useMemo(() => {
    if (points.isAllZero) return '';
    const pts = points.coords;
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      const midX = (p0.x + p1.x) / 2;
      d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
    }
    return d;
  }, [points.coords, points.isAllZero]);

  const areaPath = useMemo(() => {
    if (points.isAllZero || !curvePath || points.coords.length < 2) return '';
    const firstX = points.coords[0].x;
    const lastX = points.coords[points.coords.length - 1].x;
    return `${curvePath} L ${lastX} ${points.baseY} L ${firstX} ${points.baseY} Z`;
  }, [curvePath, points.coords, points.baseY, points.isAllZero]);

  return (
    <View
      style={trendStyles.container}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - layoutWidth) > 5) setLayoutWidth(w);
      }}
    >
      <View style={trendStyles.headerRow}>
        <View>
          <Text style={[trendStyles.headline, { color: colors.text }]}>{tr('b2_analyticsTrendTitle')}</Text>
          <Text style={[trendStyles.subheadline, { color: colors.textMuted }]}>
            {tr('b2_analyticsTrendSubtitle')}
          </Text>
        </View>
        {points.isAllZero ? (
          <View
            style={[
              trendStyles.peakPill,
              {
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.borderSoft,
              },
            ]}
          >
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={[trendStyles.peakPillText, { color: colors.textMuted }]}>
              {tr('b2_analyticsNoActivityYet')}
            </Text>
          </View>
        ) : points.peak ? (
          <View style={[trendStyles.peakPill, { backgroundColor: colors.tintAccent }]}>
            <Ionicons name="trending-up" size={12} color={colors.accent} />
            <Text style={[trendStyles.peakPillText, { color: colors.accent }]}>
              Peak: {points.peak.day}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ height, width: '100%', position: 'relative' }}>
        <Svg width="100%" height={height}>
          {/* Reference gridlines */}
          {[0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const gy = 10 + (points.plotHeight - 15) * (1 - pct);
            return (
              <Path
                key={idx}
                d={`M 15 ${gy} L ${layoutWidth - 15} ${gy}`}
                stroke={colors.borderSoft}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          })}

          {/* If all values are zero, show clean baseline with day circular dots */}
          {points.isAllZero ? (
            <G>
              <Path
                d={`M 15 ${points.baseY} L ${layoutWidth - 15} ${points.baseY}`}
                stroke={colors.primary}
                strokeWidth={1.5}
                strokeDasharray="4 4"
                opacity={0.4}
              />
              {points.coords.map((pt, idx) => (
                <Circle
                  key={idx}
                  cx={pt.x}
                  cy={points.baseY}
                  r={3.5}
                  fill={colors.surface}
                  stroke={colors.primary}
                  strokeWidth={2}
                  opacity={0.65}
                />
              ))}
            </G>
          ) : (
            <>
              {/* Solid subtle area wash (no multi-stop gradients) */}
              {areaPath ? <Path d={areaPath} fill={colors.primary} fillOpacity={0.1} /> : null}

              {/* Smooth line */}
              {curvePath ? (
                <Path
                  d={curvePath}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              ) : null}

              {/* Peak point indicator */}
              {points.peak && (
                <G>
                  <Circle
                    cx={points.peak.x}
                    cy={points.peak.y}
                    r={7}
                    fill={colors.accent}
                    opacity={0.3}
                  />
                  <Circle cx={points.peak.x} cy={points.peak.y} r={4.5} fill={colors.accent} />
                  <Circle cx={points.peak.x} cy={points.peak.y} r={2} fill="#FFFFFF" />
                </G>
              )}
            </>
          )}
        </Svg>

        {/* Empty state informative overlay badge */}
        {points.isAllZero && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '32%',
              left: 0,
              right: 0,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 20,
                backgroundColor: colors.surfaceMuted,
                borderWidth: 1,
                borderColor: colors.borderSoft,
              }}
            >
              <Ionicons name="bar-chart-outline" size={13} color={colors.textMuted} />
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                {tr('b2_analyticsZeroActivityPeriod')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* X-axis day labels */}
      <View style={trendStyles.xAxisRow}>
        {points.coords.map((pt, idx) => (
          <Text
            key={idx}
            style={[
              trendStyles.xDayLabel,
              { color: !points.isAllZero && pt.day === points.peak?.day ? colors.accent : colors.textMuted },
            ]}
          >
            {pt.day.slice(0, 3)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headline: {
    fontSize: 14,
    fontWeight: '700',
  },
  subheadline: {
    fontSize: 11,
    marginTop: 1,
  },
  peakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  peakPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  xAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 6,
  },
  xDayLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});

// ── 2. Concentric Donut Breakdown Chart (Circular Shape) ──────────────────────
export type DonutSegment = {
  label: string;
  value: number;
  color: string;
  formatted?: string;
};

function DonutBreakdownChart({
  title,
  subtitle,
  segments,
  centerLabel,
  centerValue,
}: {
  title: string;
  subtitle?: string;
  segments: DonutSegment[];
  centerLabel?: string;
  centerValue?: string;
}) {
  const { colors, isDark } = useTheme();

  const realTotal = useMemo(
    () => segments.reduce((sum, s) => sum + Math.max(s.value, 0), 0),
    [segments],
  );

  const rings = useMemo(() => {
    const baseRadius = 58;
    const ringSpacing = 14;
    return segments.slice(0, 3).map((seg, idx) => {
      const r = baseRadius - idx * ringSpacing;
      const circumference = 2 * Math.PI * r;
      const pct = realTotal > 0 ? Math.min(Math.max(seg.value / realTotal, 0), 1) : 0;
      const strokeDashoffset = circumference * (1 - pct);
      const percentageDisplay = realTotal > 0 ? `${Math.round((seg.value / realTotal) * 100)}%` : '—';
      return {
        ...seg,
        r,
        circumference,
        strokeDashoffset,
        pctDisplay: percentageDisplay,
      };
    });
  }, [segments, realTotal]);

  return (
    <View style={donutStyles.container}>
      <View style={donutStyles.headerRow}>
        <Text style={[donutStyles.title, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[donutStyles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>

      <View style={donutStyles.contentRow}>
        {/* Left: Circular Donut Ring Graphic */}
        <View style={donutStyles.chartWrapper}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            {rings.map((ring, idx) => (
              <G key={`track-${idx}`}>
                {/* Background track (always clearly visible in both light & dark mode) */}
                <Circle
                  cx={70}
                  cy={70}
                  r={ring.r}
                  stroke={isDark ? colors.surfaceMuted : colors.borderSoft}
                  strokeWidth={9}
                  fill="none"
                />
                {/* Foreground arc (rendered if realTotal > 0 and ring.value > 0) */}
                {realTotal > 0 && ring.value > 0 && (
                  <Circle
                    cx={70}
                    cy={70}
                    r={ring.r}
                    stroke={ring.color}
                    strokeWidth={9}
                    strokeDasharray={`${ring.circumference} ${ring.circumference}`}
                    strokeDashoffset={ring.strokeDashoffset}
                    strokeLinecap="round"
                    fill="none"
                    transform="rotate(-90 70 70)"
                  />
                )}
              </G>
            ))}
          </Svg>

          {/* Center Badge */}
          <View style={donutStyles.centerBadge}>
            <Text
              style={[donutStyles.centerValueText, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              {centerValue || String(realTotal)}
            </Text>
            <Text style={[donutStyles.centerLabelText, { color: colors.textMuted }]}>
              {realTotal > 0 ? (centerLabel || 'TOTAL') : 'NO DATA'}
            </Text>
          </View>
        </View>

        {/* Right: Legend Breakdown Rows */}
        <View style={donutStyles.legendCol}>
          {rings.map((ring, idx) => (
            <View key={idx} style={donutStyles.legendItem}>
              <View style={[donutStyles.legendDot, { backgroundColor: ring.color }]} />
              <View style={donutStyles.legendInfo}>
                <Text style={[donutStyles.legendLabel, { color: colors.text }]} numberOfLines={1}>
                  {ring.label}
                </Text>
                <Text style={[donutStyles.legendSub, { color: colors.textMuted }]}>
                  {ring.formatted || ring.value}
                </Text>
              </View>
              <View style={[donutStyles.pctBadge, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[donutStyles.pctText, { color: ring.color }]}>
                  {ring.pctDisplay}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* Clear indicator when no data exists */}
      {realTotal === 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 10,
            paddingVertical: 5,
            paddingHorizontal: 10,
            backgroundColor: colors.surfaceMuted,
            borderRadius: 8,
          }}
        >
          <Ionicons name="information-circle-outline" size={13} color={colors.textMuted} />
          <Text style={{ fontSize: 11, color: colors.textMuted }}>
            {tr('b2_analyticsZeroAllocationTimeframe')}
          </Text>
        </View>
      )}
    </View>
  );
}

const donutStyles = StyleSheet.create({
  container: {
    width: '100%',
  },
  headerRow: {
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chartWrapper: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 68,
    height: 68,
  },
  centerValueText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  centerLabelText: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 1,
  },
  legendCol: {
    flex: 1,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendInfo: {
    flex: 1,
    minWidth: 0,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  legendSub: {
    fontSize: 10.5,
    marginTop: 1,
  },
  pctBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pctText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});

// ── 3. Horizontal Ratio Ribbon Bar (Horizontal Strip Shape) ──────────────────
function HorizontalRatioBar({
  title,
  segments,
}: {
  title: string;
  segments: { label: string; value: number; color: string }[];
}) {
  const { colors } = useTheme();
  const realTotal = useMemo(
    () => segments.reduce((s, x) => s + Math.max(x.value, 0), 0),
    [segments],
  );

  return (
    <View style={ratioStyles.container}>
      <Text style={[ratioStyles.title, { color: colors.text }]}>{title}</Text>
      <View style={[ratioStyles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
        {realTotal === 0 ? (
          <View style={{ flex: 1, height: '100%', backgroundColor: colors.borderSoft, opacity: 0.3 }} />
        ) : (
          segments.map((seg, idx) => {
            const flex = Math.max(seg.value, 0.01);
            return (
              <View
                key={idx}
                style={{
                  flex,
                  backgroundColor: seg.color,
                  height: '100%',
                }}
              />
            );
          })
        )}
      </View>
      <View style={ratioStyles.legendRow}>
        {segments.map((seg, idx) => {
          const pct = realTotal > 0 ? Math.round((Math.max(seg.value, 0) / realTotal) * 100) : 0;
          return (
            <View key={idx} style={ratioStyles.legendItem}>
              <View style={[ratioStyles.dot, { backgroundColor: seg.color }]} />
              <Text style={[ratioStyles.labelText, { color: colors.textMuted }]}>
                {seg.label}{realTotal > 0 ? ` (${pct}%)` : ''}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const ratioStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  labelText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

// ── 4. Salo-run Performance Chart Component (Dual-bar Sun-Sat + Scale) ───────

function SaloPerformanceChart({
  data,
  height = 180,
}: {
  data: PerformancePoint[];
  height?: number;
}) {
  const { colors } = useTheme();
  const bar1Color = colors.primary;
  const bar2Color = colors.accent;

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
  const roundedMax = maxValue > 0 ? Math.ceil(maxValue / 50) * 50 : 100;
  const scale = (height - 30) / roundedMax;
  const yAxisLabels = [roundedMax, roundedMax * 0.75, roundedMax * 0.5, roundedMax * 0.25, 0];

  return (
    <View style={perfStyles.container}>
      <View style={{ height, flexDirection: 'row' }}>
        {/* Left Y-axis scale labels */}
        <View style={[perfStyles.yAxis, { height: height - 20 }]}>
          {yAxisLabels.map((lbl, idx) => (
            <Text key={idx} style={[perfStyles.yAxisLabel, { color: colors.textMuted }]}>
              {Math.round(lbl)}
            </Text>
          ))}
        </View>

        {/* Chart plot area with horizontal grid lines and vertical dual-bars */}
        <View style={perfStyles.plotArea}>
          {/* Horizontal gridlines */}
          <View style={perfStyles.gridLinesWrapper}>
            {yAxisLabels.map((_, idx) => (
              <View key={idx} style={[perfStyles.gridLine, { backgroundColor: colors.borderSoft }]} />
            ))}
          </View>

          {/* 7 day columns */}
          <View style={[perfStyles.barsContainer, { height: height - 20 }]}>
            {chartData.map((item, idx) => {
              const isZero = maxValue === 0;
              const h1 = isZero ? 6 : Math.max(item.value1 * scale, item.value1 > 0 ? 4 : 2);
              const h2 = isZero ? 6 : Math.max(item.value2 * scale, item.value2 > 0 ? 4 : 2);
              return (
                <View key={idx} style={perfStyles.dayCol}>
                  <View style={perfStyles.barPair}>
                    {/* Primary V1 Bar (Brand Blue) */}
                    <View
                      style={[
                        perfStyles.bar,
                        {
                          height: h1,
                          backgroundColor: bar1Color,
                          opacity: isZero ? 0.35 : 1,
                        },
                      ]}
                    />
                    {/* Secondary V2 Bar (Signature Accent Pink) */}
                    <View
                      style={[
                        perfStyles.bar,
                        {
                          height: h2,
                          backgroundColor: bar2Color,
                          opacity: isZero ? 0.35 : 1,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </View>

          {/* Empty state informative overlay badge */}
          {maxValue === 0 && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  backgroundColor: colors.surfaceMuted,
                  borderWidth: 1,
                  borderColor: colors.borderSoft,
                }}
              >
                <Ionicons name="bar-chart-outline" size={13} color={colors.textMuted} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: colors.textMuted }}>
                  {tr('b2_analyticsZeroPerformancePeriod')}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* X-axis day labels */}
      <View style={perfStyles.xAxisRow}>
        <View style={{ width: 34 }} />
        <View style={perfStyles.xAxisLabels}>
          {chartData.map((item, idx) => (
            <Text key={idx} style={[perfStyles.xDayLabel, { color: colors.textMuted }]}>
              {item.day.slice(0, 3)}
            </Text>
          ))}
        </View>
      </View>

      {/* Legend below chart (Solid Brand Color Dot Badges) */}
      <View style={[perfStyles.legendRow, { borderTopColor: colors.borderSoft }]}>
        <View style={perfStyles.legendItem}>
          <View style={[perfStyles.legendDot, { backgroundColor: bar1Color }]} />
          <Text style={[perfStyles.legendText, { color: colors.textMuted }]}>{tr('b2_analyticsCurrentV1')}</Text>
        </View>
        <View style={perfStyles.legendItem}>
          <View style={[perfStyles.legendDot, { backgroundColor: bar2Color }]} />
          <Text style={[perfStyles.legendText, { color: colors.textMuted }]}>{tr('b2_analyticsCurrentV2')}</Text>
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
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
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
  const { colors } = useTheme();

  const getStatusStyle = (s?: string) => {
    switch (s) {
      case 'In Progress':
        return { bg: colors.tintAccent, text: colors.accent };
      case 'Completed':
        return { bg: colors.successBg, text: colors.success };
      case 'Pending':
        return { bg: colors.warningBg, text: colors.warning };
      default:
        return { bg: colors.infoBg, text: colors.info };
    }
  };

  const badge = status ? getStatusStyle(status) : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.row,
        { borderBottomColor: colors.borderSoft },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[rowStyles.avatarBox, { backgroundColor: colors.surfaceMuted }]}>
        {avatar ? (
          <RNImage source={{ uri: avatar }} style={rowStyles.avatarImg} />
        ) : (
          <Ionicons name="person" size={18} color={colors.textMuted} />
        )}
      </View>
      <View style={rowStyles.infoCol}>
        <Text style={[rowStyles.name, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[rowStyles.sub, { color: colors.textMuted }]} numberOfLines={1}>
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
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
  const { colors } = useTheme();
  const label = type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : 'Activity';
  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.borderSoft }]}>
      <View style={[rowStyles.activityDot, { backgroundColor: colors.accent }]} />
      <View style={rowStyles.infoCol}>
        <Text style={[rowStyles.activityLabel, { color: colors.accent }]}>{label}</Text>
        <Text style={[rowStyles.name, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
      </View>
      {createdAt ? (
        <Text style={[rowStyles.meta, { color: colors.textMuted }]}>{formatDate(createdAt)}</Text>
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
  const { colors } = useTheme();
  const isFailed = type.toUpperCase() === 'FAILED';
  const cleanName = cleanTransactionTitle(name) || name || 'Payment';
  const cleanSubtitle = subtitle ? cleanTransactionTitle(subtitle) : undefined;
  const cleanType = cleanTransactionStatus(type) || type;

  return (
    <View style={[rowStyles.row, { borderBottomColor: colors.borderSoft }]}>
      <View style={[rowStyles.avatarBox, { backgroundColor: colors.surfaceMuted }]}>
        {avatar ? (
          <RNImage source={{ uri: avatar }} style={rowStyles.avatarImg} />
        ) : (
          <Text style={[rowStyles.avatarInitial, { color: colors.textMuted }]}>
            {cleanName.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      <View style={rowStyles.infoCol}>
        <Text style={[rowStyles.name, { color: colors.text }]} numberOfLines={1}>
          {cleanName}
        </Text>
        <Text
          style={[
            rowStyles.sub,
            { color: isFailed ? colors.error : colors.textMuted },
          ]}
        >
          {cleanSubtitle || cleanType}
        </Text>
      </View>
      <Text
        style={[
          rowStyles.amount,
          { color: isFailed ? colors.error : colors.primary },
        ]}
      >
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
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  sub: {
    fontSize: 12,
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
  },
  activityLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  meta: {
    fontSize: 11,
  },
  amount: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});

// ── Screen Styles ─────────────────────────────────────────────────────────────
const useStyles = makeStyles((c, e) => ({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  topBarTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },



  // Segmented Timeframe Filter Tabs (salo-run .ck-tabs)
  filterTabsContainer: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: c.card,
    ...e(1),
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: c.textMuted,
  },
  filterTabTextActive: {
    color: c.primary,
    fontWeight: '700',
  },

  // Custom date inputs
  customDatesBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: c.card,
    borderRadius: radii.md,
    padding: 12,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  customDateInputGroup: {
    flex: 1,
    gap: 4,
  },
  customDateLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: c.textMuted,
  },
  customDateInput: {
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    color: c.text,
  },
  customApplyBtn: {
    backgroundColor: c.accent,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customApplyBtnDisabled: {
    backgroundColor: c.borderSoft,
    opacity: 0.6,
  },
  customApplyBtnText: {
    color: c.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },

  // StatCards Grid
  statCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  // Pending Payments Alert (salo-run .mobile-pending-payments)
  pendingAlertContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  pendingAlertWarning: {
    backgroundColor: c.warningBg,
    borderColor: c.borderSoft,
  },
  pendingAlertFailed: {
    backgroundColor: c.errorBg,
    borderColor: c.borderSoft,
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
    backgroundColor: c.warningBg,
  },
  pendingIconFailed: {
    backgroundColor: c.errorBg,
  },
  pendingAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  pendingAlertSubtitle: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
    color: c.textSoft,
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
    color: c.primary,
  },
  pendingCardsScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  pendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.card,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 10,
    minWidth: 260,
  },
  pendingCardAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceMuted,
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
    color: c.text,
    flexShrink: 1,
  },
  pendingStatusBadgeFailed: {
    backgroundColor: c.errorBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pendingStatusBadgeTextFailed: {
    fontSize: 9,
    fontWeight: '700',
    color: c.error,
  },
  pendingStatusBadgePartial: {
    backgroundColor: c.infoBg,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pendingStatusBadgeTextPartial: {
    fontSize: 9,
    fontWeight: '700',
    color: c.info,
  },
  pendingCardEvent: {
    fontSize: 11.5,
    color: c.textMuted,
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
    color: c.textOnPrimary,
  },

  // Section Cards
  sectionCard: {
    backgroundColor: c.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: 14,
    ...e(1),
  },
  sectionCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    color: c.text,
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
    color: c.primary,
  },
  listCardBody: {
    gap: 2,
  },
}));
