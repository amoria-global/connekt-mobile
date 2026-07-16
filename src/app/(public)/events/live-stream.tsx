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
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HlsPlayer } from '@/features/streams/HlsPlayer';
import { StreamAdOverlay } from '@/features/streams/StreamAdOverlay';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  sendPublicVideoChat,
  switchAnonymousDevice,
  validateStreamToken,
  type PublicStreamChat,
} from '@/features/streams/api';
import { listCurrencies, type Currency } from '@/features/reference/api';
import {
  getPublicPaymentStatus,
  pollPublicPaymentStatus,
} from '@/features/payments/anonymous';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { useAsync } from '@/hooks/useAsync';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { reportContent, reportPublicChatMessage } from '@/features/moderation/api';
import { useModeration } from '@/features/moderation/useModeration';
import { isApiError } from '@/store/auth';
import { storage } from '@/services/storage';
import { getDeviceId } from '@/utils/deviceId';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, fontSize, fontWeight, radii, spacing } from '@/theme';

const REACTION_EMOJIS = ['🔥', '❤️', '👏', '😍', '🎉', '😮'];
const COVER_FALLBACK =
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&q=80';

// ─── Welcome splash ────────────────────────────────────────────────────────
// Web parity: showWelcomeSplash auto-dismisses after 2.6s once the stream
// loads, so first-time viewers get a friendly intro before the player.

function WelcomeSplash({ eventTitle, onDismiss }: { eventTitle?: string; onDismiss: () => void }) {
  const fade = useRef(new Animated.Value(1)).current;
  // Stable ref for onDismiss — putting onDismiss directly in the effect
  // deps caused the 2.6s timer to reset on every parent re-render (the
  // chat poll alone fires every 2.5s, so the timer never elapsed and
  // the splash stayed on screen forever). With the ref, the effect
  // runs exactly once on mount.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = () => {
    Animated.timing(fade, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
      onDismissRef.current();
    });
  };

  useEffect(() => {
    const t = setTimeout(dismiss, 2600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[splashStyles.wrap, { opacity: fade }]}>
      {/* Whole overlay is tappable — viewer can dismiss instantly
          instead of waiting for the 2.6s timer. */}
      <Pressable style={StyleSheet.absoluteFillObject} onPress={dismiss} />
      <View style={splashStyles.content} pointerEvents="none">
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
        <Text style={splashStyles.tapHint}>Tap anywhere to continue</Text>
      </View>
    </Animated.View>
  );
}

// ─── Chat message rows ───────────────────────────────────────────────────
// Web parity (knockout chat panel): each row shows who sent it. The
// current viewer's own messages are right-aligned and labelled "You"
// (the "who sent vs who received" distinction the web makes with
// `sender === "You"`); everyone else's are left-aligned with avatar +
// name + time. VIDEO-typed rows ("video wishes") render an inline
// player labelled "Video message".

function ChatVideoBubble({ uri }: { uri: string }) {
  const player = useVideoPlayer({ uri }, (p) => {
    p.loop = false;
    p.muted = false;
  });
  return (
    <View style={styles.chatVideoWrap}>
      <VideoView
        player={player}
        style={styles.chatVideo}
        contentFit="contain"
        nativeControls
      />
      <View style={styles.chatVideoTag}>
        <Ionicons name="videocam" size={11} color={colors.primary} />
        <Text style={styles.chatVideoTagText}>Video message</Text>
      </View>
    </View>
  );
}

// ─── TikTok-style live-chat overlay ──────────────────────────────────────
// The chat is no longer a boxed card below the player — it's a transparent
// layer that sits OVER the video, anchored to the right, with messages
// rising upward as new ones arrive. Each message carries its own translucent
// pill so it stays legible over any video without a solid panel background.

type FloatEmoji = { id: string; emoji: string; anim: Animated.Value; offset: number };

function OverlayChatRow({
  chat,
  isOwn,
  onLongPress,
}: {
  chat: PublicStreamChat;
  isOwn: boolean;
  /** Opens the report/hide menu. Omitted for the viewer's own messages. */
  onLongPress?: (chat: PublicStreamChat) => void;
}) {
  // Mount animation — the row fades in and slides up a few px into place, so
  // the stack visibly "moves upward" as newer messages push in below.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [enter]);

  const name = isOwn ? 'You' : chat.viewerName || 'Guest';
  const initial = (chat.viewerName || 'G').trim().charAt(0).toUpperCase();
  const hasVideo = !!chat.videoUrl;

  return (
    <Animated.View
      style={[
        chatFx.row,
        {
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      <Pressable
        style={chatFx.pill}
        onLongPress={onLongPress ? () => onLongPress(chat) : undefined}
        delayLongPress={300}
        accessibilityRole={onLongPress ? 'button' : undefined}
        accessibilityHint={
          onLongPress ? 'Long press to report this message or hide this person' : undefined
        }
      >
        <View style={chatFx.pillHead}>
          {chat.avatar ? (
            <Image source={{ uri: chat.avatar }} style={chatFx.avatar} contentFit="cover" />
          ) : (
            <View style={[chatFx.avatar, chatFx.avatarFallback]}>
              <Text style={chatFx.avatarInitial}>{initial}</Text>
            </View>
          )}
          <Text style={[chatFx.pillName, isOwn && chatFx.pillNameOwn]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {hasVideo ? (
          <ChatVideoBubble uri={chat.videoUrl!} />
        ) : (
          <Text style={chatFx.pillText}>{chat.message}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

type LiveChatPanelProps = {
  chats: PublicStreamChat[];
  isOwn: (c: PublicStreamChat) => boolean;
  /** Long-press a message someone else sent → report / hide menu. */
  onLongPressChat: (chat: PublicStreamChat) => void;
  floating: FloatEmoji[];
  emojis: string[];
  onReact: (emoji: string) => void;
  draft: string;
  setDraft: (v: string) => void;
  onSend: () => void;
  sending: boolean;
  onVideo: () => void;
  videoSending: boolean;
  canChat: boolean;
  /** Placeholder shown in the composer when the viewer can't chat yet. */
  joinHint?: string;
  error: string | null;
  minimized: boolean;
  onToggleMinimize: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  onGift: () => void;
  showGift: boolean;
  maxListHeight: number;
  insetTop?: number;
  insetBottom?: number;
};

function LiveChatPanel({
  chats,
  isOwn,
  onLongPressChat,
  floating,
  emojis,
  onReact,
  draft,
  setDraft,
  onSend,
  sending,
  onVideo,
  videoSending,
  canChat,
  joinHint,
  error,
  minimized,
  onToggleMinimize,
  fullscreen,
  onToggleFullscreen,
  onGift,
  showGift,
  maxListHeight,
  insetTop = 0,
  insetBottom = 0,
}: LiveChatPanelProps) {
  const listRef = useRef<ScrollView>(null);
  // Keep the newest message in view — the list is bottom-anchored so this is
  // what produces the upward-scrolling feed.
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [chats.length]);

  return (
    <View
      pointerEvents="box-none"
      style={[
        chatFx.panel,
        { paddingTop: insetTop + 10, paddingBottom: insetBottom + 8 },
      ]}
    >
      {/* Reaction bursts — anchored bottom-right, rising STRAIGHT up (no arc). */}
      <View pointerEvents="none" style={chatFx.floatLayer}>
        {floating.map((fx) => (
          <Animated.Text
            key={fx.id}
            style={[
              chatFx.floatEmoji,
              {
                left: fx.offset,
                opacity: fx.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                transform: [
                  {
                    translateY: fx.anim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, fullscreen ? -460 : -260],
                    }),
                  },
                  {
                    scale: fx.anim.interpolate({
                      inputRange: [0, 0.2, 1],
                      outputRange: [0.6, 1.15, 0.9],
                    }),
                  },
                ],
              },
            ]}
          >
            {fx.emoji}
          </Animated.Text>
        ))}
      </View>

      {/* Control bar: gift / minimize / fullscreen toggles. The "LIVE CHAT"
          label only shows in fullscreen — inline, the top of the video already
          carries the host + LIVE NOW details, so we leave that spot free. */}
      <View style={chatFx.controls} pointerEvents="box-none">
        {fullscreen ? (
          <View style={chatFx.controlsLeft}>
            <View style={chatFx.liveDot} />
            <Text style={chatFx.controlsTitle}>LIVE CHAT</Text>
          </View>
        ) : (
          <View />
        )}
        <View style={chatFx.controlsRight}>
          {showGift ? (
            <Pressable style={chatFx.ctrlBtn} onPress={onGift} hitSlop={6}>
              <Ionicons name="gift-outline" size={16} color="#fff" />
            </Pressable>
          ) : null}
          <Pressable style={chatFx.ctrlBtn} onPress={onToggleMinimize} hitSlop={6}>
            <Ionicons name={minimized ? 'chevron-up' : 'chevron-down'} size={18} color="#fff" />
          </Pressable>
          <Pressable style={chatFx.ctrlBtn} onPress={onToggleFullscreen} hitSlop={6}>
            <Ionicons name={fullscreen ? 'contract' : 'expand'} size={15} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Messages + reactions + composer. Collapsed to just the control bar
          when minimized. */}
      {minimized ? null : (
        <View style={chatFx.bottom}>
          <ScrollView
            ref={listRef}
            style={[chatFx.list, { maxHeight: maxListHeight }]}
            contentContainerStyle={chatFx.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {chats.length === 0 ? (
              <Text style={chatFx.empty}>No messages yet — say hi 👋</Text>
            ) : (
              chats.map((c) => (
                <OverlayChatRow
                  key={c.id}
                  chat={c}
                  isOwn={isOwn(c)}
                  onLongPress={isOwn(c) ? undefined : onLongPressChat}
                />
              ))
            )}
          </ScrollView>

          <View style={chatFx.reactions} pointerEvents="box-none">
            {emojis.map((emoji) => (
              <Pressable key={emoji} style={chatFx.reactionBtn} onPress={() => onReact(emoji)} hitSlop={6}>
                <Text style={chatFx.reactionEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          <View style={chatFx.composer}>
            <Pressable
              style={[chatFx.iconBtn, videoSending && { opacity: 0.5 }]}
              onPress={onVideo}
              disabled={videoSending || sending}
              hitSlop={6}
            >
              {videoSending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Ionicons name="videocam-outline" size={18} color="#fff" />
              )}
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={canChat ? 'Say something…' : joinHint ?? 'Verify access to chat'}
              placeholderTextColor="rgba(255,255,255,0.6)"
              editable={!sending}
              style={chatFx.input}
              returnKeyType="send"
              onSubmitEditing={onSend}
            />
            <Pressable
              style={[chatFx.sendBtn, (sending || !draft.trim()) && { opacity: 0.5 }]}
              onPress={onSend}
              disabled={sending || !draft.trim()}
            >
              {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="send" size={16} color="#fff" />}
            </Pressable>
          </View>
          {error ? <Text style={chatFx.error}>{error}</Text> : null}
        </View>
      )}
    </View>
  );
}

// ─── Player ────────────────────────────────────────────────────────────────
// expo-video has no WebRTC codec — we feed it HLS only. The web's WHEPPlayer
// is web-only (WebRTC over HTTP). Object-form source so AVPlayer/ExoPlayer
// pick the right HLS loader.

// Player has moved to @/features/streams/HlsPlayer (with a .web.tsx
// sibling that uses hls.js for Chrome / Firefox / Edge — browsers
// can't decode HLS natively). iOS / Android keep the expo-video path.

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
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

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

  // Prefill name/email from a previously-saved viewer profile so a
  // returning free viewer doesn't retype them.
  useEffect(() => {
    storage
      .get('viewerProfile')
      .then((raw) => {
        if (!raw) return;
        try {
          const p = JSON.parse(raw) as { name?: string; email?: string };
          if (p.name) setInfoName((n) => n || p.name!);
          if (p.email) setInfoEmail((e) => e || p.email!);
        } catch {
          /* ignore malformed profile */
        }
      })
      .catch(() => {});
  }, []);

  // ── Device-conflict modal ────────────────────────────────────────────────
  const [conflictOpen, setConflictOpen] = useState(false);
  const [conflictBusy, setConflictBusy] = useState(false);

  // ── Viewer count badge ───────────────────────────────────────────────────
  const [viewerCount, setViewerCount] = useState(0);

  // ── Chat state ───────────────────────────────────────────────────────────
  const [chats, setChats] = useState<PublicStreamChat[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [videoSending, setVideoSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [floatingEmoji, setFloatingEmoji] = useState<FloatEmoji[]>([]);
  // TikTok-style overlay controls: collapse the feed to just its header, or
  // blow the player + chat up to a full-screen immersive view.
  const [chatMinimized, setChatMinimized] = useState(false);
  const [chatFullscreen, setChatFullscreen] = useState(false);
  // Backend doesn't echo the anonymous viewerId per chat row, so "is this
  // mine?" is resolved two ways: by matching the viewer's display name,
  // and by remembering the exact text/caption we just sent (covers the
  // window before our name is known and survives the poll refresh).
  const sentTextsRef = useRef<Set<string>>(new Set());

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
          if (res.active) {
            // Access is its own thing — the manifest is separate. The
            // HLS URL may be null while OBS hasn't connected yet; the
            // auto-poll below picks it up the moment it appears.
            // Requiring `&& res.hlsManifestUrl` was the bug that made
            // /event/{id} Verify succeed (it only checks `active`) and
            // /events/live-stream fail seconds later for the same call.
            setAccessGranted(true);
            await storage.set(`anonymousViewer_${id}`, vId).catch(() => {});
            if (res.hlsManifestUrl) setManifestUrl(res.hlsManifestUrl);
          } else if (res.reason === 'DEVICE_MISMATCH') {
            /*
             * Backend's access-status returns DEVICE_MISMATCH on ANY
             * fingerprint mismatch for a paid viewer, regardless of
             * whether the old device is actively watching. That's too
             * strict for "anyone with the same link can watch" — we
             * silently call switch-device which DOES check the old
             * session's heartbeat. If switch succeeds, the viewer's
             * fingerprint is rewritten to this device and we re-check.
             * Only when switch returns "other device active" do we
             * open the explicit conflict modal so the user can confirm
             * taking ownership over.
             */
            const swap = await switchAnonymousDevice(id, vId, fingerprint);
            if (cancelled) return;
            if (swap.ok) {
              const reverify = await checkAnonymousAccessStatus(id, vId, fingerprint);
              if (cancelled) return;
              if (reverify.active) {
                setAccessGranted(true);
                await storage.set(`anonymousViewer_${id}`, vId).catch(() => {});
                if (reverify.hlsManifestUrl) setManifestUrl(reverify.hlsManifestUrl);
              } else {
                setConflictOpen(true);
              }
            } else {
              // Old session active OR backend rejected — user must
              // confirm explicitly via the modal (which calls switch
              // again under the hood; backend will release the old
              // session if it has timed out since this attempt).
              setConflictOpen(true);
            }
          } else if (fromPayment === '1') {
            // Just came from payment — backend may not have flipped the
            // viewer's status to COMPLETED yet. Retry once after 2s.
            setTimeout(async () => {
              if (cancelled) return;
              try {
                const fp = await getDeviceId();
                const retry = await checkAnonymousAccessStatus(id, vId, fp);
                if (cancelled) return;
                if (retry.active) {
                  setAccessGranted(true);
                  if (retry.hlsManifestUrl) setManifestUrl(retry.hlsManifestUrl);
                } else if (retry.reason === 'DEVICE_MISMATCH') {
                  setConflictOpen(true);
                } else {
                  // Retry also failed — stay on the page and surface a
                  // clear error so the user can act. Previously we
                  // bounced silently which caused a verify-then-back
                  // loop with the event page.
                  setTokenError(
                    "We couldn't confirm your access. Tap retry below or tap the back button to buy access.",
                  );
                }
              } catch {
                /* swallow */
              }
            }, 2000);
          } else {
            // hasAccess=false without DEVICE_MISMATCH. If event/[id]
            // verified access right before pushing here, this is a
            // disagreement we shouldn't paper over. Surface the raw
            // backend signal so we (and the user) can see what changed.
            if (!cancelled) {
              setTokenError(
                "Backend returned hasAccess=false for this viewerId — even though it accepted you on the event page. Tell support which event id you're testing.",
              );
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
        // Backend's public event endpoint exposes hlsManifestUrl
        // when populated. When it's null (Cloudflare manifest hasn't
        // been built backend-side) we derive HLS from whepUrl — they
        // share the same customer hash + live input id, only the path
        // differs (/webRTC/play → /manifest/video.m3u8). This lets the
        // player kick in the moment OBS connects, even before backend
        // persists the manifest URL.
        const derived = detail.whepUrl?.includes('/webRTC/play')
          ? detail.whepUrl.replace('/webRTC/play', '/manifest/video.m3u8')
          : undefined;
        const url = detail.hlsManifestUrl ?? derived ?? undefined;
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
    // Small horizontal offset from the right edge so overlapping bursts don't
    // perfectly stack — but the motion itself stays a straight vertical rise.
    const offset = 8 + Math.random() * 34;
    setFloatingEmoji((prev) => [...prev, { id: itemId, emoji, anim, offset }]);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(() => {
      setFloatingEmoji((prev) => prev.filter((x) => x.id !== itemId));
    });
  };

  // "Is this message mine?" — the backend doesn't echo the anonymous viewerId
  // per row, so we match on our display name and on the exact text we just
  // sent (covers the window before our name is known).
  const isOwnChat = useCallback(
    (c: PublicStreamChat) => {
      const ownName = viewerName?.trim().toLowerCase();
      return (
        sentTextsRef.current.has(c.message) ||
        (!!ownName && (c.viewerName || '').trim().toLowerCase() === ownName)
      );
    },
    [viewerName],
  );

  // ── Moderation ───────────────────────────────────────────────────────────
  //
  // Live chat is the one surface anonymous viewers can post to, so it needs
  // both a report path and a block path (Play UGC policy). Signed-in senders
  // are blocked account-wide server-side; anonymous senders have no account,
  // so they're hidden on this device by display name.

  const hiddenChatters = useModeration((s) => s.hiddenChatters);
  const blockedIds = useModeration((s) => s.blockedIds);
  const hideChatter = useModeration((s) => s.hideChatter);
  const blockAccount = useModeration((s) => s.block);
  const loadModeration = useModeration((s) => s.load);

  useEffect(() => {
    loadModeration();
  }, [loadModeration]);

  const [reportChat, setReportChat] = useState<PublicStreamChat | null>(null);

  /** Chats minus anyone this viewer hid or blocked. */
  const visibleChats = useMemo(
    () =>
      chats.filter((c) => {
        if (c.senderId && blockedIds.has(c.senderId)) return false;
        if (c.viewerName && hiddenChatters.has(`${id}:${c.viewerName}`)) return false;
        return true;
      }),
    [chats, blockedIds, hiddenChatters, id],
  );

  const onLongPressChat = useCallback(
    (chat: PublicStreamChat) => {
      const who = chat.viewerName || chat.senderName || 'this person';
      // Signed-in senders get a real account block; anonymous ones can only be
      // hidden locally, so the label says exactly what will happen.
      const blockLabel = chat.senderId ? `Block ${who}` : `Hide ${who} on this device`;

      Alert.alert(who, chat.message, [
        { text: 'Report message', style: 'destructive', onPress: () => setReportChat(chat) },
        {
          text: blockLabel,
          style: 'destructive',
          onPress: async () => {
            try {
              if (chat.senderId) {
                await blockAccount(chat.senderId);
              } else if (chat.viewerName) {
                await hideChatter(id, chat.viewerName);
              }
            } catch (e) {
              Alert.alert(
                'Could not block',
                isApiError(e) ? e.message : 'Please try again.',
              );
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [blockAccount, hideChatter, id],
  );

  /**
   * Anonymous viewers report through the public endpoint (they have no token);
   * signed-in viewers use the authenticated one.
   */
  const submitChatReport = useCallback(
    async (reason: string, description: string) => {
      const chat = reportChat;
      if (!chat) throw { status: 400, message: 'Nothing to report.' };
      if (viewerId) {
        const fingerprint = await getDeviceId();
        return reportPublicChatMessage(id, chat.id, viewerId, fingerprint, reason, description);
      }
      return reportContent('STREAM_CHAT', chat.id, reason, description);
    },
    [reportChat, viewerId, id],
  );

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
      setInfoError(
        status.isPaid ? 'Enter the name and email you used at checkout.' : 'Enter your name and email to join.',
      );
      return;
    }
    // Phone is only required for PAID events (matched to the purchase).
    // Free events just need name + email to register a viewer.
    if (status.isPaid && (!infoPhone.trim() || infoPhone.replace(/[^0-9]/g, '').length < 9)) {
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
        // Free events don't collect a phone. The backend now allows an empty
        // phone, but until it's redeployed the register endpoint still
        // @NotBlank-rejects it — so send a harmless placeholder (it's only
        // stored; lookup/dedup is by email). Works against both versions.
        phone: status.isPaid ? infoPhone.trim() : '0000000000',
        deviceId: fingerprint,
      });
      // Only PAID events gate on a real purchase. On a free event we
      // register the person outright so they can comment immediately.
      if (reg.needsPayment && status.isPaid) {
        setInfoError("We couldn't find a paid record for this email — buy access to start.");
        return;
      }
      if (!reg.viewerId) {
        setInfoError('Could not register you right now. Please try again.');
        return;
      }
      await storage.set(`anonymousViewer_${id}`, reg.viewerId).catch(() => {});
      // Remember the viewer so we can prefill the form next time.
      await storage
        .set('viewerProfile', JSON.stringify({ name: infoName.trim(), email: infoEmail.trim() }))
        .catch(() => {});
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
      setInfoError(
        isApiError(e) ? e.message : status.isPaid ? 'Could not verify your access.' : 'Could not join the chat.',
      );
    } finally {
      setInfoBusy(false);
    }
  };

  const onSendChat = async () => {
    const msg = chatDraft.trim();
    if (!msg) return;
    if (!viewerId) {
      setChatError(status.isPaid ? 'Verify your access to chat.' : 'Add your name and email to comment.');
      setInfoModalOpen(true);
      return;
    }
    setChatSending(true);
    setChatError(null);
    try {
      const fingerprint = await getDeviceId();
      await sendPublicStreamChat(id, { viewerId, deviceFingerprint: fingerprint, message: msg });
      sentTextsRef.current.add(msg); // mark as mine for the next poll
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

  // Record (or pick) a ≤60s clip and post it as a video message — the
  // mobile equivalent of the web's "Send 1-min video message" button.
  const onSendVideoWish = async () => {
    if (!viewerId) {
      setChatError(
        status.isPaid
          ? 'Verify your access to send a video message.'
          : 'Add your name and email to send a video message.',
      );
      setInfoModalOpen(true);
      return;
    }
    setChatError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      let result: ImagePicker.ImagePickerResult;
      if (perm.granted) {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['videos'],
          videoMaxDuration: 60,
          quality: 0.7,
        });
        // User cancelled the camera — offer the library as a fallback so
        // they can still send a clip they already recorded.
        if (result.canceled) {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['videos'],
            videoMaxDuration: 60,
            quality: 0.7,
          });
        }
      } else {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['videos'],
          videoMaxDuration: 60,
          quality: 0.7,
        });
      }
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];

      setVideoSending(true);
      const fingerprint = await getDeviceId();
      await sendPublicVideoChat(id, {
        viewerId,
        deviceFingerprint: fingerprint,
        video: {
          uri: asset.uri,
          name: asset.fileName ?? `wish-${Date.now()}.mp4`,
          mimeType: asset.mimeType ?? 'video/mp4',
        },
        content: chatDraft.trim() || undefined,
      });
      sentTextsRef.current.add(chatDraft.trim() || '[Video Message]');
      setChatDraft('');
    } catch (e) {
      setChatError(isApiError(e) ? e.message : 'Could not send video message.');
    } finally {
      setVideoSending(false);
    }
  };

  const onSubmitGift = async () => {
    setGiftError(null);
    if (!digitalPurchasesEnabled) return;
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
  // The host is the event's ORGANIZER / creator (the person putting on the
  // event) — not the photographer shooting it.
  const hostName =
    event.data?.eventOrganizer ||
    [event.data?.creator?.firstName, event.data?.creator?.lastName].filter(Boolean).join(' ') ||
    undefined;
  const hostImage = event.data?.creator?.profilePicture;

  // When the event is live the video owns the ENTIRE screen (full-bleed,
  // edge-to-edge) with every control, title, reaction and the chat feed
  // layered on top — the TikTok/web experience. The boxed 16:9 card + the
  // details/hint sections below are only used for non-live states.
  const stageContent = (
    <>
      {manifestUrl ? (
            chatFullscreen ? (
              // The player has been handed to the full-screen modal — show a
              // tap-to-return placeholder here so we never run two HLS
              // sessions at once.
              <Pressable style={styles.fsReturn} onPress={() => setChatFullscreen(false)}>
                <Image source={{ uri: eventThumb }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                <View style={styles.placeholderScrim} />
                <Ionicons name="scan-outline" size={30} color="rgba(255,255,255,0.9)" />
                <Text style={styles.placeholderText}>Playing in full screen — tap to return</Text>
              </Pressable>
            ) : (
              // Branded volume + fullscreen live above the chat composer (not
              // at the very bottom, where they'd collide with the input + send
              // button). The redundant in-video LIVE badge is hidden — the top
              // overlay already carries the LIVE NOW pill.
              <HlsPlayer
                url={manifestUrl}
                style={StyleSheet.absoluteFillObject}
                controlsBottomOffset={insets.bottom + 72}
                showLiveBadge={false}
              />
            )
          ) : (
            <>
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
            </>
          )}

          {/* Details overlaid on the video's top edge — host, LIVE NOW,
              title, and the live viewer counter. */}
          {status.isLive && !chatFullscreen ? (
            <View pointerEvents="box-none" style={[styles.topOverlay, { paddingTop: insets.top + spacing.md }]}>
              <LinearGradient
                colors={['rgba(0,0,0,0.65)', 'transparent']}
                style={[styles.topScrim, { height: insets.top + 96 }]}
                pointerEvents="none"
              />
              <View style={styles.topRow}>
                {hostImage ? (
                  <Image source={{ uri: hostImage }} style={styles.topAvatar} contentFit="cover" />
                ) : (
                  <View style={[styles.topAvatar, styles.topAvatarFallback]}>
                    <Text style={styles.topInitial}>
                      {(hostName || eventTitle).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={styles.liveRow}>
                    <View style={styles.liveNowPill}>
                      <View style={styles.liveNowDot} />
                      <Text style={styles.liveNowText}>LIVE NOW</Text>
                    </View>
                    {viewerCount > 0 ? (
                      <View style={styles.viewerPill}>
                        <Ionicons name="eye" size={12} color="#fff" />
                        <Text style={styles.viewerPillText}>{viewerCount.toLocaleString()}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.topTitle} numberOfLines={1}>
                    {eventTitle}
                  </Text>
                  {hostName ? (
                    <Text style={styles.topHostedBy} numberOfLines={1}>
                      Hosted by <Text style={styles.topHostName}>{hostName}</Text>
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* TikTok-style transparent chat overlay (inline). */}
          {status.isLive && !chatFullscreen ? (
            <LiveChatPanel
              chats={visibleChats}
              isOwn={isOwnChat}
              onLongPressChat={onLongPressChat}
              floating={floatingEmoji}
              emojis={REACTION_EMOJIS}
              onReact={onSendReaction}
              draft={chatDraft}
              setDraft={setChatDraft}
              onSend={onSendChat}
              sending={chatSending}
              onVideo={onSendVideoWish}
              videoSending={videoSending}
              canChat={!!viewerId}
              joinHint={status.isPaid ? 'Verify access to chat' : 'Add your name to comment'}
              error={chatError}
              minimized={chatMinimized}
              onToggleMinimize={() => setChatMinimized((m) => !m)}
              fullscreen={false}
              onToggleFullscreen={() => setChatFullscreen(true)}
              onGift={() => setGiftOpen(true)}
              showGift={!!viewerId && digitalPurchasesEnabled}
              maxListHeight={Math.round(windowHeight * 0.34)}
              insetTop={insets.top}
              insetBottom={insets.bottom}
            />
          ) : null}

          {/* Sponsor ads — rendered OVER the video at their configured
              placement (bars / rails / corners / L-shape). */}
          <StreamAdOverlay
            eventId={id}
            viewerId={viewerId}
            enabled={status.isLive && !!manifestUrl && !chatFullscreen}
            insetTop={insets.top}
            insetBottom={insets.bottom}
          />
    </>
  );

  return (
    <Screen padded={false} edges={status.isLive ? [] : ['bottom']}>
      {status.isLive ? (
        // ── LIVE: full-bleed video with everything overlaid on top ──────────
        <View style={styles.liveRoot}>
          <View style={styles.stageFull}>{stageContent}</View>

          {/* Invite-token entry — overlaid, centred, when a free invite_token
              stream has no manifest yet. */}
          {!manifestUrl && !status.isPaid ? (
            <View style={[styles.tokenOverlay, { paddingTop: insets.top }]} pointerEvents="box-none">
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
            </View>
          ) : null}

          {tokenError ? (
            <View style={[styles.errorToast, { top: insets.top + 70 }]} pointerEvents="none">
              <Ionicons name="alert-circle" size={18} color="#fff" />
              <Text style={styles.errorToastText}>{tokenError}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        // ── NOT LIVE: boxed 16:9 card + details/status below ────────────────
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.offlineTitle} numberOfLines={2}>
            {eventTitle}
          </Text>

          <View style={[styles.playerStage, styles.playerStageRatio]}>{stageContent}</View>

          {tokenError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={20} color={colors.error} />
              <Text style={styles.errorText}>{tokenError}</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* Full-screen immersive view — the player fills the screen with the
          same TikTok chat overlay + rising reactions on top. */}
      <Modal
        visible={chatFullscreen}
        animationType="fade"
        onRequestClose={() => setChatFullscreen(false)}
        supportedOrientations={['portrait', 'landscape']}
        statusBarTranslucent
      >
        <View style={styles.fsRoot}>
          {manifestUrl ? (
            <HlsPlayer
              url={manifestUrl}
              style={StyleSheet.absoluteFillObject}
              controlsBottomOffset={insets.bottom + 72}
              showLiveBadge={false}
            />
          ) : (
            <>
              <Image source={{ uri: eventThumb }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
              <View style={styles.placeholderScrim} />
            </>
          )}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="box-none"
          >
            <LiveChatPanel
              chats={visibleChats}
              isOwn={isOwnChat}
              onLongPressChat={onLongPressChat}
              floating={floatingEmoji}
              emojis={REACTION_EMOJIS}
              onReact={onSendReaction}
              draft={chatDraft}
              setDraft={setChatDraft}
              onSend={onSendChat}
              sending={chatSending}
              onVideo={onSendVideoWish}
              videoSending={videoSending}
              canChat={!!viewerId}
              joinHint={status.isPaid ? 'Verify access to chat' : 'Add your name to comment'}
              error={chatError}
              minimized={chatMinimized}
              onToggleMinimize={() => setChatMinimized((m) => !m)}
              fullscreen
              onToggleFullscreen={() => setChatFullscreen(false)}
              onGift={() => setGiftOpen(true)}
              showGift={!!viewerId && digitalPurchasesEnabled}
              maxListHeight={Math.round(windowHeight * 0.4)}
              insetTop={insets.top}
              insetBottom={insets.bottom}
            />
            {/* Sponsor ads in the immersive view too. */}
            <StreamAdOverlay
              eventId={id}
              viewerId={viewerId}
              enabled={chatFullscreen && status.isLive && !!manifestUrl}
              insetTop={insets.top}
              insetBottom={insets.bottom}
            />
          </KeyboardAvoidingView>
        </View>
      </Modal>

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

      {/*
       * Viewer-info modal. For PAID events it's "Verify your access"
       * (name + email + phone, matched to the purchase). For FREE events
       * it's a lightweight "Join the chat" — name + email only, which
       * registers the person as a viewer and grants commenting right away.
       */}
      <Modal visible={infoModalOpen} transparent animationType="slide" onRequestClose={() => setInfoModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setInfoModalOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '90%' }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>{status.isPaid ? 'Verify your access' : 'Join the chat'}</Text>
              <Text style={styles.modalHint}>
                {status.isPaid
                  ? "Enter the name, email and phone you used when buying your ticket. We'll restore access on this device."
                  : 'Enter your name and email to comment — no account needed. This event is free.'}
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
              {status.isPaid ? (
                <Input
                  label="Phone"
                  value={infoPhone}
                  onChangeText={(t) => setInfoPhone(t.replace(/[^0-9+]/g, ''))}
                  placeholder="+2507…"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                />
              ) : null}
              {infoError ? <Text style={styles.chatErrorText}>{infoError}</Text> : null}
              <Button
                title={infoBusy ? (status.isPaid ? 'Verifying…' : 'Joining…') : status.isPaid ? 'Verify access' : 'Join chat'}
                onPress={onSubmitViewerInfo}
                loading={infoBusy}
              />
              {status.isPaid && digitalPurchasesEnabled ? (
                <Pressable
                  onPress={() => router.replace(`/events/join?id=${id}` as unknown as Href)}
                  style={{ alignItems: 'center', marginTop: 8 }}
                >
                  <Text style={styles.linkText}>Buy access instead</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Gift modal (sponsor) */}
      <Modal visible={giftOpen} transparent animationType="slide" onRequestClose={() => setGiftOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setGiftOpen(false)}>
          <Pressable style={[styles.modalSheet, { maxHeight: '90%' }]} onPress={(e) => e.stopPropagation()}>
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.modalTitle}>Send a gift</Text>
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

      {/* Report a live-chat message (long-press a message to open). */}
      <ReportSheet
        visible={!!reportChat}
        onClose={() => setReportChat(null)}
        targetType="STREAM_CHAT"
        subject={reportChat?.viewerName || reportChat?.senderName || undefined}
        submit={submitChatReport}
      />
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

  offlineTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: colors.text, letterSpacing: -0.3 },

  // Details overlaid on the top of the video stage
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: spacing.md, paddingHorizontal: spacing.md },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 96 },
  // paddingRight leaves room for the chat panel's minimize / fullscreen
  // buttons which sit at the top-right of the same stage.
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: 92 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  topAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  topAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  topInitial: { fontFamily: fonts.bold, fontSize: 16, color: '#fff' },
  liveNowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EF4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  liveNowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveNowText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff', letterSpacing: 0.6 },
  topTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: '#fff',
    letterSpacing: -0.2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  topHostedBy: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  topHostName: { fontFamily: fonts.bold, color: '#fff' },
  viewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  viewerPillText: { fontFamily: fonts.bold, color: '#fff', fontSize: 12 },

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

  // Portrait "stage" that hosts the video + transparent chat overlay.
  playerStage: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: '#000',
    position: 'relative',
  },
  playerStageRatio: { aspectRatio: 16 / 9 },

  // Live full-bleed: the video fills the whole screen, everything overlays.
  liveRoot: { flex: 1, backgroundColor: '#000' },
  stageFull: { flex: 1, backgroundColor: '#000', position: 'relative', overflow: 'hidden' },
  tokenOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorToast: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(185,28,28,0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radii.md,
  },
  errorToastText: { flex: 1, color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  fsReturn: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fsRoot: { flex: 1, backgroundColor: '#000' },
  chatHint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

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
  chatList: { gap: 8, maxHeight: 320 },
  chatEmpty: { fontSize: fontSize.sm, color: colors.textMuted, fontStyle: 'italic' },

  // Sender differentiation: mine right-aligned, others left with avatar.
  rowOther: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '88%' },
  rowOwn: { flexDirection: 'row', justifyContent: 'flex-end' },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceMuted },
  avatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 12, fontWeight: '800' },
  bubble: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    gap: 2,
  },
  bubbleOther: { backgroundColor: colors.surfaceMuted, borderTopLeftRadius: 4 },
  bubbleOwn: {
    backgroundColor: colors.primary,
    borderTopRightRadius: 4,
    maxWidth: '88%',
  },
  bubbleHeadRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bubbleSender: { fontSize: 11, fontWeight: '700', color: colors.primary, flexShrink: 1 },
  bubbleSenderOwn: { color: 'rgba(255,255,255,0.92)' },
  bubbleTime: { fontSize: 10, color: colors.textMuted },
  bubbleTimeOwn: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  bubbleText: { fontSize: fontSize.sm, color: colors.text },
  bubbleTextOwn: { color: '#fff' },

  chatVideoWrap: { marginTop: 4, gap: 4 },
  chatVideo: { width: 220, height: 124, borderRadius: 8, backgroundColor: '#000' },
  chatVideoTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chatVideoTagText: { fontSize: 11, color: colors.primary, fontStyle: 'italic', fontWeight: '600' },

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
  videoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
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

// ─── TikTok-style chat overlay styles ────────────────────────────────────
// Everything here is drawn OVER the video: the panel itself is transparent,
// legibility comes from per-element translucent-black pills + text shadows.
const chatFx = StyleSheet.create({
  panel: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },

  // Reaction bursts rise straight up from the bottom-right corner.
  floatLayer: { position: 'absolute', left: 0, bottom: 64, top: 0, width: 90 },
  floatEmoji: { position: 'absolute', bottom: 0, fontSize: 28 },

  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ef4444' },
  controlsTitle: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  controlsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctrlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom cluster: message feed + reactions + composer.
  bottom: { gap: 6 },
  list: { alignSelf: 'flex-start', width: '62%' },
  listContent: { flexGrow: 1, justifyContent: 'flex-end', paddingVertical: 4, gap: 5 },

  row: { alignSelf: 'flex-start', maxWidth: '100%' },
  pill: {
    backgroundColor: 'rgba(0,0,0,0.32)',
    borderRadius: 14,
    paddingVertical: 5,
    paddingHorizontal: 9,
    gap: 2,
  },
  pillHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  avatarInitial: { color: '#fff', fontSize: 10, fontWeight: '800' },
  pillName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#7dd3fc',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
  },
  pillNameOwn: { color: '#fbbf24' },
  pillText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 2,
  },
  empty: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontStyle: 'italic',
    alignSelf: 'flex-start',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
  },

  reactions: { flexDirection: 'row', gap: 6, alignSelf: 'flex-start' },
  reactionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 17 },

  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    color: '#fff',
    fontSize: 13.5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#fca5a5',
    fontSize: 11.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
  },
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
  tapHint: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 12, textAlign: 'center' },
});
