/**
 * Home tab — mobile port of the salo-run Client & Coordinator dashboards
 * (`pages/client/home.tsx` + `pages/event-coordinator/home.tsx`).
 *
 * Structure (matches the web 1:1, top to bottom):
 *   1. Hero card: gradient background + greeting + 3-stat snapshot
 *      (Client: Spent / Bookings / Photos; Coordinator: Revenue / Events
 *      / Photographers).
 *   2. Period filter tabs (Today / This week / This month).
 *   3. KPI grid — 5 cards (role-aware) with value + trend % vs period.
 *   4. Pending payments banner — horizontal scroll cards. Yellow for
 *      pending, red border per card when status === FAILED.
 *   5. Recent activity list (Client only — coordinator doesn't expose
 *      one yet).
 *   6. Quick actions tile grid (kept from the legacy home — gives users
 *      shortcuts to the screens not on the bottom tabs).
 *   7. Upcoming events / bookings / streams preview (kept).
 *
 * Photographer / Viewer fall back to the original quick-action layout
 * because their dashboards live on different pages.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image as RNImage } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FindPhotosBottomSheet } from '@/components/FindPhotosBottomSheet';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import { KycBanner } from '@/features/kyc/KycBanner';
import { ClientHome } from '@/features/dashboard/ClientHome';
import { PhotographerHome } from '@/features/dashboard/PhotographerHome';
import { CoordinatorHome } from '@/features/dashboard/CoordinatorHome';
import {
  type AnalyticsPeriod,
  type CoordinatorAnalytics,
  type CustomerAnalytics,
  type PendingPayment,
  type PerformancePoint,
  type PhotographerAnalytics,
  type RecentActivity,
  type RecentPayment,
  type RecentPhotographer,
  type TrendsMap,
  getCoordinatorAnalytics,
  getCoordinatorPendingPayments,
  getCoordinatorTrends,
  getCustomerAnalytics,
  getCustomerPendingPayments,
  getCustomerPerformance,
  getCustomerPhotographers,
  getCustomerRecentActivities,
  getCustomerRecentPayments,
  getCustomerTrends,
  getPhotographerAnalytics,
  getPhotographerTrends,
} from '@/features/analytics/api';
import { listCoordinatorEvents, listEvents, listPhotographerEvents } from '@/features/events/api';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { listStreams } from '@/features/streams/api';
import { getWallet } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';
import { colors, spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';

// ────── Greetings (web parity: pages/client/home.tsx:64-114) ──────────────

const GREETINGS = {
  morning: ['Good Morning', 'Beautiful Morning', 'Rise and Shine'],
  afternoon: ['Good Afternoon', 'Lovely Afternoon', 'Wonderful Afternoon'],
  evening: ['Good Evening', 'Lovely Evening', 'Peaceful Evening'],
  night: ['Good Night', 'Quiet Night', 'Starry Night'],
} as const;

const SUBTITLES_CLIENT: Record<keyof typeof GREETINGS, string> = {
  morning: 'Ready to discover amazing photographers for your next event?',
  afternoon: 'Perfect time to browse through your galleries!',
  evening: "Time to relive today's beautiful moments!",
  night: 'Late night browsing? Your galleries await!',
};

const SUBTITLES_COORDINATOR: Record<keyof typeof GREETINGS, string> = {
  morning: "Let's plan something amazing today!",
  afternoon: 'Hope your events are running smoothly!',
  evening: "Time to review today's event performance!",
  night: 'Late night planning? Your events dashboard awaits!',
};

function getTimeOfDay(): keyof typeof GREETINGS {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

type Href =
  | '/events'
  | '/wallet'
  | '/streams'
  | '/photographers'
  | '/packages'
  | '/gallery'
  | '/find-my-photos'
  | '/donations'
  | '/clients'
  | '/payments'
  | '/collaborate';

type Action = { label: string; icon: keyof typeof Ionicons.glyphMap; href: Href };

const COMMON_TAIL: Action[] = [
  { label: 'Gallery', icon: 'images', href: '/gallery' },
  { label: 'Donate', icon: 'heart', href: '/donations' },
];

const ACTIONS_BY_ROLE: Record<string, Action[]> = {
  Client: [
    { label: 'Find Photographers', icon: 'camera', href: '/photographers' },
    { label: 'Find My Photos', icon: 'scan', href: '/find-my-photos' },
    ...COMMON_TAIL,
  ],
  Photographer: [
    { label: 'My Packages', icon: 'pricetags', href: '/packages' },
    { label: 'Clients', icon: 'people', href: '/clients' },
    { label: 'Collaborate', icon: 'people-circle', href: '/collaborate' },
    ...COMMON_TAIL,
  ],
  Coordinator: [
    { label: 'Find Photographers', icon: 'camera', href: '/photographers' },
    { label: 'Find My Photos', icon: 'scan', href: '/find-my-photos' },
    ...COMMON_TAIL,
  ],
  Viewer: [
    { label: 'Live Streams', icon: 'videocam', href: '/streams' },
    { label: 'Find My Photos', icon: 'scan', href: '/find-my-photos' },
    ...COMMON_TAIL,
  ],
};

type Preview = { id: string; title: string; subtitle?: string; status?: string; onPress: () => void };

const PERIOD_TABS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom' },
];

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = {
  today: 'yesterday',
  week: 'last week',
  month: 'last month',
  custom: 'custom',
};

export default function HomeScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const user = useAuth((s) => s.user);
  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);
  const [payNowOpen, setPayNowOpen] = useState(false);
  const [payNowPayment, setPayNowPayment] = useState<PendingPayment | null>(null);
  const { role, isClient, isCoordinator, isPhotographer, isViewer } = useRole();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const name = user?.firstName || 'there';

  const showsDashboard = isClient || isCoordinator || isPhotographer;

  // ── Greeting + cycling lead copy ────────────────────────────────────────
  const [timeOfDay, setTimeOfDay] = useState<keyof typeof GREETINGS>(getTimeOfDay);
  const [greetingIndex, setGreetingIndex] = useState(0);
  useEffect(() => {
    const tick = setInterval(() => setTimeOfDay(getTimeOfDay()), 60_000);
    return () => clearInterval(tick);
  }, []);
  useEffect(() => {
    const cycle = setInterval(
      () => setGreetingIndex((i) => (i + 1) % GREETINGS[timeOfDay].length),
      5_000,
    );
    return () => clearInterval(cycle);
  }, [timeOfDay]);
  const currentGreeting = GREETINGS[timeOfDay][greetingIndex];
  const subtitle = (isCoordinator ? SUBTITLES_COORDINATOR : SUBTITLES_CLIENT)[timeOfDay];

  // ── Period filter ──────────────────────────────────────────────────────
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');

  // ── Wallet + upcoming feed (kept for non-dashboard roles) ──────────────
  const wallet = useAsync(useCallback(() => getWallet(), []));
  const upcoming = useAsync(
    useCallback(async (): Promise<Preview[]> => {
      if (isPhotographer) {
        // Pull from /photographer/events (assigned-to-me feed) so
        // every preview row carries a real event id we can route to.
        // listBookings() rows sometimes shipped without eventId (the
        // /bookings DTO nests Event differently per endpoint) and the
        // fallback /bookings route doesn't exist anymore — the tap
        // became a no-op. Photographer events come back already
        // sorted newest-first (see EventsList) so .slice(0,3) is
        // exactly what we want for the dashboard preview.
        const events = await listPhotographerEvents();
        // Sort newest-first by createdAt so the preview matches the
        // /events tab the photographer sees one tap away.
        const sorted = [...events].sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        });
        return sorted.slice(0, 3).map((e) => ({
          id: e.id,
          title: e.title,
          subtitle: [e.eventDate ? formatDate(e.eventDate) : null, e.location]
            .filter(Boolean)
            .join(' · '),
          status: e.bookingStatus ?? e.status,
          onPress: () => router.push(`/event/${e.id}` as never),
        }));
      }
      if (isViewer) {
        const streams = await listStreams();
        return streams.slice(0, 3).map((s) => ({
          id: s.id,
          title: s.title,
          subtitle: s.photographerName,
          status: s.isLive ? 'Live' : undefined,
          onPress: () => router.push(`/stream/${s.id}` as never),
        }));
      }
      const events = isCoordinator ? await listCoordinatorEvents() : await listEvents();
      return events.slice(0, 3).map((e) => ({
        id: e.id,
        title: e.title,
        subtitle: [formatDate(e.eventDate), e.location].filter(Boolean).join(' · '),
        status: e.status,
        onPress: () => router.push(`/event/${e.id}` as never),
      }));
    }, [isPhotographer, isViewer, isCoordinator, router]),
  );

  // ── Dashboard data (Client + Coordinator + Photographer) ──────────────
  const [analyticsClient, setAnalyticsClient] = useState<CustomerAnalytics | null>(null);
  const [analyticsCoord, setAnalyticsCoord] = useState<CoordinatorAnalytics | null>(null);
  const [analyticsPhotog, setAnalyticsPhotog] = useState<PhotographerAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendsMap>({});
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [photographers, setPhotographers] = useState<RecentPhotographer[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [performance, setPerformance] = useState<PerformancePoint[]>([]);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loadingDash, setLoadingDash] = useState(false);

  // The raw text inputs used to sit in loadDashboard's dep array, so typing
  // "2026-08-01" fired a full seven-request dashboard reload on every single
  // keystroke. Debounce so the reload happens once the date stops changing.
  const [debouncedFrom, setDebouncedFrom] = useState('');
  const [debouncedTo, setDebouncedTo] = useState('');
  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedFrom(customFrom);
      setDebouncedTo(customTo);
    }, 400);
    return () => clearTimeout(id);
  }, [customFrom, customTo]);

  // Every load takes a ticket; only the newest one may write state. Without
  // this a slow earlier response landed after a newer one and the dashboard
  // showed figures for a period the user had already moved off.
  const loadGeneration = useRef(0);

  const loadDashboard = useCallback(async () => {
    if (!showsDashboard) return;
    const myGeneration = ++loadGeneration.current;
    const isCurrent = () => myGeneration === loadGeneration.current;
    setLoadingDash(true);
    try {
      if (isClient) {
        const from = period === 'custom' ? debouncedFrom : undefined;
        const to = period === 'custom' ? debouncedTo : undefined;
        const [a, t, p, recent, photogs, payments, perf] = await Promise.allSettled([
          getCustomerAnalytics(),
          getCustomerTrends(period, from, to),
          getCustomerPendingPayments(),
          getCustomerRecentActivities(),
          getCustomerPhotographers(),
          getCustomerRecentPayments(),
          getCustomerPerformance(period, from, to),
        ]);
        if (!isCurrent()) return;
        if (a.status === 'fulfilled') setAnalyticsClient(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
        if (p.status === 'fulfilled') setPending(p.value);
        if (recent.status === 'fulfilled') setActivities(recent.value);
        if (photogs.status === 'fulfilled') setPhotographers(photogs.value);
        if (payments.status === 'fulfilled') setRecentPayments(payments.value);
        if (perf.status === 'fulfilled') setPerformance(perf.value);
      } else if (isCoordinator) {
        const [a, t, p] = await Promise.allSettled([
          getCoordinatorAnalytics(),
          getCoordinatorTrends(period),
          getCoordinatorPendingPayments(),
        ]);
        if (!isCurrent()) return;
        if (a.status === 'fulfilled') setAnalyticsCoord(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
        if (p.status === 'fulfilled') setPending(p.value);
      } else if (isPhotographer) {
        const [a, t] = await Promise.allSettled([
          getPhotographerAnalytics(),
          getPhotographerTrends(period),
        ]);
        if (!isCurrent()) return;
        if (a.status === 'fulfilled') setAnalyticsPhotog(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
      }
    } finally {
      // Only the newest load owns the spinner, or a superseded one turns it
      // off while the current request is still in flight.
      if (isCurrent()) setLoadingDash(false);
    }
  }, [showsDashboard, isClient, isCoordinator, isPhotographer, period, debouncedFrom, debouncedTo]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ── Derived dashboard view-models ──────────────────────────────────────
  const heroStats = useMemo(() => {
    if (isClient && analyticsClient) {
      return [
        { label: 'Spent', value: formatPrice(analyticsClient.totalSpent, wallet.data?.currency), tone: colors.primary },
        { label: 'Bookings', value: String(analyticsClient.totalBookings), tone: colors.accent },
        { label: 'Photos', value: String(analyticsClient.totalPhotos), tone: '#10B981' },
      ];
    }
    if (isCoordinator && analyticsCoord) {
      return [
        { label: 'Revenue', value: formatPrice(analyticsCoord.totalRevenue, wallet.data?.currency), tone: colors.primary },
        { label: 'Events', value: String(analyticsCoord.totalEvents), tone: colors.accent },
        { label: 'Photographers', value: String(analyticsCoord.totalPhotographers), tone: '#10B981' },
      ];
    }
    if (isPhotographer && analyticsPhotog) {
      return [
        { label: 'Earnings', value: formatPrice(analyticsPhotog.totalEarnings, wallet.data?.currency), tone: colors.primary },
        { label: 'Clients', value: String(analyticsPhotog.totalClients), tone: colors.accent },
        { label: 'Photos', value: String(analyticsPhotog.totalPhotosUploaded), tone: '#10B981' },
      ];
    }
    return [];
  }, [isClient, isCoordinator, isPhotographer, analyticsClient, analyticsCoord, analyticsPhotog, wallet.data?.currency]);

  const kpis = useMemo(() => {
    if (isClient && analyticsClient) {
      return [
        kpi('Total Spent', formatPrice(analyticsClient.totalSpent, wallet.data?.currency), 'cash-outline', '#083A85', trends.totalSpent),
        kpi('Pending', formatPrice(analyticsClient.pendingAmount, wallet.data?.currency), 'time-outline', '#F59E0B', trends.pending),
        kpi('Bookings', String(analyticsClient.totalBookings), 'people-outline', '#3B82F6', trends.events, '/events'),
        kpi('Gifts', formatPrice(analyticsClient.gifts, wallet.data?.currency), 'gift-outline', '#10B981', trends.gifts),
        kpi('Favorites', String(analyticsClient.bookmarkedPhotographers), 'star-outline', '#8B5CF6', trends.photographers, '/photographers'),
      ];
    }
    if (isCoordinator && analyticsCoord) {
      return [
        kpi('Revenue', formatPrice(analyticsCoord.totalRevenue, wallet.data?.currency), 'cash-outline', '#083A85', trends.totalRevenue),
        kpi('Pending', formatPrice(analyticsCoord.totalPending, wallet.data?.currency), 'time-outline', '#F59E0B', trends.totalPending),
        kpi('Events', String(analyticsCoord.totalEvents), 'calendar-outline', '#3B82F6', trends.totalEvents, '/events'),
        kpi('Clients', String(analyticsCoord.totalCustomers), 'people-outline', '#10B981', trends.totalCustomers),
        kpi('Photographers', String(analyticsCoord.totalPhotographers), 'camera-outline', '#8B5CF6', trends.totalPhotographers, '/photographers'),
      ];
    }
    if (isPhotographer && analyticsPhotog) {
      return [
        kpi('Total Earnings', formatPrice(analyticsPhotog.totalEarnings, wallet.data?.currency), 'cash-outline', '#083A85', trends.totalEarnings, '/transactions'),
        kpi('Pending', formatPrice(analyticsPhotog.pendingPayments, wallet.data?.currency), 'time-outline', '#F59E0B', trends.pending, '/transactions'),
        kpi('Total clients', String(analyticsPhotog.totalClients), 'people-outline', '#3B82F6', trends.clients, '/clients'),
        kpi('Bonuses', formatPrice(analyticsPhotog.bonuses, wallet.data?.currency), 'gift-outline', '#10B981', trends.bonuses, '/transactions'),
        kpi(
          'Ratings',
          `${(analyticsPhotog.averageRating ?? 5).toFixed(1)}/5`,
          'star-outline',
          '#8B5CF6',
          trends.rating,
          '/profile',
        ),
      ];
    }
    return [];
  }, [isClient, isCoordinator, isPhotographer, analyticsClient, analyticsCoord, analyticsPhotog, wallet.data?.currency, trends]);

  const totalPendingAmount = pending.reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const hasFailedPayments = pending.some((p) => p.status === 'failed');

  // ── Render ────────────────────────────────────────────────────────────
  // The `User`, `Client`, `Photographer`, and `Coordinator` roles have specialized,
  // role-tailored homes rather than the generic business analytics dashboard.
  if (isClient) return <ClientHome />;
  if (isPhotographer) return <PhotographerHome />;
  if (isCoordinator) return <CoordinatorHome />;

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}>
        <KycBanner />
        {showsDashboard ? (
          <>
            <DashboardHero
              greeting={currentGreeting}
              name={name}
              subtitle={subtitle}
              stats={heroStats}
            />

            <View style={styles.periodTabs}>
              {PERIOD_TABS.map((t) => {
                const active = period === t.value;
                return (
                  <Pressable
                    key={t.value}
                    onPress={() => setPeriod(t.value)}
                    style={[styles.periodTab, active && styles.periodTabActive]}
                  >
                    <Text style={[styles.periodTabText, active && styles.periodTabTextActive]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {period === 'custom' ? (
              <View style={styles.customDateRow}>
                <View style={styles.customDateField}>
                  <Text style={styles.customDateLabel}>From</Text>
                  <TextInput
                    style={styles.customDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                    value={customFrom}
                    onChangeText={setCustomFrom}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
                <View style={styles.customDateField}>
                  <Text style={styles.customDateLabel}>To</Text>
                  <TextInput
                    style={styles.customDateInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={colors.textMuted}
                    value={customTo}
                    onChangeText={setCustomTo}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                </View>
              </View>
            ) : null}

            {loadingDash && kpis.length === 0 ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
            ) : (
              <View style={styles.kpiGrid}>
                {kpis.map((k) => (
                  <KpiCard
                    key={k.title}
                    title={k.title}
                    value={k.value}
                    icon={k.icon}
                    accent={k.accent}
                    trend={k.trend}
                    timeframe={PERIOD_LABEL[period]}
                    onPress={k.href ? () => router.push(k.href as never) : undefined}
                  />
                ))}
              </View>
            )}

            {pending.length > 0 ? (
              <PendingPaymentsAlert
                items={pending}
                hasFailed={hasFailedPayments}
                totalPendingAmount={totalPendingAmount}
                currency={wallet.data?.currency}
                onViewAll={() => router.push('/payments')}
                onPayNow={(p) => {
                  setPayNowPayment(p);
                  setPayNowOpen(true);
                }}
              />
            ) : null}

            {activities.length > 0 ? (
              <Section title="Recent activity">
                {activities.map((a) => (
                  <ActivityRow key={a.id} activity={a} router={router} />
                ))}
              </Section>
            ) : null}

            {performance.length > 0 ? (
              <Section title="Performance">
                <PerformanceMiniChart data={performance} />
              </Section>
            ) : null}

            {photographers.length > 0 ? (
              <Section title="Photographers">
                <View style={styles.photographerCard}>
                  {photographers.map((p) => (
                    <PhotographerRow key={p.id} photographer={p} onPress={() => router.push('/photographers' as never)} />
                  ))}
                </View>
              </Section>
            ) : null}

            {recentPayments.length > 0 ? (
              <Section title="Recent payments">
                <View style={styles.photographerCard}>
                  {recentPayments.map((p) => (
                    <RecentPaymentRow key={p.id} payment={p} currency={wallet.data?.currency} />
                  ))}
                </View>
              </Section>
            ) : null}
          </>
        ) : (
          <SimpleHeader name={name} role={role} wallet={wallet} router={router} />
        )}

        {/* Quick actions (kept for every role — shortcuts to non-tab screens) */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionsPanel}>
          {/* ROLE INVARIANT: an unknown role shows NO shortcuts rather than
              borrowing Client's — the old `?? ACTIONS_BY_ROLE.Client` silently
              handed Client's actions to whoever had no resolved role. */}
          {((role && ACTIONS_BY_ROLE[role]) || []).map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
              onPress={() => {
                if (a.href === '/find-my-photos') setFindPhotosModalVisible(true);
                else router.push(a.href as never);
              }}
            >
              <View style={styles.tileIcon}>
                <Ionicons name={a.icon} size={22} color={colors.textOnPrimary} />
              </View>
              <Text style={styles.tileLabel} numberOfLines={2}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Upcoming feed (kept) */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>
            {isPhotographer ? 'Recent bookings' : isViewer ? 'Live now' : 'Upcoming events'}
          </Text>
          <Pressable onPress={() => router.push(isViewer ? '/streams' : '/events')}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>

        {upcoming.loading && !upcoming.data ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : upcoming.data?.length ? (
          upcoming.data.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.previewRow, pressed && styles.pressed]}
              onPress={item.onPress}
            >
              <View style={styles.previewBody}>
                <Text style={styles.previewTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                {item.subtitle ? (
                  <Text style={styles.previewSub} numberOfLines={1}>
                    {item.subtitle}
                  </Text>
                ) : null}
              </View>
              {item.status ? <StatusPill status={item.status} /> : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          ))
        ) : (
          <Text style={styles.muted}>Nothing here yet.</Text>
        )}
      </ScrollView>

      <FindPhotosBottomSheet
        visible={findPhotosModalVisible}
        onClose={() => setFindPhotosModalVisible(false)}
        getPhotosRoute="/find-my-photos"
      />

      <PayNowSheet
        payment={payNowPayment}
        visible={payNowOpen}
        onClose={() => setPayNowOpen(false)}
        onSuccess={() => {
          // Refresh the dashboard data so the just-paid item disappears
          // and the KPI cards reflect the new totals.
          loadDashboard();
        }}
      />

      <TopBar />
    </Screen>
  );
}

// ────── Components ────────────────────────────────────────────────────────

function DashboardHero({
  greeting,
  name,
  subtitle,
  stats,
}: {
  greeting: string;
  name: string;
  subtitle: string;
  stats: { label: string; value: string; tone: string }[];
}) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  return (
    <LinearGradient
      colors={[...gradients.wash]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroAccent} />
      <Text style={styles.heroEyebrow}>YOUR DASHBOARD</Text>
      <Text style={styles.heroTitle}>
        {greeting}, <Text style={{ color: colors.accent }}>{name}</Text>
      </Text>
      <Text style={styles.heroSub}>{subtitle}</Text>

      {stats.length > 0 ? (
        <View style={styles.heroStatsCard}>
          {stats.map((s) => (
            <View key={s.label} style={styles.heroStatCell}>
              <Text style={styles.heroStatLabel}>{s.label}</Text>
              <Text style={[styles.heroStatValue, { color: s.tone }]} numberOfLines={1}>
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
}

type KpiSpec = {
  title: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  trend?: { percentage: string; direction: 'up' | 'down' };
  href?: string;
};

function kpi(
  title: string,
  value: string,
  icon: KpiSpec['icon'],
  accent: string,
  trend?: KpiSpec['trend'],
  href?: string,
): KpiSpec {
  return { title, value, icon, accent, trend, href };
}

function KpiCard({
  title,
  value,
  icon,
  accent,
  trend,
  timeframe,
  onPress,
}: KpiSpec & { timeframe: string; onPress?: () => void }) {
  const styles = useStyles();
  const dir = trend?.direction ?? 'up';
  const trendColor = dir === 'up' ? '#10B981' : '#EF4444';
  return (
    <Pressable
      style={({ pressed }) => [styles.kpi, pressed && onPress && styles.pressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.kpiHead}>
        <View style={[styles.kpiIcon, { backgroundColor: accent + '20' }]}>
          <Ionicons name={icon} size={16} color={accent} />
        </View>
        {trend ? (
          <View style={styles.kpiTrend}>
            <Ionicons
              name={dir === 'up' ? 'trending-up' : 'trending-down'}
              size={11}
              color={trendColor}
            />
            <Text style={[styles.kpiTrendText, { color: trendColor }]}>{trend.percentage}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.kpiTitle}>{title}</Text>
      <Text style={styles.kpiValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.kpiTimeframe}>vs {timeframe}</Text>
    </Pressable>
  );
}

function PendingPaymentsAlert({
  items,
  hasFailed,
  totalPendingAmount,
  currency,
  onViewAll,
  onPayNow,
}: {
  items: PendingPayment[];
  hasFailed: boolean;
  totalPendingAmount: number;
  currency?: string;
  onViewAll: () => void;
  onPayNow: (p: PendingPayment) => void;
}) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const tone = hasFailed ? colors.errorBg : colors.warningBg;
  const stroke = hasFailed ? colors.error : colors.warning;
  const titleText = hasFailed ? 'Payment action required' : 'Pending payments';
  return (
    <View style={[styles.alert, { backgroundColor: tone, borderColor: stroke + '40' }]}>
      <View style={styles.alertHead}>
        <View style={[styles.alertIcon, { backgroundColor: stroke + '20' }]}>
          <Ionicons name="alert-circle" size={18} color={stroke} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.alertTitle, { color: stroke }]}>{titleText}</Text>
          <Text style={[styles.alertSub, { color: stroke }]}>
            {items.length} payment{items.length === 1 ? '' : 's'} totaling{' '}
            <Text style={{ fontWeight: fontWeight.extrabold }}>
              {formatPrice(totalPendingAmount, currency)}
            </Text>
          </Text>
        </View>
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={[styles.alertLink, { color: stroke }]}>View all →</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.alertScroll}
      >
        {items.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => onPayNow(p)}
            style={({ pressed }) => [
              styles.payCard,
              p.status === 'failed' && { borderColor: colors.error + '60' },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={styles.payAvatar}>
              {p.photographerImage ? (
                <RNImage source={{ uri: p.photographerImage }} style={styles.payAvatarImg} />
              ) : (
                <Ionicons name="person" size={18} color={colors.textMuted} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.payNameRow}>
                <Text style={styles.payName} numberOfLines={1}>
                  {p.photographerName}
                </Text>
                {p.status === 'failed' ? (
                  <View style={[styles.payChip, { backgroundColor: colors.error + '20' }]}>
                    <Text style={[styles.payChipText, { color: colors.error }]}>FAILED</Text>
                  </View>
                ) : p.status === 'partially_paid' ? (
                  <View style={[styles.payChip, { backgroundColor: colors.infoBg }]}>
                    <Text style={[styles.payChipText, { color: colors.info }]}>PARTIAL</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.payEvent} numberOfLines={1}>
                {p.eventName}
              </Text>
              <Text
                style={[
                  styles.payAmount,
                  { color: p.status === 'failed' ? colors.error : colors.primary },
                ]}
              >
                {formatPrice(p.amount - p.paidAmount, currency)}
              </Text>
              <View style={styles.payNowChip}>
                <Ionicons name="card" size={11} color={colors.textOnPrimary} />
                <Text style={styles.payNowChipText}>Pay now</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Recent activity row on the Home dashboard.
 *
 * The backend returns activities as `{ id, type, title, createdAt }`
 * with `type` shaped like `BOOKING_CREATED` / `EVENT_COMPLETED` /
 * `PAYMENT_RECEIVED`. Previously this rendered as a plain View with
 * the type stringified as `Booking_created` (a half-cased enum that
 * looked unfinished) — and the row didn't react to taps.
 *
 * Now: pretty label (snake_case → Title Case), per-type icon, chevron,
 * and the row navigates to the matching list screen based on type
 * prefix (the activity payload doesn't carry the underlying entityId,
 * so we route to the list and let the user pick from there).
 */
function ActivityRow({
  activity,
  router,
}: {
  activity: RecentActivity;
  router: ReturnType<typeof useRouter>;
}) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const { label, icon, href } = describeActivity(activity.type);

  return (
    <Pressable
      style={({ pressed }) => [styles.activityRow, pressed && styles.pressed]}
      onPress={() => router.push(href as never)}
      accessibilityRole="button"
      accessibilityLabel={`Open ${label}: ${activity.title}`}
      android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
    >
      <View style={styles.activityIcon}>
        <Ionicons name={icon} size={16} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.activityLabel}>{label}</Text>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {activity.title}
        </Text>
      </View>
      {activity.createdAt ? (
        <Text style={styles.activityTime}>{formatDate(activity.createdAt)}</Text>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function describeActivity(rawType: string): {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  href: string;
} {
  const t = (rawType || '').toUpperCase();
  // Pretty-format BOOKING_CREATED → "Booking created".
  const label = t
    .split('_')
    .filter(Boolean)
    .map((w, i) => (i === 0 ? w.charAt(0) + w.slice(1).toLowerCase() : w.toLowerCase()))
    .join(' ');

  if (t.startsWith('BOOKING')) return { label, icon: 'calendar-outline', href: '/bookings' };
  if (t.startsWith('EVENT')) return { label, icon: 'calendar', href: '/events' };
  if (t.startsWith('PAYMENT') || t.startsWith('TRANSACTION'))
    return { label, icon: 'card-outline', href: '/transactions' };
  if (t.startsWith('PHOTOBOOK')) return { label, icon: 'book-outline', href: '/photobooks' };
  if (t.startsWith('ALBUM') || t.startsWith('GALLERY'))
    return { label, icon: 'images-outline', href: '/gallery' };
  if (t.startsWith('REVIEW') || t.startsWith('RATING'))
    return { label, icon: 'star-outline', href: '/profile' };
  if (t.startsWith('MESSAGE') || t.startsWith('CHAT'))
    return { label, icon: 'chatbubble-outline', href: '/inbox' };
  if (t.startsWith('STREAM')) return { label, icon: 'videocam-outline', href: '/streams' };
  return { label: label || 'Activity', icon: 'pulse-outline', href: '/events' };
}

function SimpleHeader({
  name,
  role,
  wallet,
  router,
}: {
  name: string;
  /** Absent when the session carries no resolved role — the badge is then hidden
      rather than showing a substituted one. */
  role: string | undefined;
  wallet: ReturnType<typeof useAsync<Awaited<ReturnType<typeof getWallet>>>>;
  router: ReturnType<typeof useRouter>;
}) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {name} 👋</Text>
        {role ? (
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{role}</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.balanceCard, pressed && styles.cardPressed]}
        onPress={() => router.push('/wallet')}
      >
        <Text style={styles.balanceLabel}>Wallet balance</Text>
        <Text style={styles.balanceValue}>
          {wallet.loading && !wallet.data ? '—' : formatPrice(wallet.data?.total, wallet.data?.currency)}
        </Text>
        <View style={styles.balanceFoot}>
          <Text style={styles.balanceLink}>Open wallet</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accentLight} />
        </View>
      </Pressable>
    </>
  );
}

function PerformanceMiniChart({ data }: { data: PerformancePoint[] }) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const maxVal = Math.max(...data.flatMap((d) => [d.value1, d.value2]), 1);
  return (
    <View style={styles.perfCard}>
      <View style={styles.perfBars}>
        {data.map((d, i) => (
          <View key={i} style={styles.perfCol}>
            <View style={styles.perfBarGroup}>
              <View style={[styles.perfBar, styles.perfBar1, { height: Math.max(4, (d.value1 / maxVal) * 80) }]} />
              <View style={[styles.perfBar, styles.perfBar2, { height: Math.max(4, (d.value2 / maxVal) * 80) }]} />
            </View>
            <Text style={styles.perfDayLabel} numberOfLines={1}>{d.day.slice(0, 3)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.perfLegend}>
        <View style={styles.perfLegendItem}>
          <View style={[styles.perfLegendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.perfLegendText}>Bookings</Text>
        </View>
        <View style={styles.perfLegendItem}>
          <View style={[styles.perfLegendDot, { backgroundColor: colors.accent }]} />
          <Text style={styles.perfLegendText}>Spent</Text>
        </View>
      </View>
    </View>
  );
}

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  'In Progress': { bg: '#FCE7F3', text: '#DB2777' },
  Completed: { bg: '#D1FAE5', text: '#059669' },
  Pending: { bg: '#FEF3C7', text: '#D97706' },
};

function PhotographerRow({
  photographer,
  onPress,
}: {
  photographer: RecentPhotographer;
  onPress: () => void;
}) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const chip = STATUS_COLOR[photographer.status] ?? { bg: colors.surfaceMuted, text: colors.textMuted };
  return (
    <Pressable
      style={({ pressed }) => [styles.photogRow, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.photogAvatar}>
        {photographer.avatar ? (
          <RNImage source={{ uri: photographer.avatar }} style={styles.photogAvatarImg} />
        ) : (
          <Ionicons name="person" size={18} color={colors.textMuted} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.photogName} numberOfLines={1}>{photographer.name}</Text>
        <Text style={styles.photogEvent} numberOfLines={1}>{photographer.event}</Text>
      </View>
      <View style={[styles.photogChip, { backgroundColor: chip.bg }]}>
        <Text style={[styles.photogChipText, { color: chip.text }]}>{photographer.status}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function RecentPaymentRow({
  payment,
  currency,
}: {
  payment: RecentPayment;
  currency?: string;
}) {
  const { colors, gradients } = useTheme();
  const styles = useStyles();
  const isFailure = payment.type === 'Failed';
  const typeColor = isFailure ? colors.error : colors.warning;
  return (
    <View style={styles.photogRow}>
      <View style={styles.photogAvatar}>
        {payment.avatar ? (
          <RNImage source={{ uri: payment.avatar }} style={styles.photogAvatarImg} />
        ) : (
          <Ionicons name="person" size={18} color={colors.textMuted} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.photogName} numberOfLines={1}>{payment.name}</Text>
        <Text style={[styles.photogEvent, { color: typeColor }]}>{payment.type}</Text>
      </View>
      <Text style={[styles.recentPayAmount, { color: isFailure ? colors.error : colors.primary }]}>
        {formatPrice(payment.amount, currency)}
      </Text>
    </View>
  );
}

// ────── Styles ────────────────────────────────────────────────────────────

const useStyles = makeStyles((c, e) => ({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 120, gap: spacing.lg },

  // Hero
  hero: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    gap: spacing.sm,
  },
  heroAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: c.primary,
  },
  heroEyebrow: {
    color: c.accent,
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 1.4,
  },
  heroTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text, lineHeight: 28 },
  heroSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textSoft },
  heroStatsCard: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroStatCell: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  heroStatLabel: {
    color: c.textMuted,
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroStatValue: { fontFamily: fonts.bold, fontSize: fontSize.md, fontWeight: fontWeight.extrabold, marginTop: 3 },

  // Period tabs
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    padding: 3,
    gap: 2,
  },
  periodTab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radii.full },
  periodTabActive: {
    backgroundColor: c.surface,
    ...e(1),
  },
  periodTabText: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: fontWeight.semibold },
  periodTabTextActive: { color: c.primary, fontWeight: fontWeight.bold },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 2,
  },
  kpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kpiTrend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  kpiTrendText: { fontSize: 10, fontWeight: fontWeight.bold },
  kpiTitle: { fontFamily: fonts.regular, fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold, marginTop: 6 },
  kpiValue: { fontFamily: fonts.bold, fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: c.text },
  kpiTimeframe: { fontFamily: fonts.regular, fontSize: 10, color: c.textMuted },

  // Pending payments alert
  alert: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  alertHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  alertIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontFamily: fonts.bold, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  alertSub: { fontFamily: fonts.regular, fontSize: fontSize.xs, marginTop: 2 },
  alertLink: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  alertScroll: { gap: spacing.sm, paddingTop: 4 },
  payCard: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    width: 240,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.sm,
  },
  payAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  payAvatarImg: { width: 36, height: 36 },
  payNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payName: { color: c.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flexShrink: 1 },
  payChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.full },
  payChipText: { fontSize: 9, fontWeight: fontWeight.bold },
  payEvent: { color: c.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  payAmount: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, marginTop: 2 },
  payNowChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginTop: 6,
  },
  payNowChipText: { color: c.textOnPrimary, fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.5 },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent },
  activityIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLabel: { fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold, textTransform: 'uppercase' },
  activityTitle: { fontSize: fontSize.sm, color: c.text, fontWeight: fontWeight.semibold, marginTop: 2 },
  activityTime: { fontSize: 10, color: c.textMuted },

  // Legacy header (Photographer / Viewer)
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },
  roleBadge: {
    backgroundColor: c.infoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  roleText: { color: c.info, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  balanceCard: {
    backgroundColor: c.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    shadowColor: c.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardPressed: { opacity: 0.95 },
  balanceLabel: { color: '#C7D2FE', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  balanceValue: { color: c.textOnPrimary, fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold },
  balanceFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  balanceLink: { color: c.accentLight, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Sections
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { color: c.primary, fontFamily: fonts.bold, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Quick actions
  actionsPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: c.primary,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    shadowColor: c.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  tile: {
    width: '50%',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  pressed: { opacity: 0.6 },
  tileIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: fonts.bold,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: c.textOnPrimary,
    textAlign: 'center',
  },

  loader: { alignSelf: 'flex-start' },
  muted: { color: c.textMuted, fontSize: fontSize.sm },

  // Custom date range
  customDateRow: { flexDirection: 'row', gap: spacing.sm },
  customDateField: { flex: 1, gap: 4 },
  customDateLabel: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: fontWeight.semibold },
  customDateInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    color: c.text,
  },

  // Performance chart
  perfCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  perfBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 96 },
  perfCol: { flex: 1, alignItems: 'center', gap: 4 },
  perfBarGroup: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  perfBar: { width: 8, borderRadius: 4 },
  perfBar1: { backgroundColor: c.primary },
  perfBar2: { backgroundColor: c.accent },
  perfDayLabel: { fontSize: 9, color: c.textMuted, fontWeight: fontWeight.semibold },
  perfLegend: { flexDirection: 'row', gap: spacing.md },
  perfLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  perfLegendDot: { width: 8, height: 8, borderRadius: 4 },
  perfLegendText: { fontSize: fontSize.xs, color: c.textMuted },

  // Photographers + Recent Payments
  photographerCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
  },
  photogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  photogAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photogAvatarImg: { width: 36, height: 36 },
  photogName: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  photogEvent: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
  photogChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.full },
  photogChipText: { fontSize: 10, fontWeight: fontWeight.bold },
  recentPayAmount: { fontSize: fontSize.sm, fontWeight: fontWeight.extrabold },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
  },
  previewBody: { flex: 1, gap: 2 },
  previewTitle: { fontFamily: fonts.bold, fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: c.text },
  previewSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: c.textMuted },
}));
