/**
 * Public event detail (guest-facing).
 *
 * Web parity: knockout/app/user/events/view-event/view-event.client.tsx
 *
 * What this port includes (matching the web 1:1):
 *   • Cover image with cinematic scrim + glass back / share / save buttons
 *     overlaid in the top-rail (web `.ve-glass-btn` + `.ve-hero-top`)
 *   • Status pill: LIVE (red + pulse) / UPCOMING (blue) / ENDED / CANCELLED
 *   • Countdown timer (dd / hh / mm / ss) when event is upcoming + has a date
 *     (web `.ve-countdown-card` inside the sidebar)
 *   • About section + "Read more" expand toggle
 *   • Hosts & crew section: organizer (mic icon) + photographer (camera/avatar)
 *   • Fee card: price display + "Watch live" / "Live stream" badge
 *   • Primary CTA matrix (web `renderPrimaryCTA`):
 *       cancelled  → disabled "Event cancelled"
 *       ended      → disabled "Event ended"
 *       live  + free            → "Watch live"
 *       live  + paid + access   → "Start watching"
 *       live  + paid            → "Buy access" (+ price)
 *       upcoming + free         → "Get notified"
 *       upcoming + paid + access → "Access reserved" (disabled)
 *       upcoming + paid         → "Reserve your spot" (+ price)
 *   • "Already paid? Verify access" button for live/upcoming paid events
 *     (opens recover modal → re-registers by email to get viewerId)
 *   • Group invite code redeem field: shown when event is live + paid + not owned
 *     (web `.ve-hero-group`)
 *   • "Send a wish" form for upcoming events
 *     (web `.ve-wishes` → POST /public/events/{id}/wishes)
 *   • Donation link (non-cancelled events)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import { canShowDigitalPrice, digitalPurchasesEnabled } from '@/features/payments/policy';
import { openWebCheckout, streamAccessUrl } from '@/features/payments/webCheckout';
import type { PublicEvent } from '@/features/events/types';
import {
  checkAnonymousAccessStatus,
  redeemGroupCode,
  registerAnonymousViewer,
  retryAnonymousDeviceAccess,
  sendEventWish,
} from '@/features/streams/api';
import { useAsync } from '@/hooks/useAsync';
import { storage } from '@/services/storage';
import { isApiError, useAuth } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';
import { formatDate } from '@/utils/format';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';

/**
 * Web parity (view-event.client.tsx:1507-1538): countdown to event
 * start. Renders DD:HH:MM:SS in tabular-num cells with an amber pill.
 */
function getCountdownParts(ms: number) {
  if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return { days, hours, minutes, seconds };
}

function eventStartMs(date?: string, time?: string): number | null {
  if (!date) return null;
  const [h, m] = (time || '00:00').split(':');
  const iso = `${date}T${(h || '00').padStart(2, '0')}:${(m || '00').padStart(2, '0')}:00`;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}




const SHARE_BASE = 'https://connekyt.com/user/events/view-event?id=';
// Must match explore-events.tsx. No colon: SecureStore keys allow only
// alphanumerics, '.', '-' and '_', so the old key rejected every read and
// write and saved events never persisted on device.
const SAVED_KEY = 'connekyt_savedEvents';

function formatTime12h(t?: string): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function priceLabel(e: {
  streamFee?: number | null;
  price?: number;
  streamFeeCurrencyAbbreviation?: string | null;
}): { label: string; amount: string } {
  const code = e.streamFeeCurrencyAbbreviation || 'RWF';
  const paid = (e.streamFee || 0) > 0 || (e.price || 0) > 0;
  // A price is part of the purchase surface, so it goes where the buy button
  // went. "Ticketed" keeps the useful half. Free stays visible.
  if (paid && !canShowDigitalPrice(false)) return { label: '', amount: 'Ticketed' };
  if (e.streamFee && e.streamFee > 0)
    return { label: 'From', amount: `${code} ${e.streamFee.toLocaleString()}` };
  if (e.price && e.price > 0)
    return { label: 'From', amount: `${code} ${e.price.toLocaleString()}` };
  return { label: '', amount: 'Free' };
}

type CtaTone = 'live' | 'reserve' | 'owned' | 'ended' | 'cancelled';
type Cta = {
  label: string;
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: CtaTone;
  href?: Href;
  /**
   * Purchase CTAs no longer route to an in-app payment funnel — they open
   * the web checkout instead. Only ever set when digitalPurchasesEnabled.
   */
  action?: 'webCheckout';
  disabled: boolean;
};

function deriveStatus(e: PublicEvent) {
  const rawStatus = (e.eventStatus || '').toUpperCase();
  const streamEnded = e.streamStatus === 'ended';
  const isLive = rawStatus === 'ONGOING' && !streamEnded;
  const isCompleted = rawStatus === 'COMPLETED' || streamEnded;
  const isCancelled = rawStatus === 'CANCELLED';
  const isUpcoming = !isLive && !isCompleted && !isCancelled;
  const streamFee = e.streamFee || 0;
  const isPaid = streamFee > 0 || (e.price || 0) > 0;
  return { rawStatus, streamEnded, isLive, isCompleted, isCancelled, isUpcoming, streamFee, isPaid };
}

function buildCta(
  e: PublicEvent,
  status: ReturnType<typeof deriveStatus>,
  hasPurchasedAccess: boolean,
  viewerId: string | null,
): Cta | null {
  const { isCancelled, isCompleted, isLive, isUpcoming, isPaid } = status;
  // Undefined where digital prices are gated off, so the disabled ticket CTA
  // below carries no figure the user cannot act on.
  const price = canShowDigitalPrice(!isPaid)
    ? `${(e.price || e.streamFee || 0).toLocaleString()} ${e.streamFeeCurrencyAbbreviation || 'RWF'}`
    : undefined;
  if (isCancelled)
    return { label: 'Event cancelled', icon: 'close-circle', tone: 'cancelled', disabled: true };
  if (isCompleted)
    return { label: 'Event ended', icon: 'archive', tone: 'ended', disabled: true };
  if (isLive) {
    if (!isPaid)
      return {
        label: 'Watch live',
        icon: 'play-circle',
        tone: 'live',
        disabled: false,
        href: `/(public)/events/live-stream?id=${e.id}` as unknown as Href,
      };
    if (hasPurchasedAccess)
      return {
        label: 'Start watching',
        icon: 'play-circle',
        tone: 'live',
        disabled: false,
        href: `/(public)/events/live-stream?id=${e.id}${viewerId ? `&viewerId=${viewerId}` : ''}` as unknown as Href,
      };
    // No purchase path on Android, and no link out to one either. The
    // "Already paid? Verify access" and group-code cards below stay visible,
    // so anyone who already holds access can still get in.
    if (!digitalPurchasesEnabled)
      return { label: 'Ticket required. Verify below if you have one', sub: price, icon: 'ticket', tone: 'live', disabled: true };
    return {
      label: 'Buy access',
      sub: price,
      icon: 'ticket',
      tone: 'live',
      disabled: false,
      action: 'webCheckout',
    };
  }
  if (isUpcoming) {
    if (!isPaid)
      return { label: 'Get notified', icon: 'notifications', tone: 'reserve', disabled: false };
    if (hasPurchasedAccess)
      return { label: 'Access reserved', icon: 'checkmark-circle', tone: 'owned', disabled: true };
    if (!digitalPurchasesEnabled)
      return { label: 'Ticket required. Verify below if you have one', sub: price, icon: 'ticket', tone: 'reserve', disabled: true };
    return {
      label: 'Reserve your spot',
      sub: price,
      icon: 'ticket',
      tone: 'reserve',
      disabled: false,
      action: 'webCheckout',
    };
  }
  return null;
}

// ── Countdown helpers ────────────────────────────────────────────────────────

function parseEventStart(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (timeStr) {
      const [hh, mm] = timeStr.split(':').map(Number);
      return new Date(y, m - 1, d, hh, mm);
    }
    return new Date(y, m - 1, d);
  } catch {
    return null;
  }
}

function msToCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  return { days, hours, minutes, seconds };
}

const pad = (n: number) => String(n).padStart(2, '0');

// ── Main screen ──────────────────────────────────────────────────────────────

export default function PublicEventDetailScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => getPublicEventDetailed(id), [id]),
  );

  // Proof of purchase (web parity: anonymousViewer_{id} / groupCode_{id})
  const [viewerId, setViewerId] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([storage.get(`anonymousViewer_${id}`), storage.get(`groupCode_${id}`)])
      .then(([v, g]) => {
        if (v) setViewerId(v);
        else if (g) setViewerId(g);
      })
      .catch(() => {});
  }, [id]);
  const hasPurchasedAccess = !!viewerId;

  // Bookmarks
  const [isSaved, setIsSaved] = useState(false);
  useEffect(() => {
    storage
      .get(SAVED_KEY)
      .then((raw) => {
        if (!raw) return;
        try {
          const set = new Set<string>(JSON.parse(raw) as string[]);
          setIsSaved(set.has(id));
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, [id]);
  const toggleSaved = async () => {
    try {
      const raw = await storage.get(SAVED_KEY).catch(() => null);
      const set = new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      await storage.set(SAVED_KEY, JSON.stringify(Array.from(set)));
      setIsSaved(set.has(id));
    } catch { /* ignore */ }
  };

  // Countdown
  const [msUntilStart, setMsUntilStart] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!data) return;
    const start = parseEventStart(data.eventDate, data.startTime);
    if (!start) return;
    const tick = () => setMsUntilStart(start.getTime() - Date.now());
    tick();
    countdownRef.current = setInterval(tick, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [data]);

  // Description expand/collapse (web `.ve-readmore`)
  const [descExpanded, setDescExpanded] = useState(false);
  const DESC_LIMIT = 200;

  // Group code redeem
  const [groupCode, setGroupCode] = useState('');
  const [groupCodeBusy, setGroupCodeBusy] = useState(false);
  const [groupCodeError, setGroupCodeError] = useState('');
  const onRedeemGroupCode = async () => {
    if (!groupCode.trim()) return;
    setGroupCodeBusy(true);
    setGroupCodeError('');
    try {
      const fingerprint = await getDeviceId();
      const res = await redeemGroupCode(id, {
        inviteCode: groupCode.trim(),
        viewerUsername: fingerprint,
      });
      if (!res.ok) {
        setGroupCodeError(res.message ?? 'This code is not valid for this event.');
        return;
      }
      if (res.viewerId) {
        await storage.set(`anonymousViewer_${id}`, res.viewerId).catch(() => {});
        setViewerId(res.viewerId);
      }
      // Always navigate to live-stream on a valid redeem, not only when
      // hlsManifestUrl is already populated. The manifest may be null
      // (Cloudflare hasn't generated it yet) but the user has earned
      // access — live-stream will auto-poll for the manifest and play
      // as soon as it appears. Previously a valid code left the user
      // on the event page with no feedback when stream wasn't broadcasting.
      router.push(
        `/(public)/events/live-stream?id=${id}${res.viewerId ? `&viewerId=${res.viewerId}` : ''}` as unknown as Href,
      );
    } catch (e) {
      setGroupCodeError(isApiError(e) ? e.message : 'Could not redeem the code.');
    } finally {
      setGroupCodeBusy(false);
    }
  };

  // Verify access modal (web `.ve-btn--verify`)
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyName, setVerifyName] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const currentUser = useAuth((s) => s.user);
  useEffect(() => {
    if (currentUser?.email && !verifyEmail) {
      setVerifyEmail(currentUser.email);
    }
    const fullName = [currentUser?.firstName, currentUser?.lastName].filter(Boolean).join(' ').trim();
    if (fullName && !verifyName) {
      setVerifyName(fullName);
    }
  }, [currentUser, verifyEmail, verifyName]);
  const onVerifyAccess = async () => {
    if (!verifyName.trim() || !verifyEmail.includes('@')) {
      setVerifyError('Enter the name and email you used at checkout.');
      return;
    }
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const fingerprint = await getDeviceId();
      const reg = await registerAnonymousViewer(id, {
        name: verifyName.trim(),
        email: verifyEmail.trim(),
        // The backend DTO still @NotBlank-requires a phone; we no longer ask
        // for it (name + email identify the ticket), so send a placeholder.
        phone: '0000000000',
        deviceId: fingerprint,
      });
      if (reg.needsPayment) {
        setVerifyError("We couldn't find a paid record for this email. Please buy access.");
        return;
      }
      /*
       * VALIDATE access before navigating. Previously we trusted
       * register's ACCESS_GRANTED status and pushed to live-stream;
       * but DEVICE_CONFLICT and edge-case backend states would also
       * pass the `!needsPayment` gate, then live-stream's access-status
       * call would return hasAccess=false → live-stream would bounce
       * back here → infinite loop. Now we run the same access-status
       * check here, attempt a silent device switch if needed, and only
       * push to live-stream when the viewerId is truly playable.
       */
      let granted = false;
      let accessRes = await checkAnonymousAccessStatus(id, reg.viewerId, fingerprint);
      if (accessRes.active) {
        granted = true;
      } else if (accessRes.reason === 'DEVICE_MISMATCH') {
        // Try the silent device-check: it only succeeds once the old
        // device has gone quiet for 60s+ (no forced switching while it's
        // still active - see retryAnonymousDeviceAccess).
        const swap = await retryAnonymousDeviceAccess(id, reg.viewerId, fingerprint);
        if (swap.ok) {
          accessRes = await checkAnonymousAccessStatus(id, reg.viewerId, fingerprint);
          if (accessRes.active) granted = true;
        } else {
          setVerifyError(
            'Your viewer is currently watching on another device. Stop the other session and try again.',
          );
          return;
        }
      }
      if (!granted) {
        // No clear access — keep the verify modal open so the user sees
        // the error inline instead of getting bounced into the live-
        // stream → back-to-here loop.
        setVerifyError(
          "Your access couldn't be confirmed. The payment record may not have settled yet. Try again in a moment, or buy access.",
        );
        return;
      }
      await storage.set(`anonymousViewer_${id}`, reg.viewerId).catch(() => {});
      setViewerId(reg.viewerId);
      setVerifyOpen(false);
      router.push(
        `/(public)/events/live-stream?id=${id}&viewerId=${reg.viewerId}` as unknown as Href,
      );
    } catch (e) {
      setVerifyError(isApiError(e) ? e.message : 'Could not verify access.');
    } finally {
      setVerifyBusy(false);
    }
  };

  // Send a wish (web `.ve-wishes`)
  const [wishName, setWishName] = useState('');
  const [wishEmail, setWishEmail] = useState('');
  const [wishMessage, setWishMessage] = useState('');
  const [wishBusy, setWishBusy] = useState(false);
  const [wishError, setWishError] = useState<string | null>(null);
  const [wishSuccess, setWishSuccess] = useState<string | null>(null);
  const onSendWish = async () => {
    if (!wishName.trim() || !wishEmail.includes('@') || !wishMessage.trim()) {
      setWishError('Please fill in your name, email and message.');
      return;
    }
    setWishBusy(true);
    setWishError(null);
    setWishSuccess(null);
    try {
      await sendEventWish(id, {
        name: wishName.trim(),
        email: wishEmail.trim(),
        message: wishMessage.trim(),
      });
      setWishSuccess('Your wish was sent to the event organizer!');
      setWishMessage('');
    } catch (e) {
      setWishError(isApiError(e) ? e.message : 'Could not send your wish. Please try again.');
    } finally {
      setWishBusy(false);
    }
  };

  const onShare = async () => {
    if (!data) return;
    try {
      await Share.share({
        title: data.title,
        message: `Check out "${data.title}" on Connekyt\n${SHARE_BASE}${id}`,
      });
    } catch { /* user dismissed */ }
  };

  // ── Loading / Error ────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.topBarPill}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore-events'))}
              hitSlop={12}
              style={({ pressed }) => [styles.topBarBackBtn, pressed && styles.topBarBackBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.topBarPillCenter}>
              <Text style={styles.topBarPillText}>Event</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }
  if (error && !data) {
    return (
      <Screen padded={false} edges={[]}>
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={styles.topBarPill}>
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore-events'))}
              hitSlop={12}
              style={({ pressed }) => [styles.topBarBackBtn, pressed && styles.topBarBackBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.topBarPillCenter}>
              <Text style={styles.topBarPillText}>Event</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }
  if (!data) return null;

  const status = deriveStatus(data);
  const cta = buildCta(data, status, hasPurchasedAccess, viewerId);
  const price = priceLabel(data);
  const organizer = data.creator
    ? `${data.creator.firstName ?? ''} ${data.creator.lastName ?? ''}`.trim() ||
      data.eventOrganizer
    : data.eventOrganizer;

  const countdown =
    status.isUpcoming && msUntilStart !== null && msUntilStart > 0
      ? msToCountdown(msUntilStart)
      : null;

  const desc = data.description ?? '';
  const descTruncated = desc.length > DESC_LIMIT && !descExpanded;
  const descText = descTruncated ? `${desc.slice(0, DESC_LIMIT)}…` : desc;

  // Tags from the comma-separated eventTags field
  const tags = data.eventTags
    ? data.eventTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // Whether to show the sticky bottom CTA bar
  const showStickyBar =
    !status.isCompleted &&
    !status.isCancelled &&
    cta !== null;

  return (
    <Screen padded={false} edges={[]}>
      {/* Top Bar in head — full-width rounded floating bar matching ExploreEvents & FindMyPhotos */}
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
        <View style={styles.topBarPill}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore-events'))}
            hitSlop={12}
            style={({ pressed }) => [styles.topBarBackBtn, pressed && styles.topBarBackBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.topBarPillCenter}>
            <Text style={styles.topBarPillText}>Event</Text>
          </View>

          <View style={styles.topBarActions}>
            <Pressable
              style={({ pressed }) => [styles.topBarActionBtn, pressed && { opacity: 0.7 }]}
              onPress={onShare}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share event"
            >
              <Ionicons name="share-social-outline" size={19} color={colors.text} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.topBarActionBtn, pressed && { opacity: 0.7 }]}
              onPress={toggleSaved}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Remove from saved' : 'Save event'}
            >
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={19}
                color={isSaved ? '#F59E0B' : colors.text}
              />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, showStickyBar && { paddingBottom: 140 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* ── Hero: cover ─────────────────────────── */}
        <View style={styles.heroWrap}>
          <Image
            source={data.eventPhoto ? { uri: data.eventPhoto } : EVENT_COVER_PLACEHOLDER}
            style={styles.cover}
            contentFit="cover"
            transition={250}
          />
          {/* Dark scrim over the cover, matching web `.ve-hero-veil` */}
          <View style={styles.coverScrim} />

          {/* Status pill (web `.ve-status-pill`) */}
          {status.isLive ? (
            <View style={[styles.statusPill, styles.statusPillLive]}>
              <View style={styles.pulseRed} />
              <Text style={styles.statusPillText}>HAPPENING NOW</Text>
            </View>
          ) : status.isCancelled ? (
            <View style={[styles.statusPill, styles.statusPillCancelled]}>
              <Text style={styles.statusPillText}>CANCELLED</Text>
            </View>
          ) : status.isCompleted ? (
            <View style={[styles.statusPill, styles.statusPillEnded]}>
              <Text style={styles.statusPillText}>ENDED</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, styles.statusPillUpcoming]}>
              <Text style={styles.statusPillText}>UPCOMING</Text>
            </View>
          )}

          {/* Category eyebrow */}
          {data.eventCategory?.name ? (
            <View style={styles.coverCat}>
              <Text style={styles.coverCatText}>{data.eventCategory.name.toUpperCase()}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          {/* Ended event quick card on top with Name, Location, Date, Description, and Find My Photos button */}
          {status.isCompleted ? (
            <View style={styles.endedTopCard}>
              <Text style={styles.endedTopTitle}>{data.title}</Text>

              <View style={styles.endedTopMetaList}>
                {data.eventDate ? (
                  <View style={styles.endedTopMetaItem}>
                    <View style={styles.endedTopMetaIconWrap}>
                      <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.endedTopMetaText}>{formatDate(data.eventDate)}</Text>
                  </View>
                ) : null}
                {data.location ? (
                  <View style={styles.endedTopMetaItem}>
                    <View style={styles.endedTopMetaIconWrap}>
                      <Ionicons name="location-outline" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.endedTopMetaText}>{data.location}</Text>
                  </View>
                ) : null}
              </View>

              {desc ? (
                <View style={styles.endedDescSection}>
                  <Text
                    style={styles.endedDescText}
                    numberOfLines={descExpanded ? undefined : 3}
                  >
                    {desc}
                  </Text>
                  {desc.length > 120 ? (
                    <Pressable
                      onPress={() => setDescExpanded((v) => !v)}
                      hitSlop={8}
                      style={styles.endedReadMoreBtn}
                      accessibilityRole="button"
                      accessibilityLabel={descExpanded ? 'Show less description' : 'Read more description'}
                    >
                      <Text style={styles.endedReadMoreText}>
                        {descExpanded ? 'Show less ↑' : 'Read more ↓'}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.endedFindPhotosBtn, pressed && { opacity: 0.88 }]}
                onPress={() => router.push('/find-photos' as never)}
                accessibilityRole="button"
                accessibilityLabel="Find My Photos"
              >
                <Ionicons name="search" size={18} color="#FFFFFF" />
                <Text style={styles.endedFindPhotosBtnText}>Find My Photos</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.title}>{data.title}</Text>
          )}

          {/* Tags row */}
          {!status.isCompleted && tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}># {tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Countdown card (web `.ve-countdown-card`) */}
          {countdown ? (
            <View style={styles.countdownCard}>
              <Text style={styles.countdownEyebrow}>
                <Ionicons name="hourglass-outline" size={12} color={colors.primary} /> Starts in
              </Text>
              <View style={styles.countdownGrid}>
                {countdown.days > 0 ? (
                  <View style={styles.countdownCell}>
                    <Text style={styles.countdownNum}>{pad(countdown.days)}</Text>
                    <Text style={styles.countdownUnit}>
                      {countdown.days === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.countdownCell}>
                  <Text style={styles.countdownNum}>{pad(countdown.hours)}</Text>
                  <Text style={styles.countdownUnit}>hr</Text>
                </View>
                <View style={styles.countdownCell}>
                  <Text style={styles.countdownNum}>{pad(countdown.minutes)}</Text>
                  <Text style={styles.countdownUnit}>min</Text>
                </View>
                <View style={styles.countdownCell}>
                  <Text style={styles.countdownNum}>{pad(countdown.seconds)}</Text>
                  <Text style={styles.countdownUnit}>sec</Text>
                </View>
              </View>
            </View>
          ) : null}

          {/* Event quick-info card */}
          {!status.isCompleted ? (
            <View style={styles.infoCard}>
              {data.eventDate ? (
                <Row icon="calendar-outline" text={formatDate(data.eventDate)} />
              ) : null}
              {data.startTime ? (
                <Row
                  icon="time-outline"
                  text={
                    data.endTime
                      ? `${formatTime12h(data.startTime)} – ${formatTime12h(data.endTime)}`
                      : formatTime12h(data.startTime)
                  }
                />
              ) : null}
              {data.location ? <Row icon="location-outline" text={data.location} /> : null}
              {data.maxGuests ? (
                <Row
                  icon="people-outline"
                  text={`Up to ${data.maxGuests.toLocaleString()} guests`}
                />
              ) : null}
            </View>
          ) : null}

          {/* About this event (web `.ve-card` about section + `.ve-readmore`) */}
          {!status.isCompleted && desc ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About this event</Text>
              <Text style={styles.bodyText}>{descText}</Text>
              {desc.length > DESC_LIMIT ? (
                <Pressable onPress={() => setDescExpanded((v) => !v)}>
                  <Text style={styles.readMore}>
                    {descExpanded ? 'Show less ↑' : 'Read more ↓'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Hosts & crew (web `.ve-hosts-grid`) */}
          {!status.isCompleted && (organizer || data.photographerName || data.photographerId) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hosts &amp; crew</Text>
              <View style={styles.hostsGrid}>
                {organizer ? (
                  <View style={styles.hostCard}>
                    <View style={[styles.hostAvatarWrap, styles.hostAvatarOrganizer]}>
                      <Ionicons name="mic" size={20} color="#fff" />
                    </View>
                    <View style={styles.hostInfo}>
                      <Text style={styles.hostRole}>Organized by</Text>
                      <Text style={styles.hostName}>{organizer}</Text>
                      <Text style={styles.hostSub}>Event organizer</Text>
                    </View>
                  </View>
                ) : null}
                {data.photographerName ? (
                  <View style={styles.hostCard}>
                    <View style={styles.hostAvatarWrap}>
                      {data.photographerImage ? (
                        <Image
                          source={{ uri: data.photographerImage }}
                          style={styles.hostAvatar}
                          contentFit="cover"
                        />
                      ) : (
                        <Ionicons name="camera" size={20} color="#fff" />
                      )}
                    </View>
                    <View style={styles.hostInfo}>
                      <Text style={styles.hostRole}>Photographer</Text>
                      <Text style={styles.hostName}>{data.photographerName}</Text>
                      <Text style={styles.hostSub}>Capturing the moment</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Fee card */}
          {!status.isCompleted && !status.isCancelled ? (
            <View style={styles.feeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.feeLabel}>Stream entry</Text>
                <Text style={styles.feeValue}>
                  {price.label ? `${price.label} ` : ''}
                  {price.amount}
                </Text>
              </View>
              <View style={styles.feeBadge}>
                <Ionicons name="videocam" size={14} color={colors.textOnPrimary} />
                <Text style={styles.feeBadgeText}>
                  {status.isLive ? 'Watch live' : 'Live stream'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Primary CTA — hidden from scroll body; shown in sticky bar instead */}

          {/* Verify access + group code redeem — web parity:
              shown for paid live/upcoming events where access isn't confirmed */}
          {!status.isCompleted && !status.isCancelled && status.isPaid && !hasPurchasedAccess ? (
            <>
              {/* Verify access is kept in scroll for group code card context */}
              <View style={{ height: 0 }} />

              {/* Group invite code redeem (web `.ve-hero-group`) — only shown for live paid events */}
              {status.isLive ? (
                <View style={styles.groupCodeCard}>
                  <View style={styles.groupCodeHeader}>
                    <Ionicons name="ticket-outline" size={16} color={colors.primary} />
                    <Text style={styles.groupCodeTitle}>Have a group invite code?</Text>
                  </View>
                  <View style={styles.groupCodeRow}>
                    <TextInput
                      value={groupCode}
                      onChangeText={(t) => {
                        setGroupCode(t);
                        setGroupCodeError('');
                      }}
                      placeholder="Enter code"
                      placeholderTextColor={colors.textMuted}
                      style={styles.groupCodeInput}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={onRedeemGroupCode}
                    />
                    <Pressable
                      style={[
                        styles.groupCodeBtn,
                        (!groupCode.trim() || groupCodeBusy) && { opacity: 0.6 },
                      ]}
                      onPress={onRedeemGroupCode}
                      disabled={!groupCode.trim() || groupCodeBusy}
                    >
                      {groupCodeBusy ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.groupCodeBtnText}>Redeem</Text>
                      )}
                    </Pressable>
                  </View>
                  {groupCodeError ? (
                    <Text style={styles.groupCodeError}>{groupCodeError}</Text>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : null}

          {/* Send a wish (web `.ve-wishes`) — only for upcoming events */}
          {status.isUpcoming ? (
            <View style={styles.wishCard}>
              <View style={styles.wishHeader}>
                <Ionicons name="chatbubble-ellipses" size={18} color={colors.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.wishTitle}>Send a wish to the organizer</Text>
                  <Text style={styles.wishSub}>
                    Your message will appear on screen during the event.
                  </Text>
                </View>
              </View>
              <Input
                placeholder="Your name"
                value={wishName}
                onChangeText={setWishName}
                autoCapitalize="words"
              />
              <Input
                placeholder="Email"
                value={wishEmail}
                onChangeText={setWishEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <TextInput
                value={wishMessage}
                onChangeText={setWishMessage}
                placeholder="Write your message…"
                placeholderTextColor={colors.textMuted}
                multiline
                style={styles.wishTextarea}
              />
              {wishError ? <Text style={styles.wishMsg}>{wishError}</Text> : null}
              {wishSuccess ? (
                <View style={styles.wishSuccessBox}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.wishSuccessText}>{wishSuccess}</Text>
                </View>
              ) : null}
              <Button title={wishBusy ? 'Sending…' : 'Send wish'} onPress={onSendWish} loading={wishBusy} />
            </View>
          ) : null}

          {/* Donation */}
          {!status.isCancelled ? (
            <Pressable
              style={styles.secondary}
              onPress={() => router.push(`/(public)/donate?eventId=${id}` as unknown as Href)}
            >
              <Ionicons name="heart-outline" size={18} color={colors.accent} />
              <Text style={styles.secondaryText}>
                {status.isCompleted ? 'Donate' : 'Support this event with a donation'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Sticky bottom CTA bar */}
      {showStickyBar ? (
        <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {status.isPaid && !hasPurchasedAccess ? (
            <Pressable
              style={styles.stickyVerifyBtn}
              onPress={() => setVerifyOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Already paid? Verify access"
            >
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
              <Text style={styles.stickyVerifyText}>Already paid? Verify access</Text>
            </Pressable>
          ) : null}
          <CtaButton
            cta={cta!}
            onPress={() => {
              if (cta!.action === 'webCheckout') {
                openWebCheckout(streamAccessUrl(id))
                  .then(() => { setVerifyOpen(true); })
                  .catch(() => {});
              } else if (cta!.href) {
                router.push(cta!.href);
              }
            }}
          />
        </View>
      ) : null}

      {/* Verify access modal */}
      <Modal
        visible={verifyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setVerifyOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setVerifyOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Verify your access</Text>
            <Text style={styles.modalHint}>
              Enter the name and email you used when buying your ticket. We'll restore access on
              this device.
            </Text>
            <Input
              label="Name"
              value={verifyName}
              onChangeText={setVerifyName}
              placeholder="Full name"
              autoCapitalize="words"
            />
            <Input
              label="Email"
              value={verifyEmail}
              onChangeText={setVerifyEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {verifyError ? <Text style={styles.wishMsg}>{verifyError}</Text> : null}
            <Button
              title={verifyBusy ? 'Checking…' : 'Verify access'}
              onPress={onVerifyAccess}
              loading={verifyBusy}
            />
            <Pressable onPress={() => setVerifyOpen(false)} style={{ alignSelf: 'center', marginTop: 4 }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Row({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.rowText}>{text}</Text>
    </View>
  );
}

function CtaButton({ cta, onPress }: { cta: Cta; onPress: () => void }) {
  const ctaToneStyles = useCtaToneStyles();
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.ctaBase,
        ctaToneStyles[cta.tone],
        cta.disabled && styles.ctaDisabled,
        pressed && !cta.disabled && styles.ctaPressed,
      ]}
      disabled={cta.disabled}
      onPress={onPress}
    >
      <Ionicons
        name={cta.icon}
        size={20}
        color={cta.disabled ? colors.textMuted : colors.textOnPrimary}
      />
      <View style={styles.ctaText}>
        <Text style={[styles.ctaLabel, cta.disabled && styles.ctaLabelDisabled]}>
          {cta.label}
        </Text>
        {cta.sub ? (
          <Text style={[styles.ctaSub, cta.disabled && styles.ctaLabelDisabled]}>{cta.sub}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const useStyles = makeStyles((c, e) => ({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  errorText: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { paddingBottom: 120 },

  // ── Hero ──────────────────────────────────────────────────────────────────
  heroWrap: { width: '100%', height: 280, position: 'relative' },
  cover: { width: '100%', height: '100%', backgroundColor: c.surfaceMuted },
  coverScrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(7,8,13,0.42)',
  },
  // Top bar in head — full-width rounded floating bar matching ExploreEvents & FindMyPhotos
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: c.background,
  },
  topBarPill: {
    width: '100%',
    height: 52,
    borderRadius: radii.full,
    backgroundColor: c.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    ...e(2),
  },
  topBarBackBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarBackBtnPressed: { opacity: 0.65, transform: [{ scale: 0.94 }] },
  topBarPillCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  topBarPillText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.primary,
    textAlign: 'center',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 4,
  },
  topBarActionBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Status pill (web `.ve-status-pill`)
  statusPill: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  statusPillLive: { backgroundColor: 'rgba(220,38,38,0.92)' },
  statusPillUpcoming: { backgroundColor: 'rgba(31,107,255,0.55)' },
  statusPillEnded: { backgroundColor: 'rgba(107,114,128,0.78)' },
  statusPillCancelled: { backgroundColor: 'rgba(239,68,68,0.78)' },
  statusPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.9,
  },
  pulseRed: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  coverCat: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  coverCatText: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: fontWeight.bold, letterSpacing: 0.8 },

  // ── Body ──────────────────────────────────────────────────────────────────
  body: { padding: spacing.xl, gap: spacing.lg },
  title: { fontSize: fontSize['2xl'], fontWeight: fontWeight.extrabold, color: c.text },

  // Tags
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  tagText: { fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold },

  // Countdown
  countdownCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.primary,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  countdownEyebrow: {
    color: c.primary,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.5,
  },
  countdownGrid: { flexDirection: 'row', gap: spacing.md },
  countdownCell: { alignItems: 'center', minWidth: 48 },
  countdownNum: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.extrabold,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  countdownUnit: { fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold },

  // Info card
  infoCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, fontSize: fontSize.md, color: c.textSoft },

  // About section
  section: { gap: spacing.sm },
  sectionTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  bodyText: { fontSize: fontSize.md, color: c.textSoft, lineHeight: 24 },
  readMore: {
    color: c.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    marginTop: 2,
  },

  // Hosts & crew (web `.ve-hosts-grid`)
  hostsGrid: { gap: spacing.md },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
  },
  hostAvatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hostAvatarOrganizer: { backgroundColor: '#083A85' },
  hostAvatar: { width: '100%', height: '100%' },
  hostInfo: { flex: 1, gap: 2 },
  hostRole: { fontSize: 11, color: c.textMuted, fontWeight: fontWeight.semibold, letterSpacing: 0.4 },
  hostName: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  hostSub: { fontSize: 11, color: c.textMuted },

  // Fee card
  feeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  feeLabel: {
    color: c.textMuted,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    letterSpacing: 0.5,
  },
  feeValue: {
    color: c.primary,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.extrabold,
    marginTop: 2,
  },
  feeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.full,
  },
  feeBadgeText: { color: c.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  // CTA
  ctaBase: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaDisabled: { backgroundColor: c.surfaceMuted },
  ctaText: { alignItems: 'flex-start' },
  ctaLabel: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  ctaSub: { color: 'rgba(255,255,255,0.85)', fontSize: fontSize.xs, fontWeight: fontWeight.semibold, marginTop: 2 },
  ctaLabelDisabled: { color: c.textMuted },

  // Verify access
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: c.infoBg,
  },
  verifyBtnText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Sticky bottom bar
  stickyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 12,
  },
  stickyVerifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    borderWidth: 1.5,
    borderColor: c.primary,
    backgroundColor: c.infoBg,
  },
  stickyVerifyText: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },

  // Group code redeem (web `.ve-hero-group`)
  groupCodeCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  groupCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupCodeTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },
  groupCodeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  groupCodeInput: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: c.text,
    fontSize: fontSize.sm,
  },
  groupCodeBtn: {
    backgroundColor: c.primary,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    height: 42,
  },
  groupCodeBtnText: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold },
  groupCodeError: { color: c.error, fontSize: 12 },

  // Send a wish (web `.ve-wishes`)
  wishCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.md,
  },
  wishHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  wishTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  wishSub: { fontSize: fontSize.xs, color: c.textMuted, marginTop: 2 },
  wishTextarea: {
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    color: c.text,
    fontSize: fontSize.sm,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  wishMsg: { color: c.error, fontSize: 12, fontWeight: fontWeight.semibold },
  wishSuccessBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.successBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  wishSuccessText: { color: c.success, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1 },

  // Donation
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  secondaryText: { color: c.accent, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  // Retry
  retryBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: c.primary,
  },
  retryText: { color: c.textOnPrimary, fontSize: fontSize.md, fontWeight: fontWeight.bold },

  // Ended Event Top Card & Find Photos
  endedTopCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.md,
    marginBottom: spacing.xs,
    width: '100%',
    ...e(2),
  },
  endedTopTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: c.text,
    lineHeight: 28,
    flexShrink: 1,
    width: '100%',
  },
  endedTopMetaList: {
    gap: 8,
    width: '100%',
  },
  endedTopMetaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    width: '100%',
  },
  endedTopMetaIconWrap: {
    paddingTop: 2,
  },
  endedTopMetaText: {
    flex: 1,
    flexShrink: 1,
    fontSize: fontSize.sm,
    color: c.textMuted,
    fontWeight: fontWeight.medium,
    lineHeight: 20,
  },
  endedDescSection: {
    width: '100%',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
  },
  endedDescText: {
    fontSize: fontSize.sm,
    color: c.textSoft,
    lineHeight: 22,
    flexShrink: 1,
    width: '100%',
  },
  endedReadMoreBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    marginTop: 4,
  },
  endedReadMoreText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  endedFindPhotosBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: c.primary,
    borderRadius: radii.full,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.xs,
    width: '100%',
    ...e(2),
  },
  endedFindPhotosBtnText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  modalHint: {
    fontSize: fontSize.sm,
    color: c.textMuted,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  cancelText: { color: c.textMuted, fontSize: fontSize.sm, marginTop: 4 },
}));

const useCtaToneStyles = makeStyles((c) => ({
  live: { backgroundColor: c.accent },
  reserve: { backgroundColor: c.primary },
  owned: { backgroundColor: c.successBg },
  ended: { backgroundColor: c.surfaceMuted },
  cancelled: { backgroundColor: c.errorBg },
}));
