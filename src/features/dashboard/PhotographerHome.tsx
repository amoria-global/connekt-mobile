/**
 * PhotographerHome: the photographer's working dashboard.
 *
 * Reading order follows what a photographer opens the app for:
 *   1. Orientation: greeting, date, privacy toggle.
 *   2. Money now: available to withdraw and pending release (from the wallet).
 *   3. Actions: create event, share profile, opportunities, collaborate.
 *   4. Needs your reply: booking requests and open opportunities.
 *   5. Next shoots: horizontal preview, "See all" opens the Events tab.
 *   6. Business overview: lifetime figures, horizontal preview, "View analytics".
 *   7. Recent earnings and recent clients.
 *
 * Honesty rules, each of which was a defect before this rewrite:
 *   - Every figure comes from an API. A figure that has not loaded, or failed to
 *     load, shows "N/A" and an error with a retry, never a zero.
 *   - Wallet figures use the wallet's own currency. Analytics totals and the
 *     transaction feed are USD ledger values (backend PhotographerAnalyticsService
 *     and `amountInUsd`), so they are formatted as USD, not relabelled to the wallet.
 *   - There is no period selector here: the analytics endpoint has no period, so
 *     a "this week" label over lifetime totals was misleading. Periods live on the
 *     Analytics screen.
 *   - Background polling for opportunities is quiet and never drives the
 *     pull-to-refresh spinner.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, RefreshControl, ScrollView, Share, Text, View } from 'react-native';
import { Alert } from '@/components/ui/dialog';
import { photographerProfileUrl } from '@/features/photographer/profileLink';
import { useForegroundPolling } from '@/hooks/useForegroundPolling';
import { GoalsSection } from '@/features/photographer/GoalsSection';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { KycBanner } from '@/features/kyc/KycBanner';
import { MatchingProfilePrompt } from '@/features/hybrid/MatchingProfile';
import { IncomingOpportunityAlertModal } from '@/features/hybrid/IncomingOpportunityAlertModal';
import { listOpportunities, approveOpportunity, rejectOpportunity } from '@/features/hybrid/api';
import type { PhotographerOpportunity } from '@/features/hybrid/types';
import {
  getPhotographerAnalytics,
  getPhotographerClients,
  getPhotographerRecentTransactions,
} from '@/features/analytics/api';
import { listPhotographerEvents } from '@/features/events/api';
import { listPhotographerReviews } from '@/features/reviews/api';
import { selectWalletStats } from '@/features/wallet/moneyView';
import { getWallet } from '@/features/wallet/api';
import { env } from '@/config/env';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import { useCurrency } from '@/store/currency';
import { formatDate } from '@/utils/format';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import {
  ActionButton,
  Card,
  EmptyNote,
  ErrorNotice,
  HCarousel,
  MetricCard,
  SectionHeader,
  SkeletonCard,
} from '@/features/photographer/kit';
import { BusinessOverview, EarningRow, PriorityCard, ShootCard } from '@/features/photographer/homeParts';
import { moneyText, signedMoneyText } from '@/features/photographer/money';
import {
  bucketOf,
  byStart,
  clock12,
  dayKey,
  eventDay,
  upcomingEvents as pickUpcoming,
} from '@/features/photographer/schedule';
import type { EventItem } from '@/features/events/types';

/** Analytics totals and the transaction feed are USD ledger values. */
const LEDGER_CURRENCY = 'USD';
const OPPORTUNITY_POLL_MS = 6000;
const PREVIEW_LIMIT = 6;
/** Stable fallback so `data ?? EMPTY` does not give memo hooks a new array every render. */
const EMPTY: never[] = [];

function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h >= 5 && h < 12) return 'Good morning';
  if (h >= 12 && h < 17) return 'Good afternoon';
  if (h >= 17 && h < 22) return 'Good evening';
  return 'Hello';
}

function longDate(now = new Date()): string {
  try {
    return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

/** Same buckets and words as the Events calendar, so a shoot is never described two ways. */
const SHOOT_STATUS: Record<ReturnType<typeof bucketOf>, { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' }> = {
  pending: { label: 'Awaiting your reply', tone: 'warning' },
  upcoming: { label: 'Scheduled', tone: 'info' },
  ongoing: { label: 'In progress', tone: 'success' },
  completed: { label: 'Completed', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'error' },
};

/** The API's own transaction status, coloured by meaning. Unknown words stay neutral rather than guessing. */
function txTone(status: string): 'success' | 'warning' | 'neutral' {
  if (/pend|hold|escrow|process/i.test(status)) return 'warning';
  if (/credit|complete|paid|releas|success/i.test(status)) return 'success';
  return 'neutral';
}

function whenText(e: EventItem): string {
  const day = eventDay(e);
  const parts = [day ? formatDate(day) : '', e.startTime ? clock12(e.startTime) : ''].filter(Boolean);
  return parts.join(' · ') || 'Date to be confirmed';
}

export function PhotographerHome() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || 'there';
  const photographerId = user?.customerId ? String(user.customerId) : undefined;

  const [hidden, setHidden] = useState(true);
  const [pulling, setPulling] = useState(false);
  const [dismissedOppIds, setDismissedOppIds] = useState<string[]>([]);

  const wallet = useAsync(useCallback(() => getWallet(), []));
  const analytics = useAsync(useCallback(() => getPhotographerAnalytics(), []));
  const events = useAsync(useCallback(() => listPhotographerEvents(), []));
  const clients = useAsync(useCallback(() => getPhotographerClients(8), []));
  const transactions = useAsync(useCallback(() => getPhotographerRecentTransactions(4), []));
  const reviews = useAsync(
    useCallback(
      () => (photographerId ? listPhotographerReviews(photographerId) : Promise.resolve([])),
      [photographerId],
    ),
  );
  const opportunities = useAsync(
    useCallback(() => (env.hybridBookingEnabled ? listOpportunities() : Promise.resolve([])), []),
  );

  // Quiet background poll, only while Home is focused and the app is in the foreground (useForegroundPolling).
  // The app also runs a global incoming-opportunity alert; this keeps the badge and list on Home current.
  useForegroundPolling(opportunities.refreshQuietly, OPPORTUNITY_POLL_MS, env.hybridBookingEnabled);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([
        wallet.refresh(),
        analytics.refresh(),
        events.refresh(),
        clients.refresh(),
        transactions.refresh(),
        reviews.refresh(),
        opportunities.refresh(),
      ]);
    } finally {
      setPulling(false);
    }
  }, [wallet, analytics, events, clients, transactions, reviews, opportunities]);

  // ── Opportunities ────────────────────────────────────────────────────────
  const oppList = opportunities.data ?? EMPTY;
  const openOppCount = oppList.filter((o) => (o.status ?? 'INVITED') === 'INVITED').length;
  const incomingOpportunity = useMemo(() => {
    if (!env.hybridBookingEnabled) return null;
    return (
      oppList.find((opp) => {
        const s = (opp.status ?? '').toUpperCase();
        const closed = s === 'APPROVED' || s === 'REJECTED' || s === 'DECLINED' || s === 'EXPIRED';
        return !closed && !dismissedOppIds.includes(opp.candidateId);
      }) ?? null
    );
  }, [oppList, dismissedOppIds]);

  // The alert modal has no catch of its own, so these report both outcomes.
  // Success is announced only after the request has actually resolved.
  const handleApprove = async (opp: PhotographerOpportunity) => {
    try {
      await approveOpportunity(opp.candidateId);
    } catch (e) {
      Alert.alert('Could not approve', (e as { message?: string })?.message || 'Could not approve this opportunity.');
      return;
    }
    Alert.alert(
      'You said yes',
      `The client now sees you for ${opp.eventTitle} and can choose you. We'll tell you the outcome either way.`,
    );
    opportunities.refresh();
    events.refresh();
  };
  const handleReject = async (opp: PhotographerOpportunity) => {
    try {
      await rejectOpportunity(opp.candidateId);
    } catch (e) {
      Alert.alert('Could not decline', (e as { message?: string })?.message || 'Could not decline this opportunity.');
      return;
    }
    Alert.alert('Passed', 'It goes to the next photographer.');
    opportunities.refresh();
  };

  // ── Money ────────────────────────────────────────────────────────────────
  const walletStats = useMemo(
    () => (wallet.data ? selectWalletStats(wallet.data, 'photographer') : null),
    [wallet.data],
  );
  const walletCurrency = wallet.data?.currency;
  const available = walletStats?.hero.value;
  const pending = walletStats ? (walletStats.pendingChip?.value ?? 0) : undefined;

  // ── Schedule ─────────────────────────────────────────────────────────────
  const eventList = events.data ?? EMPTY;
  const today = dayKey(new Date());
  const nextShoots = useMemo(
    () => pickUpcoming(eventList, today).filter((e) => bucketOf(e) !== 'pending'),
    [eventList, today],
  );
  // Priority today: only shoots genuinely dated today. The API carries no delivery deadline or upload state,
  // so nothing here claims one.
  const todayShoots = useMemo(
    () =>
      eventList
        .filter((e) => eventDay(e) === today && (bucketOf(e) === 'upcoming' || bucketOf(e) === 'ongoing'))
        .sort(byStart),
    [eventList, today],
  );
  const requests = useMemo(
    () => eventList.filter((e) => bucketOf(e) === 'pending').sort(byStart),
    [eventList],
  );

  // ── Business ─────────────────────────────────────────────────────────────
  const a = analytics.data;
  const reviewList = reviews.data ?? EMPTY;
  const rating = useMemo(() => {
    if (a && a.averageRating > 0) return a.averageRating;
    if (reviewList.length > 0) {
      return reviewList.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewList.length;
    }
    return null;
  }, [a, reviewList]);

  const shareProfile = async () => {
    try {
      const url = await photographerProfileUrl(user?.customerId);
      await Share.share({
        message: `Book a photography session with ${user?.firstName || 'me'} on Connekyt: ${url}`,
      });
    } catch {
      // The user closed the share sheet.
    }
  };

  const open = (path: string) => router.push(path as never);
  const privacyLabel = hidden ? 'Show amounts' : 'Hide amounts';

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topBarHeight + spacing.sm, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={pulling}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            progressViewOffset={topBarHeight}
          />
        }
      >
        <KycBanner compact style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }} />

        {/* 1. Orientation */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
              {greeting()}, {name}
            </Text>
            <Text style={styles.date}>{longDate()}</Text>
          </View>
          <Pressable
            onPress={() => setHidden((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={privacyLabel}
            accessibilityState={{ checked: !hidden }}
            style={({ pressed }) => [styles.eye, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={colors.textSoft} />
          </Pressable>
        </View>

        {/* 2. Money now */}
        {wallet.error && !wallet.data ? (
          <ErrorNotice message={wallet.error} onRetry={wallet.refresh} />
        ) : (
          <View style={styles.row}>
            <MetricCard
              label="Available to withdraw"
              icon="wallet-outline"
              loading={wallet.loading && !wallet.data}
              value={moneyText(available, walletCurrency, hidden)}
              caption={wallet.error ? 'Last known balance. Pull to refresh.' : undefined}
              onPress={() => open('/(app)/(tabs)/wallet')}
              accessibilityHint="Opens your wallet"
            />
            <MetricCard
              label="Pending release"
              icon="time-outline"
              tone="warning"
              loading={wallet.loading && !wallet.data}
              value={moneyText(pending, walletCurrency, hidden)}
              caption="Not in your available balance"
              onPress={() => open('/(app)/(tabs)/wallet')}
              accessibilityHint="Opens your wallet"
            />
          </View>
        )}

        {/* 3. Actions: Create event leads, Share profile is secondary, and the two work queues carry their own colour. */}
        <View style={styles.row}>
          <ActionButton label="Create event" icon="add" variant="primary" onPress={() => open('/event/new')} style={styles.flex} />
          <ActionButton label="Share profile" icon="share-social-outline" onPress={shareProfile} style={styles.flex} />
        </View>
        <View style={styles.row}>
          {env.hybridBookingEnabled ? (
            <ActionButton
              label="Opportunities"
              caption="Booking requests"
              icon="radio-outline"
              variant="accent"
              badge={openOppCount}
              onPress={() => open('/bookings?tab=opportunities')}
              style={styles.flex}
            />
          ) : null}
          <ActionButton
            label="Collaborate"
            caption="Other photographers"
            icon="people-outline"
            variant="teal"
            onPress={() => open('/collaborate')}
            style={styles.flex}
          />
        </View>

        {/* 3b. Priority today */}
        {todayShoots.length > 0 ? (
          <>
            <SectionHeader
              title="Priority today"
              right={
                todayShoots.length > 1 ? (
                  <Text style={styles.countChip} accessibilityLabel={`${todayShoots.length} shoots today`}>
                    {todayShoots.length} today
                  </Text>
                ) : undefined
              }
            />
            <PriorityCard
              title={todayShoots[0].title || 'Photo shoot'}
              subtitle={todayShoots[0].clientName ? `Client: ${todayShoots[0].clientName}` : undefined}
              cover={todayShoots[0].coverImage}
              when={todayShoots[0].startTime ? `Today, ${clock12(todayShoots[0].startTime)}` : 'Today'}
              status={SHOOT_STATUS[bucketOf(todayShoots[0])]}
              actionLabel="View shoot"
              onAction={() => open(`/event/${todayShoots[0].id}`)}
            />
          </>
        ) : null}

        {/* 4. Needs your reply */}
        {requests.length > 0 ? (
          <>
            <SectionHeader
              title="Needs your reply"
              subtitle={`${requests.length} booking request${requests.length === 1 ? '' : 's'} waiting`}
              actionLabel="See all"
              onAction={() => open('/events')}
            />
            <HCarousel
              label="Booking requests waiting for your reply"
              data={requests.slice(0, PREVIEW_LIMIT)}
              keyOf={(e) => String(e.id)}
              renderItem={(e) => (
                <ShootCard
                  shoot={{
                    title: e.title || 'Booking request',
                    cover: e.coverImage,
                    status: SHOOT_STATUS.pending,
                    when: whenText(e),
                    location: e.location,
                    client: e.clientName,
                  }}
                  actions={<ActionButton label="Review request" variant="primary" compact onPress={() => open(`/event/${e.id}`)} style={styles.flex} />}
                />
              )}
            />
          </>
        ) : null}

        {/* 5. Next shoots */}
        <SectionHeader
          title="Next shoots"
          actionLabel={nextShoots.length > 0 ? 'See all' : undefined}
          onAction={() => open('/events')}
        />
        {events.error && !events.data ? (
          <ErrorNotice message={events.error} onRetry={events.refresh} />
        ) : events.loading && !events.data ? (
          <SkeletonCard height={150} />
        ) : nextShoots.length === 0 ? (
          <EmptyNote
            icon="calendar-outline"
            title="No upcoming shoots"
            body="Create an event or share your profile to get booked."
            actionLabel="Create event"
            onAction={() => open('/event/new')}
          />
        ) : (
          <HCarousel
            label="Upcoming shoots"
            data={nextShoots.slice(0, PREVIEW_LIMIT)}
            keyOf={(e) => String(e.id)}
            renderItem={(e) => (
              <ShootCard
                shoot={{
                  title: e.title || 'Photo shoot',
                  cover: e.coverImage,
                  status: SHOOT_STATUS[bucketOf(e)],
                  when: whenText(e),
                  location: e.location,
                  client: e.clientName,
                }}
                actions={
                  <>
                    <ActionButton label="View shoot" compact onPress={() => open(`/event/${e.id}`)} style={styles.flex} />
                    {e.clientId ? (
                      <ActionButton
                        label="Message"
                        icon="chatbubble-outline"
                        compact
                        onPress={() => open(`/conversation/${e.clientId}?name=${encodeURIComponent(e.clientName ?? '')}`)}
                        style={styles.flex}
                      />
                    ) : null}
                  </>
                }
              />
            )}
          />
        )}

        {/* 6. Business overview */}
        <SectionHeader
          title="Business overview"
          subtitle="Lifetime figures. Pick a period on Analytics."
          actionLabel="View analytics"
          onAction={() => open('/analytics')}
        />
        {analytics.error && !analytics.data ? (
          <ErrorNotice message={analytics.error} onRetry={analytics.refresh} />
        ) : (
          <BusinessOverview
            loading={analytics.loading && !analytics.data}
            earnings={moneyText(a?.totalEarnings, a ? LEDGER_CURRENCY : undefined, hidden)}
            earningsCaption="Since you joined"
            rating={rating}
            reviewCount={reviewList.length}
            loadingReviews={reviews.loading}
            tiles={[
              { key: 'shoots', label: 'Completed shoots', icon: 'camera-outline', value: a ? String(a.completedEvents) : 'N/A' },
              { key: 'clients', label: 'Clients served', icon: 'people-outline', value: a ? String(a.totalClients) : 'N/A' },
              { key: 'bookings', label: 'Bookings', icon: 'calendar-outline', value: a ? String(a.totalBookings) : 'N/A' },
            ]}
          />
        )}

        {/* 6b. Goals, persisted through /photographer/plans */}
        <GoalsSection rating={rating} hidden={hidden} />

        {/* 7a. Recent earnings */}
        <SectionHeader
          title="Recent earnings"
          actionLabel="View wallet"
          onAction={() => open('/(app)/(tabs)/wallet')}
        />
        {transactions.error && !transactions.data ? (
          <ErrorNotice message={transactions.error} onRetry={transactions.refresh} />
        ) : transactions.loading && !transactions.data ? (
          <SkeletonCard height={120} />
        ) : (transactions.data ?? []).length === 0 ? (
          <EmptyNote
            icon="cash-outline"
            title="No earnings yet"
            body="Payments from bookings and deliveries will appear here."
          />
        ) : (
          <Card style={styles.list}>
            {(transactions.data ?? []).slice(0, 3).map((t, i, arr) => (
              <EarningRow
                key={t.id}
                title={t.eventName || 'Shoot payment'}
                when={t.createdAt ? formatDate(t.createdAt) : t.status}
                amount={signedMoneyText(t.amount, LEDGER_CURRENCY, hidden)}
                positive={t.amount >= 0}
                status={{ label: t.status, tone: txTone(t.status) }}
                divider={i < arr.length - 1}
                onPress={() => open('/(app)/(tabs)/wallet')}
                a11y={`${t.eventName}, ${signedMoneyText(t.amount, LEDGER_CURRENCY, hidden)}, ${t.status}`}
              />
            ))}
          </Card>
        )}

        {/* 7b. Recent clients */}
        {(clients.data ?? []).length > 0 ? (
          <>
            <SectionHeader title="Recent clients" actionLabel="See all" onAction={() => open('/clients')} />
            <HCarousel
              label="Recent clients"
              itemWidth={190}
              data={clients.data ?? []}
              keyOf={(c) => c.id}
              renderItem={(c) => (
                <Pressable
                  onPress={() => open(`/conversation/${c.id}?name=${encodeURIComponent(c.name)}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${c.name}`}
                  style={({ pressed }) => [styles.clientCard, pressed && { opacity: 0.85 }]}
                >
                  {c.avatar ? (
                    <Image source={{ uri: c.avatar }} style={styles.avatar} contentFit="cover" accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>{(c.name[0] ?? 'C').toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.txText}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={1}>
                      {c.totalEvents ? `${c.totalEvents} shoot${c.totalEvents > 1 ? 's' : ''}` : 'Client'}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </>
        ) : null}
      </ScrollView>

      <TopBar />
      {env.hybridBookingEnabled ? <MatchingProfilePrompt /> : null}
      <IncomingOpportunityAlertModal
        opportunity={incomingOpportunity}
        visible={!!incomingOpportunity}
        onApprove={handleApprove}
        onReject={handleReject}
        onDismiss={() => {
          if (incomingOpportunity) setDismissedOppIds((prev) => [...prev, incomingOpportunity.candidateId]);
        }}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c, elevation) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: c.text, fontSize: 23, fontWeight: '800', lineHeight: 28 },
  date: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  eye: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceMuted,
  },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  flex: { flex: 1 },
  noMargin: { marginHorizontal: 0, gap: spacing.xs },
  shootCard: { gap: 4 },
  cover: { width: '100%', height: 110, borderRadius: radii.md, marginBottom: spacing.xs },
  cardTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  cardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  list: { padding: 0, overflow: 'hidden' },
  countChip: {
    color: c.textSoft,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: c.surfaceMuted,
  },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 56 },
  txDivider: { borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  txIcon: { width: 34, height: 34, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
  shootBadge: { alignSelf: 'flex-start', marginBottom: spacing.xs },
  txText: { flex: 1, minWidth: 0 },
  txAmount: { alignItems: 'flex-end', maxWidth: '45%' },
  amount: { color: c.text, fontSize: 15, fontWeight: '800' },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 64,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
    ...elevation(1),
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.primary, fontWeight: '800', fontSize: 16 },
}));
