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
import { useCallback, useEffect, useMemo, useState } from 'react';
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
  View,
} from 'react-native';
import { FindPhotosBottomSheet } from '@/components/FindPhotosBottomSheet';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useRole } from '@/features/auth/role';
import {
  type AnalyticsPeriod,
  type CoordinatorAnalytics,
  type CustomerAnalytics,
  type PendingPayment,
  type RecentActivity,
  type TrendsMap,
  getCoordinatorAnalytics,
  getCoordinatorPendingPayments,
  getCoordinatorTrends,
  getCustomerAnalytics,
  getCustomerPendingPayments,
  getCustomerRecentActivities,
  getCustomerTrends,
} from '@/features/analytics/api';
import { listBookings } from '@/features/bookings/api';
import { listCoordinatorEvents, listEvents } from '@/features/events/api';
import { listStreams } from '@/features/streams/api';
import { getWallet } from '@/features/wallet/api';
import { useAsync } from '@/hooks/useAsync';
import { useAuth } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/format';

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
  | '/team';

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
    ...COMMON_TAIL,
  ],
  Coordinator: [
    { label: 'Find Photographers', icon: 'camera', href: '/photographers' },
    { label: 'Team', icon: 'people-circle', href: '/team' },
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
];

const PERIOD_LABEL: Record<AnalyticsPeriod, string> = {
  today: 'yesterday',
  week: 'last week',
  month: 'last month',
  custom: 'custom',
};

export default function HomeScreen() {
  const user = useAuth((s) => s.user);
  const [findPhotosModalVisible, setFindPhotosModalVisible] = useState(false);
  const { role, isClient, isCoordinator, isPhotographer, isViewer } = useRole();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const name = user?.firstName || 'there';

  const showsDashboard = isClient || isCoordinator;

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
        const bookings = await listBookings();
        return bookings.slice(0, 3).map((b) => ({
          id: b.id,
          title: b.eventTitle,
          subtitle: b.clientName,
          status: b.status,
          onPress: () => router.push('/events'),
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

  // ── Dashboard data (Client + Coordinator only) ─────────────────────────
  const [analyticsClient, setAnalyticsClient] = useState<CustomerAnalytics | null>(null);
  const [analyticsCoord, setAnalyticsCoord] = useState<CoordinatorAnalytics | null>(null);
  const [trends, setTrends] = useState<TrendsMap>({});
  const [pending, setPending] = useState<PendingPayment[]>([]);
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loadingDash, setLoadingDash] = useState(false);

  const loadDashboard = useCallback(async () => {
    if (!showsDashboard) return;
    setLoadingDash(true);
    try {
      if (isClient) {
        const [a, t, p, recent] = await Promise.allSettled([
          getCustomerAnalytics(),
          getCustomerTrends(period),
          getCustomerPendingPayments(),
          getCustomerRecentActivities(),
        ]);
        if (a.status === 'fulfilled') setAnalyticsClient(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
        if (p.status === 'fulfilled') setPending(p.value);
        if (recent.status === 'fulfilled') setActivities(recent.value);
      } else if (isCoordinator) {
        const [a, t, p] = await Promise.allSettled([
          getCoordinatorAnalytics(),
          getCoordinatorTrends(period),
          getCoordinatorPendingPayments(),
        ]);
        if (a.status === 'fulfilled') setAnalyticsCoord(a.value);
        if (t.status === 'fulfilled') setTrends(t.value);
        if (p.status === 'fulfilled') setPending(p.value);
      }
    } finally {
      setLoadingDash(false);
    }
  }, [showsDashboard, isClient, isCoordinator, period]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ── Derived dashboard view-models ──────────────────────────────────────
  const heroStats = useMemo(() => {
    if (isClient && analyticsClient) {
      return [
        { label: 'Spent', value: formatMoney(analyticsClient.totalSpent, wallet.data?.currency), tone: colors.primary },
        { label: 'Bookings', value: String(analyticsClient.totalBookings), tone: colors.accent },
        { label: 'Photos', value: String(analyticsClient.totalPhotos), tone: '#10B981' },
      ];
    }
    if (isCoordinator && analyticsCoord) {
      return [
        { label: 'Revenue', value: formatMoney(analyticsCoord.totalRevenue, wallet.data?.currency), tone: colors.primary },
        { label: 'Events', value: String(analyticsCoord.totalEvents), tone: colors.accent },
        { label: 'Photographers', value: String(analyticsCoord.totalPhotographers), tone: '#10B981' },
      ];
    }
    return [];
  }, [isClient, isCoordinator, analyticsClient, analyticsCoord, wallet.data?.currency]);

  const kpis = useMemo(() => {
    if (isClient && analyticsClient) {
      return [
        kpi('Total Spent', formatMoney(analyticsClient.totalSpent, wallet.data?.currency), 'cash-outline', '#083A85', trends.totalSpent),
        kpi('Pending', formatMoney(analyticsClient.pendingAmount, wallet.data?.currency), 'time-outline', '#F59E0B', trends.pending),
        kpi('Bookings', String(analyticsClient.totalBookings), 'people-outline', '#3B82F6', trends.events, '/events'),
        kpi('Gifts', formatMoney(analyticsClient.gifts, wallet.data?.currency), 'gift-outline', '#10B981', trends.gifts),
        kpi('Favorites', String(analyticsClient.bookmarkedPhotographers), 'star-outline', '#8B5CF6', trends.photographers, '/photographers'),
      ];
    }
    if (isCoordinator && analyticsCoord) {
      return [
        kpi('Revenue', formatMoney(analyticsCoord.totalRevenue, wallet.data?.currency), 'cash-outline', '#083A85', trends.totalRevenue),
        kpi('Pending', formatMoney(analyticsCoord.totalPending, wallet.data?.currency), 'time-outline', '#F59E0B', trends.totalPending),
        kpi('Events', String(analyticsCoord.totalEvents), 'calendar-outline', '#3B82F6', trends.totalEvents, '/events'),
        kpi('Clients', String(analyticsCoord.totalCustomers), 'people-outline', '#10B981', trends.totalCustomers),
        kpi('Photographers', String(analyticsCoord.totalPhotographers), 'camera-outline', '#8B5CF6', trends.totalPhotographers, '/photographers'),
      ];
    }
    return [];
  }, [isClient, isCoordinator, analyticsClient, analyticsCoord, wallet.data?.currency, trends]);

  const totalPendingAmount = pending.reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const hasFailedPayments = pending.some((p) => p.status === 'failed');

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.md }]}>
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
              />
            ) : null}

            {activities.length > 0 ? (
              <Section title="Recent activity">
                {activities.map((a) => (
                  <ActivityRow key={a.id} activity={a} />
                ))}
              </Section>
            ) : null}
          </>
        ) : (
          <SimpleHeader name={name} role={role} wallet={wallet} router={router} />
        )}

        {/* Quick actions (kept for every role — shortcuts to non-tab screens) */}
        <Text style={styles.sectionTitle}>Quick actions</Text>
        <View style={styles.actionsPanel}>
          {(ACTIONS_BY_ROLE[role] ?? ACTIONS_BY_ROLE.Client).map((a) => (
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
  return (
    <LinearGradient
      colors={['rgba(8,58,133,0.08)', 'rgba(242,12,143,0.08)']}
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
}: {
  items: PendingPayment[];
  hasFailed: boolean;
  totalPendingAmount: number;
  currency?: string;
  onViewAll: () => void;
}) {
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
              {formatMoney(totalPendingAmount, currency)}
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
          <View
            key={p.id}
            style={[
              styles.payCard,
              p.status === 'failed' && { borderColor: colors.error + '60' },
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
                {formatMoney(p.amount - p.paidAmount, currency)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function ActivityRow({ activity }: { activity: RecentActivity }) {
  const label = activity.type.charAt(0).toUpperCase() + activity.type.slice(1).toLowerCase();
  return (
    <View style={styles.activityRow}>
      <View style={styles.activityDot} />
      <View style={{ flex: 1 }}>
        <Text style={styles.activityLabel}>{label}</Text>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {activity.title}
        </Text>
      </View>
      {activity.createdAt ? (
        <Text style={styles.activityTime}>{formatDate(activity.createdAt)}</Text>
      ) : null}
    </View>
  );
}

function SimpleHeader({
  name,
  role,
  wallet,
  router,
}: {
  name: string;
  role: string;
  wallet: ReturnType<typeof useAsync<Awaited<ReturnType<typeof getWallet>>>>;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {name} 👋</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{role}</Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.balanceCard, pressed && styles.cardPressed]}
        onPress={() => router.push('/wallet')}
      >
        <Text style={styles.balanceLabel}>Wallet balance</Text>
        <Text style={styles.balanceValue}>
          {wallet.loading && !wallet.data ? '—' : formatMoney(wallet.data?.total, wallet.data?.currency)}
        </Text>
        <View style={styles.balanceFoot}>
          <Text style={styles.balanceLink}>Open wallet</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.accentLight} />
        </View>
      </Pressable>
    </>
  );
}

// ────── Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: 120, gap: spacing.lg },

  // Hero
  hero: {
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
    gap: spacing.sm,
  },
  heroAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.primary,
  },
  heroEyebrow: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: fontWeight.extrabold,
    letterSpacing: 1.4,
  },
  heroTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text, lineHeight: 28 },
  heroSub: { fontSize: fontSize.sm, color: colors.textSoft },
  heroStatsCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  heroStatCell: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  heroStatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroStatValue: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, marginTop: 3 },

  // Period tabs
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    padding: 3,
    gap: 2,
  },
  periodTab: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radii.full },
  periodTabActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  periodTabText: { fontSize: fontSize.xs, color: colors.textMuted, fontWeight: fontWeight.semibold },
  periodTabTextActive: { color: colors.primary, fontWeight: fontWeight.bold },

  // KPI grid
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: 2,
  },
  kpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kpiTrend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  kpiTrendText: { fontSize: 10, fontWeight: fontWeight.bold },
  kpiTitle: { fontSize: 11, color: colors.textMuted, fontWeight: fontWeight.semibold, marginTop: 6 },
  kpiValue: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.text },
  kpiTimeframe: { fontSize: 10, color: colors.textMuted },

  // Pending payments alert
  alert: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  alertHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  alertIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  alertTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  alertSub: { fontSize: fontSize.xs, marginTop: 2 },
  alertLink: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  alertScroll: { gap: spacing.sm, paddingTop: 4 },
  payCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.sm,
    width: 240,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.sm,
  },
  payAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  payAvatarImg: { width: 36, height: 36 },
  payNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  payName: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flexShrink: 1 },
  payChip: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: radii.full },
  payChipText: { fontSize: 9, fontWeight: fontWeight.bold },
  payEvent: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  payAmount: { fontSize: fontSize.md, fontWeight: fontWeight.extrabold, marginTop: 2 },

  // Activity
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  activityLabel: { fontSize: 11, color: colors.textMuted, fontWeight: fontWeight.semibold, textTransform: 'uppercase' },
  activityTitle: { fontSize: fontSize.sm, color: colors.text, fontWeight: fontWeight.semibold, marginTop: 2 },
  activityTime: { fontSize: 10, color: colors.textMuted },

  // Legacy header (Photographer / Viewer)
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: colors.text },
  roleBadge: {
    backgroundColor: colors.infoBg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  roleText: { color: colors.info, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.xs,
    shadowColor: colors.primary,
    shadowOpacity: 0.25,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  cardPressed: { opacity: 0.95 },
  balanceLabel: { color: '#C7D2FE', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  balanceValue: { color: colors.textOnPrimary, fontSize: fontSize['3xl'], fontWeight: fontWeight.extrabold },
  balanceFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  balanceLink: { color: colors.accentLight, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Sections
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seeAll: { color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Quick actions
  actionsPanel: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    shadowColor: colors.primary,
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
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textOnPrimary,
    textAlign: 'center',
  },

  loader: { alignSelf: 'flex-start' },
  muted: { color: colors.textMuted, fontSize: fontSize.sm },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.lg,
  },
  previewBody: { flex: 1, gap: 2 },
  previewTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: colors.text },
  previewSub: { fontSize: fontSize.sm, color: colors.textMuted },
});
