/**
 * PhotographerHome: the photographer's working dashboard.
 *
 * Midnight Glass layout (design/home.png). Reading order follows what a photographer opens
 * the app for:
 *   1. Orientation: DashboardGreeting hero (date eyebrow, rotating greeting, shoot summary).
 *   2. Money now: the hero tile, available to withdraw over pending release, with the
 *      privacy toggle and Withdraw (from the wallet).
 *   3. Actions: a bento of opportunities, collaborate, upcoming count and share profile,
 *      then Create event, the screen's one raised button.
 *   4. Needs your reply: booking requests and open opportunities.
 *   5. Next shoot: the first on the paper calendar tile, the rest as compact rows;
 *      "See all" opens the Events tab.
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
import { Button, PrimaryButton } from '@/components/ui/Button';
import { ActionRow, ActionTile, CountBadge, StatStrip, TileRow } from '@/components/ui/Compact';
import { GlassCard } from '@/components/ui/GlassCard';
import { IconTile as GlowTile } from '@/components/ui/IconTile';
import { InsetWell } from '@/components/ui/Input';
import { Alert } from '@/components/ui/dialog';
import { DashboardGreeting } from './DashboardGreeting';
import { photographerProfileUrl } from '@/features/photographer/profileLink';
import { useForegroundPolling } from '@/hooks/useForegroundPolling';
import { GoalsSection } from '@/features/photographer/GoalsSection';
import { HostEntry } from '@/features/hosting/HostEntry';
import { Screen } from '@/components/ui/Screen';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { KycBanner } from '@/features/kyc/KycBanner';
import { GetHelpCard } from '@/features/support/GetHelpCard';
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
import { selectIsShared, useWorkspace } from '@/store/workspace';
import { env } from '@/config/env';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import { useCurrency } from '@/store/currency';
import { useSharedT } from '@/i18n/sharedStrings';
import { formatDate } from '@/utils/format';
import { fonts, makeStyles, radii, spacing, tracking, useTheme } from '@/theme';
import {
  ActionButton,
  Card,
  EmptyNote,
  ErrorNotice,
  HCarousel,
  MetricCard,
  SectionHeader,
  Skeleton,
  SkeletonCard,
} from '@/features/photographer/kit';
import { BusinessOverview, EarningRow, NextShootCard, PriorityCard, ShootCard, ShootRow } from '@/features/photographer/homeParts';
import { moneyText, signedMoneyText } from '@/features/photographer/money';
import {
  bucketOf,
  byStart,
  clock12,
  dayKey,
  eventDay,
  parseDayKey,
  upcomingEvents as pickUpcoming,
} from '@/features/photographer/schedule';
import type { EventItem } from '@/features/events/types';
import { useTabBarClearance } from '@/hooks/useScrollClearance';

/** Analytics totals and the transaction feed are USD ledger values. */
const LEDGER_CURRENCY = 'USD';
const OPPORTUNITY_POLL_MS = 6000;
const PREVIEW_LIMIT = 6;
/** Compact Glass: Home previews the next shoot in full and two more as rows (one at ROW_PREVIEW 3 plus the card); See all has the rest. */
const ROW_PREVIEW = 3;
/** Stable fallback so `data ?? EMPTY` does not give memo hooks a new array every render. */
const EMPTY: never[] = [];

/** The hero's eyebrow, "Sunday · 25 October" (upper-cased by the style). */
function longDate(lang?: string, now = new Date()): string {
  try {
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'rw' ? 'rw-RW' : lang === 'sw' ? 'sw-TZ' : undefined;
    const weekday = now.toLocaleDateString(locale, { weekday: 'long' });
    const day = now.toLocaleDateString(locale, { day: 'numeric', month: 'long' });
    return `${weekday} · ${day}`;
  } catch {
    return '';
  }
}

/** The hero's one line about the schedule, from the events the API returned. */
function scheduleSummary(upcoming: number, ongoing: number): string {
  if (upcoming === 0 && ongoing === 0) return 'Nothing booked yet. Share your profile to get booked.';
  const u = `${upcoming} upcoming shoot${upcoming === 1 ? '' : 's'}`;
  return ongoing > 0 ? `You have ${u} and ${ongoing} ongoing.` : `You have ${u}.`;
}

const shootDate = (e: EventItem): Date | null => {
  const day = eventDay(e);
  return day ? parseDayKey(day) : null;
};

/** Same buckets and words as the Events calendar, so a shoot is never described two ways. */
const SHOOT_STATUS: Record<ReturnType<typeof bucketOf>, { label: string; tone: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'live' | 'active' }> = {
  pending: { label: 'Awaiting your reply', tone: 'warning' },
  upcoming: { label: 'Scheduled', tone: 'info' },
  ongoing: { label: 'In progress', tone: 'live' },
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
  const { language, tr } = useSharedT();
  const styles = useStyles();
  const clearance = useTabBarClearance();
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
  // In a workspace the photographer was invited to, the transaction history stays with the owner: it is never asked for.
  const isShared = useWorkspace(selectIsShared);
  const transactions = useAsync(useCallback(() => (isShared ? Promise.resolve([]) : getPhotographerRecentTransactions(4)), [isShared]));
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
    [wallet.data, language],
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
  // Priority today already shows today's first shoot, so Next shoot starts after it rather than repeating it.
  const comingUp = useMemo(
    () => (todayShoots.length > 0 ? nextShoots.filter((e) => e.id !== todayShoots[0].id) : nextShoots),
    [nextShoots, todayShoots],
  );
  const upcomingCount = useMemo(() => eventList.filter((e) => bucketOf(e) === 'upcoming').length, [eventList]);
  const ongoingCount = useMemo(() => eventList.filter((e) => bucketOf(e) === 'ongoing').length, [eventList]);
  const profileUrl = useAsync(useCallback(() => photographerProfileUrl(user?.customerId), [user?.customerId]));
  const profileHost = (profileUrl.data ?? env.webBaseUrl).replace(/^https?:\/\//, '').replace(/\/+$/, '');

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
        contentContainerStyle={{ paddingTop: topBarHeight + spacing.sm, paddingBottom: clearance }}
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
        <DashboardGreeting
          name={name}
          eyebrow={longDate(language)}
          subtitle={events.data ? tr(scheduleSummary(upcomingCount, ongoingCount)) : undefined}
        />

        {/* 2. Money now: the hero tile. Tapping it opens the wallet; Withdraw goes straight to the flow. The tile
            stays when the wallet fails, because it carries the privacy toggle the rest of Home's figures use. */}
        <View style={styles.gutter}>
              <GlassCard style={styles.moneyCard}>
                {/* Only the label row opens the wallet: one button around the whole tile would swallow the
                    privacy toggle and Withdraw for VoiceOver and TalkBack. */}
                <View style={styles.moneyHead}>
                  <Pressable
                    onPress={isShared ? undefined : () => open('/(app)/(tabs)/wallet')}
                    disabled={isShared}
                    accessibilityRole={isShared ? undefined : 'button'}
                    accessibilityLabel={`${tr('Available to withdraw')}, ${moneyText(available, walletCurrency, hidden)}`}
                    accessibilityHint={isShared ? undefined : 'Opens your wallet'}
                    style={({ pressed }) => [styles.moneyLink, pressed && { opacity: 0.85 }]}
                  >
                    <GlowTile icon="wallet-outline" tone="neutral" size="sm" />
                    <Text style={styles.moneyLabel}>{tr('Available to withdraw')}</Text>
                    {isShared ? null : <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
                  </Pressable>
                  <Pressable
                    onPress={() => setHidden((v) => !v)}
                    accessibilityRole="button"
                    accessibilityLabel={privacyLabel}
                    accessibilityState={{ checked: !hidden }}
                    style={({ pressed }) => [styles.eye, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textSoft} />
                  </Pressable>
                </View>
                {wallet.error && !wallet.data ? (
                  <ErrorNotice message={wallet.error} onRetry={wallet.refresh} flush />
                ) : wallet.loading && !wallet.data ? (
                  <Skeleton height={40} width="62%" />
                ) : (
                  <Text style={styles.moneyValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {/* Masked, the currency stays: it is not sensitive, and it says what the dots stand for. */}
                    {hidden && walletCurrency ? <Text style={styles.moneyCurrency}>{walletCurrency}  </Text> : null}
                    <Text style={hidden ? styles.moneyMasked : undefined}>{moneyText(available, walletCurrency, hidden)}</Text>
                  </Text>
                )}
                {wallet.error && wallet.data ? <Text style={styles.moneyCaption}>{tr('Last known balance. Pull to refresh.')}</Text> : null}
                {wallet.error && !wallet.data ? null : (
                <View style={styles.moneyFoot}>
                  <InsetWell style={styles.pendingWell}>
                    <Ionicons name="time-outline" size={16} color={colors.pending} />
                    <View style={styles.pendingText}>
                      <Text style={styles.pendingLabel} numberOfLines={2}>
                        {tr('Pending release')}
                      </Text>
                      <Text style={styles.pendingValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                        {wallet.loading && !wallet.data ? ' ' : moneyText(pending, walletCurrency, hidden)}
                      </Text>
                    </View>
                  </InsetWell>
                  {isShared ? null : <Button title="Withdraw" onPress={() => open('/withdraw')} style={styles.withdraw} />}
                </View>
                )}
              </GlassCard>
          </View>

        {/* 3. Actions (Compact Glass): a slim stat strip, two horizontal action tiles, one share row, then
            Create event, the screen's one raised button. */}
        <View style={[styles.gutter, styles.actions]}>
          {events.loading && !events.data ? (
            <Skeleton height={44} />
          ) : (
            <StatStrip
              value={events.data ? upcomingCount : 'N/A'}
              label={tr('Upcoming').toLowerCase()}
              note={ongoingCount > 0 ? `${ongoingCount} ${tr('ongoing now')}` : undefined}
              noteDot
            />
          )}
          {env.hybridBookingEnabled || !isShared ? (
            <TileRow>
              {env.hybridBookingEnabled ? (
                <ActionTile
                  icon="radio-outline"
                  tone="accent"
                  title={tr('Opportunities')}
                  caption={tr('Booking requests')}
                  onPress={() => open('/bookings?tab=opportunities')}
                  accessibilityLabel={openOppCount ? `${tr('Opportunities')}, ${openOppCount} waiting` : tr('Opportunities')}
                  badge={openOppCount > 0 ? <CountBadge tone="accent">{openOppCount > 99 ? '99+' : openOppCount}</CountBadge> : undefined}
                />
              ) : null}
              {isShared ? null : (
                <ActionTile icon="people-outline" tone="active" title={tr('Collaborate')} caption={tr('Other photographers')} onPress={() => open('/collaborate')} />
              )}
            </TileRow>
          ) : null}
          <ActionRow
            icon="share-social-outline"
            tone="primary"
            title={tr('Share profile')}
            caption={profileHost}
            actionLabel="Share"
            actionIcon="share-outline"
            onAction={shareProfile}
            accessibilityLabel={tr('Share profile')}
          />
        </View>
        <View style={[styles.gutter, styles.cta]}>
          <PrimaryButton
            title="Create event"
            onPress={() => open('/host/new')}
            icon={<Ionicons name="add" size={20} color={colors.textOnPrimary} />}
          />
        </View>
        <View style={styles.gutter}>
          <HostEntry />
        </View>

        {/* 3b. Priority today */}
        {todayShoots.length > 0 ? (
          <>
            <SectionHeader
              title="Priority today"
              right={
                todayShoots.length > 1 ? (
                  <Text style={styles.countChip} accessibilityLabel={`${todayShoots.length} shoots today`}>
                    {todayShoots.length} {tr('Today').toLowerCase()}
                  </Text>
                ) : undefined
              }
            />
            <PriorityCard
              title={todayShoots[0].title || 'Photo shoot'}
              subtitle={todayShoots[0].clientName ? `${tr('Client')}: ${todayShoots[0].clientName}` : undefined}
              cover={todayShoots[0].coverImage}
              when={todayShoots[0].startTime ? `${tr('Today')}, ${clock12(todayShoots[0].startTime)}` : tr('Today')}
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

        {/* 5. Next shoot: the date leads, on the paper calendar tile; the rest follow as rows. */}
        <SectionHeader
          title="Next shoot"
          actionLabel={comingUp.length > 0 ? 'See all' : undefined}
          onAction={() => open('/events')}
        />
        {events.error && !events.data ? (
          <ErrorNotice message={events.error} onRetry={events.refresh} />
        ) : events.loading && !events.data ? (
          <SkeletonCard height={150} />
        ) : comingUp.length === 0 ? (
          <EmptyNote compact
            icon="calendar-outline"
            title="No upcoming shoots"
            body="Create an event or share your profile to get booked."
            actionLabel="Share profile"
            onAction={shareProfile}
          />
        ) : (
          <View style={styles.shoots}>
            <NextShootCard
              date={shootDate(comingUp[0])}
              shoot={{
                title: comingUp[0].title || 'Photo shoot',
                cover: comingUp[0].coverImage,
                status: SHOOT_STATUS[bucketOf(comingUp[0])],
                when: comingUp[0].startTime ? clock12(comingUp[0].startTime) : whenText(comingUp[0]),
                location: comingUp[0].location,
                client: comingUp[0].clientName,
              }}
              onView={() => open(`/event/${comingUp[0].id}`)}
              onMessage={
                comingUp[0].clientId
                  ? () => open(`/conversation/${comingUp[0].clientId}?name=${encodeURIComponent(comingUp[0].clientName ?? '')}`)
                  : undefined
              }
            />
            {comingUp.slice(1, ROW_PREVIEW).map((e) => (
              <ShootRow
                key={String(e.id)}
                date={shootDate(e)}
                title={e.title || 'Photo shoot'}
                meta={[e.startTime ? clock12(e.startTime) : '', e.location].filter(Boolean).join(' · ') || whenText(e)}
                onPress={() => open(`/event/${e.id}`)}
              />
            ))}
          </View>
        )}

        {/* 6. Business overview */}
        <SectionHeader
          title="Business overview"
          subtitle="Lifetime figures"
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

        {/* 7a. Recent earnings (the transaction history; not shown in a shared workspace) */}
        {isShared ? null : (
          <>
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
          <EmptyNote compact
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

          </>
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
                  style={({ pressed }) => [styles.flex, pressed && { opacity: 0.85 }]}
                >
                  <GlassCard style={styles.clientCard}>
                  {c.avatar ? (
                    <Image source={{ uri: c.avatar }} style={styles.avatar} contentFit="cover" accessibilityIgnoresInvertColors />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarText}>{(c.name[0] ?? 'C').toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.txText}>
                    <Text style={styles.cardTitle} numberOfLines={3}>
                      {c.name}
                    </Text>
                    <Text style={styles.cardMeta} numberOfLines={3}>
                      {c.totalEvents ? `${c.totalEvents} shoot${c.totalEvents > 1 ? 's' : ''}` : tr('Client')}
                    </Text>
                  </View>
                  </GlassCard>
                </Pressable>
              )}
            />
          </>
        ) : null}

        <GetHelpCard />
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

const useStyles = makeStyles((c) => ({
  gutter: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  cta: { marginTop: 0 },
  eye: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moneyCard: { borderRadius: radii.xl, padding: spacing.lg, gap: spacing.sm },
  moneyHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  moneyLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  moneyLabel: { flex: 1, color: c.textSoft, fontSize: 15, fontFamily: fonts.medium },
  moneyValue: { color: c.text, fontSize: 36, lineHeight: 42, fontFamily: fonts.display, letterSpacing: tracking(36, -0.035) },
  moneyCurrency: { color: c.textMuted, fontSize: 18, fontFamily: fonts.displayMedium, letterSpacing: 0 },
  moneyMasked: { letterSpacing: 8 },
  moneyCaption: { color: c.textMuted, fontSize: 12, fontFamily: fonts.regular },
  moneyFoot: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.md },
  pendingWell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  pendingText: { flex: 1, minWidth: 0 },
  pendingLabel: { color: c.textSoft, fontSize: 13, fontFamily: fonts.regular },
  pendingValue: { color: c.pending, fontSize: 15, fontFamily: fonts.display },
  withdraw: { paddingHorizontal: spacing.xl },
  actions: { gap: spacing.sm },
  tileEyebrow: { color: c.textSoft, fontSize: 14, fontFamily: fonts.medium },
  liveLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.active },
  liveText: { color: c.textSoft, fontSize: 13, fontFamily: fonts.regular, flexShrink: 1 },
  shoots: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  flex: { flex: 1 },
  list: { padding: 0, overflow: 'hidden' },
  countChip: {
    color: c.textSoft,
    fontSize: 12,
    fontFamily: fonts.semibold,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    overflow: 'hidden',
    backgroundColor: c.glassTop,
  },
  txText: { flex: 1, minWidth: 0 },
  cardTitle: { color: c.text, fontSize: 16, fontFamily: fonts.display },
  cardMeta: { color: c.textMuted, fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  clientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    minHeight: 64,
    borderRadius: radii.lg,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: c.tint, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: c.link, fontFamily: fonts.display, fontSize: 16 },
}));
