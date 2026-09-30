/**
 * Client / Viewer Live Stream Screen — Master-Grade Broadcast Experience
 *
 * 20/20 Senior Design:
 *   • Master Viewer Top Bar: Notch-safe header with live broadcast pill, viewer count HUD,
 *     event context, and share trigger.
 *   • Cinematic Program Player: 16:9 player with viewfinder HUD, live stream playback,
 *     and atmospheric standby slate when awaiting broadcast.
 *   • Real-Time Audience Overlays: Rising emoji reactions bursts and animated gift banners
 *     (GiftOverlay) rendered directly over the player in real-time.
 *   • Interactive Engagement Deck:
 *       - 6-emoji quick reaction dock (❤️, 🔥, 👏, 🎉, 🚀, ⭐) that broadcasts to the photographer
 *         and all viewers.
 *       - Dedicated "Send Gift" action opening the full catalog GiftTray.
 *   • Broadcaster & Event Showcase: Verified photographer attribution, event timing, and metadata.
 *   • Live Chat & Superchat Room: Segmented tabs ("All Messages" vs "Gifts & Tips"),
 *     distinct gift highlight cards, and an interactive chat composer.
 *   • Strict Pragati Narrow typography, solid theme tokens, and zero gradients.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { useAuth, isApiError } from '@/store/auth';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { GiftCheckoutSheet } from '@/features/streams/gifting/GiftCheckoutSheet';
import {
  getStream,
  joinStream,
  listStreamChats,
  sendInAppStreamChat,
  sendPublicStreamChat,
  sendPublicStreamReaction,
  type StreamChat,
  type GiftCatalogItem,
} from '@/features/streams/api';
import {
  GiftOverlay,
  formatGiftUsd,
  parseGiftMeta,
  type GiftEvent,
} from '@/features/streams/gifting/GiftOverlay';
import { GiftTray } from '@/features/streams/gifting/GiftTray';
import { getDeviceId } from '@/utils/deviceId';
import { useAsync } from '@/hooks/useAsync';
import { env } from '@/config/env';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';

const REACTION_ACTIONS: {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
}[] = [
  { key: 'heart', icon: 'heart', color: '#EF4444', label: 'Heart' },
  { key: 'flame', icon: 'flame', color: '#F59E0B', label: 'Flame' },
  { key: 'clap', icon: 'hand-left', color: '#38BDF8', label: 'Applause' },
  { key: 'star', icon: 'star', color: '#FBBF24', label: 'Star' },
  { key: 'rocket', icon: 'rocket', color: '#8B5CF6', label: 'Rocket' },
];

function getGiftIconName(code?: string): keyof typeof Ionicons.glyphMap {
  if (!code) return 'gift';
  const c = code.toLowerCase();
  if (c.includes('diamond')) return 'diamond';
  if (c.includes('crown') || c.includes('trophy')) return 'trophy';
  if (c.includes('flame') || c.includes('fire')) return 'flame';
  if (c.includes('rocket')) return 'rocket';
  if (c.includes('rose') || c.includes('flower')) return 'flower';
  if (c.includes('heart')) return 'heart';
  if (c.includes('star')) return 'star';
  return 'gift';
}

function getReactionIcon(key: string): { icon: keyof typeof Ionicons.glyphMap; color: string } {
  const k = (key || '').toLowerCase();
  if (k === '❤️' || k.includes('heart') || k.includes('love')) {
    return { icon: 'heart', color: '#EF4444' };
  }
  if (k === '🔥' || k.includes('fire') || k.includes('flame')) {
    return { icon: 'flame', color: '#F59E0B' };
  }
  if (k === '🎁' || k.includes('gift')) {
    return { icon: 'gift', color: '#EC4899' };
  }
  if (k === '⭐' || k === '🌟' || k.includes('star')) {
    return { icon: 'star', color: '#FBBF24' };
  }
  if (k === '👏' || k.includes('clap')) {
    return { icon: 'hand-left', color: '#38BDF8' };
  }
  if (k === '🚀' || k.includes('rocket')) {
    return { icon: 'rocket', color: '#8B5CF6' };
  }
  return { icon: 'sparkles', color: '#EC4899' };
}

export default function StreamDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((s) => s.user);
  const { isCoordinator } = useRole();

  const { data, loading, error, refresh } = useAsync(useCallback(() => getStream(id), [id]));
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [chats, setChats] = useState<StreamChat[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; sender: string; text?: string } | null>(null);
  const [chatFilter, setChatFilter] = useState<'all' | 'gifts'>('all');
  const [giftTrayVisible, setGiftTrayVisible] = useState(false);
  const [giftPay, setGiftPay] = useState<GiftCatalogItem | null>(null);
  const [retrying, setRetrying] = useState(false);
  const chatInputRef = useRef<TextInput>(null);

  // Floating reactions layer (vector icons)
  const [floating, setFloating] = useState<
    { id: string; icon: keyof typeof Ionicons.glyphMap; color: string; anim: Animated.Value; offset: number }[]
  >([]);
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]);
  const [giftStats, setGiftStats] = useState({ count: 0, usd: 0 });
  const chatScrollRef = useRef<ScrollView>(null);

  const burst = useCallback((key: string) => {
    const { icon, color } = getReactionIcon(key);
    const anim = new Animated.Value(0);
    const itemId = Math.random().toString(36).slice(2);
    const offset = 10 + Math.random() * 45;
    setFloating((prev) => [...prev, { id: itemId, icon, color, anim, offset }]);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(() => {
      setFloating((prev) => prev.filter((x) => x.id !== itemId));
    });
  }, []);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
    p.audioMixingMode = 'auto';
  });

  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error: playError }) => {
      if (status === 'error' && playError?.message) {
        console.warn('[stream] playback error', playError.message);
      }
    });
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (data?.playbackUrl && !playUrl) setPlayUrl(data.playbackUrl);
  }, [data?.playbackUrl, playUrl]);

  useEffect(() => {
    if (playUrl || !id) return;
    const tick = async () => {
      try {
        await refresh();
      } catch {
        /* keep polling */
      }
    };
    const handle = setInterval(tick, 8000);
    return () => clearInterval(handle);
  }, [playUrl, id, refresh]);

  useEffect(() => {
    if (!playUrl) return;
    try {
      player.replace({ uri: playUrl });
      player.play();
    } catch (e) {
      Alert.alert('Playback unavailable', isApiError(e) ? e.message : 'Could not start the stream.');
    }
  }, [playUrl, player]);

  // Poll chats & track live gifts
  useEffect(() => {
    if (!data?.eventId) return;
    let active = true;
    let first = true;
    const seenGifts = new Set<string>();

    const load = async () => {
      try {
        const msgs = await listStreamChats(data.eventId!);
        if (!active) return;
        setChats(msgs);

        // Process gifts
        for (const m of msgs) {
          if ((m.chatType ?? '').toUpperCase() !== 'GIFT') continue;
          if (seenGifts.has(m.id)) continue;
          seenGifts.add(m.id);
          if (first) continue;
          const meta = parseGiftMeta(m.giftMeta);
          if (!meta) continue;
          const ev: GiftEvent = {
            ...meta,
            id: m.id,
            senderName: meta.senderName ?? m.sender ?? 'Viewer',
          };
          setGiftEvents((prev) => [...prev.slice(-49), ev]);
          setGiftStats((s) => ({ count: s.count + 1, usd: s.usd + ev.amountUsd }));
        }
        first = false;
      } catch {
        // ignore transient errors
      }
    };

    load();
    const t = setInterval(load, 4000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [data?.eventId]);

  useEffect(() => {
    const t = setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(t);
  }, [chats.length]);

  const onRetry = async () => {
    setRetrying(true);
    try {
      const url = (await joinStream(id)) ?? data?.playbackUrl;
      if (url) {
        setPlayUrl(url);
      } else {
        await refresh();
      }
    } catch (e) {
      Alert.alert('Could not refresh', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setRetrying(false);
    }
  };

  const onSendReaction = async (emoji: string) => {
    burst(emoji);
    if (!data?.eventId) return;
    try {
      const fp = await getDeviceId().catch(() => 'device-client');
      const senderName = user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() : 'Viewer';
      const viewerId = user?.customerId ? String(user.customerId) : undefined;
      await sendPublicStreamReaction(data.eventId, {
        emoji,
        deviceFingerprint: fp,
        viewerId,
        name: senderName || 'Viewer',
      });
    } catch {
      /* local burst already animated */
    }
  };

  const onSendChat = async () => {
    const rawMsg = chatDraft.trim();
    if (!rawMsg || !data?.eventId) return;

    const targetRecipient = replyingTo?.sender;
    const msg =
      replyingTo && !rawMsg.startsWith(`@${targetRecipient}`)
        ? `@${targetRecipient} ${rawMsg}`
        : rawMsg;

    setChatSending(true);
    try {
      const senderName = user
        ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email || 'You'
        : 'You';
      if (isCoordinator) {
        await sendInAppStreamChat(data.eventId, msg);
      } else {
        const fp = await getDeviceId().catch(() => 'device-client');
        const viewerId = user?.customerId ? String(user.customerId) : 'viewer';
        await sendPublicStreamChat(data.eventId, {
          viewerId,
          deviceFingerprint: fp,
          message: msg,
        });
      }
      setChatDraft('');
      setReplyingTo(null);
      setChats((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          sender: senderName || 'You',
          message: msg,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      Alert.alert('Could not send', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setChatSending(false);
    }
  };

  // A signed-in sender pays in the app; the gift is priced by its code on the server.
  const onSendGiftSelected = (gift: GiftCatalogItem) => {
    setGiftTrayVisible(false);
    setGiftPay(gift);
  };

  const onShare = async () => {
    const targetEventId = data?.eventId ?? id;
    const streamUrl = `${env.webBaseUrl}/user/events/live-stream?eventId=${encodeURIComponent(targetEventId)}&id=${encodeURIComponent(targetEventId)}`;
    try {
      await Share.share({
        title: data?.title || 'Live Stream',
        message: `Watch "${data?.title || 'Live Stream'}" live on Connekt:\n${streamUrl}`,
      });
    } catch {
      /* dismissed */
    }
  };

  const filteredChats = useMemo(() => {
    if (chatFilter === 'gifts') {
      return chats.filter((c) => (c.chatType ?? '').toUpperCase() === 'GIFT');
    }
    return chats;
  }, [chats, chatFilter]);

  if (loading && !data) {
    return (
      <Screen padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTitle}>Connecting to Live Stream…</Text>
          <Text style={styles.loadingSub}>Loading broadcast channel and audience room</Text>
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={44} color={colors.textMuted} />
          <Text style={styles.errorTitle}>Stream Unavailable</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => refresh()}>
            <Ionicons name="refresh" size={16} color="#fff" />
            <Text style={styles.retryBtnText}>Retry Connection</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── 1. Master Viewer Studio Top Bar ───────────────────────────────── */}
      <View style={[styles.viewerHeader, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          style={styles.headerBtn}
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <View style={styles.headerStatusRow}>
            {data?.isLive ? (
              <View style={styles.livePill}>
                <View style={styles.pulseDot} />
                <Text style={styles.livePillText}>LIVE</Text>
              </View>
            ) : (
              <View style={styles.standbyPill}>
                <View style={styles.standbyDot} />
                <Text style={styles.standbyPillText}>STANDBY</Text>
              </View>
            )}

            {data?.viewerCount != null ? (
              <View style={styles.headerViewerPill}>
                <Ionicons name="eye" size={11} color={colors.primary} />
                <Text style={styles.headerViewerText}>{data.viewerCount} watching</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {data?.title || 'Live Stream'}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable
            style={styles.headerBtn}
            onPress={onShare}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share stream"
          >
            <Ionicons name="share-social-outline" size={19} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.headerBtn}
            onPress={onRetry}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Refresh stream"
          >
            <Ionicons name="refresh-outline" size={19} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 2. Cinematic Program Video Player ────────────────────────────── */}
        <View style={styles.playerContainer}>
          <View style={styles.playerFrame}>
            {/* Viewfinder Corner Reticles */}
            <View style={[styles.reticle, styles.reticleTopLeft]} />
            <View style={[styles.reticle, styles.reticleTopRight]} />
            <View style={[styles.reticle, styles.reticleBottomLeft]} />
            <View style={[styles.reticle, styles.reticleBottomRight]} />

            {playUrl ? (
              <VideoView
                player={player}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                fullscreenOptions={{ enable: true }}
                nativeControls
              />
            ) : (
              <View style={styles.standbySlate}>
                <View style={styles.standbyIconBox}>
                  <Ionicons name="videocam-outline" size={36} color="#fff" />
                </View>
                <Text style={styles.standbyTitle}>Broadcaster Preparing Feed</Text>
                <Text style={styles.standbyDesc}>
                  {data?.isLive
                    ? 'Photographer is active on air. Synchronizing live video playback…'
                    : 'The live stream has not started yet. The player will begin playing as soon as video goes live.'}
                </Text>
                <Pressable
                  style={styles.standbyRefreshBtn}
                  onPress={onRetry}
                  disabled={retrying}
                >
                  {retrying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="refresh" size={14} color="#fff" />
                      <Text style={styles.standbyRefreshBtnText}>Check Feed Now</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* Top Player HUD Badges */}
            <View style={styles.playerTopHud}>
              {data?.isLive ? (
                <View style={styles.hudLiveBadge}>
                  <View style={styles.hudLiveDot} />
                  <Text style={styles.hudLiveText}>LIVE</Text>
                </View>
              ) : (
                <View style={styles.hudWaitingBadge}>
                  <Text style={styles.hudWaitingText}>CONNECTING</Text>
                </View>
              )}

              <View style={styles.hudResBadge}>
                <Text style={styles.hudResText}>1080p HD</Text>
              </View>
            </View>

            {/* Rising Animated Reaction Icons Layer */}
            {floating.length > 0 ? (
              <View pointerEvents="none" style={styles.floatLayer}>
                {floating.map((fx) => (
                  <Animated.View
                    key={fx.id}
                    style={[
                      styles.floatIconBox,
                      {
                        left: fx.offset,
                        opacity: fx.anim.interpolate({
                          inputRange: [0, 0.85, 1],
                          outputRange: [1, 1, 0],
                        }),
                        transform: [
                          {
                            translateY: fx.anim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -150],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Ionicons name={fx.icon} size={24} color={fx.color} />
                  </Animated.View>
                ))}
              </View>
            ) : null}

            {/* Real-time Gift Overlay Alerts */}
            <GiftOverlay
              events={giftEvents}
              bannerTop={spacing.sm}
              floaterBottom={8}
              riseDistance={140}
              style={styles.giftOverlayClip}
            />
          </View>
        </View>

        {/* ── 3. Broadcaster & Event Showcase Card ─────────────────────────── */}
        <View style={styles.showcaseCard}>
          <Text style={styles.eventTitle}>{data?.title || 'Live Broadcast'}</Text>

          <View style={styles.broadcasterRow}>
            <View style={styles.broadcasterAvatar}>
              <Text style={styles.broadcasterAvatarText}>
                {(data?.photographerName || 'C').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.broadcasterInfoCol}>
              <View style={styles.broadcasterNameRow}>
                <Text style={styles.broadcasterName}>
                  {data?.photographerName || 'Connekyt Creator'}
                </Text>
                <Ionicons name="checkmark-circle" size={14} color={colors.primary} />
              </View>
              <Text style={styles.broadcasterRole}>Verified Broadcaster · Connekyt Live</Text>
            </View>
          </View>
        </View>

        {/* ── 4. Interactive Audience Reaction & Gifting Dock ──────────────── */}
        <View style={styles.engagementDock}>
          <View style={styles.engagementHeader}>
            <Ionicons name="sparkles" size={15} color={colors.accent} />
            <Text style={styles.engagementTitle}>Audience Reactions</Text>
            <Text style={styles.engagementHint}>Tap to burst on stream</Text>
          </View>

          <View style={styles.reactionButtonsRow}>
            {REACTION_ACTIONS.map((item) => (
              <Pressable
                key={item.key}
                style={({ pressed }) => [
                  styles.reactionBtn,
                  pressed && styles.reactionBtnPressed,
                ]}
                onPress={() => onSendReaction(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`Send ${item.label} reaction`}
              >
                <Ionicons name={item.icon} size={20} color={item.color} />
              </Pressable>
            ))}

            {digitalPurchasesEnabled ? (
              <Pressable
                style={styles.giftTriggerBtn}
                onPress={() => setGiftTrayVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Send gift to broadcaster"
              >
                <Ionicons name="gift" size={16} color="#fff" />
                <Text style={styles.giftTriggerBtnText}>Send Gift</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── 5. Live Audience Chat & Superchats ───────────────────────────── */}
        <View style={styles.chatSectionCard}>
          <View style={styles.chatSectionHeader}>
            <View style={styles.chatHeaderLeft}>
              <Ionicons name="chatbubbles" size={17} color={colors.primary} />
              <Text style={styles.chatHeaderTitle}>Live Chat</Text>
              <View style={styles.chatCountPill}>
                <Text style={styles.chatCountPillText}>{chats.length}</Text>
              </View>
            </View>

            <View style={styles.chatFilterToggle}>
              <Pressable
                style={[styles.chatFilterBtn, chatFilter === 'all' && styles.chatFilterBtnActive]}
                onPress={() => setChatFilter('all')}
              >
                <Text
                  style={[
                    styles.chatFilterBtnText,
                    chatFilter === 'all' && styles.chatFilterBtnTextActive,
                  ]}
                >
                  All
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chatFilterBtn, chatFilter === 'gifts' && styles.chatFilterBtnActive]}
                onPress={() => setChatFilter('gifts')}
              >
                <View style={styles.chatFilterBtnInner}>
                  <Ionicons
                    name="gift"
                    size={12}
                    color={chatFilter === 'gifts' ? '#fff' : colors.primary}
                  />
                  <Text
                    style={[
                      styles.chatFilterBtnText,
                      chatFilter === 'gifts' && styles.chatFilterBtnTextActive,
                    ]}
                  >
                    Gifts ({giftStats.count})
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={chatScrollRef}
            style={styles.chatStreamArea}
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {filteredChats.length === 0 ? (
              <View style={styles.chatEmptyBox}>
                <Ionicons name="chatbubble-ellipses-outline" size={26} color={colors.textMuted} />
                <Text style={styles.chatEmptyTitle}>Welcome to the stream</Text>
                <Text style={styles.chatEmptySubtitle}>
                  {chatFilter === 'gifts'
                    ? 'No gifts received yet. Be the first to support this creator!'
                    : 'Say hello and join the live audience discussion below.'}
                </Text>
              </View>
            ) : (
              filteredChats.map((c) => {
                const isGift = (c.chatType ?? '').toUpperCase() === 'GIFT';
                const gift = isGift ? parseGiftMeta(c.giftMeta) : null;
                const initial = (c.sender || 'V').charAt(0).toUpperCase();

                if (isGift) {
                  return (
                    <View key={c.id} style={styles.giftMessageCard}>
                      <View style={styles.giftIconCircle}>
                        <Ionicons name={getGiftIconName(gift?.code)} size={18} color="#EC4899" />
                      </View>
                      <View style={styles.giftContentCol}>
                        <View style={styles.giftHeaderRow}>
                          <Text style={styles.giftSenderName}>{c.sender || 'Viewer'}</Text>
                          <Text style={styles.giftAmountBadge}>
                            {formatGiftUsd(gift?.amountUsd ?? 0)}
                          </Text>
                        </View>
                        <Text style={styles.giftDescription}>
                          Sent a {gift?.name || 'Gift'} to the broadcast!
                        </Text>
                      </View>
                    </View>
                  );
                }

                const isHost =
                  (c.sender || '').toLowerCase().includes('host') ||
                  (c.sender || '').toLowerCase().includes('photographer');

                return (
                  <View key={c.id} style={[styles.regularChatRow, isHost && styles.hostChatRow]}>
                    <View style={[styles.viewerAvatar, isHost && styles.hostAvatar]}>
                      {isHost ? (
                        <Ionicons name="sparkles" size={11} color="#fff" />
                      ) : (
                        <Text style={[styles.viewerAvatarText, isHost && styles.hostAvatarText]}>
                          {initial}
                        </Text>
                      )}
                    </View>
                    <View style={styles.viewerMessageCol}>
                      <View style={styles.viewerNameRow}>
                        <Text style={[styles.viewerSenderName, isHost && styles.hostSenderName]}>
                          {c.sender || 'Viewer'}
                        </Text>
                        {isHost && (
                          <View style={styles.hostBadge}>
                            <Text style={styles.hostBadgeText}>HOST</Text>
                          </View>
                        )}
                        <Pressable
                          style={styles.replyTriggerBtn}
                          onPress={() => {
                            setReplyingTo({
                              id: c.id,
                              sender: c.sender || 'Viewer',
                              text: c.message,
                            });
                            chatInputRef.current?.focus();
                          }}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Reply to ${c.sender || 'Viewer'}`}
                        >
                          <Ionicons name="arrow-undo-outline" size={11} color={colors.primary} />
                          <Text style={styles.replyTriggerText}>Reply</Text>
                        </Pressable>
                      </View>
                      <Text style={[styles.viewerMessageText, isHost && styles.hostMessageText]}>
                        {c.message}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Interactive Chat Composer */}
          <View style={styles.composerWrapper}>
            {replyingTo ? (
              <View style={styles.replyContextBar}>
                <View style={styles.replyContextLeft}>
                  <Ionicons name="arrow-undo" size={12} color={colors.primary} />
                  <Text style={styles.replyContextLabel} numberOfLines={1}>
                    Replying to <Text style={styles.replyContextTarget}>@{replyingTo.sender}</Text>
                    {replyingTo.text ? `: "${replyingTo.text}"` : ''}
                  </Text>
                </View>
                <Pressable
                  style={styles.replyContextCloseBtn}
                  onPress={() => setReplyingTo(null)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel reply"
                >
                  <Ionicons name="close-circle" size={16} color={colors.textMuted} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.composerBar}>
              <TextInput
                ref={chatInputRef}
                value={chatDraft}
                onChangeText={setChatDraft}
                placeholder={
                  replyingTo ? `Reply to @${replyingTo.sender}…` : 'Join the conversation…'
                }
                placeholderTextColor={colors.textMuted}
                style={styles.composerInput}
                returnKeyType="send"
                onSubmitEditing={onSendChat}
                editable={!chatSending}
              />
              <Pressable
                style={[
                  styles.composerSendBtn,
                  (chatSending || !chatDraft.trim()) && styles.composerSendBtnDisabled,
                ]}
                onPress={onSendChat}
                disabled={chatSending || !chatDraft.trim()}
              >
                {chatSending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="arrow-up" size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ── 6. Full Catalog GiftTray Bottom Sheet ─────────────────────────── */}
      <GiftTray
        visible={giftTrayVisible}
        onClose={() => setGiftTrayVisible(false)}
        onSendGift={onSendGiftSelected}
      />
      <GiftCheckoutSheet
        visible={!!giftPay}
        onClose={() => setGiftPay(null)}
        eventId={data?.eventId ?? id}
        gift={giftPay}
        eventTitle={data?.title}
      />
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 40,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    backgroundColor: c.background,
  },
  loadingTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
  },
  loadingSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },
  errorTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
    marginTop: 4,
  },
  errorSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 280,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  retryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: '#fff',
  },

  // ── 1. Master Viewer Header ───────────────────────────────────────────
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: c.surface,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
    gap: spacing.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(225, 29, 72, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E11D48',
  },
  livePillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#E11D48',
    letterSpacing: 0.6,
  },
  standbyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  standbyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.textMuted,
  },
  standbyPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 0.5,
  },
  headerViewerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.infoBg,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: radii.full,
  },
  headerViewerText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // ── 2. Cinematic Program Video Player ─────────────────────────────────
  playerContainer: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#050B17',
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  playerFrame: {
    position: 'relative',
    aspectRatio: 16 / 9,
    backgroundColor: '#050B17',
    overflow: 'hidden',
  },
  reticle: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    zIndex: 10,
    pointerEvents: 'none',
  },
  reticleTopLeft: {
    top: 10,
    left: 10,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  reticleTopRight: {
    top: 10,
    right: 10,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  reticleBottomLeft: {
    bottom: 10,
    left: 10,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  reticleBottomRight: {
    bottom: 10,
    right: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },

  playerTopHud: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 12,
  },
  hudLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(225, 29, 72, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.sm,
  },
  hudLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  hudLiveText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.6,
  },
  hudWaitingBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  hudWaitingText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.5,
  },
  hudResBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: radii.sm,
  },
  hudResText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#10B981',
    letterSpacing: 0.4,
  },

  standbySlate: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: 6,
  },
  standbyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  standbyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.2,
  },
  standbyDesc: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 16,
  },
  standbyRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    marginTop: 6,
  },
  standbyRefreshBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#fff',
  },

  floatLayer: {
    position: 'absolute',
    left: 0,
    bottom: 12,
    top: 0,
    width: 90,
    zIndex: 15,
  },
  floatIconBox: {
    position: 'absolute',
    bottom: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatEmoji: {
    position: 'absolute',
    bottom: 0,
    fontSize: 26,
  },
  giftOverlayClip: {
    borderRadius: radii.xl,
    overflow: 'hidden',
  },

  // ── 3. Broadcaster & Event Showcase Card ─────────────────────────────
  showcaseCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  eventTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
    letterSpacing: -0.3,
  },
  broadcasterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.background,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
  },
  broadcasterAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcasterAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.primary,
  },
  broadcasterInfoCol: {
    flex: 1,
    gap: 1,
  },
  broadcasterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  broadcasterName: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  broadcasterRole: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
  },

  // ── 4. Interactive Audience Engagement Dock ──────────────────────────
  engagementDock: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  engagementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  engagementTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
  },
  engagementHint: {
    marginLeft: 'auto',
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
  },
  reactionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBtnPressed: {
    transform: [{ scale: 0.9 }],
    backgroundColor: c.infoBg,
  },
  reactionEmojiText: {
    fontSize: 18,
  },
  giftTriggerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accent,
    paddingHorizontal: 12,
  },
  giftTriggerBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#fff',
  },

  // ── 5. Live Audience Chat Section ─────────────────────────────────────
  chatSectionCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chatSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
    paddingBottom: spacing.sm,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
  },
  chatCountPill: {
    backgroundColor: c.infoBg,
    paddingHorizontal: 7,
    paddingVertical: 1.5,
    borderRadius: radii.full,
  },
  chatCountPillText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
  },
  chatFilterToggle: {
    flexDirection: 'row',
    backgroundColor: c.background,
    borderRadius: radii.md,
    padding: 2,
    gap: 4,
  },
  chatFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  chatFilterBtnActive: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  chatFilterBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  chatFilterBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
  },
  chatFilterBtnTextActive: {
    color: c.text,
  },

  chatStreamArea: {
    maxHeight: 180,
  },
  chatEmptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: 4,
  },
  chatEmptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: c.text,
  },
  chatEmptySubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 260,
  },
  regularChatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 5,
  },
  viewerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  viewerAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.primary,
  },
  viewerMessageCol: {
    flex: 1,
    gap: 1,
  },
  viewerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  viewerSenderName: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },
  replyTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    backgroundColor: c.infoBg,
  },
  replyTriggerText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
  },
  hostBadge: {
    backgroundColor: c.primary,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  hostBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#fff',
    letterSpacing: 0.5,
  },
  hostChatRow: {
    backgroundColor: c.infoBg,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
  },
  hostAvatar: {
    backgroundColor: c.primary,
  },
  hostAvatarText: {
    color: '#fff',
    fontSize: 11,
  },
  hostSenderName: {
    color: c.primary,
  },
  hostMessageText: {
    color: c.text,
    fontFamily: fonts.bold,
  },
  viewerMessageText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.text,
    lineHeight: 18,
  },

  giftMessageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(242, 12, 143, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242, 12, 143, 0.28)',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginVertical: 3,
  },
  giftIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftContentCol: {
    flex: 1,
    gap: 1,
  },
  giftHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  giftSenderName: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: c.accent,
  },
  giftAmountBadge: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.accent,
  },
  giftDescription: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.text,
  },

  composerWrapper: {
    gap: 6,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.borderSoft,
  },
  replyContextBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.infoBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
  },
  replyContextLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  replyContextLabel: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.text,
  },
  replyContextTarget: {
    fontFamily: fonts.bold,
    color: c.primary,
  },
  replyContextCloseBtn: {
    padding: 2,
  },
  composerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    height: 42,
    backgroundColor: c.background,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: c.text,
  },
  composerSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendBtnDisabled: {
    opacity: 0.45,
  },
}));
