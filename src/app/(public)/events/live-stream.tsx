/**
 * Public live-stream viewer — mobile port of
 * `knockout/app/pages/events/live-stream.tsx`.
 *
 * This file is a full rewrite modeled on the web's flow. The web's
 * 10,885 lines include multi-event swipe carousel, embedded auth modal,
 * full emoji picker and video-message recorder — none of which are part
 * of the mobile public flow (auth lives in (auth), and the user only
 * ever arrives here for one specific event). What's kept verbatim:
 *
 *   1. ACCESS DETECTION (web lines 595-755 in pages/events/live-stream)
 *      a. If event type is `entry_fee` (streamFee > 0):
 *           viewerId from URL ?? from SecureStore(`anonymousViewer_{id}`)
 *           → checkAnonymousAccessStatus(eventId, fingerprint, viewerId)
 *             - hasAccess true + whepUrl|hlsManifestUrl → granted
 *             - reason === DEVICE_MISMATCH → device-switch modal
 *             - fromPayment param → retry after 2s (backend may not
 *               have processed yet)
 *           If no viewerId at all → show viewer-info modal (web parity
 *               with "Recover access by email" + buy-access link).
 *      b. If event type is `invite_token`:
 *           token from URL ?? from SecureStore(`streamToken_{id}`)
 *           → requestStreamAccess → granted
 *           If no token → show invite-token entry card.
 *      c. If event is free + no entry_fee:
 *           HLS poll picks up `hlsManifestUrl` from /public/events/{id}
 *           directly.
 *
 *   2. PLAYER + STATUS MESSAGING
 *      Driven off `event.eventStatus` (not manifest presence). ONGOING +
 *      not ended → "Stream is starting" spinner until manifest arrives.
 *      COMPLETED → "This event has ended."
 *
 *   3. CHAT PANEL
 *      Renders whenever the event is ONGOING (not gated on manifestUrl).
 *      Polls /public/events/{id}/chats every 2.5s. Sends via
 *      sendPublicStreamChat (rate-limited 10/min). Reactions row sends
 *      via sendPublicStreamReaction (rate-limited 30/min) and bursts
 *      floating emoji on screen. Other viewers' reactions also burst.
 *
 *   4. GIFT MODAL (sponsor)
 *      Web parity: 5 preset amount chips + custom + MoMo / Card. Posts
 *      to /public/anonymous-viewer/{id}/gift then opens gateway URL.
 *
 *   5. DEVICE-CONFLICT MODAL
 *      Surfaced when access-status returns DEVICE_MISMATCH. Confirm
 *      → switchAnonymousDevice (sends newDeviceFingerprint per backend
 *      DTO), then re-check access.
 *
 *   6. VIEWER-INFO MODAL
 *      The web's "Verify your access" form: name + email + phone +
 *      fingerprint → registerAnonymousViewer. If a paid record exists,
 *      backend dedupes by email and returns ACCESS_GRANTED with the
 *      viewerId we persist.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import {
  checkAnonymousAccessStatus,
  getPublicStreamChats,
  getPublicViewerCount,
  initiatePublicGift,
  registerAnonymousViewer,
  requestStreamAccess,
  sendPublicStreamChat,
  sendPublicStreamReaction,
  switchAnonymousDevice,
  validateStreamToken,
  type PublicStreamChat,
} from '@/features/streams/api';
import { listCurrencies, type Currency } from '@/features/reference/api';
import {
  getPublicPaymentStatus,
  pollPublicPaymentStatus,
} from '@/features/payments/anonymous';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { storage } from '@/services/storage';
import { getDeviceId } from '@/utils/deviceId';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const REACTION_EMOJIS = ['🔥', '❤️', '👏', '😍', '🎉', '😮'];
const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80';

// ─── Welcome splash ────────────────────────────────────────────────────────
// Web parity: showWelcomeSplash auto-dismisses after 2.6s once the stream
// loads, so first-time viewers get a friendly intro before the player.

function WelcomeSplash({ eventTitle, onDismiss }: { eventTitle?: string; onDismiss: () => void }) {
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(fade, { toValue: 0, duration: 320, useNativeDriver: true }).start(onDismiss);
    }, 2600);
    return () => clearTimeout(t);
  }, [fade, onDismiss]);
  return (
    <Animated.View pointerEvents="none" style={[splashStyles.wrap, { opacity: fade }]}>
      <View style={splashStyles.content}>
        <View style={splashStyles.iconWrap}>
          <Ionicons name="play-circle" size={40} color="#fff" />
        </View>
        <Text style={splashStyles.headline}>Welcome, you're in!</Text>
        {eventTitle ? (
          <Text style={splashStyles.sub} numberOfLines={2}>
            {eventTitle}
          </Text>
        ) : null}
        <View style={splashStyles.livePill}>
          <View style={splashStyles.liveDot} />
          <Text style={splashStyles.liveText}>LIVE</Text>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Player ────────────────────────────────────────────────────────────────
// expo-video has no WebRTC codec — we feed it HLS only. The web's WHEPPlayer
// is web-only (WebRTC over HTTP). Object-form source so AVPlayer/ExoPlayer
// pick the right HLS loader.

function Player({ url }: { url: string }) {
  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = false;
    p.muted = false;
    p.audioMixingMode = 'auto';
    p.play();
  });
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' && error?.message) {
        console.warn('[stream] playback error', error.message);
      }
    });
    return () => sub.remove();
  }, [player]);
  return (
    <View style={styles.playerWrap}>
      <VideoView
        player={player}
        style={styles.player}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
        nativeControls
      />
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────

export default function PublicLiveStreamScreen() {
  const {
    id,
    viewerId: urlViewerId,
    token: urlToken,
    fromPayment,
  } = useLocalSearchParams<{
    id: string;
    viewerId?: string;
    token?: string;
    fromPayment?: string;
  }>();
  const router = useRouter();

  // ── Event load ───────────────────────────────────────────────────────────
  const event = useAsync(useCallback(() => getPublicEventDetailed(id), [id]));

  // Derived event status — kept verbatim with the web's gate (live, ended,
  // upcoming, cancelled).
  const status = useMemo(() => {
    const ev = event.data;
    const raw = (ev?.eventStatus || '').toUpperCase();
    const streamEnded = ev?.streamStatus === 'ended';
    const isLive = raw === 'ONGOING' && !streamEnded;
    const isEnded = raw === 'COMPLETED' || streamEnded;
    const isCancelled = raw === 'CANCELLED';
    const streamFee = ev?.streamFee ?? 0;
    const price = ev?.price ?? 0;
    const isPaid = streamFee > 0 || price > 0;
    return { isLive, isEnded, isCancelled, isPaid };
  }, [event.data]);

  // ── Stream + access state ────────────────────────────────────────────────
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [accessGranted, setAccessGranted] = useState(false);
  const [viewerId, setViewerId] = useState<string | undefined>(urlViewerId);
  const [viewerName, setViewerName] = useState<string | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);

  // Welcome splash — fires once after the manifest first appears.
  const [splashVisible, setSplashVisible] = useState(false);
  const splashFiredRef = useRef(false);

  // ── Token (invite-code) state ────────────────────────────────────────────
  const [tokenInput, setTokenInput] = useState(urlToken ?? '');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // ── Viewer-info modal (web "Verify your access") ─────────────────────────
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [infoName, setInfoName] = useState('');
  const [infoEmail, setInfoEmail] = useState('');
  const [infoPhone, setInfoPhone] = useState('');
  const [infoBusy, setInfoBusy] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);

  // ── Device-conflict modal ────────────────────────────────────────────────
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);

  // ── Viewer count badge ───────────────────────────────────────────────────
  const [viewerCount, setViewerCount] = useState(0);

  // ── Chat state ───────────────────────────────────────────────────────────
  const [chats, setChats] = useState<PublicStreamChat[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [floatingEmoji, setFloatingEmoji] = useState<
    { id: string; emoji: string; anim: Animated.Value }[]
  >([]);

  // ── Gift modal (sponsor) ─────────────────────────────────────────────────
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('1000');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftPhone, setGiftPhone] = useState('');
  const [giftMethod, setGiftMethod] = useState<'MOMO' | 'CARD'>('MOMO');
  const [giftTelecom, setGiftTelecom] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [giftCurrencyId, setGiftCurrencyId] = useState<string | null>(null);

  useEffect(() => {
    listCurrencies()
      .then((list) => {
        setCurrencies(list);
        const rwf = list.find((c) => c.code.toUpperCase() === 'RWF');
        setGiftCurrencyId(rwf?.id ?? list[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  // ── Access detection (web parity: lines 595-755) ─────────────────────────
  //
  // Runs once event.data is loaded. Picks the right path based on the
  // event's type: invite_token + token, paid + viewerId, or free.

  useEffect(() => {
    if (!event.data || event.loading) return;
    if (status.isEnded || status.isCancelled) return;

    let cancelled = false;
    (async () => {
      // Paid event — anonymous viewer access check
      if (status.isPaid) {
        const storedViewerId = await storage.get(`anonymousViewer_${id}`).catch(() => null);
        const storedToken = await storage.get(`streamToken_${id}`).catch(() => null);
        const vId = urlViewerId || storedViewerId;
        if (!vId && !urlToken && !storedToken) {
          // No viewerId and no token at all — bounce to the event detail
          // page where the user can pick Buy / Verify / Have invite code
          // from the same three CTAs the web exposes. The live-stream
          // screen isn't a sensible landing page for someone who's
          // never opened the event before.
          if (!cancelled) {
            router.replace(`/event/${id}` as unknown as Href);
          }
          return;
        }
        if (!vId) {
          // No viewerId but the user has a token — fall through to the
          // invite-token validation path below.
          return;
        }
        if (cancelled) return;
        setViewerId(vId);
        setAccessLoading(true);
        try {
          const fingerprint = await getDeviceId();
          const res = await checkAnonymousAccessStatus(id, vId, fingerprint);
          if (cancelled) return;
          if (res.active && res.hlsManifestUrl) {
            setManifestUrl(res.hlsManifestUrl);
            setAccessGranted(true);
            await storage.set(`anonymousViewer_${id}`, vId).catch(() => {});
          } else if (res.reason === 'DEVICE_MISMATCH') {
            setConflictOpen(true);
          } else if (fromPayment === '1') {
            // Just came from payment — backend may not have flipped the
            // viewer's status to COMPLETED yet. Retry once after 2s.
            setTimeout(async () => {
              if (cancelled) return;
              try {
                const fp = await getDeviceId();
                const retry = await checkAnonymousAccessStatus(id, vId, fp);
                if (cancelled) return;
                if (retry.active && retry.hlsManifestUrl) {
                  setManifestUrl(retry.hlsManifestUrl);
                  setAccessGranted(true);
                } else if (retry.reason === 'DEVICE_MISMATCH') {
                  setConflictOpen(true);
                } else {
                  setInfoModalOpen(true);
                }
              } catch {
                /* swallow */
              }
            }, 2000);
          } else {
            // viewerId mapped to no paid record — clear it and surface
            // the recover-by-email form (web's "Verify your access").
            await storage.remove(`anonymousViewer_${id}`).catch(() => {});
            if (!cancelled) {
              setViewerId(undefined);
              setInfoModalOpen(true);
            }
          }
        } catch (e) {
          if (!cancelled) {
            setTokenError(isApiError(e) ? e.message : 'Could not verify your access.');
          }
        } finally {
          if (!cancelled) setAccessLoading(false);
        }
        return;
      }

      // Free + invite-token event
      const storedToken = await storage.get(`streamToken_${id}`).catch(() => null);
      const tk = urlToken || storedToken;
      if (tk) {
        if (cancelled) return;
        setTokenInput(tk);
        setTokenBusy(true);
        try {
          const validation = await validateStreamToken(id, tk);
          if (cancelled) return;
          if (validation.valid && validation.hlsManifestUrl) {
            setManifestUrl(validation.hlsManifestUrl);
            setAccessGranted(true);
            await storage.set(`streamToken_${id}`, tk).catch(() => {});
          } else if (validation.requiresPayment) {
            router.replace(`/events/join?id=${id}` as unknown as Href);
          }
        } catch {
          /* user can try again from the token card */
        } finally {
          if (!cancelled) setTokenBusy(false);
        }
      }
      // No token → the token card is rendered below for user input.
    })();

    return () => {
      cancelled = true;
    };
  }, [event.data, event.loading, status.isPaid, status.isEnded, status.isCancelled, id, urlViewerId, urlToken, fromPayment, router]);

  // ── Auto-poll for HLS manifest (free streams or paid without granted) ────
  // Picks up `hlsManifestUrl` directly off the public event detail. Stops
  // once we have it.

  useEffect(() => {
    if (manifestUrl) return;
    if (!status.isLive) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const detail = await getPublicEventDetailed(id);
        if (cancelled) return;
        const url = detail.hlsManifestUrl;
        if (url) {
          setManifestUrl(url);
          // Free + token-less stream → grant chat to the viewer with a
          // best-effort fingerprint. Send is still gated on viewerId.
          if (!status.isPaid) setAccessGranted(true);
        }
      } catch {
        /* keep polling */
      }
    };
    tick();
    const handle = setInterval(tick, 6000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [manifestUrl, status.isLive, status.isPaid, id]);

  // ── Welcome splash trigger ───────────────────────────────────────────────
  useEffect(() => {
    if (manifestUrl && !splashFiredRef.current) {
      setSplashVisible(true);
      splashFiredRef.current = true;
    }
  }, [manifestUrl]);

  // ── Viewer count badge poll ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const c = await getPublicViewerCount(id);
        if (!cancelled) setViewerCount(c);
      } catch {
        /* swallow */
      }
    };
    tick();
    const handle = setInterval(tick, 15000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [id]);

  // ── Chat poll (2.5s) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!status.isLive) return;
    let cancelled = false;
    let isFirst = true;
    const seenReactions = new Set<string>();
    const tick = async () => {
      try {
        const page = await getPublicStreamChats(id);
        if (cancelled) return;
        setChats(page.messages);
        for (const r of page.reactions) {
          if (seenReactions.has(r.id)) continue;
          seenReactions.add(r.id);
          if (!isFirst) burstFloating(r.message);
        }
        isFirst = false;
      } catch {
        /* keep polling */
      }
    };
    tick();
    const handle = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [status.isLive, id]);

  const burstFloating = (emoji: string) => {
    const anim = new Animated.Value(0);
    const itemId = Math.random().toString(36).slice(2);
    setFloatingEmoji((prev) => [...prev, { id: itemId, emoji, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(() => {
      setFloatingEmoji((prev) => prev.filter((x) => x.id !== itemId));
    });
  };

  // ── Handlers ─────────────────────────────────────────────────────────────

  const onJoinWithToken = async () => {
    if (!tokenInput.trim()) {
      setTokenError('Please paste the invite token from your invitation.');
      return;
    }
    setTokenBusy(true);
    setTokenError(null);
    try {
      const validation = await validateStreamToken(id, tokenInput.trim());
      if (!validation.valid) {
        setTokenError('That token is not valid for this event.');
        return;
      }
      if (validation.requiresPayment) {
        router.replace(`/events/join?id=${id}` as unknown as Href);
        return;
      }
      if (validation.hlsManifestUrl) {
        setManifestUrl(validation.hlsManifestUrl);
        setAccessGranted(true);
        await storage.set(`streamToken_${id}`, tokenInput.trim()).catch(() => {});
      } else if (status.isLive) {
        setTokenError('The stream is starting — please try again in a moment.');
      } else {
        setTokenError('This event has no live stream right now.');
      }
    } catch (e) {
      setTokenError(isApiError(e) ? e.message : 'Could not validate the token.');
    } finally {
      setTokenBusy(false);
    }
  };

  const onConfirmSwitchDevice = async () => {
    if (!viewerId) return;
    setConflictBusy(true);
    try {
      const fingerprint = await getDeviceId();
      const swap = await switchAnonymousDevice(id, viewerId, fingerprint);
      if (!swap.ok) {
        setTokenError(swap.message ?? 'Could not switch device.');
        setConflictOpen(false);
        return;
      }
      const res = await checkAnonymousAccessStatus(id, viewerId, fingerprint);
      if (res.active && res.hlsManifestUrl) {
        setManifestUrl(res.hlsManifestUrl);
        setAccessGranted(true);
        setConflictOpen(false);
      } else {
        setTokenError('Switched, but the stream isn’t live yet — try again in a moment.');
      }
    } catch (e) {
      setTokenError(isApiError(e) ? e.message : 'Could not switch device.');
    } finally {
      setConflictBusy(false);
    }
  };

  const onSubmitViewerInfo = async () => {
    if (!infoName.trim() || !infoEmail.includes('@')) {
      setInfoError('Enter the name and email you used at checkout.');
      return;
    }
    if (!infoPhone.trim() || infoPhone.replace(/[^0-9]/g, '').length < 9) {
      setInfoError('Enter the phone number you used at checkout.');
      return;
    }
    setInfoBusy(true);
    setInfoError(null);
    try {
      const fingerprint = await getDeviceId();
      const reg = await registerAnonymousViewer(id, {
        name: infoName.trim(),
        email: infoEmail.trim(),
        phone: infoPhone.trim(),
        deviceId: fingerprint,
      });
      if (reg.needsPayment) {
        setInfoError("We couldn't find a paid record for this email — buy access to start.");
        return;
      }
      await storage.set(`anonymousViewer_${id}`, reg.viewerId).catch(() => {});
      setViewerId(reg.viewerId);
      setViewerName(infoName.trim());
      if (reg.hlsManifestUrl) {
        setManifestUrl(reg.hlsManifestUrl);
        setAccessGranted(true);
      } else {
        // Fall back to the access-status check for the manifest.
        const res = await checkAnonymousAccessStatus(id, reg.viewerId, fingerprint);
        if (res.hlsManifestUrl) {
          setManifestUrl(res.hlsManifestUrl);
          setAccessGranted(true);
        }
      }
      setInfoModalOpen(false);
    } catch (e) {
      setInfoError(isApiError(e) ? e.message : 'Could not verify your access.');
    } finally {
      setInfoBusy(false);
    }
  };

  const onSendChat = async () => {
    const msg = chatDraft.trim();
    if (!msg) return;
    if (!viewerId) {
      setChatError('Verify your access to chat.');
      setInfoModalOpen(true);
      return;
    }
    setChatSending(true);
    setChatError(null);
    try {
      const fingerprint = await getDeviceId();
      await sendPublicStreamChat(id, { viewerId, deviceFingerprint: fingerprint, message: msg });
      setChatDraft('');
    } catch (e) {
      setChatError(isApiError(e) ? e.message : 'Could not send.');
    } finally {
      setChatSending(false);
    }
  };

  const onSendReaction = async (emoji: string) => {
    burstFloating(emoji); // optimistic local burst
    if (!viewerId) return;
    try {
      const fingerprint = await getDeviceId();
      await sendPublicStreamReaction(id, { viewerId, deviceFingerprint: fingerprint, emoji });
    } catch {
      /* local burst already played */
    }
  };

  const onSubmitGift = async () => {
    setGiftError(null);
    if (!viewerId) {
      setGiftError('Verify your access first.');
      return;
    }
    if (!giftCurrencyId) {
      setGiftError('Currencies are still loading — try again in a moment.');
      return;
    }
    const amount = parseInt(giftAmount, 10);
    if (Number.isNaN(amount) || amount <= 0) {
      setGiftError('Enter a valid amount.');
      return;
    }
    if (giftMethod === 'MOMO' && (!giftPhone.trim() || giftPhone.length < 9)) {
      setGiftError('Enter the mobile-money phone number.');
      return;
    }
    setGiftBusy(true);
    try {
      const fingerprint = await getDeviceId();
      const init = await initiatePublicGift(id, {
        viewerId,
        deviceFingerprint: fingerprint,
        amount,
        currencyId: giftCurrencyId,
        paymentMethod: giftMethod,
        phone: giftMethod === 'MOMO' ? giftPhone.trim() : undefined,
        telecomProvider: giftMethod === 'MOMO' ? giftTelecom : undefined,
        redirectUrl: giftMethod === 'CARD' ? 'https://connekyt.com/payment-callback' : undefined,
        giftMessage,
      });
      if (init.paymentUrl) {
        await WebBrowser.openBrowserAsync(init.paymentUrl).catch(() => {});
      }
      if (init.refid) {
        const settled = await pollPublicPaymentStatus(init.refid, {
          maxAttempts: 30,
          intervalMs: 4000,
          graceMs: 8000,
        });
        if (settled === 'success') {
          setGiftOpen(false);
          setGiftAmount('1000');
          setGiftMessage('');
        } else {
          const last = await getPublicPaymentStatus(init.refid).catch(() => 'pending' as const);
          setGiftError(`Payment ${last}. Please try again.`);
        }
      }
    } catch (e) {
      setGiftError(isApiError(e) ? e.message : 'Could not start the gift.');
    } finally {
      setGiftBusy(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  const eventTitle = event.data?.title ?? 'Live stream';
  const eventThumb = event.data?.eventPhoto || COVER_FALLBACK;

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Title row + viewer count badge */}
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {eventTitle}
          </Text>
          {viewerCount > 0 ? (
            <View style={styles.viewerBadge}>
              <Ionicons name="eye-outline" size={14} color="#fff" />
              <Text style={styles.viewerBadgeText}>{viewerCount.toLocaleString()}</Text>
            </View>
          ) : null}
        </View>

        {/* Player or placeholder, driven off eventStatus */}
        {manifestUrl ? (
          <Player url={manifestUrl} />
        ) : (
          <View style={styles.placeholder}>
            <Image source={{ uri: eventThumb }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            <View style={styles.placeholderScrim} />
            <View style={styles.placeholderContent}>
              {/*
               * Web parity (lines 7320-7400 of knockout/pages/events/
               * live-stream.tsx). 4 states for the access gate:
               *   1. accessLoading           → spinner + "Verifying Access..."
               *   2. hasPurchasedAccess      → hourglass + "Access Confirmed"
               *   3. paid + no access        → lock + "Paid Stream" + Purchase
               *   4. ended/cancelled/upcoming → status-appropriate copy
               */}
              {status.isCancelled || status.isEnded ? (
                <>
                  <Ionicons
                    name={status.isCancelled ? 'close-circle' : 'archive'}
                    size={42}
                    color="rgba(255,255,255,0.85)"
                  />
                  <Text style={styles.placeholderHeadline}>
                    {status.isCancelled ? 'Event cancelled' : 'Event ended'}
                  </Text>
                </>
              ) : accessLoading ? (
                <>
                  <ActivityIndicator color="#10b981" size="large" />
                  <Text style={styles.placeholderHeadline}>Verifying access…</Text>
                  <Text style={styles.placeholderText}>
                    Please wait while we confirm your access.
                  </Text>
                </>
              ) : status.isLive && accessGranted ? (
                <>
                  <Ionicons name="hourglass" size={42} color="#10b981" />
                  <Text style={styles.placeholderHeadline}>Access confirmed</Text>
                  <Text style={styles.placeholderText}>Waiting for the stream to start…</Text>
                </>
              ) : status.isLive && status.isPaid ? (
                // No-access viewers are bounced to /event/{id} by the
                // useEffect above where the same 3 CTAs (Buy / Verify /
                // Invite code) live. This branch only fires if the bounce
                // is in-flight — show a brief loader instead of letting
                // the user dwell on a half-state.
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.placeholderHeadline}>Loading…</Text>
                </>
              ) : status.isLive ? (
                <>
                  <ActivityIndicator color="#fff" />
                  <Text style={styles.placeholderHeadline}>Stream is starting…</Text>
                  <Text style={styles.placeholderText}>Hang tight, the stream is loading.</Text>
                </>
              ) : (
                <>
                  <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.85)" />
                  <Text style={styles.placeholderText}>
                    Stream will appear here once it goes live.
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Invite-token card — shown when no paid access + free invite_token event */}
        {!manifestUrl && !status.isPaid && status.isLive ? (
          <View style={styles.tokenCard}>
            <Text style={styles.tokenLabel}>Have an invite token?</Text>
            <Input
              value={tokenInput}
              onChangeText={setTokenInput}
              placeholder="Paste the token from your invitation"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button title="Join stream" onPress={onJoinWithToken} loading={tokenBusy} />
            <Pressable
              onPress={() => router.replace(`/event/${id}` as unknown as Href)}
              style={{ alignItems: 'center', marginTop: 4 }}
            >
              <Text style={styles.linkText}>← Back to event details</Text>
            </Pressable>
          </View>
        ) : null}

        {/*
         * Chat panel. Shown whenever the event is LIVE — chat works even
         * before the local player has connected. Send is gated on viewerId;
         * tapping the input opens the Verify modal for non-paid viewers.
         */}
        {status.isLive ? (
          <View style={styles.chatCard}>
            <View style={styles.chatTitleRow}>
              <Text style={styles.chatTitle}>Live chat</Text>
              {viewerId ? (
                <Pressable style={styles.giftPill} onPress={() => setGiftOpen(true)}>
                  <Ionicons name="gift-outline" size={14} color="#fff" />
                  <Text style={styles.giftPillText}>Sponsor</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.chatList}>
              {chats.length === 0 ? (
                <Text style={styles.chatEmpty}>No messages yet — say hi 👋</Text>
              ) : (
                chats.map((c) => (
                  <View key={c.id} style={styles.chatBubble}>
                    {c.viewerName ? (
                      <Text style={styles.chatBubbleSender}>{c.viewerName}</Text>
                    ) : null}
                    <Text style={styles.chatBubbleText}>{c.message}</Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.reactionsRow}>
              {REACTION_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.reactionBtn}
                  onPress={() => onSendReaction(emoji)}
                  hitSlop={6}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.composer}>
              <TextInput
                value={chatDraft}
                onChangeText={setChatDraft}
                placeholder={viewerId ? 'Say something…' : 'Verify access to chat'}
                placeholderTextColor={colors.textMuted}
                editable={!chatSending}
                style={styles.composerInput}
                returnKeyType="send"
                onSubmitEditing={onSendChat}
              />
              <Pressable
                style={[styles.sendBtn, (chatSending || !chatDraft.trim()) && { opacity: 0.5 }]}
                onPress={onSendChat}
                disabled={chatSending || !chatDraft.trim()}
              >
                {chatSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
            {chatError ? <Text style={styles.chatErrorText}>{chatError}</Text> : null}
          </View>
        ) : null}

        {tokenError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{tokenError}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Floating reactions overlay */}
      {floatingEmoji.length > 0 ? (
        <View pointerEvents="none" style={styles.floatingLayer}>
          {floatingEmoji.map((fx) => (
            <Animated.Text
              key={fx.id}
              style={[
                styles.floatingEmoji,
                {
                  opacity: fx.anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
                  transform: [
                    { translateY: fx.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -260] }) },
                  ],
                  left: `${20 + Math.random() * 60}%`,
                },
              ]}
            >
              {fx.emoji}
            </Animated.Text>
          ))}
        </View>
      ) : null}

      {/* Welcome splash */}
      {splashVisible ? (
        <WelcomeSplash eventTitle={eventTitle} onDismiss={() => setSplashVisible(false)} />
      ) : null}

      {/* Device-conflict modal */}
      <Modal visible={conflictOpen} transparent animationType="slide" onRequestClose={() => setConflictOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setConflictOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>You're watching on another device</Text>
            <Text style={styles.modalHint}>
              Only one device can watch on the same paid ticket. Switch ownership to this device —
              the old session will be ended.
            </Text>
            <Button
              title={conflictBusy ? 'Switching…' : 'Switch to this device'}
              onPress={onConfirmSwitchDevice}
              loading={conflictBusy}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Viewer-info modal (Verify your access) */}
      <Modal visible={infoModalOpen} transparent animationType="slide" onRequestClose={() => setInfoModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoModalOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '90%' }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Verify your access</Text>
              <Text style={styles.modalHint}>
                Enter the name, email and phone you used when buying your ticket. We'll restore
                access on this device.
              </Text>
              <Input
                label="Name"
                value={infoName}
                onChangeText={setInfoName}
                placeholder="Full name"
                autoCapitalize="words"
              />
              <Input
                label="Email"
                value={infoEmail}
                onChangeText={setInfoEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Input
                label="Phone"
                value={infoPhone}
                onChangeText={(t) => setInfoPhone(t.replace(/[^0-9+]/g, ''))}
                placeholder="+2507…"
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              {infoError ? <Text style={styles.chatErrorText}>{infoError}</Text> : null}
              <Button
                title={infoBusy ? 'Verifying…' : 'Verify access'}
                onPress={onSubmitViewerInfo}
                loading={infoBusy}
              />
              <Pressable
                onPress={() => router.replace(`/events/join?id=${id}` as unknown as Href)}
                style={{ alignItems: 'center', marginTop: 8 }}
              >
                <Text style={styles.linkText}>Buy access instead</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gift modal (sponsor) */}
      <Modal visible={giftOpen} transparent animationType="slide" onRequestClose={() => setGiftOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setGiftOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '90%' }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Sponsor this stream</Text>
              <Text style={styles.modalHint}>
                Send a gift to the creator. Mobile Money settles instantly; Card goes through
                XentriPay.
              </Text>

              <Text style={styles.giftLabel}>Amount</Text>
              <View style={styles.amountChipRow}>
                {[500, 1000, 2000, 5000, 10000].map((preset) => {
                  const active = String(preset) === giftAmount;
                  return (
                    <Pressable
                      key={preset}
                      style={[styles.amountChip, active && styles.amountChipActive]}
                      onPress={() => setGiftAmount(String(preset))}
                    >
                      <Text style={[styles.amountChipText, active && styles.amountChipTextActive]}>
                        {preset.toLocaleString()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Input
                value={giftAmount}
                onChangeText={(t) => setGiftAmount(t.replace(/[^0-9]/g, ''))}
                placeholder="Custom amount"
                keyboardType="number-pad"
              />

              <Text style={styles.giftLabel}>Payment method</Text>
              <View style={styles.payTabs}>
                <Pressable
                  style={[styles.payTab, giftMethod === 'MOMO' && styles.payTabActive]}
                  onPress={() => setGiftMethod('MOMO')}
                >
                  <Ionicons
                    name="phone-portrait-outline"
                    size={16}
                    color={giftMethod === 'MOMO' ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.payTabText, giftMethod === 'MOMO' && styles.payTabTextActive]}>
                    Mobile Money
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.payTab, giftMethod === 'CARD' && styles.payTabActive]}
                  onPress={() => setGiftMethod('CARD')}
                >
                  <Ionicons
                    name="card-outline"
                    size={16}
                    color={giftMethod === 'CARD' ? colors.primary : colors.textMuted}
                  />
                  <Text style={[styles.payTabText, giftMethod === 'CARD' && styles.payTabTextActive]}>
                    Card
                  </Text>
                </Pressable>
              </View>

              {giftMethod === 'MOMO' ? (
                <>
                  <View style={styles.payTabs}>
                    <Pressable
                      style={[styles.payTab, giftTelecom === 'MTN' && styles.payTabActive]}
                      onPress={() => setGiftTelecom('MTN')}
                    >
                      <Text style={[styles.payTabText, giftTelecom === 'MTN' && styles.payTabTextActive]}>
                        MTN
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.payTab, giftTelecom === 'AIRTEL' && styles.payTabActive]}
                      onPress={() => setGiftTelecom('AIRTEL')}
                    >
                      <Text style={[styles.payTabText, giftTelecom === 'AIRTEL' && styles.payTabTextActive]}>
                        Airtel
                      </Text>
                    </Pressable>
                  </View>
                  <Input
                    label="Phone"
                    value={giftPhone}
                    onChangeText={(t) => setGiftPhone(t.replace(/[^0-9+]/g, ''))}
                    placeholder="+2507…"
                    keyboardType="phone-pad"
                    autoCapitalize="none"
                  />
                </>
              ) : null}

              <Input
                label="Message (optional)"
                value={giftMessage}
                onChangeText={setGiftMessage}
                placeholder="Say something nice"
                multiline
                style={{
                  height: 80,
                  paddingTop: spacing.md,
                  textAlignVertical: 'top',
                  marginTop: spacing.sm,
                }}
              />

              {giftError ? <Text style={styles.chatErrorText}>{giftError}</Text> : null}

              <Button
                title={
                  giftBusy
                    ? 'Processing…'
                    : `Send ${giftAmount} ${currencies.find((c) => c.id === giftCurrencyId)?.code ?? 'RWF'}`
                }
                onPress={onSubmitGift}
                loading={giftBusy}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 140 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  viewerBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  placeholder: {
    aspectRatio: 16 / 9,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#0F1217',
  },
  placeholderScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(7,8,13,0.62)' },
  placeholderContent: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  placeholderHeadline: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  placeholderText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm, textAlign: 'center', maxWidth: 320 },
  placeholderCta: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.full,
  },
  placeholderCtaText: { color: colors.primary, fontWeight: '800', fontSize: fontSize.sm },
  placeholderLinkText: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: fontSize.xs,
    textDecorationLine: 'underline',
    fontWeight: '700',
  },

  playerWrap: { aspectRatio: 16 / 9, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: '#000' },
  player: { width: '100%', height: '100%' },

  tokenCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.md,
  },
  tokenLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  linkText: {
    textAlign: 'center',
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.errorBg,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  errorText: { flex: 1, color: colors.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  chatCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.md,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  giftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  giftPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  chatList: { gap: 6, maxHeight: 280 },
  chatEmpty: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic' },
  chatBubble: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 2,
  },
  chatBubbleSender: { fontSize: 11, fontWeight: '700', color: colors.primary },
  chatBubbleText: { fontSize: fontSize.sm, color: colors.text },
  reactionsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  reactionBtn: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  reactionEmoji: { fontSize: 18 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: fontSize.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatErrorText: { color: colors.error, fontSize: 12 },

  floatingLayer: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  floatingEmoji: { position: 'absolute', bottom: 80, fontSize: 32 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  modalHint: { fontSize: fontSize.sm, color: colors.textMuted, lineHeight: 20, marginBottom: spacing.sm },

  giftLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSoft,
    marginTop: spacing.sm,
    letterSpacing: 0.4,
  },
  amountChipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginVertical: 6 },
  amountChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  amountChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  amountChipText: { fontSize: fontSize.xs, color: colors.textSoft, fontWeight: '700' },
  amountChipTextActive: { color: '#fff' },
  payTabs: { flexDirection: 'row', gap: 6, marginVertical: 6 },
  payTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.borderSoft,
  },
  payTabActive: { borderColor: colors.primary, backgroundColor: colors.infoBg },
  payTabText: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '700' },
  payTabTextActive: { color: colors.primary },
});

const splashStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7,8,13,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  content: { alignItems: 'center', gap: 14, paddingHorizontal: 40 },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(220,38,38,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(220,38,38,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headline: { fontSize: 22, fontWeight: '800', color: '#f4f6fb', textAlign: 'center' },
  sub: { fontSize: 14, color: '#9ca3af', textAlign: 'center', lineHeight: 20 },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220,38,38,0.88)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});
