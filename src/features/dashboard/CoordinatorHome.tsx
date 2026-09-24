/**
 * CoordinatorHome — staff-grade dashboard for the `Coordinator` role.
 * Full mobile parity with the salo-run coordinator web dashboard
 * (pages/event-coordinator/home.tsx).
 *
 * Engineered with premier mobile design craft:
 *   1. Solid, crisp card backgrounds — high-contrast surfaces without muddy gradients.
 *   2. Frosted persistent TopBar integration with safe-area metrics.
 *   3. Editorial date header & dynamic time-of-day greeting.
 *   4. Salo-run Coordinator Hero: 3px brand accent line, embedded 3-metric mini-stats snapshot (Revenue, Events, Photographers).
 *   5. Tactile quick search bar & production category chips.
 *   6. 2x2 Bento Action Hub (New Event, Team Management, Photographers, Live Streams).
 *   7. Period filter tabs (Today / This week / This month) with live trends.
 *   8. Salo-run 5 KPI Cards Grid (Revenue, Pending, Events, Clients, Photographers).
 *   9. Pending payments alert banner with PayNowSheet integration.
 *  10. Upcoming productions & events list with status pills and quick manage navigation.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { KycBanner } from '@/features/kyc/KycBanner';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import {
  getCoordinatorAnalytics,
  getCoordinatorPendingPayments,
  getCoordinatorTrends,
  type AnalyticsPeriod,
  type CoordinatorAnalytics,
  type PendingPayment,
  type TrendsMap,
} from '@/features/analytics/api';
import { listCoordinatorEvents } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import { getWallet } from '@/features/wallet/api';
import { formatDate, formatMoney } from '@/utils/format';
import { useResponsive } from '@/hooks/useResponsive';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';

const CATEGORY_CHIPS = [
  { label: 'All', icon: 'sparkles' as const, color: '#083A85' },
  { label: 'Weddings', icon: 'heart' as const, color: '#F20C8F' },
  { label: 'Corporate', icon: 'briefcase-outline' as const, color: '#3B82F6' },
  { label: 'Festivals', icon: 'musical-notes' as const, color: '#0EA5E9' },
  { label: 'Conferences', icon: 'people-outline' as const, color: '#8B5CF6' },
  { label: 'Sports', icon: 'football-outline' as const, color: '#10B981' },
  { label: 'Parties', icon: 'balloon-outline' as const, color: '#EC4899' },
];

const PERIOD_TABS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 22) return 'Good Evening';
  return 'Good Night';
}

function getTimeTagline(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Let's plan something extraordinary today!";
  if (h >= 12 && h < 17) return 'Hope your events and streams are running smoothly!';
  if (h >= 17 && h < 22) return "Time to review today's production performance!";
  return 'Late night planning? Your production workspace awaits.';
}

function getTodayFormatted(): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(new Date()).toUpperCase();
  } catch {
    return 'TODAY';
  }
}

export function CoordinatorHome() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const responsive = useResponsive();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || user?.organizationName || 'Coordinator';

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  const [payNowPayment, setPayNowPayment] = useState<PendingPayment | null>(null);
  const [payNowOpen, setPayNowOpen] = useState(false);

  // Async data sources
  const analytics = useAsync(useCallback(() => getCoordinatorAnalytics(), []));
  const events = useAsync(useCallback(() => listCoordinatorEvents(), []));
  const pending = useAsync(useCallback(() => getCoordinatorPendingPayments(), []));
  const wallet = useAsync(useCallback(() => getWallet(), []));
  const trendsState = useAsync(useCallback(() => getCoordinatorTrends(period), [period]));

  const trends: TrendsMap = useMemo(() => trendsState.data ?? {}, [trendsState.data]);

  const refreshing =
    analytics.loading ||
    events.loading ||
    pending.loading ||
    wallet.loading ||
    trendsState.loading;

  const onRefresh = () => {
    analytics.refresh();
    events.refresh();
    pending.refresh();
    wallet.refresh();
    trendsState.refresh();
  };

  const a: CoordinatorAnalytics | null = analytics.data;
  const currency = wallet.data?.currency || 'USD';
  const pendingList = pending.data ?? [];
  const totalPendingAmount = pendingList.reduce((s, p) => s + (p.amount - p.paidAmount), 0);
  const hasFailedPayments = pendingList.some((p) => p.status === 'failed');

  const eventList = useMemo(() => events.data ?? [], [events.data]);
  const todayIso = new Date().toISOString().slice(0, 10);
  const upcomingEvents = useMemo(() => {
    return eventList.filter((e) => {
      const s = (e.status ?? '').toUpperCase();
      if (s === 'COMPLETED' || s === 'CANCELLED') return false;
      return !e.eventDate || e.eventDate >= todayIso;
    });
  }, [eventList, todayIso]);

  const greeting = getTimeGreeting();
  const tagline = getTimeTagline();
  const todayFormatted = getTodayFormatted();
  const periodLabel = period === 'today' ? 'yesterday' : period === 'month' ? 'last month' : 'last week';

  // Salo-run 5 Coordinator KPI Cards
  const kpiCards = [
    {
      title: 'Total Revenue',
      value: formatMoney(a?.totalRevenue || 0, currency),
      percentage: trends.totalRevenue?.percentage,
      trend: trends.totalRevenue?.direction ?? 'up',
      icon: 'cash-outline' as const,
      accent: '#083A85',
      href: '/wallet',
    },
    {
      title: 'Pending',
      value: formatMoney(a?.totalPending || 0, currency),
      percentage: trends.totalPending?.percentage,
      trend: trends.totalPending?.direction ?? 'up',
      icon: 'time-outline' as const,
      accent: '#F59E0B',
      href: '/wallet',
    },
    {
      title: 'Events Managed',
      value: String(a?.totalEvents || 0),
      percentage: trends.totalEvents?.percentage,
      trend: trends.totalEvents?.direction ?? 'up',
      icon: 'calendar-outline' as const,
      accent: '#3B82F6',
      href: '/events',
    },
    {
      title: 'Total Clients',
      value: String(a?.totalCustomers || 0),
      percentage: trends.totalCustomers?.percentage,
      trend: trends.totalCustomers?.direction ?? 'up',
      icon: 'people-outline' as const,
      accent: '#10B981',
      href: '/clients',
    },
    {
      title: 'Photographers',
      value: String(a?.totalPhotographers || 0),
      percentage: trends.totalPhotographers?.percentage,
      trend: trends.totalPhotographers?.direction ?? 'up',
      icon: 'camera-outline' as const,
      accent: '#8B5CF6',
      href: '/photographers',
    },
  ];

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.sm }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Prominent KYC Banner */}
        <KycBanner />

        {/* ── Salo-run Coordinator Hero Section ───────────────────────────── */}
        <View style={styles.heroCard}>
          {/* Top 3px Brand Accent Line */}
          <View style={styles.heroTopAccent} />

          <View style={styles.heroBody}>
            {/* Editorial Date & Role Eyebrow */}
            <View style={styles.heroEyebrowRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="sparkles" size={11} color={colors.primary} />
                <Text style={styles.heroBadgeText}>EVENT COORDINATOR</Text>
              </View>
              <View style={styles.datePill}>
                <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
                <Text style={styles.datePillText}>{todayFormatted}</Text>
              </View>
            </View>

            {/* Greeting & Name Heading */}
            <Text style={styles.heroGreeting}>
              {greeting},{' '}
              <Text style={styles.heroName}>{name}</Text> 🎯
            </Text>
            <Text style={styles.heroTagline}>{tagline}</Text>

            {/* Salo-run Coordinator 3-Metric Mini-Stats Snapshot */}
            <View style={styles.heroMiniStatsCard}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>REVENUE</Text>
                <Text style={[styles.heroStatValue, { color: '#083A85' }]}>
                  {formatMoney(a?.totalRevenue || 0, currency)}
                </Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>EVENTS</Text>
                <Text style={[styles.heroStatValue, { color: '#F20C8F' }]}>
                  {String(a?.totalEvents || 0)}
                </Text>
              </View>
              <View style={styles.heroStatDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>PHOTOGRAPHERS</Text>
                <Text style={[styles.heroStatValue, { color: '#10B981' }]}>
                  {String(a?.totalPhotographers || 0)}
                </Text>
              </View>
            </View>

            {/* Quick Search Events & Productions Bar */}
            <View
              style={[
                styles.searchBar,
                isSearchFocused && styles.searchBarFocused,
              ]}
            >
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search events, productions, venues..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onSubmitEditing={() => {
                  if (searchQuery.trim()) {
                    router.push('/events' as never);
                  }
                }}
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <Pressable
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}
                  style={styles.searchClearBtn}
                >
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* Production Category Selector Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChips}
            >
              {CATEGORY_CHIPS.map((c) => {
                const active = selectedCategory === c.label;
                return (
                  <Pressable
                    key={c.label}
                    onPress={() => {
                      setSelectedCategory(c.label);
                      router.push('/events' as never);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Ionicons
                      name={c.icon}
                      size={12}
                      color={active ? '#FFFFFF' : colors.textMuted}
                    />
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* ── 2x2 Bento Action Hub ────────────────────────────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>WORKSPACE HUB</Text>
          <Text style={styles.sectionSubtitle}>Quick management tools for your events</Text>
        </View>

        <View style={styles.bentoGrid}>
          {/* Card 1: New Event */}
          <Pressable
            style={({ pressed }) => [
              styles.bentoCard,
              responsive.isLarge && styles.bentoCardLarge,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/event/new' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Create a new event"
          >
            <View style={styles.bentoTopRow}>
              <View style={[styles.bentoIconBox, { backgroundColor: '#F20C8F15', borderColor: '#F20C8F30' }]}>
                <Ionicons name="add-circle" size={20} color="#F20C8F" />
              </View>
              <View style={[styles.bentoBadge, { backgroundColor: '#F20C8F15', borderColor: '#F20C8F30' }]}>
                <Text style={[styles.bentoBadgeText, { color: '#F20C8F' }]}>CREATE</Text>
              </View>
            </View>
            <Text style={styles.bentoCardTitle}>New Event</Text>
            <Text style={styles.bentoCardDesc}>Launch a new production, booking, or session</Text>
          </Pressable>

          {/* Card 2: Team Management */}
          <Pressable
            style={({ pressed }) => [
              styles.bentoCard,
              responsive.isLarge && styles.bentoCardLarge,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/team' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Manage team members and roles"
          >
            <View style={styles.bentoTopRow}>
              <View style={[styles.bentoIconBox, { backgroundColor: '#3B82F615', borderColor: '#3B82F630' }]}>
                <Ionicons name="people-circle" size={20} color="#3B82F6" />
              </View>
              <View style={[styles.bentoBadge, { backgroundColor: '#3B82F615', borderColor: '#3B82F630' }]}>
                <Text style={[styles.bentoBadgeText, { color: '#3B82F6' }]}>TEAM</Text>
              </View>
            </View>
            <Text style={styles.bentoCardTitle}>Manage Team</Text>
            <Text style={styles.bentoCardDesc}>Organize crew, staff members, and custom roles</Text>
          </Pressable>

          {/* Card 3: Photographers */}
          <Pressable
            style={({ pressed }) => [
              styles.bentoCard,
              responsive.isLarge && styles.bentoCardLarge,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/photographers' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Browse and invite photographers"
          >
            <View style={styles.bentoTopRow}>
              <View style={[styles.bentoIconBox, { backgroundColor: '#8B5CF615', borderColor: '#8B5CF630' }]}>
                <Ionicons name="camera" size={20} color="#8B5CF6" />
              </View>
              <View style={[styles.bentoBadge, { backgroundColor: '#8B5CF615', borderColor: '#8B5CF630' }]}>
                <Text style={[styles.bentoBadgeText, { color: '#8B5CF6' }]}>TALENT</Text>
              </View>
            </View>
            <Text style={styles.bentoCardTitle}>Photographers</Text>
            <Text style={styles.bentoCardDesc}>Assign verified creators and invite your team</Text>
          </Pressable>

          {/* Card 4: Live Streams */}
          <Pressable
            style={({ pressed }) => [
              styles.bentoCard,
              responsive.isLarge && styles.bentoCardLarge,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/streams' as Href)}
            accessibilityRole="button"
            accessibilityLabel="Live streams"
          >
            <View style={styles.bentoTopRow}>
              <View style={[styles.bentoIconBox, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}>
                <Ionicons name="videocam" size={20} color="#EF4444" />
              </View>
              <View style={[styles.bentoBadge, { backgroundColor: '#EF444415', borderColor: '#EF444430' }]}>
                <Text style={[styles.bentoBadgeText, { color: '#EF4444' }]}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.bentoCardTitle}>Live Streams</Text>
            <Text style={styles.bentoCardDesc}>Broadcast events and view active viewer streams</Text>
          </Pressable>
        </View>

        {/* ── Pending Payments Alert (if any) ─────────────────────────────── */}
        {pendingList.length > 0 ? (
          <View style={styles.pendingCard}>
            <View style={styles.pendingHeader}>
              <View style={styles.pendingIconWrap}>
                <Ionicons
                  name={hasFailedPayments ? 'alert-circle' : 'time'}
                  size={18}
                  color={hasFailedPayments ? colors.error : '#F59E0B'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pendingTitle}>
                  {hasFailedPayments ? 'Action Required: Pending Payments' : 'Pending Invoices'}
                </Text>
                <Text style={styles.pendingSub}>
                  {pendingList.length} payment{pendingList.length === 1 ? '' : 's'} totaling{' '}
                  <Text style={{ fontWeight: fontWeight.bold, color: colors.text }}>
                    {formatMoney(totalPendingAmount, currency)}
                  </Text>
                </Text>
              </View>
              <Pressable
                style={styles.pendingViewBtn}
                onPress={() => {
                  if (pendingList[0]) {
                    setPayNowPayment(pendingList[0]);
                    setPayNowOpen(true);
                  } else {
                    router.push('/payments' as Href);
                  }
                }}
              >
                <Text style={styles.pendingViewBtnText}>Pay Now</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── Period Filter Tabs ──────────────────────────────────────────── */}
        <View style={styles.periodRow}>
          <Text style={styles.sectionTitle}>PERFORMANCE &amp; METRICS</Text>
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
        </View>

        {/* ── Salo-run 5 Coordinator KPI Cards ────────────────────────────── */}
        <View style={styles.kpiGrid}>
          {kpiCards.map((k) => {
            const dir = k.trend;
            const trendColor = dir === 'up' ? '#10B981' : '#EF4444';
            return (
              <Pressable
                key={k.title}
                style={({ pressed }) => [
                  styles.kpiCard,
                  responsive.isLarge && styles.kpiCardLarge,
                  pressed && styles.cardPressed,
                ]}
                onPress={() => router.push(k.href as Href)}
                accessibilityRole="button"
                accessibilityLabel={`${k.title}: ${k.value}`}
              >
                <View style={styles.kpiTopRow}>
                  <View style={[styles.kpiIconWrap, { backgroundColor: `${k.accent}15` }]}>
                    <Ionicons name={k.icon} size={17} color={k.accent} />
                  </View>
                  {k.percentage ? (
                    <View style={styles.kpiTrendBadge}>
                      <Ionicons
                        name={dir === 'up' ? 'trending-up' : 'trending-down'}
                        size={12}
                        color={trendColor}
                      />
                      <Text style={[styles.kpiTrendText, { color: trendColor }]}>
                        {k.percentage}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.kpiValue} numberOfLines={1}>
                  {k.value}
                </Text>
                <View style={styles.kpiFooter}>
                  <Text style={styles.kpiTitle}>{k.title}</Text>
                  <Text style={styles.kpiSub}>vs {periodLabel}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* ── Upcoming Productions & Events ───────────────────────────────── */}
        <View style={styles.eventsSectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>UPCOMING PRODUCTIONS</Text>
            <Text style={styles.sectionSubtitle}>Assigned events and active sessions</Text>
          </View>
          <Pressable
            onPress={() => router.push('/events' as Href)}
            hitSlop={8}
            style={styles.seeAllBtn}
          >
            <Text style={styles.seeAllText}>View all</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        </View>

        {events.loading && eventList.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
        ) : upcomingEvents.length > 0 ? (
          <View style={styles.eventsList}>
            {upcomingEvents.slice(0, 4).map((e) => (
              <CoordinatorEventCard
                key={e.id}
                event={e}
                onPress={() => router.push(`/event/${e.id}` as Href)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No upcoming events</Text>
            <Text style={styles.emptySub}>
              Launch a new event to start coordinating photographers and streams.
            </Text>
            <Pressable
              style={styles.emptyActionBtn}
              onPress={() => router.push('/event/new' as Href)}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.emptyActionBtnText}>Create Event</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* Floating Translucent TopBar */}
      <TopBar />

      <PayNowSheet
        payment={payNowPayment}
        visible={payNowOpen}
        onClose={() => setPayNowOpen(false)}
        onSuccess={() => {
          pending.refresh();
          analytics.refresh();
        }}
      />
    </Screen>
  );
}

function CoordinatorEventCard({
  event,
  onPress,
}: {
  event: EventItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  const isLive = (event.status ?? '').toUpperCase() === 'ONGOING' || event.hasLiveStream;
  const statusColor = isLive ? '#EF4444' : event.published ? '#10B981' : '#F59E0B';
  const statusLabel = isLive ? 'LIVE NOW' : event.published ? 'PUBLISHED' : 'UPCOMING';

  return (
    <Pressable
      style={({ pressed }) => [styles.eventRowCard, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}`}
    >
      <View style={styles.eventRowLeft}>
        <View style={styles.eventStatusPill}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.eventStatusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        <Text style={styles.eventRowTitle} numberOfLines={1}>
          {event.title}
        </Text>

        <View style={styles.eventMetaRow}>
          {event.eventDate ? (
            <View style={styles.eventMetaItem}>
              <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
              <Text style={styles.eventMetaText}>{formatDate(event.eventDate)}</Text>
            </View>
          ) : null}
          {event.location ? (
            <View style={styles.eventMetaItem}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={styles.eventMetaText} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          ) : null}
          {event.photographerName ? (
            <View style={styles.eventMetaItem}>
              <Ionicons name="camera-outline" size={12} color={colors.primary} />
              <Text style={[styles.eventMetaText, { color: colors.primary }]} numberOfLines={1}>
                {event.photographerName}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.eventRowRight}>
        <View style={styles.manageChip}>
          <Text style={styles.manageChipText}>Manage</Text>
          <Ionicons name="chevron-forward" size={12} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((c, e) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },

  // ── Coordinator Hero Card ──────────────────────────────────────────────
  heroCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    ...e(2),
  },
  heroTopAccent: {
    height: 3,
    backgroundColor: c.primary,
  },
  heroBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  heroBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: c.primary,
    letterSpacing: 0.8,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  datePillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 0.5,
  },
  heroGreeting: {
    fontFamily: fonts.bold,
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  heroName: {
    color: c.primary,
  },
  heroTagline: {
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.textSoft,
    lineHeight: 19,
    marginTop: -4,
  },

  // Hero 3-Metric Mini-Stats
  heroMiniStatsCard: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  heroStatValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: fontWeight.extrabold,
  },
  heroStatDivider: {
    width: 1,
    height: 24,
    backgroundColor: c.borderSoft,
  },

  // Hero Search Bar
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  searchBarFocused: {
    borderColor: c.primary,
    backgroundColor: c.surface,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    color: c.text,
    padding: 0,
  },
  searchClearBtn: {
    padding: 2,
  },

  // Category Selector Chips
  categoryChips: {
    gap: spacing.xs,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipPressed: {
    opacity: 0.85,
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // ── Section Header ─────────────────────────────────────────────────────
  sectionHeader: {
    gap: 2,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.xs,
    color: c.textSoft,
  },

  // ── 2x2 Bento Action Hub ───────────────────────────────────────────────
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  bentoCard: {
    width: '47.5%',
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 6,
    ...e(1),
  },
  bentoCardLarge: {
    width: '23%',
  },
  bentoTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bentoIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bentoBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  bentoBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  bentoCardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  bentoCardDesc: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
    lineHeight: 15,
  },

  // ── Pending Payments Alert ─────────────────────────────────────────────
  pendingCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#F59E0B40',
    ...e(1),
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pendingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: '#F59E0B15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  pendingSub: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textSoft,
    marginTop: 1,
  },
  pendingViewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  pendingViewBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },

  // ── Performance & KPI Grid ─────────────────────────────────────────────
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  periodTabs: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    padding: 2,
  },
  periodTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  periodTabActive: {
    backgroundColor: c.primary,
  },
  periodTabText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
  },
  periodTabTextActive: {
    color: '#FFFFFF',
  },

  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  kpiCard: {
    width: '47.5%',
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 4,
    ...e(1),
  },
  kpiCardLarge: {
    width: '31%',
  },
  kpiTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  kpiIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiTrendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  kpiTrendText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
  },
  kpiValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.3,
  },
  kpiFooter: {
    flexDirection: 'column',
    gap: 1,
  },
  kpiTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: c.textSoft,
  },
  kpiSub: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: c.textMuted,
  },

  // ── Upcoming Events Section ────────────────────────────────────────────
  eventsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
    fontWeight: fontWeight.bold,
  },
  eventsList: {
    gap: spacing.sm,
  },
  eventRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.sm,
    ...e(1),
  },
  eventRowLeft: {
    flex: 1,
    gap: 4,
  },
  eventStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventStatusText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.6,
  },
  eventRowTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  eventMetaText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  eventRowRight: {
    alignItems: 'flex-end',
  },
  manageChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  manageChipText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },

  // Empty State Card
  emptyCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  emptySub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 16,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.full,
    marginTop: spacing.sm,
  },
  emptyActionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },

  // Pressable states
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
}));
