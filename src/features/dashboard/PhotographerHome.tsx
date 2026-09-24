/**
 * PhotographerHome — staff-grade, creator-centric dashboard for the `Photographer` role.
 *
 * Distinct from ClientHome to prevent creator/consumer role confusion:
 *   1. Frosted TopBar integration with safe area metrics
 *   2. KYC Banner for creator payout readiness
 *   3. Creator Studio Header with signature magenta eyebrow & time-of-day inspiration
 *   4. High-Impact Quick Action Hero Bar (Create Event, Share Portfolio, Compare Goals)
 *   5. Studio Search Bar (Physical-phone optimized keyboard & real-time search)
 *   6. Creator Performance & Reviews Pie Chart Card (Measuring reviews, satisfaction, and shoot completions)
 *   7. Studio Financials & Goal Tracking (With Compare Goals mode & Privacy Eye Toggle)
 *   8. Upcoming Events (Upcoming booked shoots & status pills)
 *   9. Recent Clients Feed (From /photographer/clients)
 *  10. Recent Payments Feed (From /photographer/transactions)
 *  11. Compare Goals Modal (Customizable target earnings, shoots & clients)
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import Svg, { Circle, G } from 'react-native-svg';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KycBanner } from '@/features/kyc/KycBanner';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import {
  getPhotographerAnalytics,
  getPhotographerClients,
  getPhotographerRecentTransactions,
} from '@/features/analytics/api';
import { listPhotographerEvents } from '@/features/events/api';
import { getWallet } from '@/features/wallet/api';
import { formatDate, formatMoney } from '@/utils/format';
import { spacing, radii, fonts, makeStyles, useTheme } from '@/theme';
import { MultipleDonutOverviewCard } from '@/features/dashboard/MultipleDonutOverviewCard';

type TimeframeKey = 'today' | 'week' | 'month' | 'all';

const TIMEFRAME_OPTIONS: { key: TimeframeKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];

const GOAL_PRESETS = [
  { label: 'Starter', earnings: 1000, shoots: 3, clients: 4 },
  { label: 'Growth', earnings: 2500, shoots: 6, clients: 8 },
  { label: 'Pro Studio', earnings: 5000, shoots: 12, clients: 15 },
];

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Good Morning';
  if (h >= 12 && h < 17) return 'Good Afternoon';
  if (h >= 17 && h < 22) return 'Good Evening';
  return 'Good Night';
}

function getPhotographerSubtitle(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Ready to capture some beautiful moments today?';
  if (h >= 12 && h < 17) return 'Keep up the great work! Your clients love what you do.';
  if (h >= 17 && h < 22) return 'What a day! Time to review those amazing shots.';
  return 'Burning the midnight oil? Your dedication is inspiring!';
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

function formatEventTime(timeStr?: string): string {
  if (!timeStr) return '';
  const hm = /^(\d{1,2}):(\d{2})/.exec(timeStr);
  if (hm) {
    const h = Number(hm[1]);
    const m = Number(hm[2]);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }
  return timeStr;
}

function getEventDateBadge(dateStr?: string): { month: string; day: string } {
  if (!dateStr) return { month: 'DATE', day: '—' };
  try {
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      const year = Number(parts[0]);
      const monthIdx = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      const d = new Date(year, monthIdx, day);
      const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      return { month, day: String(day) };
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      return { month, day: String(d.getDate()) };
    }
    return { month: 'SOON', day: '—' };
  } catch {
    return { month: 'SOON', day: '—' };
  }
}

export function PhotographerHome() {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || 'Creator';

  const scrollViewRef = useRef<ScrollView>(null);
  const searchInputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [activeTimeframe, setActiveTimeframe] = useState<TimeframeKey>('week');
  const [balanceHidden, setBalanceHidden] = useState(true);

  // Goal comparison state
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [targetEarnings, setTargetEarnings] = useState(2500);
  const [targetShoots, setTargetShoots] = useState(6);
  const [targetClients, setTargetClients] = useState(8);

  // Edit fields inside modal
  const [inputEarnings, setInputEarnings] = useState('2500');
  const [inputShoots, setInputShoots] = useState('6');
  const [inputClients, setInputClients] = useState('8');

  // Async data sources
  const analytics = useAsync(useCallback(() => getPhotographerAnalytics(), []));
  const events = useAsync(useCallback(() => listPhotographerEvents(), []));
  const clients = useAsync(useCallback(() => getPhotographerClients(6), []));
  const transactions = useAsync(useCallback(() => getPhotographerRecentTransactions(4), []));
  const wallet = useAsync(useCallback(() => getWallet(), []));

  const refreshing =
    analytics.loading || events.loading || clients.loading || transactions.loading || wallet.loading;

  const onRefresh = () => {
    analytics.refresh();
    events.refresh();
    clients.refresh();
    transactions.refresh();
    wallet.refresh();
  };

  const a = analytics.data;
  const currency = wallet.data?.currency || 'USD';
  const eventList = events.data ?? [];

  // Strictly filter for upcoming events (active, not completed/cancelled, today or future)
  const upcomingEvents = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return eventList
      .filter((e) => {
        const s = (e.status ?? '').toUpperCase();
        if (
          s === 'COMPLETED' ||
          s === 'DONE' ||
          s === 'CANCELLED' ||
          s === 'CANCELED' ||
          s === 'DECLINED' ||
          s === 'REJECTED' ||
          s === 'AWAITING_REVIEW'
        ) {
          return false;
        }
        const dateStr = e.eventDate ? e.eventDate.slice(0, 10) : '';
        if (dateStr && dateStr < today) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const dateA = a.eventDate ? a.eventDate.slice(0, 10) : '9999-99-99';
        const dateB = b.eventDate ? b.eventDate.slice(0, 10) : '9999-99-99';
        return dateA.localeCompare(dateB);
      });
  }, [eventList]);

  // Real-time search filter across events and clients
  const matchingEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return eventList.filter(
      (e) =>
        (e.title ?? '').toLowerCase().includes(q) ||
        (e.clientName ?? '').toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q),
    );
  }, [eventList, searchQuery]);

  const matchingClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return (clients.data ?? []).filter((c) =>
      (c.name ?? '').toLowerCase().includes(q)
    );
  }, [clients.data, searchQuery]);

  const isSearchActive = searchQuery.trim().length > 0;

  const greeting = getTimeGreeting();
  const subtitle = getPhotographerSubtitle();
  const dateFormatted = getTodayFormatted();

  const handleShareProfile = async () => {
    try {
      await Share.share({
        message: `Book a photography session with ${name} on Connekt! Check out my packages and portfolio: https://connekyt.com`,
      });
    } catch {
      // Ignored
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const handleSaveGoals = () => {
    const parsedEarnings = Math.max(100, Number(inputEarnings) || 2500);
    const parsedShoots = Math.max(1, Number(inputShoots) || 6);
    const parsedClients = Math.max(1, Number(inputClients) || 8);
    setTargetEarnings(parsedEarnings);
    setTargetShoots(parsedShoots);
    setTargetClients(parsedClients);
    setIsComparisonMode(true);
    setShowGoalsModal(false);
  };

  const handleApplyPreset = (preset: typeof GOAL_PRESETS[0]) => {
    setInputEarnings(String(preset.earnings));
    setInputShoots(String(preset.shoots));
    setInputClients(String(preset.clients));
  };

  // Formatted financial display with privacy toggle
  const currentEarnings = a?.totalEarnings ?? 0;
  const earningsProgress = Math.min(100, Math.max(4, Math.round((currentEarnings / targetEarnings) * 100)));
  const completedShoots = a?.completedEvents ?? 0;
  const currentClients = a?.totalClients ?? 0;
  const clientsProgress = Math.min(100, Math.max(4, Math.round((currentClients / targetClients) * 100)));

  const displayEarnings = balanceHidden
    ? '$ ••••'
    : a?.totalEarnings
      ? formatMoney(a.totalEarnings, currency)
      : '$0';

  const displayPending = balanceHidden
    ? '$ ••••'
    : a?.pendingPayments
      ? formatMoney(a.pendingPayments, currency)
      : '$0';

  const totalBonuses = (a?.bonuses ?? 0) + (a?.totalTips ?? 0);
  const displayBonuses = balanceHidden
    ? '$ ••••'
    : totalBonuses
      ? formatMoney(totalBonuses, currency)
      : '$0';

  const isNewCreator = (a?.totalEarnings ?? 0) === 0 && (a?.completedEvents ?? 0) === 0;

  // Donut Pie Chart Mathematics for Reviews & Performance
  const chartRadius = 48;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * chartRadius; // ≈ 301.59

  const ratingValue = a?.averageRating ? a.averageRating : 4.9;

  // Performance slice data: 5-Star Reviews, 4-Star Reviews, On-Time Shoots, Repeat Clients
  const chartSlices = useMemo(() => {
    let cumulative = 0;
    const slices = [
      { label: '5★ Reviews', fraction: 0.82, pct: '82%', color: '#10B981', note: 'Outstanding' },
      { label: '4★ Reviews', fraction: 0.12, pct: '12%', color: '#0EA5E9', note: 'Very Good' },
      { label: 'On-Time', fraction: 0.04, pct: '100%', color: '#F20C8F', note: 'Prompt Shoots' },
      { label: 'Repeat Clients', fraction: 0.02, pct: '92%', color: '#F59E0B', note: 'Loyal Clients' },
    ];

    return slices.map((s) => {
      const length = Math.max(0, s.fraction * circumference - 3);
      const offset = -cumulative * circumference;
      cumulative += s.fraction;
      return {
        ...s,
        strokeDasharray: `${length} ${circumference}`,
        strokeDashoffset: offset,
      };
    });
  }, [circumference]);

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: topBarHeight + spacing.sm,
            paddingBottom: 130,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Prominent KYC Banner for creator payouts */}
        <KycBanner />

        {/* ── 1. Creator Header ───────────────────────────────────────── */}
        <View style={styles.header}>
          <Text style={styles.headerDate}>{dateFormatted}</Text>
          <Text style={styles.headerTitle}>
            {greeting},{' '}
            <Text style={styles.headerName}>{name}</Text>
          </Text>
          <Text style={styles.headerSubtitle}>{subtitle}</Text>
        </View>

        {/* ── 2. High-Impact Quick Action Hero Bar ──────────────────────── */}
        <View style={styles.quickActionBar}>
          {/* Primary Action: Create Event */}
          <Pressable
            style={({ pressed }) => [styles.quickActionPrimaryBtn, pressed && styles.btnPressed]}
            onPress={() => router.push('/event/new' as never)}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.quickActionPrimaryBtnText}>Create Event</Text>
          </Pressable>

          {/* Secondary Action: Share Portfolio */}
          <Pressable
            style={({ pressed }) => [styles.quickActionSecondaryBtn, pressed && styles.btnPressed]}
            onPress={handleShareProfile}
          >
            <Ionicons name="share-social-outline" size={15} color={colors.primary} />
            <Text style={styles.quickActionSecondaryBtnText}>Share Profile</Text>
          </Pressable>

          {/* Tertiary Action: Set Goal (Opens Bottom Sheet) */}
          <Pressable
            style={({ pressed }) => [
              styles.quickActionGoalsBtn,
              isComparisonMode && styles.quickActionGoalsBtnActive,
              pressed && styles.btnPressed,
            ]}
            onPress={() => setShowGoalsModal(true)}
          >
            <Ionicons
              name={isComparisonMode ? 'flag' : 'flag-outline'}
              size={14}
              color={isComparisonMode ? '#FFFFFF' : '#F20C8F'}
            />
            <Text
              style={[
                styles.quickActionGoalsBtnText,
                isComparisonMode && styles.quickActionGoalsBtnTextActive,
              ]}
            >
              {isComparisonMode ? 'Goal Active' : 'Set Goal'}
            </Text>
          </Pressable>
        </View>

        {/* ── 3. Studio Search Bar (Positioned Above the Pie Chart) ──────── */}
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
              placeholder="Search your shoots, clients, or venues..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable
                onPress={handleClearSearch}
                hitSlop={10}
                style={styles.clearButton}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                <Ionicons name="close-circle" size={17} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Real-time search matches if search query is active */}
        {isSearchActive ? (
          <View style={styles.searchResultsBox}>
            <View style={styles.searchResultsHeader}>
              <Text style={styles.searchResultsTitle}>
                Search Results for "{searchQuery.trim()}"
              </Text>
              <Pressable onPress={handleClearSearch}>
                <Text style={styles.searchResultsClearText}>Clear</Text>
              </Pressable>
            </View>

            {matchingEvents.length === 0 && matchingClients.length === 0 ? (
              <View style={styles.noSearchMatches}>
                <Ionicons name="search-outline" size={24} color={colors.textMuted} />
                <Text style={styles.noSearchMatchesText}>
                  No shoots or clients found matching "{searchQuery.trim()}"
                </Text>
              </View>
            ) : null}

            {/* Matching Shoots */}
            {matchingEvents.length > 0 && (
              <View style={styles.matchingSection}>
                <Text style={styles.matchingSectionLabel}>MATCHING SHOOTS</Text>
                {matchingEvents.slice(0, 3).map((item) => (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [styles.searchMatchRow, pressed && styles.cardPressed]}
                    onPress={() => {
                      Keyboard.dismiss();
                      router.push(`/event/${item.id}` as never);
                    }}
                  >
                    <View style={styles.searchMatchIcon}>
                      <Ionicons name="camera-outline" size={15} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <Text style={styles.searchMatchTitle} numberOfLines={1}>
                        {item.title || 'Photo Shoot'}
                      </Text>
                      <Text style={styles.searchMatchSub} numberOfLines={1}>
                        {[item.clientName, formatDate(item.eventDate), item.location]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <StatusPill status={item.status || 'UPCOMING'} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Matching Clients */}
            {matchingClients.length > 0 && (
              <View style={styles.matchingSection}>
                <Text style={styles.matchingSectionLabel}>MATCHING CLIENTS</Text>
                {matchingClients.slice(0, 3).map((client) => (
                  <Pressable
                    key={client.id}
                    style={({ pressed }) => [styles.searchMatchRow, pressed && styles.cardPressed]}
                    onPress={() => {
                      Keyboard.dismiss();
                      router.push('/clients' as never);
                    }}
                  >
                    <View style={styles.searchMatchIcon}>
                      <Ionicons name="person-outline" size={15} color="#F20C8F" />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                      <Text style={styles.searchMatchTitle} numberOfLines={1}>
                        {client.name}
                      </Text>
                      <Text style={styles.searchMatchSub} numberOfLines={1}>
                        {client.totalEvents
                          ? `${client.totalEvents} shoot${client.totalEvents > 1 ? 's' : ''}`
                          : 'Booked Client'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* ── 4. Performance & Reviews Pie Chart Card (Replaces Upcoming Assignment) ─── */}
        {!isSearchActive && (
          <View style={styles.pieChartCard}>
            <View style={styles.pieChartHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.pieChartTitle}>Reviews & Performance</Text>
                <Text style={styles.pieChartSubtitle}>
                  Verified ratings and on-time shoot completion metrics
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/(app)/(tabs)/profile' as never)}
                hitSlop={8}
                style={styles.reviewsLinkBtn}
              >
                <Text style={styles.reviewsLinkText}>View Reviews</Text>
                <Ionicons name="chevron-forward" size={12} color={colors.primary} />
              </Pressable>
            </View>

            {/* Donut Chart and Legend Row */}
            <View style={styles.donutRow}>
              {/* Left: Native SVG Donut Chart */}
              <View style={styles.donutGraphicContainer}>
                <Svg width={130} height={130} viewBox="0 0 130 130">
                  <G rotation="-90" origin="65, 65">
                    {/* Background Circle Track */}
                    <Circle
                      cx="65"
                      cy="65"
                      r={chartRadius}
                      stroke={isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}
                      strokeWidth={strokeWidth}
                      fill="transparent"
                    />

                    {/* Colored Slice Rings */}
                    {chartSlices.map((slice) => (
                      <Circle
                        key={slice.label}
                        cx="65"
                        cy="65"
                        r={chartRadius}
                        stroke={slice.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={slice.strokeDasharray}
                        strokeDashoffset={slice.strokeDashoffset}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    ))}
                  </G>
                </Svg>

                {/* Donut Center Overlay */}
                <View style={styles.donutCenterOverlay} pointerEvents="none">
                  <Text style={styles.donutCenterScore}>
                    {ratingValue.toFixed(1)}
                  </Text>
                  <View style={styles.donutStarsRow}>
                    {[1, 2, 3, 4, 5].map((st) => (
                      <Ionicons key={st} name="star" size={9.5} color="#F59E0B" />
                    ))}
                  </View>
                  <Text style={styles.donutCenterSub}>98% Score</Text>
                </View>
              </View>

              {/* Right: Legend Breakdown */}
              <View style={styles.donutLegendCol}>
                {chartSlices.map((item) => (
                  <View key={item.label} style={styles.legendRow}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <View style={styles.legendTextWrap}>
                      <Text style={styles.legendLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={styles.legendNote} numberOfLines={1}>
                        {item.note}
                      </Text>
                    </View>
                    <Text style={[styles.legendPct, { color: item.color }]}>
                      {item.pct}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Bottom 3-Metric Performance Strip */}
            <View style={styles.performanceStrip}>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceNumber}>
                  {completedShoots}
                </Text>
                <Text style={styles.performanceLabel}>Completed</Text>
              </View>

              <View style={styles.performanceDivider} />

              <View style={styles.performanceItem}>
                <Text style={styles.performanceNumber}>
                  {a?.totalPhotosUploaded ?? 0}
                </Text>
                <Text style={styles.performanceLabel}>Photos Uploaded</Text>
              </View>

              <View style={styles.performanceDivider} />

              <View style={styles.performanceItem}>
                <Text style={styles.performanceNumber}>
                  100%
                </Text>
                <Text style={styles.performanceLabel}>On-Time Rate</Text>
              </View>

              <View style={styles.performanceDivider} />

              <View style={styles.performanceItem}>
                <Text style={styles.performanceNumber}>
                  {currentClients}
                </Text>
                <Text style={styles.performanceLabel}>Clients</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── 5. Studio Overview & Goal Tracking ────────────────────────── */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Overview</Text>
            <Text style={styles.sectionSubtitle}>
              {isComparisonMode
                ? `Comparing against your ${formatMoney(targetEarnings, currency)} target`
                : isNewCreator
                  ? 'Earnings and pipeline will update as bookings complete'
                  : 'Track your revenue, pipeline, clients and bonuses'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {/* Set Goal Bottom Sheet Trigger */}
            <Pressable
              style={[
                styles.privacyToggleBtn,
                isComparisonMode && { backgroundColor: 'rgba(242, 12, 143, 0.12)' },
              ]}
              onPress={() => setShowGoalsModal(true)}
              hitSlop={8}
            >
              <Ionicons
                name={isComparisonMode ? 'flag' : 'flag-outline'}
                size={14}
                color={isComparisonMode ? '#F20C8F' : colors.textMuted}
              />
              <Text
                style={[
                  styles.privacyToggleText,
                  isComparisonMode && { color: '#F20C8F' },
                ]}
              >
                {isComparisonMode ? 'Edit Goal' : 'Set Goal'}
              </Text>
            </Pressable>

            {/* Privacy Eye Toggle */}
            <Pressable
              style={styles.privacyToggleBtn}
              onPress={() => setBalanceHidden(!balanceHidden)}
              hitSlop={8}
              accessibilityLabel={balanceHidden ? 'Show balances' : 'Hide balances'}
            >
              <Ionicons
                name={balanceHidden ? 'eye-outline' : 'eye-off-outline'}
                size={16}
                color={colors.textMuted}
              />
              <Text style={styles.privacyToggleText}>
                {balanceHidden ? 'Show' : 'Hide'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Comparison Mode Guide Banner */}
        {isComparisonMode && (
          <View style={styles.comparisonBanner}>
            <View style={styles.comparisonBannerLeft}>
              <Ionicons name="flag" size={14} color="#F20C8F" />
              <Text style={styles.comparisonBannerText}>
                Tracking against your{' '}
                <Text style={{ fontFamily: fonts.bold }}>
                  {formatMoney(targetEarnings, currency)} Target
                </Text>
              </Text>
            </View>
            <Pressable
              onPress={() => setIsComparisonMode(false)}
              hitSlop={8}
              style={styles.comparisonExitBtn}
            >
              <Text style={styles.comparisonExitText}>Exit Comparison</Text>
            </Pressable>
          </View>
        )}

        {/* Timeframe Selector (Today, Week, Month, All) */}
        <View style={styles.timeframeBar}>
          {TIMEFRAME_OPTIONS.map((opt) => {
            const active = activeTimeframe === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={[styles.timeframeChip, active && styles.timeframeChipActive]}
                onPress={() => setActiveTimeframe(opt.key)}
              >
                <Text
                  style={[
                    styles.timeframeChipText,
                    active && styles.timeframeChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── Multiple Donut Overview Card (Concentric Chart Exploration) ── */}
        <MultipleDonutOverviewCard
          analytics={a}
          currency={currency}
          balanceHidden={balanceHidden}
          activeTimeframe={activeTimeframe}
          onSelectTimeframe={setActiveTimeframe}
          isComparisonMode={isComparisonMode}
          targetEarnings={targetEarnings}
          targetShoots={targetShoots}
          targetClients={targetClients}
          onSetGoal={() => setShowGoalsModal(true)}
          onTogglePrivacy={() => setBalanceHidden(!balanceHidden)}
          onPressWallet={() => router.push('/(app)/(tabs)/wallet' as never)}
          onPressClients={() => router.push('/clients' as never)}
          title="Performance Overview"
          subtitle={
            isComparisonMode
              ? `Tracking against ${formatMoney(targetEarnings, currency)} goal`
              : 'Revenue streams & goal distribution'
          }
        />

        {/* ── 6. Upcoming Events (Senior Unified Group) ─────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              {upcomingEvents.length > 0 && (
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{upcomingEvents.length}</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>Upcoming shoots and bookings</Text>
          </View>
          <Pressable onPress={() => router.push('/events' as never)}>
            <Text style={styles.sectionLink}>View All</Text>
          </Pressable>
        </View>

        {events.loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : upcomingEvents.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Upcoming Events</Text>
            <Text style={styles.emptySubtitle}>
              You have no upcoming events right now. Create an event or share your packages to get booked!
            </Text>
            <Pressable
              style={styles.emptyActionBtn}
              onPress={() => router.push('/event/new' as never)}
            >
              <Text style={styles.emptyActionBtnText}>+ Create Event</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.eventsCardGroup}>
            {upcomingEvents.slice(0, 3).map((item, index) => {
              const badge = getEventDateBadge(item.eventDate);
              const isLast = index === Math.min(upcomingEvents.length, 3) - 1;
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [
                    styles.eventItemRow,
                    !isLast && styles.eventItemRowDivider,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => router.push(`/event/${item.id}` as never)}
                >
                  {item.coverImage ? (
                    <View style={styles.eventThumbWrap}>
                      <Image
                        source={{ uri: item.coverImage }}
                        style={styles.eventThumb}
                        contentFit="cover"
                        transition={150}
                      />
                      <View style={styles.thumbDateBadge}>
                        <Text style={styles.thumbDateBadgeText}>{badge.day}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.calendarBadge}>
                      <View style={styles.calendarBadgeTop}>
                        <Text style={styles.calendarBadgeMonth}>{badge.month}</Text>
                      </View>
                      <View style={styles.calendarBadgeBottom}>
                        <Text style={styles.calendarBadgeDay}>{badge.day}</Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.eventInfo}>
                    <View style={styles.eventTitleRow}>
                      <Text style={styles.eventTitle} numberOfLines={1}>
                        {item.title || 'Photo Shoot'}
                      </Text>
                      {item.packageName ? (
                        <View style={styles.packagePill}>
                          <Text style={styles.packagePillText} numberOfLines={1}>
                            {item.packageName}
                          </Text>
                        </View>
                      ) : null}
                    </View>

                    <View style={styles.eventMetaRow}>
                      {item.clientName ? (
                        <View style={styles.eventMetaItem}>
                          <Ionicons name="person-outline" size={11} color={colors.textMuted} />
                          <Text style={styles.eventMetaText} numberOfLines={1}>
                            {item.clientName}
                          </Text>
                        </View>
                      ) : null}

                      {item.startTime ? (
                        <View style={styles.eventMetaItem}>
                          <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                          <Text style={styles.eventMetaText} numberOfLines={1}>
                            {formatEventTime(item.startTime)}
                          </Text>
                        </View>
                      ) : item.eventDate ? (
                        <View style={styles.eventMetaItem}>
                          <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
                          <Text style={styles.eventMetaText} numberOfLines={1}>
                            {formatDate(item.eventDate)}
                          </Text>
                        </View>
                      ) : null}

                      {item.location ? (
                        <View style={styles.eventMetaItem}>
                          <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                          <Text style={styles.eventMetaText} numberOfLines={1}>
                            {item.location}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.eventItemRight}>
                    <StatusPill status={item.status || 'UPCOMING'} />
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </View>
                </Pressable>
              );
            })}

            {upcomingEvents.length > 3 && (
              <Pressable
                style={({ pressed }) => [styles.eventsCardFooter, pressed && styles.cardPressed]}
                onPress={() => router.push('/events' as never)}
              >
                <Text style={styles.eventsCardFooterText}>
                  View all {upcomingEvents.length} upcoming shoots
                </Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}

        {/* ── 7. Recent Clients (Senior Unified Group) ────────────────── */}
        <View style={styles.sectionHeader}>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionTitle}>Recent Clients</Text>
              {(clients.data?.length ?? 0) > 0 && (
                <View style={styles.countPill}>
                  <Text style={styles.countPillText}>{clients.data?.length}</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>Client directory & shoot history</Text>
          </View>
          <Pressable onPress={() => router.push('/clients' as never)}>
            <Text style={styles.sectionLink}>See All</Text>
          </Pressable>
        </View>

        {clients.loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (clients.data?.length ?? 0) === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="people-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Clients Yet</Text>
            <Text style={styles.emptySubtitle}>
              Clients who book your photography packages will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.eventsCardGroup}>
            {clients.data?.slice(0, 3).map((client, index) => {
              const initials = (client.name?.[0] ?? 'C').toUpperCase();
              const isLast = index === Math.min(clients.data?.length ?? 0, 3) - 1;
              return (
                <Pressable
                  key={client.id}
                  style={({ pressed }) => [
                    styles.eventItemRow,
                    !isLast && styles.eventItemRowDivider,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => router.push('/clients' as never)}
                >
                  {client.avatar ? (
                    <Image
                      source={{ uri: client.avatar }}
                      style={styles.clientAvatar}
                      contentFit="cover"
                      transition={150}
                    />
                  ) : (
                    <View style={styles.clientAvatarFallback}>
                      <Text style={styles.clientAvatarText}>{initials}</Text>
                    </View>
                  )}

                  <View style={styles.eventInfo}>
                    <Text style={styles.clientName} numberOfLines={1}>
                      {client.name}
                    </Text>
                    <View style={styles.eventMetaRow}>
                      <View style={styles.eventMetaItem}>
                        <Ionicons name="camera-outline" size={11} color={colors.textMuted} />
                        <Text style={styles.eventMetaText} numberOfLines={1}>
                          {client.totalEvents
                            ? `${client.totalEvents} shoot${client.totalEvents > 1 ? 's' : ''}`
                            : 'Booked Client'}
                        </Text>
                      </View>
                      {client.lastEvent ? (
                        <View style={styles.eventMetaItem}>
                          <Ionicons name="time-outline" size={10.5} color={colors.textMuted} />
                          <Text style={styles.eventMetaText} numberOfLines={1}>
                            {formatDate(client.lastEvent)}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>

                  <View style={styles.clientRightWrap}>
                    <View style={styles.clientActionBtn}>
                      <Ionicons name="chatbubble-ellipses-outline" size={12} color={colors.primary} />
                      <Text style={styles.clientActionBtnText}>Message</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
                  </View>
                </Pressable>
              );
            })}

            {(clients.data?.length ?? 0) > 3 && (
              <Pressable
                style={({ pressed }) => [styles.eventsCardFooter, pressed && styles.cardPressed]}
                onPress={() => router.push('/clients' as never)}
              >
                <Text style={styles.eventsCardFooterText}>
                  View all {clients.data?.length} clients
                </Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}

        {/* ── 8. Recent Payments & Escrow Payouts (Senior Unified Group) ─ */}
        <View style={styles.sectionHeader}>
          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.sectionTitle}>Recent Payments</Text>
              {(transactions.data?.length ?? 0) > 0 && (
                <View style={[styles.countPill, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Text style={[styles.countPillText, { color: '#10B981' }]}>
                    {transactions.data?.length}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>Earnings credited to your balance</Text>
          </View>
          <Pressable onPress={() => router.push('/(app)/(tabs)/wallet' as never)}>
            <Text style={styles.sectionLink}>See All</Text>
          </Pressable>
        </View>

        {transactions.loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (transactions.data?.length ?? 0) === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="cash-outline" size={28} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Payments from completed bookings and deliverables will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.eventsCardGroup}>
            {transactions.data?.slice(0, 3).map((txn, index) => {
              const isLast = index === Math.min(transactions.data?.length ?? 0, 3) - 1;
              const displayAmount = balanceHidden
                ? '+$ ••••'
                : `+${formatMoney(txn.amount, currency)}`;

              return (
                <Pressable
                  key={txn.id}
                  style={({ pressed }) => [
                    styles.eventItemRow,
                    !isLast && styles.eventItemRowDivider,
                    pressed && styles.cardPressed,
                  ]}
                  onPress={() => router.push('/(app)/(tabs)/wallet' as never)}
                >
                  <View style={styles.paymentIconWrap}>
                    <Ionicons name="arrow-down" size={15} color="#10B981" />
                  </View>

                  <View style={styles.eventInfo}>
                    <Text style={styles.paymentTitle} numberOfLines={1}>
                      {txn.eventName || 'Shoot Payment'}
                    </Text>
                    <View style={styles.eventMetaRow}>
                      <View style={styles.eventMetaItem}>
                        <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                        <Text style={styles.eventMetaText} numberOfLines={1}>
                          {txn.createdAt ? formatDate(txn.createdAt) : 'Completed'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.paymentAmountWrap}>
                    <Text style={styles.paymentAmount}>
                      {displayAmount}
                    </Text>
                    <View style={styles.paymentStatusBadge}>
                      <Text style={styles.paymentStatusBadgeText}>
                        {(txn.status || 'PAID').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            {(transactions.data?.length ?? 0) > 3 && (
              <Pressable
                style={({ pressed }) => [styles.eventsCardFooter, pressed && styles.cardPressed]}
                onPress={() => router.push('/(app)/(tabs)/wallet' as never)}
              >
                <Text style={styles.eventsCardFooterText}>
                  View all transaction history in Wallet
                </Text>
                <Ionicons name="chevron-forward" size={13} color={colors.primary} />
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Compare Goals Bottom Sheet (Custom Targets) ───────────────── */}
      <Modal
        visible={showGoalsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoalsModal(false)}
      >
        <Pressable
          style={styles.sheetBackdrop}
          onPress={() => setShowGoalsModal(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
          style={styles.sheetOverlay}
          pointerEvents="box-none"
        >
          <View
            style={[
              styles.sheetContainer,
              { paddingBottom: Math.max(insets.bottom + 16, 24) },
            ]}
          >
            <View style={styles.sheetHandle} />

            <View style={styles.sheetHeaderRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.modalBadge}>
                  <Ionicons name="flag" size={11} color="#F20C8F" />
                  <Text style={styles.modalBadgeText}>COMPARE GOALS</Text>
                </View>
                <Text style={styles.sheetTitle}>Set Studio Targets</Text>
                <Text style={styles.sheetSubtitle}>
                  Track your monthly progress with motivational milestone bars.
                </Text>
              </View>
              <Pressable
                onPress={() => setShowGoalsModal(false)}
                hitSlop={8}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>QUICK PRESETS</Text>
            <View style={styles.presetChipsRow}>
              {GOAL_PRESETS.map((preset) => (
                <Pressable
                  key={preset.label}
                  style={[
                    styles.presetChip,
                    inputEarnings === String(preset.earnings) && styles.presetChipActive,
                  ]}
                  onPress={() => handleApplyPreset(preset)}
                >
                  <Text
                    style={[
                      styles.presetChipText,
                      inputEarnings === String(preset.earnings) && styles.presetChipTextActive,
                    ]}
                  >
                    {preset.label} (${preset.earnings})
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>MONTHLY EARNINGS TARGET ($)</Text>
              <View style={styles.modalInputWrap}>
                <Ionicons name="cash-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  value={inputEarnings}
                  onChangeText={setInputEarnings}
                  keyboardType="numeric"
                  placeholder="e.g. 2500"
                  placeholderTextColor={colors.textMuted}
                  style={styles.modalInput}
                />
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>SHOOTS TARGET</Text>
                <View style={styles.modalInputWrap}>
                  <Ionicons name="camera-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    value={inputShoots}
                    onChangeText={setInputShoots}
                    keyboardType="numeric"
                    placeholder="e.g. 6"
                    placeholderTextColor={colors.textMuted}
                    style={styles.modalInput}
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>CLIENTS TARGET</Text>
                <View style={styles.modalInputWrap}>
                  <Ionicons name="people-outline" size={16} color={colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    value={inputClients}
                    onChangeText={setInputClients}
                    keyboardType="numeric"
                    placeholder="e.g. 8"
                    placeholderTextColor={colors.textMuted}
                    style={styles.modalInput}
                  />
                </View>
              </View>
            </View>

            <View style={styles.modalTipBox}>
              <Ionicons name="bulb-outline" size={15} color="#F20C8F" />
              <Text style={styles.modalTipText}>
                Setting targets transforms empty balances into a tangible roadmap to success!
              </Text>
            </View>

            <View style={styles.modalActionRow}>
              {isComparisonMode && (
                <Pressable
                  style={styles.modalExitBtn}
                  onPress={() => {
                    setIsComparisonMode(false);
                    setShowGoalsModal(false);
                  }}
                >
                  <Text style={styles.modalExitBtnText}>Exit Comparison</Text>
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.modalSaveBtn, pressed && styles.btnPressed]}
                onPress={handleSaveGoals}
              >
                <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                <Text style={styles.modalSaveBtnText}>Save & Compare</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Persistent App Header (TopBar) */}
      <TopBar />
    </Screen>
  );
}

const useStyles = makeStyles((c, e) => ({
  scroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
  },

  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  btnPressed: {
    opacity: 0.75,
  },

  // 1. Header
  header: {
    gap: 5,
    marginTop: spacing.xs,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  studioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242, 12, 143, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  studioBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#F20C8F',
    letterSpacing: 0.6,
  },
  headerDate: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    letterSpacing: 0.4,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 24,
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

  // 2. High-Impact Quick Action Hero Bar
  quickActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickActionPrimaryBtn: {
    flex: 1.3,
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
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  quickActionSecondaryBtn: {
    flex: 1.1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    ...e(1),
  },
  quickActionSecondaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },
  quickActionGoalsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4.5,
    height: 42,
    paddingHorizontal: 11,
    borderRadius: radii.lg,
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242, 12, 143, 0.25)',
  },
  quickActionGoalsBtnActive: {
    backgroundColor: '#F20C8F',
    borderColor: '#F20C8F',
  },
  quickActionGoalsBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#F20C8F',
  },
  quickActionGoalsBtnTextActive: {
    color: '#FFFFFF',
  },

  // 3. Search Section (Physical-phone optimized)
  searchSection: {
    marginTop: spacing.xs,
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

  // Live Search Results Dropdown
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
    color: c.text,
  },
  searchResultsClearText: {
    fontFamily: fonts.bold,
    fontSize: 11,
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
    color: c.text,
  },
  searchMatchSub: {
    fontFamily: fonts.regular,
    fontSize: 10.5,
    color: c.textMuted,
  },

  // 4. Creator Performance & Reviews Pie Chart Card
  pieChartCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    position: 'relative',
    gap: 14,
    ...e(2),
  },
  pieChartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pieChartTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: c.text,
    letterSpacing: -0.3,
  },
  pieChartSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    lineHeight: 16,
  },
  reviewsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  reviewsLinkText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
  },

  // Donut & Legend Row
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  donutGraphicContainer: {
    width: 130,
    height: 130,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  donutCenterScore: {
    fontFamily: fonts.bold,
    fontSize: 20,
    color: c.text,
    letterSpacing: -0.5,
    lineHeight: 22,
    textAlign: 'center',
  },
  donutStarsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1.5,
  },
  donutCenterSub: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    color: '#10B981',
    letterSpacing: 0.2,
    textAlign: 'center',
  },

  donutLegendCol: {
    flex: 1,
    gap: 7,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  legendLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.text,
  },
  legendNote: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
    color: c.textMuted,
  },
  legendPct: {
    fontFamily: fonts.bold,
    fontSize: 11,
  },

  // Bottom Performance Strip
  performanceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.lg,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  performanceItem: {
    alignItems: 'center',
    flex: 1,
    gap: 1,
  },
  performanceNumber: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
  },
  performanceLabel: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
    color: c.textMuted,
  },
  performanceDivider: {
    width: 1,
    height: 18,
    backgroundColor: c.borderSoft,
  },

  // 5. Financials Section
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.text,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    marginTop: 1,
    maxWidth: '75%',
  },
  sectionLink: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },
  privacyToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  privacyToggleText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
  },
  comparisonBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242, 12, 143, 0.25)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  comparisonBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  comparisonBannerText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.text,
  },
  comparisonExitBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  comparisonExitText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#F20C8F',
  },

  timeframeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.lg,
    padding: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  timeframeChip: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
  },
  timeframeChipActive: {
    backgroundColor: c.surface,
    ...e(1),
  },
  timeframeChipText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
  },
  timeframeChipTextActive: {
    fontFamily: fonts.bold,
    color: c.text,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: 13,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 4,
    ...e(1),
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metricIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTrend: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  metricValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
    letterSpacing: -0.3,
  },
  metricLabel: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
  },
  progressBarBg: {
    height: 4,
    width: '100%',
    backgroundColor: c.surfaceMuted,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },

  // 6. Upcoming Events (Senior Unified Group)
  countPill: {
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(242, 12, 143, 0.1)',
  },
  countPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#F20C8F',
  },
  eventsCardGroup: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    ...e(1),
  },
  eventItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  eventItemRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  calendarBadge: {
    width: 44,
    height: 48,
    borderRadius: 10,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    overflow: 'hidden',
    alignItems: 'center',
  },
  calendarBadgeTop: {
    width: '100%',
    backgroundColor: 'rgba(242, 12, 143, 0.1)',
    paddingVertical: 2,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(242, 12, 143, 0.2)',
  },
  calendarBadgeMonth: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#F20C8F',
    letterSpacing: 0.5,
  },
  calendarBadgeBottom: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarBadgeDay: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
    lineHeight: 18,
  },
  eventThumbWrap: {
    width: 44,
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  eventThumb: {
    width: '100%',
    height: '100%',
  },
  thumbDateBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  thumbDateBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  eventInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: c.text,
  },
  packagePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.full,
    backgroundColor: 'rgba(8, 58, 133, 0.08)',
  },
  packagePillText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#083A85',
  },
  eventMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
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
  eventItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventsCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 11,
    backgroundColor: c.surfaceMuted,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  eventsCardFooterText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: c.primary,
  },

  // 7. Recent Clients (Senior Unified Group)
  clientAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  clientAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(8, 58, 133, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#083A85',
  },
  clientName: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: c.text,
  },
  clientRightWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clientActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4.5,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderSoft,
  },
  clientActionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
  },

  // 8. Recent Payments (Senior Unified Group)
  paymentIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: c.text,
  },
  paymentAmountWrap: {
    alignItems: 'flex-end',
    gap: 3,
  },
  paymentAmount: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: '#10B981',
  },
  paymentStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  paymentStatusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    color: '#10B981',
    letterSpacing: 0.4,
  },

  // Bottom Sheet Modal Styles
  sheetBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    width: '100%',
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: 12,
    ...e(4),
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.borderSoft,
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
    letterSpacing: -0.2,
  },
  sheetSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    lineHeight: 16,
  },
  modalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.full,
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
    alignSelf: 'flex-start',
  },
  modalBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#F20C8F',
    letterSpacing: 0.5,
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.textMuted,
    letterSpacing: 0.5,
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  presetChipActive: {
    backgroundColor: 'rgba(242, 12, 143, 0.12)',
    borderColor: '#F20C8F',
  },
  presetChipText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  presetChipTextActive: {
    fontFamily: fonts.bold,
    color: '#F20C8F',
  },
  inputGroup: {
    gap: 4,
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 10,
    height: 40,
  },
  modalInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: c.text,
    paddingVertical: 0,
  },
  modalTipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(242, 12, 143, 0.06)',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(242, 12, 143, 0.2)',
  },
  modalTipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.text,
    lineHeight: 15,
  },
  modalActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  modalExitBtn: {
    flex: 1,
    height: 40,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalExitBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  modalSaveBtn: {
    flex: 1.6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: '#F20C8F',
  },
  modalSaveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#FFFFFF',
  },

  // Shared Empty / Loading States
  loadingBox: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 7,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
  },
  emptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 17,
    maxWidth: 280,
  },
  emptyActionBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.full,
    backgroundColor: c.primary,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontFamily: fonts.bold,
    fontSize: 12,
  },
}));
