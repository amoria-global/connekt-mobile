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
 *   6. Bento Action Hub (Create Event, Gallery, Photographers, Live Streams).
 *   7. Performance & Metrics Hero: Organic wave energy card with period tabs and live metric trends.
 *   8. Pending payments alert banner with PayNowSheet integration.
 *   9. Upcoming productions & events list with status pills and quick manage navigation.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { GlassBackdrop, GlassCard } from '@/components/ui/GlassCard';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { KycBanner } from '@/features/kyc/KycBanner';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import {
  getCoordinatorAnalytics,
  getCoordinatorPendingPayments,
  getCoordinatorTrends,
  getCoordinatorPerformance,
  type AnalyticsPeriod,
  type CoordinatorAnalytics,
  type PendingPayment,
  type TrendsMap,
} from '@/features/analytics/api';
import { listCoordinatorEvents } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import { getWallet } from '@/features/wallet/api';
import { formatDate, formatPrice } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';
import { spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { PerformanceWaveCard, type MetricKey } from '@/features/dashboard/PerformanceWaveCard';

const CATEGORY_CHIPS = [
  { label: 'All', icon: 'apps-outline' as const, color: '#083A85' },
  { label: 'Wedding', icon: 'heart-outline' as const, color: '#F20C8F' },
  { label: 'Corporate', icon: 'briefcase-outline' as const, color: '#3B82F6' },
  { label: 'Birthday', icon: 'gift-outline' as const, color: '#F59E0B' },
  { label: 'Concert', icon: 'musical-notes-outline' as const, color: '#0EA5E9' },
  { label: 'Conference', icon: 'easel-outline' as const, color: '#8B5CF6' },
  { label: 'Sports', icon: 'trophy-outline' as const, color: '#10B981' },
  { label: 'Graduation', icon: 'school-outline' as const, color: '#EC4899' },
  { label: 'Fashion', icon: 'shirt-outline' as const, color: '#6366F1' },
  { label: 'Entertainment', icon: 'film-outline' as const, color: '#14B8A6' },
];

const PERIOD_TABS: { value: AnalyticsPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

function getTimeGreeting(t: (k: any) => string): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return t('goodMorning');
  if (h >= 12 && h < 17) return t('goodAfternoon');
  if (h >= 17 && h < 22) return t('goodEvening');
  return t('goodNight');
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
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { language, t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const glassTarget = useRef<View>(null);
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || user?.organizationName || 'Coordinator';

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [selectedWaveMetric, setSelectedWaveMetric] = useState<MetricKey>('totalRevenue');
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
  const perfState = useAsync(useCallback(() => getCoordinatorPerformance(period), [period]));

  const trends: TrendsMap = useMemo(() => trendsState.data ?? {}, [trendsState.data]);

  const refreshing =
    analytics.loading ||
    events.loading ||
    pending.loading ||
    wallet.loading ||
    trendsState.loading ||
    perfState.loading;

  const onRefresh = () => {
    analytics.refresh();
    events.refresh();
    pending.refresh();
    wallet.refresh();
    trendsState.refresh();
    perfState.refresh();
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

  const matchingEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return eventList.filter(
      (e) =>
        (e.title ?? '').toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q) ||
        (e.photographerName ?? '').toLowerCase().includes(q) ||
        (e.category ?? '').toLowerCase().includes(q),
    );
  }, [eventList, searchQuery]);

  const isSearchActive = searchQuery.trim().length > 0;

  const greeting = getTimeGreeting(t);
  const tagline = getTimeTagline();
  const todayFormatted = getTodayFormatted();


  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: topBarHeight + spacing.sm }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Prominent KYC Banner */}
        <KycBanner />

        {/* ── 1. Coordinator Header ───────────────────────────────────────── */}
        <View style={styles.heroPanel}>
          <GlassBackdrop ref={glassTarget} />
          <View style={styles.header}>
            <View style={styles.headerEyebrowRow}>
              <View style={styles.roleBadge}>
                <Ionicons name="sparkles" size={11} color={colors.primary} />
                <Text style={styles.roleBadgeText}>{t('roleCoordinatorTitle').toUpperCase()}</Text>
              </View>
              <View style={styles.headerDot} />
              <Text style={styles.headerDate}>{todayFormatted}</Text>
            </View>
            <Text style={styles.headerTitle}>
              {greeting},{' '}
              <Text style={styles.headerName}>{name}</Text>
            </Text>
            <Text style={styles.headerSubtitle}>{tagline}</Text>
          </View>

          {/* ── 2. High-Impact Quick Action Hero Bar ──────────────────────── */}
          <GlassCard blurTarget={glassTarget} style={styles.quickActionBar}>
            {/* Primary Action: Create Event */}
            <Pressable
              style={({ pressed }) => [styles.quickActionPrimaryBtn, pressed && styles.btnPressed]}
              onPress={() => router.push('/event/new' as never)}
              accessibilityRole="button"
              accessibilityLabel="Create a new event"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.quickActionPrimaryBtnText}>{t('createEvent')}</Text>
            </Pressable>

            {/* Secondary Action: Gallery (the Team it replaced was retired for album collaboration) */}
            <Pressable
              style={({ pressed }) => [styles.quickActionSecondaryBtn, pressed && styles.btnPressed]}
              onPress={() => router.push('/gallery' as never)}
              accessibilityRole="button"
              accessibilityLabel="Gallery"
            >
              <Ionicons name="images-outline" size={15} color={colors.primary} />
              <Text style={styles.quickActionSecondaryBtnText}>{t('gallery')}</Text>
            </Pressable>

            {/* Tertiary Action: Photographers */}
            <Pressable
              style={({ pressed }) => [styles.quickActionSecondaryBtn, pressed && styles.btnPressed]}
              onPress={() => router.push('/photographers' as never)}
              accessibilityRole="button"
              accessibilityLabel="Photographers"
            >
              <Ionicons name="camera-outline" size={15} color={colors.primary} />
              <Text style={styles.quickActionSecondaryBtnText} numberOfLines={1}>
                {t('menuPhotographers')}
              </Text>
            </Pressable>

            {/* Live Action: Live Streams */}
            <Pressable
              style={({ pressed }) => [styles.quickActionLiveBtn, pressed && styles.btnPressed]}
              onPress={() => router.push('/streams' as never)}
              accessibilityRole="button"
              accessibilityLabel="Live Streams"
            >
              <Ionicons name="videocam" size={14} color="#EF4444" />
              <Text style={styles.quickActionLiveBtnText}>{t('liveNow')}</Text>
            </Pressable>
          </GlassCard>
        </View>

        {/* ── 3. Search & Production Category Section ──────────────────── */}
        <View style={styles.searchSection}>
          <View
            style={[
              styles.searchBar,
              isSearchFocused && {
                borderColor: colors.primary,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <Ionicons
              name="search"
              size={17}
              color={isSearchFocused ? colors.primary : colors.textMuted}
              style={styles.searchIcon}
            />
            <TextInput
              ref={searchInputRef}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search events, productions, venues..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              blurOnSubmit={true}
              onSubmitEditing={() => {
                Keyboard.dismiss();
                if (searchQuery.trim()) {
                  router.push({
                    pathname: '/events',
                    params: { q: searchQuery.trim() },
                  } as never);
                }
              }}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  Keyboard.dismiss();
                }}
                hitSlop={10}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={17} color={colors.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Category Chips Carousel */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.categoryChips}
          >
            {CATEGORY_CHIPS.map((c) => {
              const active = selectedCategory === c.label;
              return (
                <Pressable
                  key={c.label}
                  onPress={() => {
                    setSelectedCategory(c.label);
                    router.push({
                      pathname: '/events',
                      params: c.label === 'All' ? {} : { category: c.label },
                    } as never);
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

        {/* Real-time search matches if search query is active */}
        {isSearchActive ? (
          <View style={styles.searchResultsBox}>
            <View style={styles.searchResultsHeader}>
              <Text style={styles.searchResultsTitle}>
                Search Results for "{searchQuery.trim()}"
              </Text>
              <Pressable
                onPress={() => {
                  setSearchQuery('');
                  Keyboard.dismiss();
                }}
              >
                <Text style={styles.searchResultsClearText}>Clear</Text>
              </Pressable>
            </View>

            {matchingEvents.length === 0 ? (
              <View style={styles.noSearchMatches}>
                <Ionicons name="search-outline" size={24} color={colors.textMuted} />
                <Text style={styles.noSearchMatchesText}>
                  No events found matching "{searchQuery.trim()}"
                </Text>
              </View>
            ) : (
              <View style={styles.matchingSection}>
                <Text style={styles.matchingSectionLabel}>MATCHING PRODUCTIONS</Text>
                {matchingEvents.slice(0, 4).map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.searchMatchRow, pressed && styles.cardPressed]}
                    onPress={() => {
                      Keyboard.dismiss();
                      router.push(`/event/${item.id}` as never);
                    }}
                  >
                    <View style={styles.searchMatchIcon}>
                      <Ionicons name="calendar-outline" size={15} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <Text style={styles.searchMatchTitle} numberOfLines={1}>
                        {item.title || 'Event Production'}
                      </Text>
                      <Text style={styles.searchMatchSub} numberOfLines={1}>
                        {[item.category, item.clientName || item.photographerName, formatDate(item.eventDate), item.location]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <StatusPill status={item.status || 'UPCOMING'} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* ── 4. Coordinator 3-Metric Mini-Stats Snapshot Card ────────────────── */}
        {!isSearchActive && (
          <View style={styles.snapshotCard}>
            <View style={styles.snapshotBody}>
              <Pressable
                style={styles.snapshotItem}
                onPress={() => router.push('/wallet' as never)}
                accessibilityRole="button"
                accessibilityLabel="View revenue in wallet"
              >
                <Text style={styles.snapshotLabel}>REVENUE</Text>
                <Text style={[styles.snapshotValue, { color: '#083A85' }]}>
                  {formatPrice(a?.totalRevenue || 0, currency)}
                </Text>
              </Pressable>
              <View style={styles.snapshotDivider} />
              <Pressable
                style={styles.snapshotItem}
                onPress={() => router.push('/events' as never)}
                accessibilityRole="button"
                accessibilityLabel="View events"
              >
                <Text style={styles.snapshotLabel}>EVENTS</Text>
                <Text style={[styles.snapshotValue, { color: '#F20C8F' }]}>
                  {String(a?.totalEvents || 0)}
                </Text>
              </Pressable>
              <View style={styles.snapshotDivider} />
              <Pressable
                style={styles.snapshotItem}
                onPress={() => router.push('/photographers' as never)}
                accessibilityRole="button"
                accessibilityLabel="View photographers"
              >
                <Text style={styles.snapshotLabel}>PHOTOGRAPHERS</Text>
                <Text style={[styles.snapshotValue, { color: '#10B981' }]}>
                  {String(a?.totalPhotographers || 0)}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

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
                    {formatPrice(totalPendingAmount, currency)}
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
                <Text style={styles.pendingViewBtnText}>{t('payNow')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── Performance & Metrics Infographic Section ───────────────────── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>PERFORMANCE &amp; METRICS</Text>
          <Text style={styles.sectionSubtitle}>
            Wave trajectory &amp; production performance analytics
          </Text>
        </View>

        {/* ── Pinterest Wave Energy Infographic Hero Card ────────────────── */}
        <PerformanceWaveCard
          analytics={a}
          trends={trends}
          period={period}
          onPeriodChange={setPeriod}
          currency={currency}
          selectedMetric={selectedWaveMetric}
          onSelectMetric={setSelectedWaveMetric}
          performanceData={perfState.data}
        />


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

  // ── 1. Coordinator Header ───────────────────────────────────────────────
  header: {
    gap: 4,
  },
  headerEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: c.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  roleBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    color: c.primary,
    letterSpacing: 0.6,
  },
  headerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: c.textMuted,
  },
  headerDate: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 0.4,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
    fontWeight: fontWeight.extrabold,
    color: c.text,
    letterSpacing: -0.4,
  },
  headerName: {
    color: c.primary,
  },
  headerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    lineHeight: 18,
  },

  // ── 2. High-Impact Quick Action Hero Bar ────────────────────────────────
  // Greeting + quick actions on soft brand glows; the actions sit on frosted glass.
  heroPanel: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  quickActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
  },
  quickActionPrimaryBtn: {
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: c.primary,
    ...e(2),
  },
  quickActionPrimaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  quickActionSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 42,
    paddingHorizontal: 4,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    ...e(1),
  },
  quickActionSecondaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  quickActionLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4.5,
    height: 42,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  quickActionLiveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: '#EF4444',
  },
  btnPressed: {
    opacity: 0.75,
  },

  // ── 3. Search Section & Category Chips ──────────────────────────────────
  searchSection: {
    marginTop: spacing.xs,
    gap: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.text,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
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

  // ── Real-time Search Results Box ────────────────────────────────────────
  searchResultsBox: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 10,
    ...e(2),
  },
  searchResultsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  searchResultsTitle: {
    fontFamily: fonts.bold,
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  searchResultsClearText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  noSearchMatches: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: 6,
  },
  noSearchMatchesText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
  },
  matchingSection: {
    gap: 6,
  },
  matchingSectionLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 0.5,
  },
  searchMatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    padding: 9,
    gap: 9,
  },
  searchMatchIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchMatchTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    fontWeight: fontWeight.bold,
    color: c.text,
  },
  searchMatchSub: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textMuted,
  },

  // ── 4. Coordinator 3-Metric Mini-Stats Snapshot Card ───────────────────
  snapshotCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    ...e(1),
  },
  snapshotBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  snapshotItem: {
    flex: 1,
    alignItems: 'center',
  },
  snapshotLabel: {
    fontFamily: fonts.bold,
    fontSize: 9,
    fontWeight: fontWeight.bold,
    color: c.textMuted,
    letterSpacing: 0.8,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  snapshotValue: {
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: fontWeight.extrabold,
  },
  snapshotDivider: {
    width: 1,
    height: 24,
    backgroundColor: c.borderSoft,
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
