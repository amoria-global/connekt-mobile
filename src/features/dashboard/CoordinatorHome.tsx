/**
 * CoordinatorHome: the event coordinator's working dashboard, in the same night-studio system as ClientHome.
 *
 * Reading order follows what a coordinator opens the app for:
 *   1. Orientation: greeting, date, search over their own events.
 *   2. Actions: create an event (hero), gallery, photographers, live streams.
 *   3. Overview: revenue, events, photographers, clients and live streams as tappable figures.
 *   4. Action required: payments with something left to pay.
 *   5. Upcoming productions: horizontal preview, "See all" opens the Events tab.
 *   6. Performance: the trend card with its period tabs.
 *
 * Honesty rules:
 *   - A figure that is loading shows a skeleton; one that failed shows "N/A" under an error with a retry. It is
 *     never a zero, because a coordinator would read a failed read as "no revenue".
 *   - Revenue is shown in the wallet currency only once the wallet has loaded; until then it is "N/A", not a guess.
 *   - Amounts due come from the pending-payments feed, which is USD ledger values, so they are formatted as USD
 *     and are never summed with, or relabelled as, the wallet currency.
 *   - "Live now" means ONGOING or a connected stream, not "has a stream" (see homeModel.isLiveNow).
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Keyboard, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { StatusPill } from '@/components/ui/StatusPill';
import { LiveButton } from '@/components/ui/live';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { KycBanner } from '@/features/kyc/KycBanner';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { GetHelpCard } from '@/features/support/GetHelpCard';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import {
  getCoordinatorAnalytics,
  getCoordinatorPendingPayments,
  getCoordinatorTrends,
  getCoordinatorPerformance,
  type AnalyticsPeriod,
  type PendingPayment,
  type TrendsMap,
} from '@/features/analytics/api';
import { listCoordinatorEvents } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import { getWallet } from '@/features/wallet/api';
import {
  ActionButton,
  Card,
  Chip,
  EmptyNote,
  ErrorNotice,
  HCarousel,
  IconTile,
  MetricCard,
  SectionHeader,
  SkeletonCard,
} from '@/features/photographer/kit';
import { ShootCard } from '@/features/photographer/homeParts';
import { moneyText } from '@/features/photographer/money';
import { HeroActionCard, ListRow } from '@/features/client/studio';
import { DUE_CURRENCY, clientStatus, dueText, isLiveNow, payable, remaining } from '@/features/client/homeModel';
import { clock12, dayKey, eventDay, upcomingEvents } from '@/features/photographer/schedule';
import { PerformanceWaveCard } from '@/features/dashboard/PerformanceWaveCard';
import { formatDate } from '@/utils/format';
import { useCurrency } from '@/store/currency';
import { useLanguage } from '@/store/language';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { useTabBarClearance } from '@/hooks/useScrollClearance';

const PREVIEW_LIMIT = 6;
/** Stable fallback so `data ?? EMPTY` does not hand memo hooks a new array every render. */
const EMPTY: never[] = [];

const CATEGORY_CHIPS = ['All', 'Wedding', 'Corporate', 'Birthday', 'Concert', 'Conference', 'Sports', 'Graduation', 'Fashion', 'Entertainment'];

function longDate(now = new Date()): string {
  try {
    return now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

function whenText(e: EventItem): string {
  const day = eventDay(e);
  const parts = [day ? formatDate(day) : '', e.startTime ? clock12(e.startTime) : ''].filter(Boolean);
  return parts.join(' · ') || 'Date to be confirmed';
}

export function CoordinatorHome() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const clearance = useTabBarClearance();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || user?.organizationName || 'Coordinator';

  const [period, setPeriod] = useState<AnalyticsPeriod>('week');
  const [selectedWaveMetric, setSelectedWaveMetric] = useState<string>('totalRevenue');
  const [searchQuery, setSearchQuery] = useState('');
  const [pulling, setPulling] = useState(false);
  // Amounts start hidden, like the photographer and client Home.
  const [hidden, setHidden] = useState(true);
  const [payNowPayment, setPayNowPayment] = useState<PendingPayment | null>(null);

  const analytics = useAsync(useCallback(() => getCoordinatorAnalytics(), []));
  const events = useAsync(useCallback(() => listCoordinatorEvents(), []));
  const pending = useAsync(useCallback(() => getCoordinatorPendingPayments(), []));
  const wallet = useAsync(useCallback(() => getWallet(), []));
  const trendsState = useAsync(useCallback(() => getCoordinatorTrends(period), [period]));
  const perfState = useAsync(useCallback(() => getCoordinatorPerformance(period), [period]));
  const trends: TrendsMap = useMemo(() => trendsState.data ?? {}, [trendsState.data]);

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([
        analytics.refresh(),
        events.refresh(),
        pending.refresh(),
        wallet.refresh(),
        trendsState.refresh(),
        perfState.refresh(),
      ]);
    } finally {
      setPulling(false);
    }
  }, [analytics, events, pending, wallet, trendsState, perfState]);

  const a = analytics.data;
  const aFailed = !!analytics.error && !a;
  const eventList = events.data ?? EMPTY;
  const today = dayKey(new Date());
  const upcoming = useMemo(() => upcomingEvents(eventList, today), [eventList, today]);
  const preview = useMemo(() => upcoming.slice(0, PREVIEW_LIMIT), [upcoming]);
  const dues = useMemo(() => payable(pending.data ?? EMPTY), [pending.data]);
  const dueFailed = dues.some((p) => p.status === 'failed');
  const currency = wallet.data?.currency;
  const anyLive = useMemo(() => eventList.some(isLiveNow), [eventList]);

  const q = searchQuery.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return [];
    return eventList.filter((e) =>
      [e.title, e.location, e.photographerName, e.clientName, e.category].some((v) => (v ?? '').toLowerCase().includes(q)),
    );
  }, [eventList, q]);

  // Revenue is shown in the wallet currency, so a failed wallet read leaves it N/A and needs its own retry.
  const walletFailed = !!wallet.error && !wallet.data;
  const trendFailed = (!!perfState.error && !perfState.data) || (!!trendsState.error && !trendsState.data);
  const open = (path: string) => router.push(path as never);
  const openEvent = (e: EventItem) => open(`/event/${e.id}`);
  const figure = (v: number | undefined) => (aFailed ? 'N/A' : String(v ?? 0));
  const revenueText = !a || !currency ? 'N/A' : moneyText(a.totalRevenue, currency, hidden);

  const overview = [
    { key: 'rev', label: 'Revenue', value: revenueText, icon: 'wallet-outline' as const, tone: 'primary' as const, to: '/wallet' },
    { key: 'ev', label: 'Events', value: figure(a?.totalEvents), icon: 'calendar-outline' as const, tone: 'accent' as const, to: '/events' },
    { key: 'ph', label: 'Photographers', value: figure(a?.totalPhotographers), icon: 'camera-outline' as const, tone: 'success' as const, to: '/photographers' },
    { key: 'cl', label: 'Clients', value: figure(a?.totalCustomers), icon: 'people-outline' as const, tone: 'primary' as const, to: '/clients' },
    { key: 'st', label: 'Live streams', value: figure(a?.activeStreams), icon: 'videocam-outline' as const, tone: 'warning' as const, to: '/streams' },
  ];

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topBarHeight + spacing.sm, paddingBottom: clearance }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onRefresh} tintColor={colors.primary} progressViewOffset={topBarHeight} />
        }
      >
        <KycBanner compact style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }} />

        {/* 1. Orientation */}
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
              {`Welcome back, ${name}`}
            </Text>
            <Text style={styles.subtitle}>{longDate() || `${t('roleCoordinatorTitle')} workspace`}</Text>
          </View>
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show amounts' : 'Hide amounts'}
            style={({ pressed }) => [styles.eye, pressed && styles.pressed]}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search your events, venues, people"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            accessibilityLabel="Search your events"
            maxFontSizeMultiplier={1.6}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => {
              Keyboard.dismiss();
              if (q) router.push({ pathname: '/events', params: { q: searchQuery.trim() } } as never);
            }}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => {
                setSearchQuery('');
                Keyboard.dismiss();
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              style={styles.clear}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {q ? (
          <>
            <SectionHeader title="Search results" subtitle={`For "${searchQuery.trim()}"`} actionLabel="Clear" onAction={() => setSearchQuery('')} />
            {events.loading && !events.data ? (
              <SkeletonCard height={72} />
            ) : events.error && !events.data ? (
              <ErrorNotice message={events.error} onRetry={events.refresh} />
            ) : matches.length === 0 ? (
              <EmptyNote icon="search-outline" title="No events match" body="Try a title, venue, client or photographer." />
            ) : (
              <Card style={styles.list}>
                {matches.slice(0, 5).map((e, i, arr) => (
                  <ListRow
                    key={e.id}
                    icon="calendar-outline"
                    title={e.title || 'Event'}
                    meta={[e.category, e.clientName || e.photographerName, e.eventDate ? formatDate(e.eventDate) : '', e.location]
                      .filter(Boolean)
                      .join(' · ')}
                    trailing={<StatusPill status={e.status || 'UPCOMING'} />}
                    onPress={() => openEvent(e)}
                    divider={i < arr.length - 1}
                  />
                ))}
              </Card>
            )}
          </>
        ) : (
          <>
            {/* 2. Actions */}
            <View style={styles.stack}>
              <HeroActionCard
                title={t('createEvent')}
                subtitle="Set the date, venue and photographer"
                icon="add-circle-outline"
                onPress={() => open('/event/new')}
              />
            </View>
            <View style={styles.row}>
              <ActionButton label={t('gallery')} icon="images-outline" onPress={() => open('/gallery')} style={styles.flex} />
              <ActionButton label="Photographers" icon="camera-outline" onPress={() => open('/photographers')} style={styles.flex} />
            </View>
            <View style={styles.stack}>
              <ActionButton
                label="Live streams"
                caption={anyLive ? 'Live now' : 'Control and watch'}
                icon="videocam-outline"
                variant="teal"
                onPress={() => open('/streams')}
              />
            </View>

            {/* Event types: a quick way into the Events tab, filtered */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              accessibilityLabel="Event types"
              contentContainerStyle={styles.chips}
              style={styles.chipsWrap}
            >
              {CATEGORY_CHIPS.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={false}
                  onPress={() => router.push({ pathname: '/events', params: c === 'All' ? {} : { category: c } } as never)}
                />
              ))}
            </ScrollView>

            {/* 3. Overview */}
            <SectionHeader title="Overview" subtitle="Lifetime figures for your account" actionLabel="Analytics" onAction={() => open('/analytics')} />
            {aFailed || walletFailed ? (
              <ErrorNotice
                message={(analytics.error || wallet.error) as string}
                onRetry={() => {
                  void analytics.refresh();
                  void wallet.refresh();
                }}
              />
            ) : null}
            <HCarousel
              label="Overview figures"
              itemWidth={168}
              data={overview}
              keyOf={(m) => m.key}
              renderItem={(m) => (
                <MetricCard
                  label={m.label}
                  value={m.value}
                  icon={m.icon}
                  tone={m.tone}
                  loading={analytics.loading && !analytics.data}
                  onPress={() => open(m.to)}
                />
              )}
            />

            {/* 4. Action required */}
            {pending.error && !pending.data ? (
              <>
                <SectionHeader title="Action required" />
                <ErrorNotice message={pending.error} onRetry={pending.refresh} compact />
              </>
            ) : dues.length > 0 ? (
              <>
                <SectionHeader
                  title="Action required"
                  subtitle={`${dues.length} payment${dues.length === 1 ? '' : 's'} waiting${dueFailed ? ', one failed' : ''}`}
                  actionLabel="See all"
                  onAction={() => open('/payments')}
                />
                <HCarousel
                  label="Payments that need your attention"
                  itemWidth={280}
                  data={dues}
                  keyOf={(p) => p.id}
                  renderItem={(p) => <PaymentCard hidden={hidden} payment={p} onPay={() => setPayNowPayment(p)} />}
                />
              </>
            ) : null}

            {/* 5. Upcoming productions */}
            <SectionHeader
              title="Upcoming productions"
              subtitle="Events you coordinate"
              actionLabel={upcoming.length > 0 ? 'See all' : undefined}
              onAction={() => open('/events')}
            />
            {events.error && !events.data ? (
              <ErrorNotice message={events.error} onRetry={events.refresh} />
            ) : events.loading && !events.data ? (
              <SkeletonCard height={170} />
            ) : preview.length === 0 ? (
              <EmptyNote
                icon="calendar-outline"
                title="No upcoming events"
                body="Create an event to start coordinating photographers and streams."
                actionLabel="Create event"
                onAction={() => open('/event/new')}
              />
            ) : (
              <HCarousel
                label="Upcoming events"
                data={preview}
                keyOf={(e) => String(e.id)}
                renderItem={(e) => {
                  const live = isLiveNow(e);
                  return (
                    <ShootCard
                      shoot={{
                        title: e.title || 'Event',
                        cover: e.coverImage,
                        status: clientStatus(e),
                        live,
                        when: whenText(e),
                        location: e.location,
                        client: e.clientName,
                        photographer: e.photographerName,
                      }}
                      actions={
                        live ? (
                          <LiveButton label="Control live" size="sm" icon="play" onPress={() => openEvent(e)} style={styles.flex} />
                        ) : (
                          <ActionButton label="Manage" compact onPress={() => openEvent(e)} style={styles.flex} />
                        )
                      }
                    />
                  );
                }}
              />
            )}

            {/* 6. Performance */}
            <SectionHeader title="Performance" subtitle="Trends for the period you pick" />
            {trendFailed ? (
              <ErrorNotice
                message={(perfState.error || trendsState.error) as string}
                onRetry={() => {
                  void trendsState.refresh();
                  void perfState.refresh();
                }}
                compact
              />
            ) : null}
            <View style={styles.wave}>
              <PerformanceWaveCard
                analytics={a}
                trends={trends}
                period={period}
                onPeriodChange={setPeriod}
                currency={currency}
                selectedMetric={selectedWaveMetric}
                onSelectMetric={setSelectedWaveMetric}
                performanceData={perfState.data}
                hidden={hidden}
                emptyText={trendFailed ? 'Trend data could not be loaded' : undefined}
              />
            </View>
          </>
        )}

        {q ? null : <GetHelpCard />}
      </ScrollView>

      <TopBar />

      <PayNowSheet
        payment={payNowPayment}
        visible={!!payNowPayment}
        onClose={() => setPayNowPayment(null)}
        onSuccess={() => {
          pending.refresh();
          analytics.refresh();
        }}
      />
    </Screen>
  );
}

function PaymentCard({ payment, onPay, hidden }: { payment: PendingPayment; onPay: () => void; hidden: boolean }) {
  const styles = useStyles();
  const failed = payment.status === 'failed';
  const dueDate = dueText(payment);
  const amount = moneyText(remaining(payment), DUE_CURRENCY, hidden);
  return (
    <Card>
      <View style={styles.cardTop}>
        <IconTile icon={failed ? 'alert-circle-outline' : 'time-outline'} tone={failed ? 'error' : 'warning'} />
        <View style={styles.flex}>
          <Text style={styles.cardTitle} numberOfLines={3}>
            {payment.eventName}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={2}>
            {failed ? 'Payment failed' : payment.status === 'partially_paid' ? 'Balance due' : 'Payment due'}
            {dueDate ? ` · ${dueDate}` : ''}
          </Text>
        </View>
      </View>
      <Text style={styles.amount} accessibilityLabel={`${amount} to pay`}>
        {amount}
      </Text>
      <ActionButton label={failed ? 'Try again' : 'Pay now'} variant="primary" compact onPress={onPay} />
    </Card>
  );
}

const useStyles = makeStyles((c) => ({
  header: { paddingHorizontal: spacing.lg, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eye: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { color: c.text, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: c.borderSoft,
    backgroundColor: c.card,
  },
  searchInput: { flex: 1, minWidth: 0, color: c.text, fontSize: 14, paddingVertical: spacing.sm },
  clear: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  stack: { gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  chipsWrap: { flexGrow: 0 },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  list: { padding: 0, overflow: 'hidden' },
  wave: { paddingHorizontal: spacing.lg },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  cardTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: c.textMuted, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  amount: { color: c.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.sm },
}));
