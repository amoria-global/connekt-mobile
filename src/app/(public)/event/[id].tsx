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
import { useCallback, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import { canBuyEventTicket, canShowDigitalPrice, isInPersonEvent } from '@/features/payments/policy';
import type { PublicEvent } from '@/features/events/types';
import {
  checkAnonymousAccessStatus,
  redeemGroupCode,
  registerAnonymousViewer,
  retryAnonymousDeviceAccess,
  sendEventWish,
  sendEventVideoWish,
} from '@/features/streams/api';
import { useAsync } from '@/hooks/useAsync';
import { storage } from '@/services/storage';
import { isApiError, useAuth } from '@/store/auth';
import { accountIdentity, isEmail, loadGuestIdentity, saveGuestIdentity } from '@/features/events/guestIdentity';
import { pickShortVideo } from '@/features/streams/pickShortVideo';
import { getDeviceId } from '@/utils/deviceId';
import { colors, spacing, radii, fontSize, fontWeight, makeStyles, useTheme, onFill } from '@/theme';
import { formatDate, formatPrice } from '@/utils/format';
import { EVENT_COVER_PLACEHOLDER } from '@/utils/placeholders';
import { useLanguage } from '@/store/language';
import { useCurrency } from '@/store/currency';
import { LiveButton, LivePill } from '@/components/ui/live';
import { clearReminder, getReminder, isValidReminderEmail, setReminder } from '@/features/events/reminder';
import { registerForPushNotifications } from '@/features/notifications/push';
import { useStackClearance } from '@/hooks/useScrollClearance';
import { GlassScrim, GlassSheetHost } from '@/components/ui/GlassModal';

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

function priceLabel(
  e: {
    streamFee?: number | null;
    price?: number;
    streamFeeCurrencyAbbreviation?: string | null;
    location?: string;
  },
  t: ReturnType<typeof useLanguage.getState>['t'],
): { label: string; amount: string } {
  const code = e.streamFeeCurrencyAbbreviation || 'RWF';
  const paid = (e.streamFee || 0) > 0 || (e.price || 0) > 0;
  // A price is part of the purchase surface, so it goes where the buy button
  // went. "Ticketed" keeps the useful half. Free stays visible. In-person
  // events sell a real-world ticket, so their price stays visible.
  if (paid && !canShowDigitalPrice(false) && !isInPersonEvent(e)) return { label: '', amount: t('b4_priceTicketed') };
  if (e.streamFee && e.streamFee > 0)
    return { label: t('b4_priceFrom'), amount: formatPrice(e.streamFee, code) };
  if (e.price && e.price > 0)
    return { label: t('b4_priceFrom'), amount: formatPrice(e.price, code) };
  return { label: '', amount: t('b4_priceFree') };
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
  action?: 'webCheckout' | 'reminder';
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
  t: ReturnType<typeof useLanguage.getState>['t'],
): Cta | null {
  const { isCancelled, isCompleted, isLive, isUpcoming, isPaid } = status;
  // Undefined where digital prices are gated off, so the disabled ticket CTA
  // below carries no figure the user cannot act on.
  const inPerson = isInPersonEvent(e);
  const canBuy = canBuyEventTicket(e);
  const price = canShowDigitalPrice(!isPaid) || canBuy
    ? formatPrice(e.price || e.streamFee || 0, e.streamFeeCurrencyAbbreviation || 'RWF')
    : undefined;
  if (isCancelled)
    return { label: t('b4_ctaCancelled'), icon: 'close-circle', tone: 'cancelled', disabled: true };
  if (isCompleted)
    return { label: t('b4_ctaEnded'), icon: 'archive', tone: 'ended', disabled: true };
  if (isLive) {
    if (!isPaid)
      return {
        label: t('b4_ctaWatchLive'),
        icon: 'play-circle',
        tone: 'live',
        disabled: false,
        href: `/(public)/events/live-stream?id=${e.id}` as unknown as Href,
      };
    if (hasPurchasedAccess)
      return {
        label: t('b4_ctaStartWatching'),
        icon: 'play-circle',
        tone: 'live',
        disabled: false,
        href: `/(public)/events/live-stream?id=${e.id}${viewerId ? `&viewerId=${viewerId}` : ''}` as unknown as Href,
      };
    // Stream-only events have no purchase path on native, and no link out to
    // one either. Tickets to in-person events are a real-world service and may
    // be bought in the app. The "Already paid? Verify access" and group-code
    // cards below stay visible, so anyone who already holds access can get in.
    if (!canBuy)
      return { label: t('b4_ctaTicketRequired'), sub: price, icon: 'ticket', tone: 'live', disabled: true };
    return {
      label: inPerson ? t('b4_ctaBuyEventTicket') : t('b4_ctaBuyAccess'),
      sub: price,
      icon: 'ticket',
      tone: 'live',
      disabled: false,
      action: 'webCheckout',
    };
  }
  if (isUpcoming) {
    if (!isPaid)
      return { label: t('b4_ctaGetNotified'), icon: 'notifications-outline', tone: 'reserve', disabled: false, action: 'reminder' };
    if (hasPurchasedAccess)
      return { label: t('b4_ctaAccessReserved'), icon: 'checkmark-circle', tone: 'owned', disabled: true };
    if (!canBuy)
      return { label: t('b4_ctaTicketRequired'), sub: price, icon: 'ticket', tone: 'reserve', disabled: true };
    return {
      label: inPerson ? t('b4_ctaBuyEventTicket') : t('b4_ctaReserveSpot'),
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

/**
 * The "Starts in" card. It owns the one-second clock, so only this card re-renders each second
 * and not the whole event screen above it.
 */
function EventCountdown({ start }: { start: Date | null }) {
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const startMs = start ? start.getTime() : null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startMs === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs]);
  if (startMs === null || startMs - now <= 0) return null;
  const countdown = msToCountdown(startMs - now);
  return (
    <View style={styles.countdownCard}>
      <Text style={styles.countdownEyebrow}>
        <Ionicons name="hourglass-outline" size={12} color={colors.primary} /> {t('b4_startsIn')}
      </Text>
      <View style={styles.countdownGrid}>
        {countdown.days > 0 ? (
          <View style={styles.countdownCell}>
            <Text style={styles.countdownNum}>{pad(countdown.days)}</Text>
            <Text style={styles.countdownUnit}>{countdown.days === 1 ? t('b4_daySingular') : t('b4_dayPlural')}</Text>
          </View>
        ) : null}
        <View style={styles.countdownCell}>
          <Text style={styles.countdownNum}>{pad(countdown.hours)}</Text>
          <Text style={styles.countdownUnit}>{t('b4_hr')}</Text>
        </View>
        <View style={styles.countdownCell}>
          <Text style={styles.countdownNum}>{pad(countdown.minutes)}</Text>
          <Text style={styles.countdownUnit}>{t('b4_min')}</Text>
        </View>
        <View style={styles.countdownCell}>
          <Text style={styles.countdownNum}>{pad(countdown.seconds)}</Text>
          <Text style={styles.countdownUnit}>{t('b4_sec')}</Text>
        </View>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────

export default function PublicEventDetailScreen() {
  // Re-render when the display currency changes (formatPrice reads the store).
  useCurrency((s) => s.currency);
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const clearance = useStackClearance();
  const { id, src } = useLocalSearchParams<{ id: string; src?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Arriving from a scanned QR code shows the short version first: what, when, where and the one thing to do.
  const fromQr = src === 'qr';
  const [showDetails, setShowDetails] = useState(!fromQr);
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
        setGroupCodeError(res.message ?? t('b4_codeNotValid'));
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
      setGroupCodeError(isApiError(e) ? e.message : t('b4_couldNotRedeemCode'));
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
  // "Get notified": a real reminder held by the backend. Signed in, the person is told by an
  // in-app notification and a push; as a guest, by one email about 15 minutes before the start.
  const signedIn = useAuth((s) => s.status === 'authenticated');
  const [reminderOn, setReminderOn] = useState(false);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderAsk, setReminderAsk] = useState(false);
  const [reminderEmail, setReminderEmail] = useState('');
  const [reminderError, setReminderError] = useState<string | null>(null);
  const [reminderNote, setReminderNote] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const email = (await storage.get('reminderEmail')) ?? '';
        const on = await getReminder(String(id), { signedIn, email });
        if (alive) setReminderOn(on);
      } catch {
        /* unknown stays off */
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, signedIn]);

  const flashReminder = (text: string) => {
    setReminderNote(text);
    setTimeout(() => setReminderNote(null), 3500);
  };

  const applyReminder = async (email?: string) => {
    if (reminderBusy) return;
    setReminderBusy(true);
    setReminderError(null);
    try {
      const who = { signedIn, email };
      if (reminderOn) {
        await clearReminder(String(id), who);
        setReminderOn(false);
        flashReminder('Notification turned off.');
      } else {
        await setReminder(String(id), who);
        setReminderOn(true);
        setReminderAsk(false);
        if (signedIn) {
          // The push needs the phone's permission; ask now, while the person just asked for it.
          void registerForPushNotifications();
          flashReminder('Done. We will notify you when this event starts.');
        } else {
          await storage.set('reminderEmail', email ?? '').catch(() => {});
          flashReminder(`Done. We will email ${email} when this event starts.`);
        }
      }
    } catch (e) {
      setReminderError(isApiError(e) ? e.message : 'Could not update your notification. Please try again.');
    } finally {
      setReminderBusy(false);
    }
  };

  const onReminderPress = async () => {
    if (reminderBusy) return;
    if (reminderOn) {
      await applyReminder((await storage.get('reminderEmail')) ?? undefined);
      return;
    }
    if (signedIn) {
      await applyReminder();
      return;
    }
    setReminderEmail((await storage.get('reminderEmail')) ?? '');
    setReminderError(null);
    setReminderAsk(true);
  };

  const onVerifyAccess = async () => {
    if (!verifyName.trim() || !verifyEmail.includes('@')) {
      setVerifyError(t('b4_verifyEnterNameEmail'));
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
        setVerifyError(t('b4_verifyNoPaidRecord'));
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
          setVerifyError(t('b4_verifyAnotherDevice'));
          return;
        }
      }
      if (!granted) {
        // No clear access — keep the verify modal open so the user sees
        // the error inline instead of getting bounced into the live-
        // stream → back-to-here loop.
        setVerifyError(t('b4_verifyNotConfirmed'));
        return;
      }
      await storage.set(`anonymousViewer_${id}`, reg.viewerId).catch(() => {});
      setViewerId(reg.viewerId);
      setVerifyOpen(false);
      router.push(
        `/(public)/events/live-stream?id=${id}&viewerId=${reg.viewerId}` as unknown as Href,
      );
    } catch (e) {
      setVerifyError(isApiError(e) ? e.message : t('b4_couldNotVerifyAccess'));
    } finally {
      setVerifyBusy(false);
    }
  };

  // Send a wish (web `.ve-wishes`): a text wish or a video wish of up to one minute, for an event that has not started.
  // A signed-in user is sent as their account (name and email are not asked again); a guest is asked once and remembered.
  const [wishName, setWishName] = useState('');
  const [wishEmail, setWishEmail] = useState('');
  const [wishMessage, setWishMessage] = useState('');
  const [wishBusy, setWishBusy] = useState(false);
  const [wishVideoBusy, setWishVideoBusy] = useState(false);
  const [wishError, setWishError] = useState<string | null>(null);
  const [wishSuccess, setWishSuccess] = useState<string | null>(null);
  const account = accountIdentity(currentUser);
  useEffect(() => {
    if (account) return;
    loadGuestIdentity().then((g) => {
      if (g.name) setWishName((n) => n || g.name!);
      if (g.email) setWishEmail((e) => e || g.email!);
    });
  }, [account]);
  /** Who the wish comes from, or null with the reason shown. */
  const wishIdentity = (): { name: string; email: string } | null => {
    const who = account ?? { name: wishName.trim(), email: wishEmail.trim() };
    if (!who.name) {
      setWishError('Please enter your name.');
      return null;
    }
    if (!isEmail(who.email)) {
      setWishError('Please enter a valid email.');
      return null;
    }
    return who;
  };
  const onSendWish = async () => {
    const who = wishIdentity();
    if (!who) return;
    if (!wishMessage.trim()) {
      setWishError('Please write your message.');
      return;
    }
    setWishBusy(true);
    setWishError(null);
    setWishSuccess(null);
    try {
      await sendEventWish(id, { ...who, message: wishMessage.trim() });
      setWishSuccess(t('b4_wishSentSuccess'));
      setWishMessage('');
      if (!account) void saveGuestIdentity(who);
    } catch (e) {
      setWishError(isApiError(e) ? e.message : t('b4_wishSendError'));
    } finally {
      setWishBusy(false);
    }
  };
  const onSendVideoWish = async () => {
    const who = wishIdentity();
    if (!who) return;
    setWishError(null);
    setWishSuccess(null);
    try {
      const video = await pickShortVideo();
      if (!video) return;
      setWishVideoBusy(true);
      await sendEventVideoWish(id, { ...who, message: wishMessage, video });
      setWishSuccess('Your video wish was sent to the event organizer!');
      setWishMessage('');
      if (!account) void saveGuestIdentity(who);
    } catch (e) {
      setWishError(isApiError(e) ? e.message : 'Could not send your video wish. Please try again.');
    } finally {
      setWishVideoBusy(false);
    }
  };

  const onShare = async () => {
    if (!data) return;
    try {
      await Share.share({
        title: data.title,
        message: t('b4_shareEventMsg', { title: data.title, url: `${SHARE_BASE}${id}` }),
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
              accessibilityLabel={t('b4_goBack')}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.topBarPillCenter}>
              <Text style={styles.topBarPillText}>{t('b4_eventHeader')}</Text>
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
              accessibilityLabel={t('b4_goBack')}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
            <View style={styles.topBarPillCenter}>
              <Text style={styles.topBarPillText}>{t('b4_eventHeader')}</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>
        </View>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={refresh}>
            <Text style={styles.retryText}>{t('b4_tryAgain')}</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }
  if (!data) return null;

  const status = deriveStatus(data);
  const baseCta = buildCta(data, status, hasPurchasedAccess, viewerId, t);
  const cta =
    baseCta && baseCta.action === 'reminder'
      ? {
          ...baseCta,
          label: reminderOn ? 'You will be notified' : reminderBusy ? 'Setting up' : t('b4_ctaGetNotified'),
          sub: reminderOn ? (reminderBusy ? 'Updating' : 'Tap to turn off') : undefined,
          icon: (reminderOn ? 'notifications' : 'notifications-outline') as keyof typeof Ionicons.glyphMap,
        }
      : baseCta;
  const price = priceLabel(data, t);
  const organizer = data.creator
    ? `${data.creator.firstName ?? ''} ${data.creator.lastName ?? ''}`.trim() ||
      data.eventOrganizer
    : data.eventOrganizer;

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
            accessibilityLabel={t('b4_goBack')}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>

          <View style={styles.topBarPillCenter}>
            <Text style={styles.topBarPillText}>{t('b4_eventHeader')}</Text>
          </View>

          <View style={styles.topBarActions}>
            <Pressable
              style={({ pressed }) => [styles.topBarActionBtn, pressed && { opacity: 0.7 }]}
              onPress={onShare}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('b4_shareEvent')}
            >
              <Ionicons name="share-social-outline" size={19} color={colors.text} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.topBarActionBtn, pressed && { opacity: 0.7 }]}
              onPress={toggleSaved}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? t('b4_removeFromSaved') : t('b4_saveEvent')}
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
        contentContainerStyle={[styles.scroll, { paddingBottom: clearance }, showStickyBar && { paddingBottom: 140 }]}
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
            <LivePill label={t('b4_happeningNow')} size="md" sparkle style={styles.statusPillPos} />
          ) : status.isCancelled ? (
            <View style={[styles.statusPill, styles.statusPillCancelled]}>
              <Text style={styles.statusPillText}>{t('b4_cancelledUpper')}</Text>
            </View>
          ) : status.isCompleted ? (
            <View style={[styles.statusPill, styles.statusPillEnded]}>
              <Text style={styles.statusPillText}>{t('b4_badgeEnded')}</Text>
            </View>
          ) : (
            <View style={[styles.statusPill, styles.statusPillUpcoming]}>
              <Text style={styles.statusPillText}>{t('b4_badgeUpcoming')}</Text>
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
                      accessibilityLabel={descExpanded ? t('b4_showLess') : t('b4_readMore')}
                    >
                      <Text style={styles.endedReadMoreText}>
                        {descExpanded ? t('b4_showLess') : t('b4_readMore')}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [styles.endedFindPhotosBtn, pressed && { opacity: 0.88 }]}
                onPress={() => router.push('/find-photos' as never)}
                accessibilityRole="button"
                accessibilityLabel={t('b4_findMyPhotos')}
              >
                <Ionicons name="search" size={18} color={onFill} />
                <Text style={styles.endedFindPhotosBtnText}>{t('b4_findMyPhotos')}</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.title}>{data.title}</Text>
          )}

          {/* Tags row */}
          {showDetails && !status.isCompleted && tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {tags.map((tag) => (
                <View key={tag} style={styles.tag}>
                  <Text style={styles.tagText}># {tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* Countdown card (web `.ve-countdown-card`) */}
          {status.isUpcoming ? <EventCountdown start={parseEventStart(data.eventDate, data.startTime)} /> : null}

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
                  text={t('b4_upToGuests', { count: data.maxGuests.toLocaleString() })}
                />
              ) : null}
            </View>
          ) : null}

          {/* Scanned from a QR code: the short version first, the rest one tap away. */}
          {fromQr && !status.isCompleted ? (
            <Pressable
              style={styles.secondary}
              onPress={() => setShowDetails((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showDetails }}
            >
              <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
              <Text style={styles.secondaryText}>{showDetails ? 'Show less' : 'Show full details'}</Text>
            </Pressable>
          ) : null}

          {/* About this event (web `.ve-card` about section + `.ve-readmore`) */}
          {showDetails && !status.isCompleted && desc ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('b4_aboutThisEvent')}</Text>
              <Text style={styles.bodyText}>{descText}</Text>
              {desc.length > DESC_LIMIT ? (
                <Pressable onPress={() => setDescExpanded((v) => !v)}>
                  <Text style={styles.readMore}>
                    {descExpanded ? t('b4_showLess') : t('b4_readMore')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Hosts & crew (web `.ve-hosts-grid`) */}
          {showDetails && !status.isCompleted && (organizer || data.photographerName || data.photographerId) ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('b4_hostsAndCrew')}</Text>
              <View style={styles.hostsGrid}>
                {organizer ? (
                  <View style={styles.hostCard}>
                    <View style={[styles.hostAvatarWrap, styles.hostAvatarOrganizer]}>
                      <Ionicons name="mic" size={20} color={onFill} />
                    </View>
                    <View style={styles.hostInfo}>
                      <Text style={styles.hostRole}>{t('b4_organizedBy')}</Text>
                      <Text style={styles.hostName}>{organizer}</Text>
                      <Text style={styles.hostSub}>{t('b4_eventOrganizerRole')}</Text>
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
                        <Ionicons name="camera" size={20} color={onFill} />
                      )}
                    </View>
                    <View style={styles.hostInfo}>
                      <Text style={styles.hostRole}>{t('b4_photographerRole')}</Text>
                      <Text style={styles.hostName}>{data.photographerName}</Text>
                      <Text style={styles.hostSub}>{t('b4_capturingTheMoment')}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Fee card */}
          {(showDetails || status.isPaid) && !status.isCompleted && !status.isCancelled ? (
            <View style={styles.feeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.feeLabel}>{isInPersonEvent(data) ? t('b4_eventTicketIncludesStream') : t('b4_streamEntry')}</Text>
                <Text style={styles.feeValue}>
                  {price.label ? `${price.label} ` : ''}
                  {price.amount}
                </Text>
              </View>
              {status.isLive ? (
                <LivePill label={t('b4_ctaWatchLive')} size="sm" sparkle style={{ alignSelf: 'center' }} />
              ) : (
                <View style={styles.feeBadge}>
                  <Ionicons name="videocam" size={14} color={colors.textOnPrimary} />
                  <Text style={styles.feeBadgeText}>{t('b4_liveStreamBadge')}</Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Primary CTA — hidden from scroll body; shown in sticky bar instead */}

          {/* Verify access + group code redeem — web parity:
              shown for paid live/upcoming events where access isn't confirmed */}
          {showDetails && !status.isCompleted && !status.isCancelled && status.isPaid && !hasPurchasedAccess ? (
            <>
              {/* Verify access is kept in scroll for group code card context */}
              <View style={{ height: 0 }} />

              {/* Group invite code redeem (web `.ve-hero-group`) — only shown for live paid events */}
              {status.isLive ? (
                <View style={styles.groupCodeCard}>
                  <View style={styles.groupCodeHeader}>
                    <Ionicons name="ticket-outline" size={16} color={colors.primary} />
                    <Text style={styles.groupCodeTitle}>{t('b4_haveGroupInviteCode')}</Text>
                  </View>
                  <View style={styles.groupCodeRow}>
                    <TextInput
                      value={groupCode}
                      onChangeText={(t) => {
                        setGroupCode(t);
                        setGroupCodeError('');
                      }}
                      placeholder={t('b4_enterCodePlaceholder')}
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
                        <ActivityIndicator color={onFill} size="small" />
                      ) : (
                        <Text style={styles.groupCodeBtnText}>{t('b4_redeem')}</Text>
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
                  <Text style={styles.wishTitle}>{t('b4_sendWishTitle')}</Text>
                  <Text style={styles.wishSub}>
                    {t('b4_sendWishSub')}
                  </Text>
                </View>
              </View>
              {account ? (
                <Text style={styles.wishSub}>{`Sending as ${account.name} (${account.email})`}</Text>
              ) : (
                <>
                  <Input
                    placeholder={t('b4_yourNamePlaceholder')}
                    value={wishName}
                    onChangeText={(v) => {
                      setWishName(v);
                      setWishError(null);
                    }}
                    autoCapitalize="words"
                  />
                  <Input
                    placeholder={t('b4_emailPlaceholder')}
                    value={wishEmail}
                    onChangeText={(v) => {
                      setWishEmail(v);
                      setWishError(null);
                    }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </>
              )}
              <TextInput
                value={wishMessage}
                onChangeText={setWishMessage}
                placeholder={t('b4_writeMessagePlaceholder')}
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
              <Button title={wishBusy ? t('b4_sending') : t('b4_sendWishBtn')} onPress={onSendWish} loading={wishBusy} />
              <Pressable
                style={({ pressed }) => [styles.secondary, (pressed || wishVideoBusy) && { opacity: 0.7 }]}
                onPress={onSendVideoWish}
                disabled={wishVideoBusy || wishBusy}
                accessibilityRole="button"
                accessibilityLabel="Record a 1 minute video wish"
                accessibilityState={{ busy: wishVideoBusy }}
              >
                {wishVideoBusy ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="videocam-outline" size={18} color={colors.accent} />
                )}
                <Text style={styles.secondaryText}>{wishVideoBusy ? 'Sending your video…' : 'Record a 1 minute video wish'}</Text>
              </Pressable>
              <Text style={styles.wishSub}>The message above is added to your video as a caption. Videos can be up to 1 minute.</Text>
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
                {status.isCompleted ? t('b4_donate') : t('b4_supportWithDonation')}
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
              accessibilityLabel={t('b4_alreadyPaidVerify')}
            >
              <Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} />
              <Text style={styles.stickyVerifyText}>{t('b4_alreadyPaidVerify')}</Text>
            </Pressable>
          ) : null}
          <CtaButton
            cta={cta!}
            onPress={() => {
              if (cta!.action === 'reminder') {
                void onReminderPress();
              } else if (cta!.action === 'webCheckout') {
                router.push(`/(public)/events/pay?id=${id}` as unknown as Href);
              } else if (cta!.href) {
                router.push(cta!.href);
              }
            }}
          />
        </View>
      ) : null}

      {/* Get notified: a guest gives an email; a signed-in member needs nothing here. */}
      <Modal visible={reminderAsk} transparent animationType="slide" onRequestClose={() => setReminderAsk(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <GlassScrim style={styles.modalBackdrop} onPress={() => !reminderBusy && setReminderAsk(false)}>
            <GlassSheetHost
              style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}
            >
              <Text style={styles.modalTitle}>Get notified</Text>
              <Text style={styles.modalHint}>
                Enter your email and we will send you one message about 15 minutes before this event starts.
                Signed-in members are notified in the app instead.
              </Text>
              <Input
                label="Email"
                value={reminderEmail}
                onChangeText={(v) => {
                  setReminderEmail(v);
                  setReminderError(null);
                }}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
              {reminderError ? <Text style={styles.wishMsg}>{reminderError}</Text> : null}
              <Button
                title={reminderBusy ? 'Saving…' : 'Notify me'}
                onPress={() => {
                  if (!isValidReminderEmail(reminderEmail)) {
                    setReminderError('Enter a valid email address.');
                    return;
                  }
                  void applyReminder(reminderEmail.trim().toLowerCase());
                }}
                loading={reminderBusy}
              />
              <Pressable onPress={() => setReminderAsk(false)} style={{ alignSelf: 'center', marginTop: 4 }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </GlassSheetHost>
          </GlassScrim>
        </KeyboardAvoidingView>
      </Modal>

      {reminderNote || (reminderError && !reminderAsk) ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={{ position: 'absolute', left: 16, right: 16, bottom: Math.max(insets.bottom, 16) + 84, alignItems: 'center' }}
        >
          <View style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 }}>
            <Text style={{ color: onFill, fontWeight: '600', fontSize: 14, textAlign: 'center' }}>
              {reminderNote ?? reminderError}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Verify access modal */}
      <Modal
        visible={verifyOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setVerifyOpen(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <GlassScrim style={styles.modalBackdrop} onPress={() => setVerifyOpen(false)}>
          <GlassSheetHost style={styles.modalSheet}>
            <Text style={styles.modalTitle}>{t('b4_verifyYourAccessTitle')}</Text>
            <Text style={styles.modalHint}>
              {t('b4_verifyModalHint')}
            </Text>
            <Input
              label={t('b4_nameLabel')}
              value={verifyName}
              onChangeText={setVerifyName}
              placeholder={t('b4_fullNamePlaceholder')}
              autoCapitalize="words"
            />
            <Input
              label={t('b4_emailPlaceholder')}
              value={verifyEmail}
              onChangeText={setVerifyEmail}
              placeholder={t('b4_emailExamplePlaceholder')}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {verifyError ? <Text style={styles.wishMsg}>{verifyError}</Text> : null}
            <Button
              title={verifyBusy ? t('b4_checking') : t('b4_verifyAccessBtn')}
              onPress={onVerifyAccess}
              loading={verifyBusy}
            />
            <Pressable onPress={() => setVerifyOpen(false)} style={{ alignSelf: 'center', marginTop: 4 }}>
              <Text style={styles.cancelText}>{t('b4_cancel')}</Text>
            </Pressable>
          </GlassSheetHost>
        </GlassScrim>
        </KeyboardAvoidingView>
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
  if (cta.tone === 'live' && !cta.disabled) {
    return <LiveButton label={cta.label} sub={cta.sub} icon={cta.icon} onPress={onPress} size="lg" />;
  }
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
  scroll: {},

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
  statusPillPos: { position: 'absolute', bottom: spacing.lg, left: spacing.lg },
  statusPillUpcoming: { backgroundColor: 'rgba(31,107,255,0.55)' },
  statusPillEnded: { backgroundColor: 'rgba(107,114,128,0.78)' },
  statusPillCancelled: { backgroundColor: 'rgba(239,68,68,0.78)' },
  statusPillText: {
    color: c.textOnPrimary,
    fontSize: 11,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.9,
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
  hostAvatarOrganizer: { backgroundColor: c.primary },
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
    shadowColor: c.shadow,
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
  groupCodeBtnText: { color: c.textOnPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.bold },
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
    color: c.textOnPrimary,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    letterSpacing: 0.3,
  },

  // Modal
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: {
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
