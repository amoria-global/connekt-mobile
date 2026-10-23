/**
 * ClientHome: the client's working dashboard.
 *
 * Reading order follows what a client opens the app for:
 *   1. Orientation: welcome, search.
 *   2. Actions: book a photographer, publish an offer (hybrid only), albums,
 *      find my photos, explore events.
 *   3. Upcoming event: the one booking that matters next, with its countdown,
 *      confirmation and any amount due.
 *   4. Action required: payments with something left to pay, photos delivered.
 *   5. Your bookings: horizontal preview, "See all" opens the Events tab.
 *   6. Featured photographers: horizontal preview with bookmarks.
 *   7. Recent activity.
 *
 * Honesty rules (see homeModel.ts for the ones that are pure functions):
 *   - A figure that has not loaded, or failed to load, is an error with a retry,
 *     never a zero and never an empty-state sentence.
 *   - Amounts due are USD ledger values from the pending-payments feed and are
 *     formatted as USD, not relabelled to the wallet currency.
 *   - "Live now" means live, not "has a stream". Nothing here invents a rating,
 *     a price or a notification.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { LivePill } from '@/components/ui/live';
import { TopBar, useTopBarHeight } from '@/components/topbar/TopBar';
import { FindPhotosBottomSheet } from '@/components/FindPhotosBottomSheet';
import { GlobalSearchModal } from '@/components/GlobalSearchModal';
import { KycBanner } from '@/features/kyc/KycBanner';
import { PayNowSheet } from '@/features/payments/PayNowSheet';
import { BookingModeSelector, type BookingStep } from '@/features/booking/BookingModeSelector';
import { ExploreChoiceSheet, pendingPostEvent } from '@/features/hybrid/ExploreChoiceSheet';
import { env } from '@/config/env';
import { useAuth } from '@/store/auth';
import { useAsync } from '@/hooks/useAsync';
import {
  getCustomerAnalytics,
  getCustomerPendingPayments,
  getCustomerRecentActivities,
  type PendingPayment,
  type RecentActivity,
} from '@/features/analytics/api';
import { listEvents } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import {
  bookmarkPhotographer,
  listBookmarkedPhotographers,
  listPhotographers,
  unbookmarkPhotographer,
} from '@/features/photographers/api';
import { PhotographerCard } from '@/features/photographers/PhotographerCard';
import {
  ActionButton,
  Card,
  EmptyNote,
  ErrorNotice,
  HCarousel,
  IconTile,
  SectionHeader,
  SkeletonCard,
  StatusBadge,
} from '@/features/photographer/kit';
import { Thumb, ShootCard } from '@/features/photographer/homeParts';
import { moneyText } from '@/features/photographer/money';
import { HeroActionCard } from '@/features/client/studio';
import { ClientOverview } from '@/features/client/ClientOverview';
import { getWallet } from '@/features/wallet/api';
import { selectWalletStats } from '@/features/wallet/moneyView';
import { matchDue, type DueMatch } from '@/features/payments/payNowLookup';
import { clock12, dayKey, eventDay } from '@/features/photographer/schedule';
import {
  DUE_CURRENCY,
  clientStatus,
  countdownLabel,
  daysUntil,
  dueText,
  isLiveNow,
  payable,
  pickNextEvent,
  remaining,
} from '@/features/client/homeModel';
import { useCurrency } from '@/store/currency';
import { useSharedT } from '@/i18n/sharedStrings';
import { formatDate } from '@/utils/format';
import { makeStyles, radii, spacing, useTheme } from '@/theme';

const PREVIEW_LIMIT = 6;
const ACTIVITY_LIMIT = 4;
/** Stable fallback so `data ?? EMPTY` does not give memo hooks a new array every render. */
const EMPTY: never[] = [];

type IconName = keyof typeof Ionicons.glyphMap;

function longDate(lang?: string, now = new Date()): string {
  try {
    const locale = lang === 'fr' ? 'fr-FR' : lang === 'es' ? 'es-ES' : lang === 'rw' ? 'rw-RW' : lang === 'sw' ? 'sw-TZ' : undefined;
    return now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

function whenText(e: EventItem): string {
  const day = eventDay(e);
  const parts = [day ? formatDate(day) : '', e.startTime ? clock12(e.startTime) : ''].filter(Boolean);
  return parts.join(' · ') || 'Date to be confirmed';
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Where an activity row leads, and how it looks. Unknown kinds stay generic rather than guessing. */
function activityKind(a: RecentActivity): { icon: IconName; tone: 'primary' | 'accent' | 'success' | 'error'; route: string } {
  const t = (a.type || '').toUpperCase();
  if (t.includes('GALLERY') || t.includes('PHOTO') || t.includes('ALBUM')) return { icon: 'images-outline', tone: 'success', route: '/gallery' };
  if (t.includes('STREAM') || t.includes('LIVE')) return { icon: 'videocam-outline', tone: 'error', route: '/explore-events' };
  if (t.includes('PAY') || t.includes('ESCROW') || t.includes('TRANSACTION')) return { icon: 'card-outline', tone: 'primary', route: '/events' };
  if (t.includes('BOOK')) return { icon: 'calendar-outline', tone: 'accent', route: '/events' };
  return { icon: 'notifications-outline', tone: 'primary', route: '/events' };
}

export function ClientHome() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { language, tr } = useSharedT();
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const topBarHeight = useTopBarHeight();
  const user = useAuth((s) => s.user);
  const name = user?.firstName || 'there';

  const [pulling, setPulling] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [findPhotosOpen, setFindPhotosOpen] = useState(false);
  const [payNowPayment, setPayNowPayment] = useState<PendingPayment | null>(null);
  const [bookingModeOpen, setBookingModeOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState<BookingStep>('select');
  const [exploreChoiceOpen, setExploreChoiceOpen] = useState(false);
  // Amounts start hidden, like the photographer Home.
  const [hidden, setHidden] = useState(true);

  // A guest who chose "Post my event" before signing in lands here; open the wizard for them.
  useEffect(() => {
    if (env.hybridBookingEnabled && pendingPostEvent.take()) {
      setBookingStep(1);
      setBookingModeOpen(true);
    }
  }, []);

  const analytics = useAsync(useCallback(() => getCustomerAnalytics(), []));
  const events = useAsync(useCallback(() => listEvents(), []));
  const activities = useAsync(useCallback(() => getCustomerRecentActivities(8), []));
  const photographers = useAsync(useCallback(() => listPhotographers(), []));
  const pending = useAsync(useCallback(() => getCustomerPendingPayments(), []));
  const wallet = useAsync(useCallback(() => getWallet(), []));

  // ── Bookmarks ────────────────────────────────────────────────────────────
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkBusy, setBookmarkBusy] = useState<Record<string, boolean>>({});

  const refreshBookmarks = useCallback(() => {
    listBookmarkedPhotographers()
      .then((items) => setBookmarkedIds(new Set(items.map((p) => p.id))))
      .catch(() => {
        // Offline: cards simply show as not bookmarked.
      });
  }, []);
  useEffect(() => {
    refreshBookmarks();
  }, [refreshBookmarks]);

  const toggleBookmark = async (id: string) => {
    if (bookmarkBusy[id]) return;
    const was = bookmarkedIds.has(id);
    const flip = (on: boolean) =>
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      });
    flip(!was);
    setBookmarkBusy((p) => ({ ...p, [id]: true }));
    try {
      if (was) await unbookmarkPhotographer(id);
      else await bookmarkPhotographer(id);
      analytics.refresh();
    } catch {
      flip(was);
    } finally {
      setBookmarkBusy((p) => ({ ...p, [id]: false }));
    }
  };

  const onRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await Promise.all([
        analytics.refresh(),
        events.refresh(),
        activities.refresh(),
        photographers.refresh(),
        pending.refresh(),
        wallet.refresh(),
      ]);
      refreshBookmarks();
    } finally {
      setPulling(false);
    }
  }, [analytics, events, activities, photographers, pending, wallet, refreshBookmarks]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const eventList = events.data ?? EMPTY;
  const today = dayKey(new Date());
  const nextEvent = useMemo(() => pickNextEvent(eventList, today), [eventList, today]);
  const dues = useMemo(() => payable(pending.data ?? EMPTY), [pending.data]);
  const walletStats = useMemo(() => (wallet.data ? selectWalletStats(wallet.data, 'client') : null), [wallet.data, language]);
  const dueTotal = useMemo(
    () => (pending.data ? { amount: dues.reduce((s, p) => s + remaining(p), 0), count: dues.length } : undefined),
    [pending.data, dues],
  );
  const photosReady = analytics.data?.totalPhotos ?? 0;
  const anyLive = useMemo(() => eventList.some(isLiveNow), [eventList]);
  const photographerPreview = useMemo(() => (photographers.data ?? EMPTY).slice(0, PREVIEW_LIMIT), [photographers.data]);
  const activityPreview = (activities.data ?? EMPTY).slice(0, ACTIVITY_LIMIT);

  const open = (path: string) => router.push(path as never);
  const openEvent = (e: EventItem) =>
    open(isLiveNow(e) ? `/(public)/events/live-stream?id=${e.id}` : `/(public)/event/${e.id}`);
  const bookPhotographer = () => {
    if (env.hybridBookingEnabled) {
      setBookingStep('select');
      setBookingModeOpen(true);
    } else {
      open('/photographers');
    }
  };

  const actionAttention = dues.length > 0 || photosReady > 0;
  const actionError = pending.error && !pending.data;

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView
        contentContainerStyle={{ paddingTop: topBarHeight + spacing.sm, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
          <View style={styles.flex}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
              {tr('Welcome back')}, {name}
            </Text>
            <Text style={styles.subtitle}>{longDate(language) || tr('Your events, photos and bookings')}</Text>
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

        <Pressable
          onPress={() => setSearchOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Search photographers, events and live streams"
          style={({ pressed }) => [styles.search, pressed && styles.pressed]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <Text style={styles.searchText} numberOfLines={2}>
            {tr('Search photographers, events, live streams')}
          </Text>
        </Pressable>

        {/* 2. Actions */}
        <View style={styles.stack}>
          <HeroActionCard
            title="Book photographer"
            subtitle={env.hybridBookingEnabled ? 'Direct booking' : 'Verified pros'}
            icon="camera-outline"
            onPress={bookPhotographer}
          />
          {env.hybridBookingEnabled ? (
            <HeroActionCard
              title="Publish offer"
              subtitle="Set your budget, match with talent"
              icon="document-text-outline"
              tone="violet"
              onPress={() => {
                setBookingStep(1);
                setBookingModeOpen(true);
              }}
            />
          ) : null}
        </View>
        <View style={styles.row}>
          <ActionButton label="My albums" icon="images-outline" onPress={() => open('/gallery')} style={styles.flex} />
          <ActionButton label="Find my photos" icon="scan-outline" onPress={() => setFindPhotosOpen(true)} style={styles.flex} />
        </View>
        <View style={styles.stack}>
          <ActionButton
            label="Explore events"
            caption={anyLive ? 'Live now' : 'Watch and join'}
            icon="videocam-outline"
            variant="teal"
            onPress={() => (env.hybridBookingEnabled ? setExploreChoiceOpen(true) : open('/explore-events'))}
          />
        </View>

        {/* 3. Upcoming event */}
        <SectionHeader
          title="Upcoming event"
          actionLabel={nextEvent ? 'See all' : undefined}
          onAction={() => open('/events')}
        />
        {events.error && !events.data ? (
          <ErrorNotice message={events.error} onRetry={events.refresh} />
        ) : events.loading && !events.data ? (
          <SkeletonCard height={170} />
        ) : !nextEvent ? (
          <EmptyNote
            icon="calendar-outline"
            title="No upcoming events"
            body="Book a photographer and your next shoot appears here."
            actionLabel="Book photographer"
            onAction={bookPhotographer}
          />
        ) : (
          <NextEventCard
            hidden={hidden}
            event={nextEvent}
            match={matchDue(nextEvent, dues, eventList)}
            today={today}
            onOpen={() => openEvent(nextEvent)}
            onPay={(p) => setPayNowPayment(p)}
            onReview={() => open('/payments')}
          />
        )}

        {/* 4. Action required */}
        {actionAttention || actionError ? (
          <>
            <SectionHeader
              title="Action required"
              subtitle={
                dues.length > 0
                  ? `${dues.length} payment${dues.length === 1 ? '' : 's'} waiting`
                  : undefined
              }
            />
            {actionError ? (
              <ErrorNotice message={pending.error as string} onRetry={pending.refresh} compact />
            ) : null}
            <HCarousel
              label="Things that need your attention"
              itemWidth={280}
              data={[
                ...dues.map((p) => ({ key: `pay-${p.id}`, kind: 'pay' as const, p })),
                ...(photosReady > 0 ? [{ key: 'photos', kind: 'photos' as const, p: undefined }] : []),
              ]}
              keyOf={(i) => i.key}
              renderItem={(i) =>
                i.kind === 'pay' && i.p ? (
                  <PaymentCard hidden={hidden} payment={i.p} onPay={() => setPayNowPayment(i.p!)} />
                ) : (
                  <Card>
                    <View style={styles.attentionTop}>
                      <IconTile icon="images-outline" tone="success" />
                      <View style={styles.flex}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {tr('Photos ready')}
                        </Text>
                        <Text style={styles.cardMeta}>{photosReady} {tr('in your albums')}</Text>
                      </View>
                    </View>
                    <ActionButton label="Review photos" variant="primary" compact onPress={() => open('/gallery')} />
                  </Card>
                )
              }
            />
          </>
        ) : null}

        {/* 5. Your bookings */}
        {eventList.length > 0 ? (
          <>
            <SectionHeader title="Your bookings" actionLabel="See all" onAction={() => open('/events')} />
            <HCarousel
              label="Your latest bookings"
              data={eventList.slice(0, PREVIEW_LIMIT)}
              keyOf={(e) => String(e.id)}
              renderItem={(e) => {
                const m = matchDue(e, dues, eventList);
                const due = m.kind === 'one' ? m.payment : undefined;
                return (
                  <ShootCard
                    shoot={{
                      title: e.title || 'Booking',
                      cover: e.coverImage,
                      status: clientStatus(e),
                      when: whenText(e),
                      location: e.location,
                      photographer: e.photographerName,
                    }}
                    actions={
                      <>
                        {due ? (
                          <ActionButton label="Pay now" variant="primary" compact onPress={() => setPayNowPayment(due)} style={styles.flex} />
                        ) : m.kind === 'ambiguous' ? (
                          <ActionButton label="Review payments" compact onPress={() => open('/payments')} style={styles.flex} />
                        ) : null}
                        <ActionButton
                          label={isLiveNow(e) ? 'Watch live' : 'View booking'}
                          compact
                          onPress={() => openEvent(e)}
                          style={styles.flex}
                        />
                      </>
                    }
                  />
                );
              }}
            />
          </>
        ) : null}

        {/* 5b. Your overview (lifetime figures, same shape as the photographer's business overview) */}
        <SectionHeader
          title="Your overview"
          subtitle="Lifetime figures. Pick a period on Analytics."
          actionLabel="View analytics"
          onAction={() => open('/analytics')}
        />
        {analytics.error && !analytics.data ? (
          <ErrorNotice message={analytics.error} onRetry={analytics.refresh} />
        ) : (
          <ClientOverview
            analytics={analytics.data}
            loading={analytics.loading}
            spent={walletStats?.hero.value}
            walletCurrency={wallet.data?.currency}
            walletLoading={wallet.loading}
            due={dueTotal}
            hidden={hidden}
            onOpenWallet={() => open('/wallet')}
            onOpenPayments={() => open('/payments')}
          />
        )}

        {/* 6. Featured photographers */}
        <SectionHeader title="Featured photographers" actionLabel="See all" onAction={() => open('/photographers')} />
        {photographers.error && !photographers.data ? (
          <ErrorNotice message={photographers.error} onRetry={photographers.refresh} />
        ) : photographers.loading && !photographers.data ? (
          <SkeletonCard height={220} />
        ) : photographerPreview.length === 0 ? (
          <EmptyNote icon="people-outline" title="No photographers to show yet" body="Check back soon, or search for someone you know." />
        ) : (
          <HCarousel
            label="Featured photographers"
            itemWidth={240}
            data={photographerPreview}
            keyOf={(p) => String(p.id)}
            renderItem={(p) => (
              <Pressable
                onPress={() => open(`/photographer/${p.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`View ${p.name}'s profile`}
              >
                <PhotographerCard
                  photographer={p}
                  isBookmarked={bookmarkedIds.has(p.id)}
                  onToggleBookmark={() => toggleBookmark(p.id)}
                />
              </Pressable>
            )}
          />
        )}

        {/* 7. Recent activity */}
        <SectionHeader title="Recent activity" actionLabel={activityPreview.length > 0 ? 'See all' : undefined} onAction={() => open('/notifications')} />
        {activities.error && !activities.data ? (
          <ErrorNotice message={activities.error} onRetry={activities.refresh} />
        ) : activities.loading && !activities.data ? (
          <SkeletonCard height={120} />
        ) : activityPreview.length === 0 ? (
          <EmptyNote icon="notifications-outline" title="Nothing yet" body="Bookings, payments and photo deliveries show up here." />
        ) : (
          <Card style={styles.list}>
            {activityPreview.map((a, i) => {
              const k = activityKind(a);
              return (
                <Pressable
                  key={a.id}
                  onPress={() => open(k.route)}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.title}${a.createdAt ? `, ${relativeTime(a.createdAt)}` : ''}`}
                  style={({ pressed }) => [styles.activityRow, i < activityPreview.length - 1 && styles.divider, pressed && styles.pressed]}
                >
                  <IconTile icon={k.icon} tone={k.tone} />
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {a.title}
                    </Text>
                    {a.message ? (
                      <Text style={styles.cardMeta} numberOfLines={2}>
                        {a.message}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.time}>{relativeTime(a.createdAt)}</Text>
                </Pressable>
              );
            })}
          </Card>
        )}
      </ScrollView>

      <TopBar />

      <FindPhotosBottomSheet visible={findPhotosOpen} onClose={() => setFindPhotosOpen(false)} getPhotosRoute="/find-my-photos" />

      <PayNowSheet
        payment={payNowPayment}
        visible={!!payNowPayment}
        onClose={() => setPayNowPayment(null)}
        onSuccess={() => {
          pending.refresh();
          events.refresh();
          analytics.refresh();
        }}
      />

      <BookingModeSelector visible={bookingModeOpen} initialStep={bookingStep} onClose={() => setBookingModeOpen(false)} />

      <ExploreChoiceSheet
        visible={exploreChoiceOpen}
        onClose={() => setExploreChoiceOpen(false)}
        signedIn
        onPostEvent={() => {
          setBookingStep(1);
          setBookingModeOpen(true);
        }}
      />

      <GlobalSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} />
    </Screen>
  );
}

/** The next booking: photograph, facts, countdown, what is owed, and the one or two things to do. */
function NextEventCard({
  event,
  match,
  today,
  onOpen,
  onPay,
  onReview,
  hidden,
}: {
  hidden: boolean;
  event: EventItem;
  match: DueMatch;
  today: string;
  onOpen: () => void;
  onPay: (p: PendingPayment) => void;
  onReview: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { tr } = useSharedT();
  const live = isLiveNow(event);
  const day = eventDay(event);
  const countdown = day ? countdownLabel(daysUntil(day, today)) : undefined;
  const status = clientStatus(event);
  // Only a certain match gets a direct Pay now. More than one open payment under this title is the person's to pick.
  const due = match.kind === 'one' ? match.payment : undefined;
  const dueDate = due ? dueText(due) : undefined;
  return (
    <Card>
      <View style={styles.nextRow}>
        <Thumb uri={event.coverImage} size={96} />
        <View style={styles.nextText}>
          {live ? <LivePill label={tr('Live now')} size="xs" sparkle /> : <StatusBadge {...status} />}
          <Text style={styles.cardTitle} numberOfLines={2}>
            {event.title || tr('Your booking')}
          </Text>
          <Meta icon="calendar-outline" text={tr(whenText(event))} />
          {event.location ? <Meta icon="location-outline" text={event.location} /> : null}
          {countdown && !live ? (
            <View style={styles.countdown} accessibilityLabel={countdown}>
              <Ionicons name="time-outline" size={12} color={colors.link} />
              <Text style={styles.countdownText}>{tr(countdown)}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {event.photographerName ? <Meta icon="camera-outline" text={`${tr('Photographer')}: ${event.photographerName}`} /> : null}
      {due ? (
        <View style={styles.dueRow} accessibilityLabel={`${moneyText(remaining(due), DUE_CURRENCY, hidden)} due`}>
          <Ionicons name={due.status === 'failed' ? 'alert-circle' : 'time'} size={14} color={due.status === 'failed' ? colors.error : colors.warning} />
          <Text style={styles.dueText}>
            {moneyText(remaining(due), DUE_CURRENCY, hidden)}
            {dueDate ? ` · ${tr('Due')} ${tr(dueDate)}` : ` ${tr('Due').toLowerCase()}`}
            {due.status === 'failed' ? ` · ${tr('Payment failed')}` : ''}
          </Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        {due ? <ActionButton label="Pay now" variant="primary" compact onPress={() => onPay(due)} style={styles.flex} /> : null}
        {match.kind === 'ambiguous' ? <ActionButton label="Review payments" variant="primary" compact onPress={onReview} style={styles.flex} /> : null}
        <ActionButton
          label={live ? 'Watch live' : 'View booking'}
          variant={due || match.kind === 'ambiguous' ? 'secondary' : 'primary'}
          compact
          onPress={onOpen}
          style={styles.flex}
        />
      </View>
    </Card>
  );
}

function Meta({ icon, text }: { icon: IconName; text: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.metaLine}>
      <Ionicons name={icon} size={13} color={colors.textMuted} />
      <Text style={styles.cardMeta} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

function PaymentCard({ payment, onPay, hidden }: { payment: PendingPayment; onPay: () => void; hidden: boolean }) {
  const styles = useStyles();
  const { tr } = useSharedT();
  const failed = payment.status === 'failed';
  const dueDate = dueText(payment);
  return (
    <Card>
      <View style={styles.attentionTop}>
        <IconTile icon={failed ? 'alert-circle-outline' : 'time-outline'} tone={failed ? 'error' : 'warning'} />
        <View style={styles.flex}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {payment.eventName}
          </Text>
          <Text style={styles.cardMeta} numberOfLines={2}>
            {failed ? tr('Payment failed') : payment.status === 'partially_paid' ? tr('Balance due') : tr('Payment due')}
            {dueDate ? ` · ${tr(dueDate)}` : ''}
          </Text>
        </View>
      </View>
      <Text style={styles.amount} accessibilityLabel={`${moneyText(remaining(payment), DUE_CURRENCY, hidden)} to pay`}>
        {moneyText(remaining(payment), DUE_CURRENCY, hidden)}
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
  searchText: { flex: 1, color: c.textMuted, fontSize: 14 },
  pressed: { opacity: 0.85 },
  stack: { gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  flex: { flex: 1, minWidth: 0 },
  cardTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
  cardMeta: { color: c.textMuted, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  nextRow: { flexDirection: 'row', gap: spacing.md },
  nextText: { flex: 1, minWidth: 0, gap: 4, alignItems: 'flex-start' },
  metaLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 2 },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: c.tint,
  },
  countdownText: { color: c.link, fontSize: 12, fontWeight: '700' },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
  },
  dueText: { flex: 1, color: c.text, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  attentionTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  amount: { color: c.text, fontSize: 22, fontWeight: '800', marginBottom: spacing.sm },
  list: { padding: 0, overflow: 'hidden' },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, minHeight: 60 },
  divider: { borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  time: { color: c.textMuted, fontSize: 12 },
}));
