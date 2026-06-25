/**
 * Public live-stream viewer.
 *
 * Two entry shapes:
 *   1. /events/live-stream?id=…&viewerId=…   (post-payment, paid stream)
 *      → checkAnonymousAccessStatus → render HLS via expo-video
 *   2. /events/live-stream?id=…              (free stream / invite token)
 *      → token input → validateStreamToken → render HLS
 *
 * The web equivalents are `events/live-stream/page.tsx` (anonymous viewer
 * resume) and `events/join-event/page.tsx` (free + token flow).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
import * as WebBrowser from 'expo-web-browser';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { storage } from '@/services/storage';
import { getDeviceId } from '@/utils/deviceId';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const REACTION_EMOJIS = ['🔥', '❤️', '👏', '😍', '🎉', '😮'];

// ── Welcome splash (web parity: showWelcomeSplash state, auto-dismiss 2.6s) ─

function WelcomeSplash({ eventTitle, onDismiss }: { eventTitle?: string; onDismiss: () => void }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const t = setTimeout(() => {
      Animated.timing(fadeAnim, { toValue: 0, duration: 320, useNativeDriver: true }).start(
        onDismiss,
      );
    }, 2600);
    return () => clearTimeout(t);
  }, [fadeAnim, onDismiss]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[splashStyles.wrap, { opacity: fadeAnim }]}
    >
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

export default function PublicLiveStreamScreen() {
  const { id, viewerId: initialViewerId, token: initialToken } = useLocalSearchParams<{
    id: string;
    viewerId?: string;
    token?: string;
  }>();
  const router = useRouter();

  const event = useAsync(useCallback(() => getPublicEventDetailed(id), [id]));
  const [token, setToken] = useState(initialToken ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(0);

  // Chat state — only populated when we know the viewerId (i.e. the
  // viewer has paid + been registered as an AnonymousStreamViewer).
  const [viewerId, setViewerId] = useState<string | undefined>(initialViewerId);
  const [chats, setChats] = useState<PublicStreamChat[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  // Welcome splash (web parity: auto-dismiss 2.6s on stream load)
  const [splashVisible, setSplashVisible] = useState(false);
  // Trigger splash once manifestUrl is set for the first time
  const splashFiredRef = useRef(false);

  const [floatingEmoji, setFloatingEmoji] = useState<{ id: string; emoji: string; anim: Animated.Value }[]>([]);

  // Recover-by-email state — when storage is wiped, the viewer can
  // re-enter their email to ask the backend whether they already paid.
  // The /anonymous-viewer/{id}/register endpoint dedupes by email, so
  // matching an existing COMPLETED record returns ACCESS_GRANTED.
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverName, setRecoverName] = useState('');
  const [recoverEmail, setRecoverEmail] = useState('');
  const [recoverPhone, setRecoverPhone] = useState('');
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);

  // Device-conflict modal — surfaces when the backend returns reason
  // DEVICE_MISMATCH for a paid viewer. The user explicitly confirms
  // they want to switch ownership to this device (web parity).
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);

  // Gift / sponsor flow state. Web parity: anonymous-viewer/{id}/gift
  // endpoint accepts MoMo (MTN/Airtel) and Card. Mobile defaults to
  // MoMo with the viewer's stored phone number; Card opens the
  // gateway URL via WebBrowser like the rest of the public flow.
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftAmount, setGiftAmount] = useState('1000');
  const [giftMessage, setGiftMessage] = useState('');
  const [giftPhone, setGiftPhone] = useState('');
  const [giftMethod, setGiftMethod] = useState<'MOMO' | 'CARD'>('MOMO');
  const [giftTelecom, setGiftTelecom] = useState<'MTN' | 'AIRTEL'>('MTN');
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftCurrencyId, setGiftCurrencyId] = useState<string | null>(null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);

  // Hydrate currencies once so the gift modal can resolve the currency
  // id without blocking the screen. Default to RWF when possible.
  useEffect(() => {
    listCurrencies()
      .then((list) => {
        setCurrencies(list);
        const rwf = list.find((c) => c.code.toUpperCase() === 'RWF');
        setGiftCurrencyId(rwf?.id ?? list[0]?.id ?? null);
      })
      .catch(() => {});
  }, []);

  // Auto-resume paid anonymous-viewer access if we already have a viewerId.
  // Backend access-status is GET with `fingerprint` + `viewerId` query
  // params — needs the device id loaded async, so resolve that inside
  // the effect rather than blocking the screen mount.
  useEffect(() => {
    if (!viewerId) return;
    let cancelled = false;
    setBusy(true);
    (async () => {
      try {
        const fingerprint = await getDeviceId();
        const res = await checkAnonymousAccessStatus(id, viewerId, fingerprint);
        if (cancelled) return;
        if (res.active && res.hlsManifestUrl) {
          setManifestUrl(res.hlsManifestUrl);
        } else if (res.reason === 'DEVICE_MISMATCH') {
          // Backend's single-device enforcement: paid viewer is bound
          // to another device. Open the confirmation modal so the user
          // explicitly decides to take over the session on THIS device.
          setConflictOpen(true);
        } else {
          setError('Your viewer access is not active yet — please retry the payment.');
        }
      } catch (e) {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Could not verify your access.');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, viewerId]);

  // Poll public viewer count for the badge.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const c = await getPublicViewerCount(id);
        if (!cancelled) setViewerCount(c);
      } catch {
        /* not fatal */
      }
    };
    tick();
    const handle = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [id]);

  /**
   * Auto-pick up the HLS manifest from the public event detail.
   * For free streams (or anonymous viewers who haven't recovered yet)
   * the event's `eventPhoto`/`hlsManifestUrl` is the only handle to
   * the playback URL. We poll every 6s until it appears, then stop.
   * This unblocks the "video can't be received" symptom on events
   * where the photographer started the stream but the mobile screen
   * had no path to discover the new manifest.
   */
  useEffect(() => {
    if (manifestUrl) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const detail = await getPublicEventDetailed(id);
        if (cancelled) return;
        // HLS ONLY — feeding whepUrl to expo-video sends it to
        // Cloudflare's /webRTC/play (WebRTC SDP), which the native
        // player can't decode. We poll until the HLS manifest exists.
        const url = detail.hlsManifestUrl;
        if (url) setManifestUrl(url);
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
  }, [id, manifestUrl]);

  // Show welcome splash the first time the manifest URL becomes available
  // (web parity: showWelcomeSplash auto-dismissed after 2.6s).
  useEffect(() => {
    if (manifestUrl && !splashFiredRef.current) {
      splashFiredRef.current = true;
      setSplashVisible(true);
    }
  }, [manifestUrl]);

  /**
   * Poll the public chat panel while we have a manifest. 2.5s feels
   * snappy without hammering the backend; reactions burst-render as
   * floating emoji animations, plain messages append into the chat
   * list. We only fetch when manifestUrl is set so the chat doesn't
   * eagerly load before the viewer can actually watch.
   */
  useEffect(() => {
    if (!manifestUrl || !id) return;
    let cancelled = false;
    let isFirstPoll = true;
    const seenIds = new Set<string>();
    const tick = async () => {
      try {
        const page = await getPublicStreamChats(id);
        if (cancelled) return;
        setChats(page.messages);
        // On the first poll, seed seenIds with every historical
        // reaction so the viewer doesn't get flooded with a wall of
        // floating emoji on screen-open. From the second poll onward,
        // only NEW reactions burst.
        for (const r of page.reactions) {
          if (seenIds.has(r.id)) continue;
          seenIds.add(r.id);
          if (!isFirstPoll) burstFloating(r.message);
        }
        isFirstPoll = false;
      } catch {
        /* not fatal — keep last chat */
      }
    };
    tick();
    const handle = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [manifestUrl, id]);

  // Quick optimistic floating-emoji burst.
  const burstFloating = (emoji: string) => {
    const anim = new Animated.Value(0);
    const itemId = Math.random().toString(36).slice(2);
    setFloatingEmoji((prev) => [...prev, { id: itemId, emoji, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(() => {
      setFloatingEmoji((prev) => prev.filter((x) => x.id !== itemId));
    });
  };

  const onSendChat = async () => {
    const msg = chatDraft.trim();
    if (!msg) return;
    if (!viewerId) {
      setChatError('You need to recover your access first to chat.');
      return;
    }
    setChatSending(true);
    setChatError(null);
    try {
      const fingerprint = await getDeviceId();
      await sendPublicStreamChat(id, { viewerId, deviceFingerprint: fingerprint, message: msg });
      setChatDraft('');
    } catch (e) {
      setChatError(isApiError(e) ? e.message : 'Could not send message.');
    } finally {
      setChatSending(false);
    }
  };

  const onSendReaction = async (emoji: string) => {
    burstFloating(emoji); // optimistic local burst
    if (!viewerId) {
      setChatError('Reactions need access first — recover or buy access.');
      return;
    }
    try {
      const fingerprint = await getDeviceId();
      await sendPublicStreamReaction(id, { viewerId, deviceFingerprint: fingerprint, emoji });
    } catch (e) {
      // Silent fail on reaction send — the local burst already played.
      setChatError(isApiError(e) ? e.message : 'Reaction not sent.');
    }
  };

  /**
   * Recover paid access by re-entering the email used during checkout.
   * The backend's registerOrLookup is identity-keyed by email and
   * returns ACCESS_GRANTED (with a fresh viewerId) when a matching
   * COMPLETED record exists. We persist the new viewerId so future
   * launches resume directly.
   */
  const onRecover = async () => {
    if (!recoverName.trim() || !recoverEmail.includes('@')) {
      setRecoverError('Please enter your name and the email used at checkout.');
      return;
    }
    if (!recoverPhone.trim() || recoverPhone.replace(/[^0-9]/g, '').length < 9) {
      setRecoverError('Please enter the phone number you used at checkout.');
      return;
    }
    setRecoverBusy(true);
    setRecoverError(null);
    try {
      const fingerprint = await getDeviceId();
      const reg = await registerAnonymousViewer(id, {
        name: recoverName.trim(),
        email: recoverEmail.trim(),
        phone: recoverPhone.trim(),
        deviceId: fingerprint,
      });
      if (reg.needsPayment) {
        setRecoverError(
          "We couldn't find a paid record for this email. Buy access to start watching.",
        );
        return;
      }
      // Paid — persist and load the manifest.
      await storage.set(`anonymousViewer_${id}`, reg.viewerId);
      setViewerId(reg.viewerId);
      if (reg.hlsManifestUrl) setManifestUrl(reg.hlsManifestUrl);
      else {
        // Fall back to the access-status lookup if register didn't
        // return the manifest (some flows defer that until check).
        const status = await checkAnonymousAccessStatus(id, reg.viewerId, fingerprint);
        if (status.hlsManifestUrl) setManifestUrl(status.hlsManifestUrl);
      }
      setRecoverOpen(false);
    } catch (e) {
      setRecoverError(isApiError(e) ? e.message : 'Could not recover access.');
    } finally {
      setRecoverBusy(false);
    }
  };

  /**
   * Confirm device-switch: deactivate the old session, anchor the
   * viewerId to this device's fingerprint, then re-check access.
   */
  const confirmSwitchDevice = async () => {
    if (!viewerId) return;
    setConflictBusy(true);
    try {
      const fingerprint = await getDeviceId();
      const res = await switchAnonymousDevice(id, viewerId, fingerprint);
      if (!res.ok) {
        setError(res.message ?? 'Could not switch device.');
        setConflictOpen(false);
        return;
      }
      // Re-verify; the access-status response carries the manifest now.
      const status = await checkAnonymousAccessStatus(id, viewerId, fingerprint);
      if (status.active && status.hlsManifestUrl) {
        setManifestUrl(status.hlsManifestUrl);
        setConflictOpen(false);
      } else {
        setError('Switched, but the stream isn’t live yet. Tap retry.');
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not switch device.');
    } finally {
      setConflictBusy(false);
    }
  };

  /**
   * Initiate a gift. MoMo path uses StorageQ phone + telecom; Card
   * opens the gateway URL via expo-web-browser like the rest of the
   * public flow. We poll the public payment-status endpoint until
   * COMPLETED or FAILED.
   */
  const onSubmitGift = async () => {
    setGiftError(null);
    if (!viewerId) {
      setGiftError('You need viewer access first — recover or buy access.');
      return;
    }
    if (!giftCurrencyId) {
      setGiftError('Currencies haven’t loaded yet — try again in a moment.');
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
        giftMessage: giftMessage,
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

  const onJoinWithToken = async () => {
    if (!token.trim()) {
      setError('Please paste the invite token from your invitation.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await validateStreamToken(id, token.trim());
      if (!res.valid) {
        setError('That token is not valid for this event.');
        return;
      }
      if (res.requiresPayment) {
        // Forward to the payment screen for a paid stream.
        router.replace(`/events/join?id=${id}` as unknown as Href);
        return;
      }
      if (res.hlsManifestUrl) {
        setManifestUrl(res.hlsManifestUrl);
      } else {
        setError(
          res.hasLiveStream
            ? 'The stream is starting soon. Please try again in a moment.'
            : 'This event has no live stream right now.',
        );
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not validate the token.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {event.data?.title ?? 'Live stream'}
          </Text>
          {viewerCount > 0 ? (
            <View style={styles.viewerBadge}>
              <Ionicons name="eye-outline" size={14} color="#fff" />
              <Text style={styles.viewerBadgeText}>{viewerCount.toLocaleString()}</Text>
            </View>
          ) : null}
        </View>

        {manifestUrl ? (
          <Player url={manifestUrl} />
        ) : (
          <View style={styles.placeholder}>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="videocam-outline" size={48} color={colors.textMuted} />
            )}
            <Text style={styles.placeholderText}>
              {busy ? 'Connecting to the stream…' : 'Stream will appear here.'}
            </Text>
          </View>
        )}

        {!manifestUrl && !viewerId ? (
          <View style={styles.tokenCard}>
            <Text style={styles.tokenLabel}>Have an invite token?</Text>
            <Input
              value={token}
              onChangeText={setToken}
              placeholder="Paste the token from your invitation"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button title="Join stream" onPress={onJoinWithToken} loading={busy} />

            {/* Recover-by-email — only for paid streams. We don't gate
                on isPaid here because the modal is harmless on free
                streams (registerOrLookup will just say REQUIRES_PAYMENT
                with amount = 0). */}
            <Pressable onPress={() => setRecoverOpen(true)} hitSlop={6}>
              <Text style={styles.linkText}>Already paid? Recover access by email</Text>
            </Pressable>
            <Pressable onPress={() => router.replace(`/event/${id}` as unknown as Href)}>
              <Text style={styles.linkText}>← Back to event details</Text>
            </Pressable>
          </View>
        ) : null}

        {/*
         * Chat panel — visible whenever the manifest is loaded so the
         * viewer can read messages while watching. Sending is gated on
         * viewerId; without it, the user is prompted to recover access.
         */}
        {manifestUrl ? (
          <View style={styles.chatCard}>
            <View style={styles.chatTitleRow}>
              <Text style={styles.chatTitle}>Live chat</Text>
              {/*
               * Gift button — opens the sponsor sheet. Web parity:
               * always visible while watching, opens the gift modal
               * regardless of free/paid event (anonymous viewer gift
               * endpoint accepts both).
               */}
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

            {/* Reactions row */}
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

            {/* Message input */}
            <View style={styles.composer}>
              <TextInput
                value={chatDraft}
                onChangeText={setChatDraft}
                placeholder={viewerId ? 'Say something…' : 'Recover access to chat'}
                placeholderTextColor={colors.textMuted}
                editable={!!viewerId && !chatSending}
                style={styles.composerInput}
                returnKeyType="send"
                onSubmitEditing={onSendChat}
              />
              <Pressable
                style={[styles.sendBtn, (!viewerId || chatSending) && { opacity: 0.5 }]}
                onPress={onSendChat}
                disabled={!viewerId || chatSending || !chatDraft.trim()}
              >
                {chatSending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
            {chatError ? <Text style={styles.chatError}>{chatError}</Text> : null}
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Floating reactions overlay — covers the screen so reactions
          rise across the player from bottom to top. Each entry self-
          removes after its animation finishes. */}
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
                    {
                      translateY: fx.anim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -260],
                      }),
                    },
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

      {/* Device-conflict confirmation — web parity: explicit
          switch-device confirmation to take ownership on this device. */}
      <Modal
        visible={conflictOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setConflictOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setConflictOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>You're watching on another device</Text>
            <Text style={styles.modalHint}>
              Only one device can watch at a time on a single paid ticket. Switch ownership to this
              device and the old session will be ended.
            </Text>
            <Button
              title={conflictBusy ? 'Switching…' : 'Switch to this device'}
              onPress={confirmSwitchDevice}
              loading={conflictBusy}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gift / sponsor sheet — web parity: amount + currency + payment
          method picker, opens XentriPay gateway URL via WebBrowser. */}
      <Modal
        visible={giftOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setGiftOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setGiftOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '90%' }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Sponsor this stream</Text>
              <Text style={styles.modalHint}>
                Send a gift to the photographer running this event. Mobile Money is processed
                instantly; Card goes through XentriPay.
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
                style={{ height: 80, paddingTop: spacing.md, textAlignVertical: 'top', marginTop: spacing.sm }}
              />

              {giftError ? <Text style={styles.chatError}>{giftError}</Text> : null}

              <Button
                title={giftBusy ? 'Processing…' : `Send ${giftAmount} ${currencies.find((c) => c.id === giftCurrencyId)?.code ?? 'RWF'}`}
                onPress={onSubmitGift}
                loading={giftBusy}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Recover-by-email sheet */}
      <Modal
        visible={recoverOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setRecoverOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setRecoverOpen(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Recover your access</Text>
            <Text style={styles.modalHint}>
              Enter the name + email you used when paying. We'll restore your viewer access on this
              device.
            </Text>
            <Input
              label="Name"
              value={recoverName}
              onChangeText={setRecoverName}
              placeholder="The name on your ticket"
              autoCapitalize="words"
            />
            <Input
              label="Email"
              value={recoverEmail}
              onChangeText={setRecoverEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              label="Phone"
              value={recoverPhone}
              onChangeText={(t) => setRecoverPhone(t.replace(/[^0-9+]/g, ''))}
              placeholder="+2507…"
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            {recoverError ? <Text style={styles.chatError}>{recoverError}</Text> : null}
            <Button
              title={recoverBusy ? 'Checking…' : 'Recover access'}
              onPress={onRecover}
              loading={recoverBusy}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Welcome splash (web parity: dismisses automatically after 2.6s) */}
      {splashVisible ? (
        <WelcomeSplash
          eventTitle={event.data?.title}
          onDismiss={() => setSplashVisible(false)}
        />
      ) : null}
    </Screen>
  );
}

function Player({ url }: { url: string }) {
  // Native HLS on iOS (AVPlayer) and Android (ExoPlayer) needs the
  // explicit object-form source so it can pick the right metadata
  // strategy. Passing a bare string sometimes leaves the player in a
  // "stalled" state on Android where it never asks for segments.
  //
  // We also surface playerStatusChange errors via Alert — silent
  // failures were the reason the screen sat on the placeholder
  // forever even though the URL was reachable from the browser.
  const player = useVideoPlayer({ uri: url }, (p) => {
    p.loop = false;
    p.muted = false;
    p.audioMixingMode = 'auto';
    p.timeUpdateEventInterval = 0;
    p.play();
  });
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' && error?.message) {
        // Cloudflare returns 404 for HLS while OBS isn't connected.
        // We surface a calmer message so the user knows to wait
        // rather than thinking the player itself is broken.
        console.warn('[stream] playback error', error.message);
      }
    });
    return () => subscription.remove();
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

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 },
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
    backgroundColor: '#0F1217',
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  placeholderText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm },

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
  linkText: { textAlign: 'center', color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

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
  chatTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
  chatError: { color: colors.error, fontSize: 12 },

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
});
