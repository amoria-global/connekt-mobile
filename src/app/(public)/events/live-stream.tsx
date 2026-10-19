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
 *   4. GIFTING (TikTok-style)
 *      The GiftTray bottom sheet (features/streams/gifting) lists the
 *      backend gift catalog with exact prices; picking a gift opens the
 *      in-app GiftCheckoutSheet (a viewer who has not registered yet adds
 *      name and email first, then lands in the same sheet). The tray button
 *      is gated by giftsEnabled, and INCOMING gift animations (GiftOverlay
 *      banners / floaters / big-gift takeover, fed by GIFT chat rows)
 *      render on every platform — displaying a gift is not a purchase.
 *
 *   5. DEVICE-CONFLICT MODAL
 *      Surfaced when access-status returns DEVICE_MISMATCH. Forced
 *      switching isn't supported - Retry calls retryAnonymousDeviceAccess,
 *      which only succeeds once the other device has gone idle 60s+.
 *
 *   6. VIEWER-INFO MODAL
 *      The web's "Verify your access" form: name + email + phone +
 *      fingerprint → registerAnonymousViewer. If a paid record exists,
 *      backend dedupes by email and returns ACCESS_GRANTED with the
 *      viewerId we persist.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { HlsPlayer } from '@/features/streams/HlsPlayer';
import { StreamWatermark } from '@/features/streams/StreamWatermark';
import { StreamAdOverlay } from '@/features/streams/StreamAdOverlay';
import {
  ActivityIndicator,
  Alert,
  Animated,
  AppState,
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
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput, type PhoneValue } from '@/components/ui/PhoneInput';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import {
  checkAnonymousAccessStatus,
  deactivateAnonymousSession,
  getPublicStreamChats,
  getPublicViewerCount,
  registerAnonymousViewer,
  requestStreamAccess,
  retryAnonymousDeviceAccess,
  sendAnonymousHeartbeat,
  sendPublicStreamChat,
  sendPublicStreamReaction,
  sendPublicVideoChat,
  validateStreamToken,
  type GiftCatalogItem,
  type PublicStreamChat,
} from '@/features/streams/api';
import {
  GiftOverlay,
  formatGiftUsd,
  parseGiftMeta,
  type GiftEvent,
} from '@/features/streams/gifting/GiftOverlay';
import { GiftTray } from '@/features/streams/gifting/GiftTray';
import { digitalPurchasesEnabled, giftsEnabled } from '@/features/payments/policy';
import { GiftCheckoutSheet } from '@/features/streams/gifting/GiftCheckoutSheet';
import { useAsync } from '@/hooks/useAsync';
import { ReportSheet } from '@/features/moderation/ReportSheet';
import { reportContent, reportPublicChatMessage } from '@/features/moderation/api';
import { useModeration } from '@/features/moderation/useModeration';
import { isApiError, useAuth } from '@/store/auth';
import { storage } from '@/services/storage';
import { getDeviceId } from '@/utils/deviceId';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, radii, fontSize, fontWeight, fonts, makeStyles, useTheme } from '@/theme';
import { EVENT_COVER_PLACEHOLDER } from "@/utils/placeholders";
import { GlassLayer, glassClear } from '@/components/ui/GlassCard';

import { useLanguage } from '@/hooks/useLanguage';
import { translate, type TranslationKey } from '@/i18n/translations';
const tr = (k: TranslationKey) => translate(useLanguage.getState().language, k);

/** The side-rail toggles' "on" state: a white wash over the glass. */
const CTRL_ACTIVE_FILL = 'rgba(255,255,255,0.28)';

/** iOS drops a Modal presented while another is still sliding away; wait this long between them. */
const MODAL_HANDOFF_MS = 400;

const REACTION_EMOJIS = ['🔥', '❤️', '👏', '😍', '🎉', '😮'];

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
      <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      <View style={splashStyles.content} pointerEvents="none">
        <View style={splashStyles.iconWrap}>
          <Ionicons name="play-circle" size={40} color="#fff" />
        </View>
        <Text style={splashStyles.headline}>{tr('b4_welcomeYouAreIn')}</Text>
        {eventTitle ? (
          <Text style={splashStyles.sub} numberOfLines={2}>
            {eventTitle}
          </Text>
        ) : null}
        <View style={splashStyles.livePill}>
          <View style={splashStyles.liveDot} />
          <Text style={splashStyles.liveText}>LIVE</Text>
        </View>
        <Text style={splashStyles.tapHint}>{tr('b4_tapAnywhereContinue')}</Text>
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
  const styles = useStyles();
  const { colors } = useTheme();
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
        <Text style={styles.chatVideoTagText}>{tr('b4_videoMessage')}</Text>
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
  const chatFx = useChatFx();
  // Mount animation — the row fades in and slides up a few px into place, so
  // the stack visibly "moves upward" as newer messages push in below.
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [enter]);

  const name = isOwn ? 'You' : chat.viewerName || 'Guest';
  const initial = (chat.viewerName || 'G').trim().charAt(0).toUpperCase();
  const hasVideo = !!chat.videoUrl;
  // GIFT rows render as a pink-tinted gift line: emoji + "sent a {name} · $X".
  // giftMeta is a JSON string parsed defensively — fall back to the row's
  // human-readable message when it's missing or malformed.
  const isGift = (chat.chatType ?? chat.type ?? '').toUpperCase() === 'GIFT';
  const gift = isGift ? parseGiftMeta(chat.giftMeta) : null;

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
        style={[chatFx.pill, isGift && chatFx.giftPill]}
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
        ) : isGift ? (
          <View style={chatFx.giftLine}>
            <Text style={chatFx.giftEmoji}>{gift?.emoji ?? '🎁'}</Text>
            {gift ? (
              <Text style={chatFx.giftText}>
                sent a {gift.name}
                <Text style={chatFx.giftAmount}> · {formatGiftUsd(gift.amountUsd)}</Text>
              </Text>
            ) : (
              <Text style={chatFx.giftText}>{chat.message}</Text>
            )}
          </View>
        ) : (
          <Text style={chatFx.pillText}>{chat.message}</Text>
        )}
      </Pressable>
    </Animated.View>
  );
}

function YouTubeChatRow({
  chat,
  isOwn,
  onLongPress,
}: {
  chat: PublicStreamChat;
  isOwn: boolean;
  onLongPress?: (chat: PublicStreamChat) => void;
}) {
  const chatFx = useChatFx();
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [enter]);

  const name = isOwn ? 'You' : chat.viewerName || 'Guest';
  const initial = (chat.viewerName || 'G').trim().charAt(0).toUpperCase();
  const hasVideo = !!chat.videoUrl;
  const isGift = (chat.chatType ?? chat.type ?? '').toUpperCase() === 'GIFT';
  const gift = isGift ? parseGiftMeta(chat.giftMeta) : null;

  return (
    <Animated.View
      style={[
        chatFx.ytRow,
        {
          opacity: enter,
          transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        },
      ]}
    >
      <Pressable
        style={[chatFx.ytRowPressable, isGift && chatFx.ytGiftRow]}
        onLongPress={onLongPress ? () => onLongPress(chat) : undefined}
        delayLongPress={300}
        accessibilityRole={onLongPress ? 'button' : undefined}
        accessibilityHint={
          onLongPress ? 'Long press to report this message or hide this person' : undefined
        }
      >
        {chat.avatar ? (
          <Image source={{ uri: chat.avatar }} style={chatFx.ytAvatar} contentFit="cover" />
        ) : (
          <View style={[chatFx.ytAvatar, chatFx.ytAvatarFallback]}>
            <Text style={chatFx.ytAvatarInitial}>{initial}</Text>
          </View>
        )}

        <View style={chatFx.ytMsgCol}>
          <View style={chatFx.ytNameRow}>
            <Text style={[chatFx.ytAuthorName, isOwn && chatFx.ytAuthorOwn]} numberOfLines={1}>
              {name}
            </Text>
            {isOwn ? (
              <View style={chatFx.ytYouBadge}>
                <Text style={chatFx.ytYouBadgeText}>{tr('b4_youUpper')}</Text>
              </View>
            ) : null}
          </View>

          {hasVideo ? (
            <ChatVideoBubble uri={chat.videoUrl!} />
          ) : isGift ? (
            <View style={chatFx.ytGiftContent}>
              <Text style={chatFx.ytGiftEmoji}>{gift?.emoji ?? '🎁'}</Text>
              <Text style={chatFx.ytGiftDesc}>
                sent a <Text style={{ fontWeight: '700' }}>{gift?.name ?? 'gift'}</Text>
                {gift ? <Text style={chatFx.ytGiftAmount}> · {formatGiftUsd(gift.amountUsd)}</Text> : null}
              </Text>
            </View>
          ) : (
            <Text style={chatFx.ytMsgText}>{chat.message}</Text>
          )}
        </View>
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
  onDonate: () => void;
  maxListHeight: number;
  insetTop?: number;
  insetBottom?: number;
  isMuted?: boolean;
  onToggleMute?: () => void;
  layout?: 'overlay' | 'youtube';
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
  onDonate,
  maxListHeight,
  insetTop = 0,
  insetBottom = 0,
  isMuted = false,
  onToggleMute,
  layout = 'overlay',
}: LiveChatPanelProps) {
  const chatFx = useChatFx();
  const listRef = useRef<ScrollView>(null);
  // Overlay layout: comments and reactions live behind single buttons on the
  // right rail, closed by default so nothing sits on top of the video.
  const [chatOpen, setChatOpen] = useState(false);
  const [reactOpen, setReactOpen] = useState(false);
  // Keep the newest message in view — the list is bottom-anchored so this is
  // what produces the upward-scrolling feed.
  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [chats.length]);

  if (layout === 'youtube') {
    return (
      <View style={chatFx.ytContainer}>
        {/* Header: Live Chat title + collapse + fullscreen */}
        <View style={chatFx.ytHeader}>
          <View style={chatFx.ytHeaderLeft}>
            <Ionicons name="chatbubble-ellipses" size={16} color="#4F46E5" />
            <Text style={chatFx.ytHeaderTitle}>{tr('b4_liveChatTitle')}</Text>
            <View style={chatFx.ytHeaderLiveDot} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              style={chatFx.ytCollapseBtn}
              onPress={onToggleFullscreen}
              hitSlop={8}
              accessibilityLabel={tr('b4_fullScreen')}
            >
              <Ionicons name="expand" size={16} color={chatFx.ytHeaderTitle.color} />
            </Pressable>
            <Pressable
              style={chatFx.ytCollapseBtn}
              onPress={onToggleMinimize}
              hitSlop={8}
              accessibilityLabel={minimized ? 'Expand chat' : 'Collapse chat'}
            >
              <Ionicons
                name={minimized ? 'chevron-down' : 'chevron-up'}
                size={18}
                color={chatFx.ytHeaderTitle.color}
              />
            </Pressable>
          </View>
        </View>

        {minimized ? (
          <Pressable style={chatFx.ytCollapsedTeaser} onPress={onToggleMinimize} hitSlop={8}>
            <Text style={chatFx.ytCollapsedText}>{tr('b4_liveChatHiddenTap')}</Text>
          </Pressable>
        ) : (
          <View style={chatFx.ytBody}>
            {/* Reaction bursts layer — positioned absolute right */}
            <View pointerEvents="none" style={chatFx.ytFloatLayer}>
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
                            outputRange: [0, -220],
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

            {/* Messages list */}
            <ScrollView
              ref={listRef}
              style={chatFx.ytList}
              contentContainerStyle={chatFx.ytListContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {chats.length === 0 ? (
                <Text style={chatFx.ytEmpty}>{tr('b4_welcomeLiveChat')}</Text>
              ) : (
                chats.map((c) => (
                  <YouTubeChatRow
                    key={c.id}
                    chat={c}
                    isOwn={isOwn(c)}
                    onLongPress={isOwn(c) ? undefined : onLongPressChat}
                  />
                ))
              )}
            </ScrollView>

            {/* Quick Reaction Emojis Row */}
            <View style={chatFx.ytReactionsRow} pointerEvents="box-none">
              {emojis.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={chatFx.ytReactionBtn}
                  onPress={() => onReact(emoji)}
                  hitSlop={4}
                >
                  <Text style={chatFx.ytReactionEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </View>

            {/* Composer */}
            <View style={[chatFx.ytComposer, { paddingBottom: Math.max(insetBottom, 6) }]}>
              <Pressable
                style={[chatFx.ytIconBtn, videoSending && { opacity: 0.5 }]}
                onPress={onVideo}
                disabled={videoSending || sending}
                hitSlop={6}
              >
                {videoSending ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Ionicons name="videocam-outline" size={19} color={chatFx.ytMsgText.color} />
                )}
              </Pressable>

              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={canChat ? 'Say something…' : joinHint ?? 'Verify access to chat'}
                placeholderTextColor={chatFx.ytEmpty.color}
                editable={!sending}
                style={chatFx.ytInput}
                returnKeyType="send"
                onSubmitEditing={onSend}
              />

              <Pressable
                style={[chatFx.ytSendBtn, (sending || !draft.trim()) && { opacity: 0.5 }]}
                onPress={onSend}
                disabled={sending || !draft.trim()}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="send" size={15} color="#fff" />
                )}
              </Pressable>
            </View>

            {error ? <Text style={chatFx.ytErrorText}>{error}</Text> : null}
          </View>
        )}
      </View>
    );
  }

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

      {/* Right-side vertical controls pill — exit fullscreen at top, mute + gift + donate below */}
      <View style={chatFx.sideControls} pointerEvents="box-none">
        <Pressable style={[chatFx.ctrlBtn, glassClear]} onPress={onToggleFullscreen} hitSlop={8}
          accessibilityLabel={tr('b4_exitFullScreen')}>
          <GlassLayer />
          <Ionicons name="contract" size={16} color="#fff" />
        </Pressable>
        {onToggleMute ? (
          <Pressable style={[chatFx.ctrlBtn, glassClear]} onPress={onToggleMute} hitSlop={8}
            accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}>
            <GlassLayer />
            <Ionicons name={isMuted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable
          style={[chatFx.ctrlBtn, reactOpen && chatFx.ctrlBtnActive, glassClear]}
          onPress={() => setReactOpen((v) => !v)}
          hitSlop={8}
          accessibilityLabel={reactOpen ? 'Hide reactions' : 'Show reactions'}
        >
          <GlassLayer fill={reactOpen ? CTRL_ACTIVE_FILL : undefined} />
          <Ionicons name="happy-outline" size={16} color="#fff" />
        </Pressable>
        <Pressable
          style={[chatFx.ctrlBtn, chatOpen && chatFx.ctrlBtnActive, glassClear]}
          onPress={() => setChatOpen((v) => !v)}
          hitSlop={8}
          accessibilityLabel={chatOpen ? 'Hide comments' : 'Show comments'}
        >
          <GlassLayer fill={chatOpen ? CTRL_ACTIVE_FILL : undefined} />
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#fff" />
        </Pressable>
        {showGift ? (
          <Pressable style={[chatFx.ctrlBtn, glassClear]} onPress={onGift} hitSlop={8}
            accessibilityLabel={tr('b4_sendAGift')}>
            <GlassLayer />
            <Ionicons name="gift-outline" size={16} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable style={[chatFx.ctrlBtn, glassClear]} onPress={onDonate} hitSlop={8}
          accessibilityLabel="Donate">
          <GlassLayer />
          <Ionicons name="heart-outline" size={16} color="#fff" />
        </Pressable>
      </View>

      {/* Reactions: a column beside the rail, only while toggled open */}
      {reactOpen ? (
        <View style={chatFx.reactPopover} pointerEvents="box-none">
          {emojis.map((emoji) => (
            <Pressable key={emoji} style={[chatFx.reactionBtn, glassClear]} onPress={() => onReact(emoji)} hitSlop={6}>
              <GlassLayer />
              <Text style={chatFx.reactionEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Bottom cluster: messages + composer, only while comments are open */}
      {chatOpen ? (
      <View style={chatFx.bottom}>
        {!minimized ? (
          <ScrollView
            ref={listRef}
            style={[chatFx.list, { maxHeight: maxListHeight }]}
            contentContainerStyle={chatFx.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {chats.length === 0 ? (
              <Text style={chatFx.empty}>{tr('b4_noMessagesYet')}</Text>
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
        ) : null}

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
          <Pressable style={chatFx.minimizeToggle} onPress={onToggleMinimize} hitSlop={8}>
            <Ionicons name={minimized ? 'chevron-up' : 'chevron-down'} size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
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
      ) : null}
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
  useLanguage();
  const styles = useStyles();
  const { colors } = useTheme();
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
  const [infoPhone, setInfoPhone] = useState<PhoneValue | null>(null);
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

  // Expo Router delegates this to react-native-screens, which is already
  // available in the client binary. Keeping it in navigation options avoids
  // loading an optional native module while Expo Router is discovering routes.
  const enterFullscreen = useCallback(() => {
    setChatFullscreen(true);
  }, []);
  const exitFullscreen = useCallback(() => {
    setChatFullscreen(false);
  }, []);
  const [isMuted, setIsMuted] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
  // Backend doesn't echo the anonymous viewerId per chat row, so "is this
  // mine?" is resolved two ways: by matching the viewer's display name,
  // and by remembering the exact text/caption we just sent (covers the
  // window before our name is known and survives the poll refresh).
  const sentTextsRef = useRef<Set<string>>(new Set());

  // ── Gifting ──────────────────────────────────────────────────────────────
  // The GiftTray never collects payment (open/closed flag only — the send
  // hands off to the web checkout). Incoming GIFT chat rows feed
  // `giftEvents`, an append-only, id-deduped list consumed by GiftOverlay
  // for banners / floaters / big-gift takeovers on EVERY platform.
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftConfirm, setGiftConfirm] = useState<GiftCatalogItem | null>(null);
  const [giftPay, setGiftPay] = useState<GiftCatalogItem | null>(null);
  // A gift picked before the viewer registered: resumes into the in-app checkout once they have.
  const [pendingGift, setPendingGift] = useState<GiftCatalogItem | null>(null);
  // A signed-in account pays for a gift as itself, so it never needs the name and email form.
  const signedIn = useAuth((a) => a.status === 'authenticated');
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]);

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
            router.replace(`/(public)/event/${id}` as unknown as Href);
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
             * DEVICE_MISMATCH means this viewer's paid access is bound to a
             * different device. Forced switching isn't supported anymore -
             * quietly try the one legitimate path (device-check, which
             * only succeeds if that other device has gone idle 60s+) before
             * bothering the user with the conflict modal at all.
             */
            const retry = await retryAnonymousDeviceAccess(id, vId, fingerprint);
            if (cancelled) return;
            if (retry.ok) {
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
              // Other device is still actively watching - show the
              // conflict modal explaining that, with a Retry action.
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
                "Backend returned hasAccess=false for this viewerId, even though it accepted you on the event page. Tell support which event id you're testing.",
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

  // ── Session Concurrency Heartbeat (25s) & Clean Deactivation ─────────────
  useEffect(() => {
    if (!viewerId || !accessGranted) return;
    let cancelled = false;

    const doHeartbeat = async () => {
      try {
        const fp = await getDeviceId();
        if (cancelled) return;
        const res = await sendAnonymousHeartbeat(id, viewerId, fp);
        if (!cancelled && res.status === 'DEVICE_CONFLICT') {
          setConflictOpen(true);
        }
      } catch {
        /* best-effort heartbeat */
      }
    };

    doHeartbeat();
    const interval = setInterval(doHeartbeat, 25000);

    // Clean exit hook when app is backgrounded or inactive
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        const fp = await getDeviceId().catch(() => null);
        if (fp) deactivateAnonymousSession(id, fp);
      } else if (nextState === 'active') {
        doHeartbeat();
      }
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      sub.remove();
      getDeviceId().then((fp) => {
        if (fp) deactivateAnonymousSession(id, fp);
      }).catch(() => {});
    };
  }, [viewerId, accessGranted, id]);

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
    const seenGifts = new Set<string>();
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
        // GIFT rows → overlay animations. Deduped by row id; the first
        // batch is history (gifts sent before this viewer arrived) so it
        // is absorbed without animating. The rows stay in page.messages
        // too, where the chat list renders them as styled gift lines.
        for (const m of page.messages) {
          if ((m.chatType ?? m.type ?? '').toUpperCase() !== 'GIFT') continue;
          if (seenGifts.has(m.id)) continue;
          seenGifts.add(m.id);
          if (isFirst) continue;
          const meta = parseGiftMeta(m.giftMeta);
          if (!meta) continue;
          const ev: GiftEvent = {
            ...meta,
            id: m.id,
            senderName: meta.senderName ?? m.viewerName ?? 'Someone',
          };
          setGiftEvents((prev) => [...prev.slice(-49), ev]);
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
                tr('b4_couldNotBlockTitle'),
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
        setTokenError('The stream is starting. Please try again in a moment.');
      } else {
        setTokenError('This event has no live stream right now.');
      }
    } catch (e) {
      setTokenError(isApiError(e) ? e.message : 'Could not validate the token.');
    } finally {
      setTokenBusy(false);
    }
  };

  const onRetryDeviceAccess = async () => {
    if (!viewerId) return;
    setConflictBusy(true);
    try {
      const fingerprint = await getDeviceId();
      const retry = await retryAnonymousDeviceAccess(id, viewerId, fingerprint);
      if (!retry.ok) {
        // Still active elsewhere - keep the modal open with its accurate
        // "already watching on another device" copy; no separate banner
        // needed since that's exactly what the modal already says.
        return;
      }
      const res = await checkAnonymousAccessStatus(id, viewerId, fingerprint);
      if (res.active && res.hlsManifestUrl) {
        setManifestUrl(res.hlsManifestUrl);
        setAccessGranted(true);
        setConflictOpen(false);
      } else {
        setTokenError(null);
        setConflictOpen(false);
      }
    } catch (e) {
      setTokenError(isApiError(e) ? e.message : 'Could not confirm access.');
      setConflictOpen(false);
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
    if (status.isPaid && !infoPhone?.isValid) {
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
        // Paid events submit the wire format: full international digits,
        // no '+' ("250788123456").
        phone: status.isPaid ? (infoPhone?.digits ?? '') : '0000000000',
        deviceId: fingerprint,
      });
      // Only PAID events gate on a real purchase. On a free event we
      // register the person outright so they can comment immediately.
      if (reg.needsPayment && status.isPaid) {
        setInfoError("We couldn't find a paid record for this email. Buy access to start.");
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
      if (pendingGift) {
        const gift = pendingGift;
        setPendingGift(null);
        // iOS drops a Modal presented while another is still sliding away.
        setTimeout(() => setGiftPay(gift), MODAL_HANDOFF_MS);
      }
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
      try {
        await sendPublicStreamChat(id, { viewerId, deviceFingerprint: fingerprint, message: msg });
      } catch (e) {
        // Backend rejects when the stored fingerprint doesn't match the one
        // registered for this viewerId (e.g. after reinstall / storage wipe).
        // Silently attempt to re-bind this device then retry once.
        const msg2 = isApiError(e) ? e.message.toLowerCase() : '';
        if (msg2.includes('fingerprint') || msg2.includes('mismatch') || msg2.includes('device')) {
          const retry = await retryAnonymousDeviceAccess(id, viewerId, fingerprint);
          if (retry.ok) {
            await sendPublicStreamChat(id, { viewerId, deviceFingerprint: fingerprint, message: msg });
          } else {
            throw e; // other device still active — surface the real error
          }
        } else {
          throw e;
        }
      }
      sentTextsRef.current.add(msg);
      setChatDraft('');
    } catch (e) {
      setChatError(isApiError(e) ? e.message : 'Could not send.');
    } finally {
      setChatSending(false);
    }
  };

  const onSendReaction = async (emoji: string) => {
    burstFloating(emoji); // optimistic local burst
    try {
      const fingerprint = await getDeviceId();
      await sendPublicStreamReaction(id, {
        emoji,
        deviceFingerprint: fingerprint,
        viewerId: viewerId ?? undefined,
        name: viewerName || undefined,
      });
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
      const videoPayload = {
        viewerId,
        deviceFingerprint: fingerprint,
        video: {
          uri: asset.uri,
          name: asset.fileName ?? `wish-${Date.now()}.mp4`,
          mimeType: asset.mimeType ?? 'video/mp4',
        },
        content: chatDraft.trim() || undefined,
      };
      try {
        await sendPublicVideoChat(id, videoPayload);
      } catch (e) {
        const msg2 = isApiError(e) ? e.message.toLowerCase() : '';
        if (msg2.includes('fingerprint') || msg2.includes('mismatch') || msg2.includes('device')) {
          const retry = await retryAnonymousDeviceAccess(id, viewerId, fingerprint);
          if (retry.ok) {
            await sendPublicVideoChat(id, videoPayload);
          } else {
            throw e;
          }
        } else {
          throw e;
        }
      }
      sentTextsRef.current.add(chatDraft.trim() || '[Video Message]');
      setChatDraft('');
    } catch (e) {
      setChatError(isApiError(e) ? e.message : 'Could not send video message.');
    } finally {
      setVideoSending(false);
    }
  };

  // Step 1 — user picks a gift in the tray → show confirmation sheet.
  const onSendGift = (gift: GiftCatalogItem) => {
    if (!giftsEnabled) return;
    setGiftOpen(false);
    setGiftConfirm(gift);
  };

  // Step 2 — user confirms. A registered viewer pays in the app (GiftCheckoutSheet);
  // without a viewer id there is no identity to bind the gift to, so fall back
  // to the web page, which registers one.
  const fireLocalGift = (gift: GiftCatalogItem) => {
    setGiftEvents((prev) => [
      ...prev.slice(-49),
      {
        id: `local-${Date.now()}`,
        code: gift.code,
        name: gift.name,
        emoji: gift.emoji,
        amountUsd: gift.amountUsd,
        bigAnimation: gift.bigAnimation,
        senderName: viewerName || 'You',
        message: '',
      },
    ]);
  };

  const onConfirmGift = async () => {
    if (!giftConfirm) return;
    const gift = giftConfirm;
    setGiftConfirm(null);
    if (viewerId || signedIn) {
      setTimeout(() => setGiftPay(gift), MODAL_HANDOFF_MS);
      return;
    }
    // Not registered yet: collect name and email here, then resume into the
    // in-app checkout (see onSubmitInfo). The viewer never leaves the app.
    setPendingGift(gift);
    setInfoError(null);
    setTimeout(() => setInfoModalOpen(true), MODAL_HANDOFF_MS);
  };

  const closeInfoModal = () => {
    setInfoModalOpen(false);
    setPendingGift(null);
  };

  const onDonate = () => router.push(`/(public)/donate?eventId=${id}` as unknown as Href);

  /*
   * Viewer-info modal, rendered once on the screen and once inside the fullscreen chat
   * modal: iOS cannot present a second Modal beside an open one, so a gift started from
   * fullscreen chat would never have shown this form. PAID events: "Verify your access"
   * (name, email, phone). FREE events: name and email only, which registers the viewer.
   */
  const renderInfoModal = (open: boolean) => (
    <Modal visible={open} transparent animationType="slide" onRequestClose={closeInfoModal}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalKeyboard}
      >
      <Pressable style={styles.modalBackdrop} onPress={closeInfoModal}>
        <Pressable
          style={[styles.modalSheet, { maxHeight: '90%', paddingBottom: Math.max(insets.bottom, spacing.xl) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {status.isPaid ? 'Verify your access' : pendingGift ? 'Send your gift' : 'Join the chat'}
            </Text>
            <Text style={styles.modalHint}>
              {status.isPaid
                ? "Enter the name, email and phone you used when buying your ticket. We'll restore access on this device."
                : pendingGift
                  ? 'Enter your name and email to send your gift. No account needed.'
                  : 'Enter your name and email to comment. No account needed, and this event is free.'}
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
              // NOTE: light variant on purpose — this modal renders on the
              // light bottom sheet (styles.modalSheet uses colors.surface),
              // so the dark PhoneInput variant would be illegible here.
              <PhoneInput
                label="Phone"
                defaultIso2="RW"
                onChange={setInfoPhone}
              />
            ) : null}
            {infoError ? <Text style={styles.chatErrorText}>{infoError}</Text> : null}
            <Button
              title={
                infoBusy
                  ? status.isPaid ? 'Verifying…' : 'Joining…'
                  : status.isPaid ? 'Verify access' : pendingGift ? 'Continue to payment' : 'Join chat'
              }
              onPress={onSubmitViewerInfo}
              loading={infoBusy}
            />
            {status.isPaid && digitalPurchasesEnabled ? (
              <Pressable
                onPress={() => router.push(`/(public)/events/pay?id=${id}` as unknown as Href)}
                style={{ alignItems: 'center', marginTop: 8 }}
              >
                <Text style={styles.linkText}>Buy access instead</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const eventTitle = event.data?.title ?? 'Live stream';
  const eventThumbSource = event.data?.eventPhoto ? { uri: event.data.eventPhoto } : EVENT_COVER_PLACEHOLDER;
  // The host is the event's ORGANIZER / creator (the person putting on the
  // event) — not the photographer shooting it.
  const hostName =
    event.data?.eventOrganizer ||
    [event.data?.creator?.firstName, event.data?.creator?.lastName].filter(Boolean).join(' ') ||
    undefined;
  const hostImage = event.data?.creator?.profilePicture;

  // Non-live placeholder card (ended, cancelled, photo finder, upcoming)
  const offlineStageContent = (
    <>
      <Image source={eventThumbSource} style={StyleSheet.absoluteFill} contentFit="cover" />
      <View style={styles.placeholderScrim} />
      <StreamWatermark position="top-right" />
      {status.isCancelled || status.isEnded ? (
        <View style={styles.placeholderContentFlow}>
          <Ionicons
            name={status.isCancelled ? 'close-circle' : 'archive'}
            size={42}
            color="rgba(255,255,255,0.85)"
          />
          <Text style={styles.placeholderHeadline}>
            {status.isCancelled ? 'Event cancelled' : 'Event ended'}
          </Text>
          {status.isEnded ? (
            <View style={{ alignItems: 'center', marginTop: 4, gap: 12 }}>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: 13,
                  textAlign: 'center',
                  lineHeight: 19,
                }}
              >
                {tr('b4_attendedInPersonFindPhotos')}
              </Text>
              <View style={{ flexDirection: 'column', gap: 10, alignItems: 'center', width: '100%' }}>
                <Pressable
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.3)',
                      width: '100%',
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => (id ? router.push(`/(public)/event/${id}` as never) : router.back())}
                  accessibilityRole="button"
                  accessibilityLabel="View Event Details"
                >
                  <Ionicons name="eye-outline" size={16} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                    View Details
                  </Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      backgroundColor: '#4F46E5',
                      paddingHorizontal: 20,
                      paddingVertical: 12,
                      borderRadius: 999,
                      width: '100%',
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => router.push('/find-photos' as never)}
                  accessibilityRole="button"
                  accessibilityLabel="Find My Photos"
                >
                  <Ionicons name="search" size={16} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                    Find My Photos
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={styles.placeholderContent}>
          <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.85)" />
          <Text style={styles.placeholderText}>
            {tr('b4_streamWillAppearOnceLive')}
          </Text>
        </View>
      )}
    </>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, orientation: chatFullscreen ? 'landscape' : 'portrait' }} />
      <Screen padded={false} edges={[]}>
      {status.isLive && !isMiniPlayer ? (
        // ── LIVE: YouTube style layout ──
        <View style={styles.ytRoot}>
          {/* Branded header stays visible above the live player. */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.topBarPill}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore-events'))}
                hitSlop={12}
                style={({ pressed }) => [styles.topBarBackBtn, pressed && styles.topBarBackBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel={tr('b4_goBack')}
              >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>

              <View style={styles.topBarPillCenter}>
                <Text style={styles.topBarPillText} numberOfLines={1}>Live stream</Text>
              </View>

              <View style={styles.topBarSpacer} />
            </View>
          </View>

          {/* 1. 16:9 Player Stage */}
          <View style={styles.ytStageWrap}>
            <View style={styles.ytStage}>
              {manifestUrl ? (
                chatFullscreen ? (
                  <Pressable style={styles.fsReturn} onPress={exitFullscreen}>
                    <Image source={eventThumbSource} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <View style={styles.placeholderScrim} />
                    <Ionicons name="scan-outline" size={30} color="rgba(255,255,255,0.9)" />
                    <Text style={styles.placeholderText}>{tr('b4_playingInFullScreenTapReturn')}</Text>
                  </Pressable>
                ) : (
                  <HlsPlayer
                    url={manifestUrl}
                    style={StyleSheet.absoluteFill}
                    controls={false}
                    showLiveBadge={false}
                    muted={isMuted}
                  />
                )
              ) : (
                <>
                  <Image source={eventThumbSource} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={styles.placeholderScrim} />
                  <StreamWatermark position="top-right" />
                  <View style={styles.placeholderContent}>
                    {accessLoading ? (
                      <>
                        <ActivityIndicator color="#10b981" size="large" />
                        <Text style={styles.placeholderHeadline}>{tr('b4_verifyingAccess')}</Text>
                        <Text style={styles.placeholderText}>{tr('b4_pleaseWaitConfirmAccess')}</Text>
                      </>
                    ) : status.isLive && accessGranted ? (
                      <>
                        <ActivityIndicator color="#10b981" size="large" />
                        <Text style={styles.placeholderText}>{tr('b4_streamIsLoading')}</Text>
                      </>
                    ) : status.isLive && status.isPaid ? (
                      <>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.placeholderHeadline}>{tr('b4_loading')}</Text>
                      </>
                    ) : (
                      <>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.placeholderHeadline}>{tr('b4_streamIsStarting')}</Text>
                        <Text style={styles.placeholderText}>{tr('b4_hangTightStreamLoading')}</Text>
                      </>
                    )}
                  </View>
                </>
              )}

              {/* Top Controls Overlay on Video: Back + Minimize only — left side */}
              {!chatFullscreen ? (
                <View style={styles.ytStageTopOverlay} pointerEvents="box-none" />
              ) : null}

              {/* In-video Gift Overlay */}
              {!chatFullscreen ? (
                <GiftOverlay
                  events={giftEvents}
                  bannerTop={48}
                  floaterBottom={36}
                  riseDistance={110}
                />
              ) : null}

              {/* In-video Sponsor Ads Overlay */}
              <StreamAdOverlay
                eventId={id}
                viewerId={viewerId}
                enabled={status.isLive && !!manifestUrl && !chatFullscreen}
                insetTop={0}
                insetBottom={0}
              />

              {/* Bottom Controls Overlay: LIVE badge left · mute + gift + fullscreen right */}
              {!chatFullscreen ? (
                <View style={styles.ytStageBottomOverlay} pointerEvents="box-none">
                  <View style={styles.ytStageLiveBadge}>
                    <View style={styles.ytStageLiveDot} />
                    <Text style={styles.ytStageLiveText}>LIVE</Text>
                  </View>

                  <View style={styles.ytStageBottomRight}>
                    {giftsEnabled ? (
                      <Pressable
                        style={[styles.ytStageIconBtn, glassClear]}
                        onPress={() => setGiftOpen(true)}
                        hitSlop={8}
                        accessibilityLabel={tr('b4_sendAGift')}
                      >
                        <GlassLayer />
                        <Ionicons name="gift-outline" size={17} color="#fff" />
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[styles.ytStageIconBtn, glassClear]}
                      onPress={onDonate}
                      hitSlop={8}
                      accessibilityLabel="Donate"
                    >
                      <GlassLayer />
                      <Ionicons name="heart-outline" size={17} color="#fff" />
                    </Pressable>
                    <Pressable
                      style={[styles.ytStageIconBtn, glassClear]}
                      onPress={() => setIsMuted((m) => !m)}
                      hitSlop={8}
                      accessibilityLabel={isMuted ? 'Unmute stream' : 'Mute stream'}
                    >
                      <GlassLayer />
                      <Ionicons
                        name={isMuted ? 'volume-mute' : 'volume-high'}
                        size={18}
                        color="#fff"
                      />
                    </Pressable>
                    <Pressable
                      style={[styles.ytStageIconBtn, glassClear]}
                      onPress={enterFullscreen}
                      hitSlop={8}
                      accessibilityLabel="Full screen cinema mode"
                    >
                      <GlassLayer />
                      <Ionicons name="expand" size={17} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          </View>

          {/* Invite-token entry (if token needed and not paid) */}
          {!manifestUrl && !status.isPaid ? (
            <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
              <View style={styles.tokenCard}>
                <Text style={styles.tokenLabel}>{tr('b4_haveAnInviteToken')}</Text>
                <Input
                  value={tokenInput}
                  onChangeText={setTokenInput}
                  placeholder={tr('b4_pasteTokenFromInvitation')}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Button title={tr('b4_joinStream')} onPress={onJoinWithToken} loading={tokenBusy} />
                <Pressable
                  onPress={() => router.replace(`/(public)/event/${id}` as unknown as Href)}
                  style={{ alignItems: 'center', marginTop: 4 }}
                >
                  <Text style={styles.linkText}>{tr('b4_backToEventDetails')}</Text>
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

          {/* 2. Event & Host Meta Section */}
          <View style={styles.ytMetaSection}>
            <View style={styles.ytMetaTop}>
              {hostImage ? (
                <Image source={{ uri: hostImage }} style={styles.ytHostAvatar} contentFit="cover" />
              ) : (
                <View style={[styles.ytHostAvatar, styles.ytHostAvatarFallback]}>
                  <Text style={styles.ytHostInitial}>
                    {(hostName || eventTitle).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.ytEventTitle} numberOfLines={1}>{eventTitle}</Text>
                <Text style={styles.ytHostName} numberOfLines={1}>
                  {hostName ?? 'Event Host'}
                </Text>
              </View>
              <View style={styles.ytMetaRight}>
                {viewerCount > 0 ? (
                  <View style={styles.ytViewerPill}>
                    <View style={styles.ytViewerDot} />
                    <Ionicons name="eye" size={11} color="#fff" />
                    <Text style={styles.ytViewerPillText}>
                      {viewerCount >= 1000
                        ? `${(viewerCount / 1000).toFixed(1)}k`
                        : viewerCount.toLocaleString()}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* 3. Live Chat — fills remaining screen below meta */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.ytChatWrapper}
          >
            <LiveChatPanel
              layout="youtube"
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
              onToggleFullscreen={enterFullscreen}
              onGift={() => setGiftOpen(true)}
              showGift={giftsEnabled}
              onDonate={onDonate}
              maxListHeight={Math.round(windowHeight * 0.35)}
              insetBottom={insets.bottom}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
            />
          </KeyboardAvoidingView>
        </View>
      ) : (
        // ── NOT LIVE or MINI-PLAYER BROWSE: boxed 16:9 card + details/status below ────
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          {/* Top Bar */}
          <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
            <View style={styles.topBarPill}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore-events'))}
                hitSlop={12}
                style={({ pressed }) => [styles.topBarBackBtn, pressed && styles.topBarBackBtnPressed]}
                accessibilityRole="button"
                accessibilityLabel={tr('b4_goBack')}
              >
                <Ionicons name="chevron-back" size={24} color={colors.text} />
              </Pressable>

              <View style={styles.topBarPillCenter}>
                <Text style={styles.topBarPillText} numberOfLines={1}>
                  {status.isLive ? 'Now Streaming' : status.isEnded ? 'Event Ended' : 'Live Stream'}
                </Text>
              </View>

              <View style={styles.topBarSpacer} />
            </View>
          </View>

          <ScrollView contentContainerStyle={[styles.scroll, status.isLive && { paddingBottom: insets.bottom + 84 }]}>
            {status.isLive && isMiniPlayer ? (
              <Pressable
                style={styles.ytBrowseNotice}
                onPress={() => setIsMiniPlayer(false)}
                accessibilityRole="button"
                accessibilityLabel="Restore stream player"
              >
                <View style={styles.ytBrowseNoticeLeft}>
                  <View style={styles.ytStageLiveDot} />
                  <Text style={styles.ytBrowseNoticeText}>
                    {tr('b4_streamMiniPlayerTapExpand')}
                  </Text>
                </View>
                <Ionicons name="expand" size={16} color={colors.primary} />
              </Pressable>
            ) : null}

            <Text style={styles.offlineTitle} numberOfLines={2}>
              {eventTitle}
            </Text>

            {status.isLive && isMiniPlayer ? (
              <Pressable
                style={[styles.playerStage, styles.playerStageRatio]}
                onPress={() => setIsMiniPlayer(false)}
                accessibilityRole="button"
                accessibilityLabel="Expand to full player"
              >
                <Image source={eventThumbSource} style={StyleSheet.absoluteFill} contentFit="cover" />
                <View style={styles.placeholderScrim} />
                <View style={styles.placeholderContent}>
                  <Ionicons name="scan-outline" size={32} color="#fff" />
                  <Text style={styles.placeholderHeadline}>{tr('b4_playingInMiniPlayer')}</Text>
                  <Text style={styles.placeholderText}>{tr('b4_tapToExpandFullPlayer')}</Text>
                </View>
              </Pressable>
            ) : (
              <View style={[styles.playerStage, (status.isEnded || status.isCancelled) ? styles.playerStageEnded : styles.playerStageRatio]}>{offlineStageContent}</View>
            )}

            {tokenError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={20} color={colors.error} />
                <Text style={styles.errorText}>{tokenError}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      )}

      {/* Floating Mini-Player Dock */}
      {status.isLive && isMiniPlayer ? (
        <View style={[styles.ytMiniPlayer, { bottom: insets.bottom + 8 }]}>
          <Pressable
            style={styles.ytMiniPressable}
            onPress={() => setIsMiniPlayer(false)}
            accessibilityRole="button"
            accessibilityLabel="Expand stream player"
          >
            <View style={styles.ytMiniVideo}>
              {manifestUrl ? (
                <HlsPlayer
                  url={manifestUrl}
                  style={StyleSheet.absoluteFill}
                  controls={false}
                  showLiveBadge={false}
                  muted={isMuted}
                />
              ) : (
                <Image source={eventThumbSource} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
            </View>

            <View style={styles.ytMiniMeta}>
              <Text style={styles.ytMiniTitle} numberOfLines={1}>
                {eventTitle}
              </Text>
              <View style={styles.ytMiniLiveRow}>
                <View style={styles.ytStageLiveDot} />
                <Text style={styles.ytMiniLiveText}>LIVE</Text>
                {viewerCount > 0 ? (
                  <Text style={styles.ytMiniViewers}>· {viewerCount.toLocaleString()}</Text>
                ) : null}
              </View>
            </View>
          </Pressable>

          <View style={styles.ytMiniActions}>
            <Pressable
              style={styles.ytMiniActionBtn}
              onPress={() => setIsMuted((m) => !m)}
              hitSlop={8}
              accessibilityLabel={isMuted ? 'Unmute stream' : 'Mute stream'}
            >
              <Ionicons
                name={isMuted ? 'volume-mute' : 'volume-high'}
                size={18}
                color={colors.text}
              />
            </Pressable>
            <Pressable
              style={styles.ytMiniActionBtn}
              onPress={() => setIsMiniPlayer(false)}
              hitSlop={8}
              accessibilityLabel="Maximize stream player"
            >
              <Ionicons name="expand" size={17} color={colors.text} />
            </Pressable>
            <Pressable
              style={styles.ytMiniActionBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore-events'))}
              hitSlop={8}
              accessibilityLabel="Close stream"
            >
              <Ionicons name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Full-screen immersive view — the player fills the screen with the
          same TikTok chat overlay + rising reactions on top. */}
      <Modal
        visible={chatFullscreen}
        animationType="fade"
        onRequestClose={exitFullscreen}
        supportedOrientations={['portrait', 'landscape']}
        statusBarTranslucent
      >
        <View style={styles.fsRoot}>
          {manifestUrl ? (
            <HlsPlayer
              url={manifestUrl}
              style={StyleSheet.absoluteFill}
              controlsBottomOffset={insets.bottom + 72}
              showLiveBadge={false}
              muted={isMuted}
            />
          ) : (
            <>
              <Image source={eventThumbSource} style={StyleSheet.absoluteFill} contentFit="cover" />
              <View style={styles.placeholderScrim} />
              <StreamWatermark position="top-right" />
            </>
          )}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={StyleSheet.absoluteFill}
            pointerEvents="box-none"
          >
            <LiveChatPanel
              layout="overlay"
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
              onToggleFullscreen={exitFullscreen}
              onGift={() => setGiftOpen(true)}
              showGift={giftsEnabled}
              onDonate={onDonate}
              maxListHeight={Math.round(windowHeight * 0.4)}
              insetTop={insets.top}
              insetBottom={insets.bottom}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted((m) => !m)}
            />
            {/* Incoming gift animations in the immersive view too. This
                fresh GiftOverlay instance absorbs the existing giftEvents
                history on mount, so entering fullscreen never replays old
                banners — only gifts arriving from now on animate. */}
            <GiftOverlay
              events={giftEvents}
              bannerTop={insets.top + 64}
              floaterBottom={150}
              riseDistance={Math.round(windowHeight * 0.5)}
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

          {/* Gift tray + confirm sheet must live INSIDE the fullscreen
              modal so they render above it, not behind it. */}
          <GiftTray
            visible={giftOpen}
            onClose={() => setGiftOpen(false)}
            onSendGift={onSendGift}
          />
          <GiftConfirmSheet
            gift={giftConfirm}
            visible={!!giftConfirm}
            onClose={() => setGiftConfirm(null)}
            onConfirm={onConfirmGift}
          />
          {renderInfoModal(infoModalOpen && chatFullscreen)}
          <GiftCheckoutSheet
            visible={!!giftPay && chatFullscreen}
            onClose={() => setGiftPay(null)}
            onSettled={() => giftPay && fireLocalGift(giftPay)}
            eventId={id}
            viewerId={viewerId ?? ''}
            gift={giftPay}
            eventTitle={eventTitle}
          />
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
            <Text style={styles.modalTitle}>{tr('b4_watchingOnAnotherDeviceTitle')}</Text>
            <Text style={styles.modalHint}>
              Only one device can watch on the same paid ticket at a time. It'll free up
              automatically once the other device stops watching. Tap retry to check.
            </Text>
            <Button
              title={conflictBusy ? 'Checking…' : 'Retry'}
              onPress={onRetryDeviceAccess}
              loading={conflictBusy}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {renderInfoModal(infoModalOpen && !chatFullscreen)}

      {/* Gift tray — catalog-driven picker; picking a gift hands off to the
          web checkout with that gift preselected. No in-app payment
          collection. The gift button that opens this is gated on
          giftsEnabled (showGift). */}
      <GiftTray visible={giftOpen} onClose={() => setGiftOpen(false)} onSendGift={onSendGift} />

      {/* Gift confirmation sheet — shown after picking a gift, before
          opening the web checkout. Gives the user a clear summary and
          a single deliberate CTA so they know exactly what’s happening. */}
      <GiftConfirmSheet
        gift={giftConfirm}
        visible={!!giftConfirm}
        onClose={() => setGiftConfirm(null)}
        onConfirm={onConfirmGift}
      />
      <GiftCheckoutSheet
            visible={!!giftPay && !chatFullscreen}
            onClose={() => setGiftPay(null)}
            onSettled={() => giftPay && fireLocalGift(giftPay)}
            eventId={id}
            viewerId={viewerId ?? ''}
            gift={giftPay}
            eventTitle={eventTitle}
          />

      {/* Report a live-chat message (long-press a message to open). */}
      <ReportSheet
        visible={!!reportChat}
        onClose={() => setReportChat(null)}
        targetType="STREAM_CHAT"
        subject={reportChat?.viewerName || reportChat?.senderName || undefined}
        submit={submitChatReport}
      />
      </Screen>
    </>
  );
}

// ─── Gift Confirmation Sheet ──────────────────────────────────────────────

function GiftConfirmSheet({
  gift,
  visible,
  onClose,
  onConfirm,
}: {
  gift: GiftCatalogItem | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  if (!gift) return null;

  const handle = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={gcStyles.scrim} onPress={onClose} />
      <View style={[gcStyles.sheet, { paddingBottom: insets.bottom + 24 }]}>
        <View style={gcStyles.handle} />

        {/* Gift preview */}
        <View style={gcStyles.preview}>
          <Text style={gcStyles.emoji}>{gift.emoji}</Text>
          <Text style={gcStyles.giftName}>{gift.name}</Text>
          <Text style={gcStyles.giftPrice}>{formatGiftUsd(gift.amountUsd)}</Text>
        </View>

        {/* Info row */}
        <View style={gcStyles.infoRow}>
          <Ionicons name="globe-outline" size={15} color={colors.info} />
          <Text style={gcStyles.infoText}>
            {tr('b4_giftConfirmInfo')}
          </Text>
        </View>

        {/* CTA */}
        <Pressable
          style={({ pressed }) => [gcStyles.cta, pressed && { opacity: 0.85 }, busy && { opacity: 0.6 }]}
          onPress={handle}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={`Send ${gift.name} gift`}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="gift" size={18} color="#fff" />
              <Text style={gcStyles.ctaText}>Send {gift.emoji} {gift.name} · {formatGiftUsd(gift.amountUsd)}</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={onClose} hitSlop={10} style={gcStyles.cancel}>
          <Text style={gcStyles.cancelText}>{tr('b4_cancel')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const gcStyles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: '#12151e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 16,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  preview: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
  },
  emoji: { fontSize: 52 },
  giftName: { color: '#fff', fontSize: 18, fontWeight: '700' },
  giftPrice: { color: '#ffd166', fontSize: 22, fontWeight: '800' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(99,179,237,0.1)',
    borderRadius: 10,
    padding: 12,
  },
  infoText: { flex: 1, color: '#90cdf4', fontSize: 12, lineHeight: 18 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F20C8F',
    borderRadius: 50,
    paddingVertical: 15,
  },
  ctaText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  cancel: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { color: 'rgba(255,255,255,0.45)', fontSize: 13 },
});

// ─── Styles ────────────────────────────────────────────────────────────────

const useStyles = makeStyles((c, e) => ({
  topBackCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    gap: spacing.xs + 2,
  },
  topBarPillText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: c.primary,
  },
  topBarSpacer: {
    width: 40,
    height: 40,
  },

  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 140 },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  viewerBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  offlineTitle: { fontFamily: fonts.bold, fontSize: fontSize.xl, color: c.text, letterSpacing: -0.3 },

  // Details overlaid on the top of the video stage
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: spacing.md, paddingHorizontal: spacing.md },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 96 },
  // paddingRight leaves room for the muted brand watermark bug (logo + logo)
  // which sits at the top-right corner of the video stage.
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: 110 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  topAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  topAvatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
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
  placeholderScrim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(7,8,13,0.62)' },
  placeholderContent: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  placeholderContentFlow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: 32,
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
  placeholderCtaText: { color: c.primary, fontWeight: '800', fontSize: fontSize.sm },
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
  playerStageEnded: { minHeight: 280 },

  // Live full-bleed: the video fills the whole screen, everything overlays.
  liveRoot: { flex: 1, backgroundColor: '#000' },
  stageFull: { flex: 1, backgroundColor: '#000', position: 'relative', overflow: 'hidden' },

  // YouTube 16:9 stage and meta layout
  ytRoot: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: c.background,
  },
  ytStageWrap: {
    backgroundColor: '#000',
    width: '100%',
  },
  ytStage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#000',
    position: 'relative',
    overflow: 'hidden',
  },
  ytStageTopOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: 10,
    zIndex: 10,
  },
  ytStageTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ytStageIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  ytStageBottomOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 10,
  },
  ytStageLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 4,
  },
  ytStageLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  ytStageLiveText: {
    color: '#fff',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  ytStageBottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ytMetaSection: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  ytMetaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ytEventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: c.text,
    lineHeight: 19,
  },
  ytHostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  ytHostInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  ytHostAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceMuted,
    borderWidth: 2,
    borderColor: c.primary,
  },
  ytHostAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  ytHostInitial: { color: '#fff', fontSize: 14, fontWeight: '800' },
  ytHostName: { fontSize: 12, color: c.textMuted, fontWeight: '500', marginTop: 1 },
  ytMetaRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ytViewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  ytViewerDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  ytViewerPillText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ytViewerCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  ytViewerCountText: { fontSize: 11.5, color: c.textMuted },
  ytActionPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ytGiftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F43F5E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  ytGiftPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  ytChatWrapper: {
    flex: 1,
    backgroundColor: c.surface,
  },

  // Floating Mini-Player Dock
  ytMiniPlayer: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 60,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: c.borderSoft,
    zIndex: 999,
  },
  ytMiniPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  ytMiniVideo: {
    width: 84,
    height: 48,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  ytMiniMeta: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ytMiniTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: c.text,
  },
  ytMiniLiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ytMiniLiveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ef4444',
  },
  ytMiniViewers: {
    fontSize: 10,
    color: c.textMuted,
  },
  ytMiniActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ytMiniActionBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Mini-player browse banner
  ytBrowseNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  ytBrowseNoticeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  ytBrowseNoticeText: {
    fontSize: 12,
    color: c.text,
    fontWeight: '600',
    flex: 1,
  },
  tokenOverlay: {
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  fsRoot: { flex: 1, backgroundColor: '#000' },
  chatHint: {
    fontSize: fontSize.xs,
    color: c.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  tokenCard: {
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.md,
  },
  tokenLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  linkText: {
    textAlign: 'center',
    color: c.primary,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.errorBg,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  errorText: { flex: 1, color: c.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  chatCard: {
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: spacing.md,
  },
  chatTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chatTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  giftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.accent,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  giftPillText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  chatList: { gap: 8, maxHeight: 320 },
  chatEmpty: { fontSize: fontSize.sm, color: c.textMuted, fontStyle: 'italic' },

  // Sender differentiation: mine right-aligned, others left with avatar.
  rowOther: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '88%' },
  rowOwn: { flexDirection: 'row', justifyContent: 'flex-end' },
  avatar: { width: 26, height: 26, borderRadius: 13, backgroundColor: c.surfaceMuted },
  avatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.primary,
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
  bubbleOther: { backgroundColor: c.surfaceMuted, borderTopLeftRadius: 4 },
  bubbleOwn: {
    backgroundColor: c.primary,
    borderTopRightRadius: 4,
    maxWidth: '88%',
  },
  bubbleHeadRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bubbleSender: { fontSize: 11, fontWeight: '700', color: c.primary, flexShrink: 1 },
  bubbleSenderOwn: { color: 'rgba(255,255,255,0.92)' },
  bubbleTime: { fontSize: 10, color: c.textMuted },
  bubbleTimeOwn: { fontSize: 10, color: 'rgba(255,255,255,0.7)' },
  bubbleText: { fontSize: fontSize.sm, color: c.text },
  bubbleTextOwn: { color: '#fff' },

  chatVideoWrap: { marginTop: 4, gap: 4 },
  chatVideo: { width: 220, height: 124, borderRadius: 8, backgroundColor: '#000' },
  chatVideoTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chatVideoTagText: { fontSize: 11, color: c.primary, fontStyle: 'italic', fontWeight: '600' },

  reactionsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  reactionBtn: {
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  reactionEmoji: { fontSize: 18 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerInput: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: c.text,
    fontSize: fontSize.sm,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatErrorText: { color: c.error, fontSize: 12 },

  floatingLayer: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  floatingEmoji: { position: 'absolute', bottom: 80, fontSize: 32 },

  modalKeyboard: { flex: 1 },
  modalContent: { gap: spacing.md },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  modalHint: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20, marginBottom: spacing.sm },

  giftLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: c.textSoft,
    marginTop: spacing.sm,
    letterSpacing: 0.4,
  },
  amountChipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginVertical: 6 },
  amountChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  amountChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  amountChipText: { fontSize: fontSize.xs, color: c.textSoft, fontWeight: '700' },
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
    backgroundColor: c.surfaceMuted,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
  payTabActive: { borderColor: c.primary, backgroundColor: c.infoBg },
  payTabText: { fontSize: fontSize.sm, color: c.textMuted, fontWeight: '700' },
  payTabTextActive: { color: c.primary },
}));

// ─── TikTok-style chat overlay styles ────────────────────────────────────
// Everything here is drawn OVER the video: the panel itself is transparent,
// legibility comes from per-element translucent-black pills + text shadows.
const useChatFx = makeStyles((c) => ({
  panel: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
  },

  // Reaction bursts rise straight up from the bottom-right corner.
  floatLayer: { position: 'absolute', right: 56, bottom: 64, top: 0, width: 50 },
  floatEmoji: { position: 'absolute', bottom: 0, fontSize: 28 },

  // Right-side vertical controls pill (fullscreen overlay)
  sideControls: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  controlsLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.4)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radii.full },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#ef4444' },
  controlsTitle: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 3 },
  controlsRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ctrlBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctrlBtnActive: { backgroundColor: 'rgba(255,255,255,0.28)' },
  reactPopover: {
    position: 'absolute',
    right: 56,
    top: 0,
    bottom: 0,
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
  },

  minimizeToggle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlsEmpty: { height: 1 },
  inlineControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  minimizedBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  minimizedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
  },
  minimizedBarText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
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
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary },
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

  // GIFT rows: pink-tinted pill + gold amount, matching the GiftOverlay
  // banner language so gifts read as one system across chat and overlay.
  giftPill: {
    backgroundColor: 'rgba(242,12,143,0.30)',
    borderWidth: 1,
    borderColor: 'rgba(242,12,143,0.55)',
  },
  giftLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  giftEmoji: { fontSize: 16, lineHeight: 18 },
  giftText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    flexShrink: 1,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowRadius: 2,
  },
  giftAmount: { color: '#ffd166', fontWeight: '800' },

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
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#fca5a5',
    fontSize: 11.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 2,
  },

  // YouTube Live Chat Layout styles
  ytContainer: {
    flex: 1,
    backgroundColor: c.surface,
  },
  ytHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  ytHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ytHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: c.text,
    letterSpacing: 0.3,
  },
  ytHeaderLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#ef4444',
  },
  ytCollapseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ytCollapsedTeaser: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  ytCollapsedText: {
    fontSize: 13,
    color: c.textMuted,
    fontWeight: '600',
  },
  ytBody: {
    flex: 1,
    position: 'relative',
    backgroundColor: c.background,
  },
  ytFloatLayer: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    top: 0,
    width: 60,
    zIndex: 20,
    pointerEvents: 'none',
  },
  ytList: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 14,
  },
  ytListContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingVertical: 10,
    gap: 2,
  },
  ytEmpty: {
    color: c.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 24,
  },
  ytRow: { width: '100%' },
  ytRowPressable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  ytGiftRow: {
    backgroundColor: 'rgba(242,12,143,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242,12,143,0.25)',
    padding: 10,
    borderRadius: 10,
    marginVertical: 2,
  },
  ytAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.surfaceMuted,
  },
  ytAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  ytAvatarInitial: { color: '#fff', fontSize: 12, fontWeight: '800' },
  ytMsgCol: { flex: 1, minWidth: 0, gap: 2 },
  ytNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ytAuthorName: { fontSize: 12.5, fontWeight: '700', color: c.primary },
  ytAuthorOwn: { color: '#f59e0b' },
  ytYouBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.35)',
  },
  ytYouBadgeText: { color: '#f59e0b', fontSize: 9, fontWeight: '800', letterSpacing: 0.4 },
  ytMsgText: { color: c.text, fontSize: 13.5, lineHeight: 19 },
  ytGiftContent: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  ytGiftEmoji: { fontSize: 20 },
  ytGiftDesc: { fontSize: 13, color: c.text, fontWeight: '600' },
  ytGiftAmount: { color: '#f59e0b', fontWeight: '800' },

  ytReactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  ytReactionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  ytReactionEmoji: { fontSize: 20 },

  ytComposer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
    backgroundColor: c.surface,
  },
  ytIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  ytInput: {
    flex: 1,
    backgroundColor: c.background,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: c.text,
    fontSize: 14,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
    minHeight: 40,
  },
  ytSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ytErrorText: {
    color: c.error,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingBottom: 6,
    fontWeight: '500',
  },
}));

const splashStyles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
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
