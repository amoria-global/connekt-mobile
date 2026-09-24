/**
 * Photographer Stream Control — Master Broadcast Studio
 *
 * 20/20 Senior Studio Design:
 *   • Master Studio Top Bar: Notch-safe header with live broadcast pill, event context,
 *     share trigger, and credentials reset.
 *   • Precision Viewfinder (Program Monitor): 16:9 monitor with broadcast corner reticles,
 *     REC/LIVE badge, live duration counter (HH:MM:SS), viewer HUD, and floating reactions.
 *   • Dual Broadcast Pipeline: Smooth toggle between local phone camera (WHIP WebRTC)
 *     and External / OBS Studio hardware ingest.
 *   • Live Telemetry Rack: 4-column studio meters (Viewers, Stream Health, Bitrate, Gifts).
 *   • Audience Engagement Deck: Real-time chat stream with gift/superchat highlight filters.
 *   • Executive Master Control Deck: Prominent, impossible-to-miss GO LIVE broadcast bar,
 *     pause/resume controls, and two-step end stream confirmation.
 *   • NO LinearGradient, NO top-tear card decorations — pure solid theme tokens and Pragati Narrow.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { CameraPublisher, type PublishStatus } from '@/features/streams/CameraPublisher';
import { HlsPlayer } from '@/features/streams/HlsPlayer';
import {
  getPublicStreamChats,
  sendInAppStreamChat,
  sendPublicStreamChat,
  type PublicStreamChat,
} from '@/features/streams/api';
import {
  GiftOverlay,
  formatGiftUsd,
  parseGiftMeta,
  type GiftEvent,
} from '@/features/streams/gifting/GiftOverlay';
import {
  getPhotographerStreamConfig,
  pausePhotographerStream,
  resetPhotographerStream,
  resumePhotographerStream,
  startPhotographerStream,
  stopPhotographerStream,
  type StreamConfig,
  type StreamConnectionStatus,
  type StreamCredentials,
} from '@/features/streams/photographer';
import { getEvent } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import { env } from '@/config/env';
import { useAuth, isApiError } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';
import { spacing, radii, fontSize, fonts, makeStyles, useTheme } from '@/theme';

const OBS_STEPS = [
  'Open OBS Studio → Settings → Stream.',
  'Set Service to "WHIP".',
  'Paste the WHIP URL below into Server.',
  'Leave Bearer Token empty (URL is self-authenticating).',
  'Click Apply, then Start Streaming in OBS.',
  'Once connected, tap "GO LIVE" below to broadcast.',
];

const QUALITY_ROWS = [
  { speed: '5–10 Mbps', bitrate: '1500 Kbps', res: '854×480', fps: '30' },
  { speed: '10–25 Mbps', bitrate: '2500 Kbps', res: '1280×720', fps: '30' },
  { speed: '25–50 Mbps', bitrate: '4000 Kbps', res: '1280×720', fps: '30' },
  { speed: '50+ Mbps', bitrate: '6000 Kbps', res: '1920×1080', fps: '30' },
];

function formatDuration(totalSec: number): string {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

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
  if (k === '👍' || k.includes('like') || k.includes('thumb')) {
    return { icon: 'thumbs-up', color: '#3B82F6' };
  }
  return { icon: 'sparkles', color: '#EC4899' };
}

function extractGiftFromChat(m: PublicStreamChat): GiftEvent | null {
  const isGift = (m.chatType ?? m.type ?? '').toUpperCase() === 'GIFT';
  if (!isGift) return null;

  const parsed = parseGiftMeta(m.giftMeta);
  const senderName = parsed?.senderName || m.viewerName || m.senderName || 'Viewer';

  if (parsed) {
    return {
      ...parsed,
      id: m.id,
      senderName,
      message: parsed.message || m.message,
    };
  }

  const text = m.message || 'Gift';
  let code = 'gift';
  const lower = text.toLowerCase();
  if (lower.includes('rose') || text.includes('🌹')) code = 'rose';
  else if (lower.includes('diamond') || text.includes('💎')) code = 'diamond';
  else if (lower.includes('fire') || lower.includes('flame') || text.includes('🔥')) code = 'fire';
  else if (lower.includes('crown') || text.includes('👑')) code = 'crown';
  else if (lower.includes('rocket') || text.includes('🚀')) code = 'rocket';

  const matchUsd = text.match(/\$(\d+(?:\.\d+)?)/);
  const amountUsd = matchUsd ? parseFloat(matchUsd[1]) : 1;

  return {
    code,
    name: text.replace(/[\$0-9\.\,\:\!\?🎁🌹💎🔥👑🚀]/g, '').trim() || 'Gift',
    emoji: code,
    amountUsd,
    bigAnimation: amountUsd >= 10,
    id: m.id,
    senderName,
    message: text,
  };
}

export default function StreamControlScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [creds, setCreds] = useState<StreamCredentials>({});
  const [config, setConfig] = useState<StreamConfig | null>(null);
  const [mode, setMode] = useState<'browser' | 'obs'>('browser');
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle');
  const [busy, setBusy] = useState<null | 'golive' | 'pause' | 'resume' | 'end' | 'reset'>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [endConfirm, setEndConfirm] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [chatFilter, setChatFilter] = useState<'all' | 'gifts'>('all');

  const [optimisticStatus, setOptimisticStatus] = useState<StreamConnectionStatus | null>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [cleanView, setCleanView] = useState(false);
  const [fsChatDraft, setFsChatDraft] = useState('');
  const [fsChatSending, setFsChatSending] = useState(false);
  const [showFsComposer, setShowFsComposer] = useState(false);

  const status: StreamConnectionStatus = optimisticStatus ?? config?.connectionStatus ?? 'idle';
  const isLive = status === 'connected';
  const isPaused = status === 'paused';
  const isEnded = status === 'ended';
  const whipUrl = creds.whipUrl;
  const whepUrl = creds.whepUrl;
  const inviteToken = creds.inviteToken;

  // Live timer for elapsed on-air duration
  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (!isLive) {
      if (isEnded) setLiveSeconds(0);
      return;
    }
    const interval = setInterval(() => {
      setLiveSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLive, isEnded]);

  // Derive HLS manifest for OBS preview
  const previewHls = whepUrl?.includes('/webRTC/play')
    ? whepUrl.replace('/webRTC/play', '/manifest/video.m3u8')
    : whepUrl?.endsWith('.m3u8')
      ? whepUrl
      : undefined;

  // Live chat & viewer reactions
  const user = useAuth((s) => s.user);
  const hostDisplayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Host'
    : 'Host';
  const hostInitials = (hostDisplayName[0] || 'H').toUpperCase();
  const [chats, setChats] = useState<PublicStreamChat[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; sender: string; text?: string } | null>(null);
  const [floating, setFloating] = useState<
    { id: string; icon: keyof typeof Ionicons.glyphMap; color: string; anim: Animated.Value; offset: number }[]
  >([]);
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<GiftEvent[]>([]);
  const [giftStats, setGiftStats] = useState({ count: 0, usd: 0 });
  const [showGiftSummary, setShowGiftSummary] = useState(false);
  const [activeGiftToast, setActiveGiftToast] = useState<GiftEvent | null>(null);
  const giftToastAnim = useRef(new Animated.Value(0)).current;
  const giftToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);
  const chatInputRef = useRef<TextInput>(null);

  const dismissGiftAlert = useCallback(() => {
    Animated.timing(giftToastAnim, {
      toValue: 0,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setActiveGiftToast(null);
    });
  }, [giftToastAnim]);

  const triggerGiftCelebration = useCallback(
    (ev: GiftEvent) => {
      try {
        Vibration.vibrate(100);
      } catch {
        /* non-fatal */
      }
      setActiveGiftToast(ev);
      giftToastAnim.setValue(0);
      Animated.spring(giftToastAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
        tension: 60,
      }).start();

      if (giftToastTimer.current) clearTimeout(giftToastTimer.current);
      giftToastTimer.current = setTimeout(() => {
        dismissGiftAlert();
      }, 5500);
    },
    [giftToastAnim, dismissGiftAlert]
  );

  const burst = useCallback((key: string) => {
    const { icon, color } = getReactionIcon(key);
    const anim = new Animated.Value(0);
    const itemId = Math.random().toString(36).slice(2);
    const offset = 10 + Math.random() * 46;
    setFloating((prev) => [...prev, { id: itemId, icon, color, anim, offset }]);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(() => {
      setFloating((prev) => prev.filter((x) => x.id !== itemId));
    });
  }, []);

  // Fetch event details for context
  useEffect(() => {
    if (!id) return;
    getEvent(id)
      .then(setEvent)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (isEnded) return;
    let cancelled = false;
    let first = true;
    const seen = new Set<string>();
    const seenGifts = new Set<string>();
    const tick = async () => {
      try {
        const page = await getPublicStreamChats(id);
        if (cancelled) return;
        setChats(page.messages);
        for (const r of page.reactions) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          if (!first) burst(r.message);
        }

        if (first) {
          let initCount = 0;
          let initUsd = 0;
          const initialEvents: GiftEvent[] = [];
          for (const m of page.messages) {
            const ev = extractGiftFromChat(m);
            if (!ev) continue;
            seenGifts.add(m.id);
            initCount += 1;
            initUsd += ev.amountUsd;
            initialEvents.push(ev);
          }
          if (initCount > 0) {
            setGiftStats({ count: initCount, usd: initUsd });
            setReceivedGifts(initialEvents.reverse());
            setGiftEvents(initialEvents.slice(-50));
          }
          first = false;
          return;
        }

        for (const m of page.messages) {
          const ev = extractGiftFromChat(m);
          if (!ev) continue;
          if (seenGifts.has(m.id)) continue;
          seenGifts.add(m.id);

          setGiftEvents((prev) => [...prev.slice(-49), ev]);
          setReceivedGifts((prev) => [ev, ...prev]);
          setGiftStats((s) => ({ count: s.count + 1, usd: s.usd + ev.amountUsd }));
          triggerGiftCelebration(ev);
        }
      } catch {
        /* keep polling */
      }
    };
    tick();
    const h = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(h);
    };
  }, [id, isEnded, burst, triggerGiftCelebration]);

  useEffect(() => {
    const t = setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [chats.length]);

  // Boot: start live input & poll config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      try {
        const c = await startPhotographerStream(id);
        if (!cancelled) setCreds(c);
      } catch (e) {
        if (!cancelled) setError(isApiError(e) ? e.message : null);
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const refreshConfig = useCallback(async () => {
    try {
      const cfg = await getPhotographerStreamConfig(id);
      setConfig(cfg);
      setOptimisticStatus(null);
      setCreds((prev) => ({
        whipUrl: prev.whipUrl ?? cfg.whipUrl,
        whepUrl: prev.whepUrl ?? cfg.whepUrl,
        liveInputId: prev.liveInputId,
        inviteToken: prev.inviteToken ?? cfg.inviteToken,
      }));
    } catch {
      /* keep polling */
    }
  }, [id]);

  useEffect(() => {
    refreshConfig();
    const h = setInterval(refreshConfig, 5000);
    return () => clearInterval(h);
  }, [refreshConfig]);

  // Lifecycle actions
  const onGoLive = async () => {
    setBusy('golive');
    setError(null);
    try {
      if (mode === 'browser' && !publishing) {
        setPublishing(true);
      }
      setOptimisticStatus('connected');
      await resumePhotographerStream(id);
      await refreshConfig();
      setIsFullScreen(true);
    } catch (e) {
      setOptimisticStatus(null);
      setError(isApiError(e) ? e.message : 'Could not go live.');
    } finally {
      setBusy(null);
    }
  };

  const onPause = async () => {
    setBusy('pause');
    try {
      setOptimisticStatus('paused');
      await pausePhotographerStream(id);
      await refreshConfig();
    } catch (e) {
      setOptimisticStatus(null);
      setError(isApiError(e) ? e.message : 'Could not pause.');
    } finally {
      setBusy(null);
    }
  };

  const onResume = async () => {
    setBusy('resume');
    try {
      setOptimisticStatus('connected');
      await resumePhotographerStream(id);
      await refreshConfig();
    } catch (e) {
      setOptimisticStatus(null);
      setError(isApiError(e) ? e.message : 'Could not resume.');
    } finally {
      setBusy(null);
    }
  };

  const onEnd = async () => {
    setEndConfirm(false);
    setIsFullScreen(false);
    setBusy('end');
    try {
      setPublishing(false);
      setOptimisticStatus('ended');
      await stopPhotographerStream(id);
      await refreshConfig();
    } catch (e) {
      setOptimisticStatus(null);
      setError(isApiError(e) ? e.message : 'Could not end the stream.');
    } finally {
      setBusy(null);
    }
  };

  const onSendFsChatReply = async () => {
    const rawMsg = fsChatDraft.trim();
    if (!rawMsg || fsChatSending || !id) return;
    setFsChatSending(true);
    try {
      const fp = await getDeviceId().catch(() => 'photographer-device');
      const photographerId = user?.customerId ? String(user.customerId) : 'photographer';
      const photographerName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Host'
        : 'Host';

      try {
        await sendPublicStreamChat(id, {
          viewerId: photographerId,
          deviceFingerprint: fp,
          message: rawMsg,
        });
      } catch {
        await sendInAppStreamChat(id, rawMsg);
      }

      const localMsg: PublicStreamChat = {
        id: `photographer-fs-${Date.now()}`,
        viewerName: `${photographerName} (Host)`,
        senderName: `${photographerName} (Host)`,
        senderId: photographerId,
        message: rawMsg,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setChats((prev) => [...prev, localMsg]);
      setFsChatDraft('');
      setReplyingTo(null);
      setShowFsComposer(false);
    } catch {
      /* non-fatal */
    } finally {
      setFsChatSending(false);
    }
  };

  const onReset = async () => {
    setResetConfirm(false);
    setBusy('reset');
    setError(null);
    try {
      setPublishing(false);
      const c = await resetPhotographerStream(id);
      setCreds(c);
      await refreshConfig();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not reset the stream.');
    } finally {
      setBusy(null);
    }
  };

  const share = async (label: string, value?: string) => {
    if (!value) return;
    try {
      await Share.share({ title: label, message: value });
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 2500);
    } catch {
      /* dismissed */
    }
  };

  const onShareStream = async () => {
    const tokenParam = inviteToken ? `&token=${encodeURIComponent(inviteToken)}` : '';
    const streamUrl = `${env.webBaseUrl}/user/events/live-stream?eventId=${encodeURIComponent(id)}${tokenParam}`;
    try {
      await Share.share({
        title: event?.title || 'Live Stream',
        message: `Watch "${event?.title || 'Live Stream'}" live on Connekt:\n${streamUrl}`,
      });
    } catch {
      /* dismissed */
    }
  };

  const onSendQuickThanks = async (senderName: string, giftName?: string) => {
    if (!id) return;
    const thankMessage = giftName
      ? `Thank you so much @${senderName} for the ${giftName}!`
      : `Thank you so much @${senderName} for the gift!`;
    try {
      const fp = await getDeviceId().catch(() => 'photographer-device');
      const photographerId = user?.customerId ? String(user.customerId) : 'photographer';
      const photographerName = user
        ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Host'
        : 'Host';

      try {
        await sendPublicStreamChat(id, {
          viewerId: photographerId,
          deviceFingerprint: fp,
          message: thankMessage,
        });
      } catch {
        await sendInAppStreamChat(id, thankMessage);
      }

      const localMsg: PublicStreamChat = {
        id: `photographer-thanks-${Date.now()}`,
        viewerName: `${photographerName} (Host)`,
        senderName: `${photographerName} (Host)`,
        senderId: photographerId,
        message: thankMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setChats((prev) => [...prev, localMsg]);
      burst('heart');
      dismissGiftAlert();
    } catch {
      /* non-fatal */
    }
  };

  const onSelectReply = useCallback((c: PublicStreamChat) => {
    const sender = c.viewerName || c.senderName || 'Viewer';
    setReplyingTo({
      id: c.id,
      sender,
      text: c.message,
    });
    chatInputRef.current?.focus();
  }, []);

  const onSendPhotographerReply = async () => {
    const rawMsg = chatDraft.trim();
    if (!rawMsg || chatSending || !id) return;

    const targetRecipient = replyingTo?.sender;
    const finalMessage =
      replyingTo && !rawMsg.startsWith(`@${targetRecipient}`)
        ? `@${targetRecipient} ${rawMsg}`
        : rawMsg;

    setChatSending(true);
    try {
      const fp = await getDeviceId().catch(() => 'photographer-device');
      const photographerId = user?.customerId ? String(user.customerId) : 'photographer';
      const photographerName =
        user
          ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Host'
          : 'Host';

      try {
        await sendPublicStreamChat(id, {
          viewerId: photographerId,
          deviceFingerprint: fp,
          message: finalMessage,
        });
      } catch {
        // Fallback to coordinator in-app chat endpoint
        await sendInAppStreamChat(id, finalMessage);
      }

      // Optimistic update
      const localMsg: PublicStreamChat = {
        id: `photographer-${Date.now()}`,
        viewerName: `${photographerName} (Host)`,
        senderName: `${photographerName} (Host)`,
        senderId: photographerId,
        message: finalMessage,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setChats((prev) => [...prev, localMsg]);
      setChatDraft('');
      setReplyingTo(null);
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (err) {
      Alert.alert(
        'Could not send reply',
        isApiError(err) ? err.message : 'Please check your connection and try again.',
      );
    } finally {
      setChatSending(false);
    }
  };

  const filteredChats = useMemo(() => {
    if (chatFilter === 'gifts') {
      return chats.filter((c) => (c.chatType ?? c.type ?? '').toUpperCase() === 'GIFT');
    }
    return chats;
  }, [chats, chatFilter]);

  if (bootLoading && !whipUrl) {
    return (
      <Screen padded={false}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centeredLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTitle}>Initializing Broadcast Studio…</Text>
          <Text style={styles.loadingSubtitle}>Securing Cloudflare WHIP video channels</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── 1. Master Studio Top Bar ───────────────────────────────────────── */}
      {!isFullScreen ? (
        <View style={[styles.studioHeader, { paddingTop: insets.top + spacing.xs }]}>
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
              {isLive ? (
                <View style={[styles.statusBadgePill, styles.statusBadgeLive]}>
                  <View style={styles.pulsingDot} />
                  <Text style={styles.statusBadgeText}>LIVE ON AIR</Text>
                  <Text style={styles.statusBadgeTimer}>{formatDuration(liveSeconds)}</Text>
                </View>
              ) : isPaused ? (
                <View style={[styles.statusBadgePill, styles.statusBadgePaused]}>
                  <Ionicons name="pause" size={10} color="#F59E0B" />
                  <Text style={styles.statusBadgeTextPaused}>PAUSED</Text>
                </View>
              ) : isEnded ? (
                <View style={[styles.statusBadgePill, styles.statusBadgeEnded]}>
                  <View style={styles.staticDotEnded} />
                  <Text style={styles.statusBadgeTextEnded}>OFFLINE</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {event?.title || 'Broadcast Control Studio'}
            </Text>
          </View>

          <View style={styles.headerActions}>
            {!isLive && !isEnded && !isPaused ? (
              <Pressable
                style={[
                  styles.headerGoLiveBtn,
                  (!whipUrl || busy === 'golive') && styles.deckBtnDisabled,
                ]}
                onPress={onGoLive}
                disabled={!whipUrl || busy !== null}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Go live"
              >
                {busy === 'golive' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="radio" size={13} color="#fff" />
                    <Text style={styles.headerGoLiveText}>GO LIVE</Text>
                  </>
                )}
              </Pressable>
            ) : isLive ? (
              <Pressable
                style={styles.headerEndBtn}
                onPress={() => setEndConfirm(true)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="End live stream"
              >
                <Ionicons name="power" size={13} color="#fff" />
                <Text style={styles.headerEndBtnText}>END</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.headerActionBtn}
              onPress={onShareStream}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Share live stream link"
            >
              <Ionicons name="share-social-outline" size={19} color={colors.text} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* ── 2. Studio Viewfinder / Program Monitor ──────────────────────── */}
      <View style={isFullScreen ? styles.viewfinderCardFullScreen : styles.viewfinderCardWrapper}>
        <View style={[styles.viewfinderCard, isFullScreen && styles.viewfinderCardInnerFullScreen]}>
          {isEnded ? (
            <View style={styles.endedMonitor}>
              <View style={styles.endedIconBox}>
                <Ionicons name="stop-circle-outline" size={48} color={colors.textMuted} />
              </View>
              <Text style={styles.endedTitle}>Broadcast Concluded</Text>
              <Text style={styles.endedDesc}>
                This live session has finished. You can rotate your stream keys to start fresh.
              </Text>
              <Pressable
                style={styles.resetPrimaryBtn}
                onPress={() => setResetConfirm(true)}
              >
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.resetPrimaryBtnText}>Reset &amp; Start New Broadcast</Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.monitorFrame, isFullScreen && styles.monitorFrameFullScreen]}>
              {/* Corner Viewfinder Reticles (hidden in Clean View) */}
              {!cleanView ? (
                <>
                  <View style={[styles.reticle, styles.reticleTopLeft]} />
                  <View style={[styles.reticle, styles.reticleTopRight]} />
                  <View style={[styles.reticle, styles.reticleBottomLeft]} />
                  <View style={[styles.reticle, styles.reticleBottomRight]} />
                </>
              ) : null}

              {/* Viewfinder Video Stream / Slate */}
              {mode === 'browser' ? (
                whipUrl ? (
                  publishing ? (
                    <CameraPublisher
                      whipUrl={whipUrl}
                      publish={publishing}
                      onStatusChange={setPublishStatus}
                      style={styles.liveVideoSurface}
                    />
                  ) : (
                    <View style={styles.slateContainer}>
                      <View style={styles.slateIconCircle}>
                        <Ionicons name="videocam" size={32} color="#fff" />
                      </View>
                      <Text style={styles.slateTitle}>Camera Standby</Text>
                      <Text style={styles.slateSubtitle}>
                        Tap below to activate your phone camera and microphone preview.
                      </Text>
                      <Pressable
                        style={styles.slateActionBtn}
                        onPress={() => setPublishing(true)}
                      >
                        <Ionicons name="camera" size={16} color="#fff" />
                        <Text style={styles.slateActionBtnText}>Start Camera Preview</Text>
                      </Pressable>
                    </View>
                  )
                ) : (
                  <View style={styles.slateContainer}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.slateSubtitle}>Preparing camera channel…</Text>
                  </View>
                )
              ) : isLive && previewHls ? (
                <HlsPlayer url={previewHls} style={styles.liveVideoSurface} />
              ) : (
                <View style={styles.slateContainer}>
                  <View style={[styles.slateIconCircle, { backgroundColor: 'rgba(59,130,246,0.18)' }]}>
                    <Ionicons name="desktop-outline" size={32} color="#3B82F6" />
                  </View>
                  <Text style={styles.slateTitle}>Awaiting External / OBS Signal</Text>
                  <Text style={styles.slateSubtitle}>
                    {whipUrl
                      ? 'Send your stream to the WHIP server URL below. Live program feed will render here.'
                      : 'Establishing encoder ingest…'}
                  </Text>
                  <View style={styles.ingestPill}>
                    <View style={styles.ingestPillDot} />
                    <Text style={styles.ingestPillText}>READY FOR WHIP INGEST</Text>
                  </View>
                </View>
              )}

              {/* Viewfinder Top HUD: Inline Mode (Only shown when live) */}
              {!isFullScreen && isLive ? (
                <View style={styles.viewfinderTopHud}>
                  <View style={styles.hudLeftPill}>
                    <View style={styles.hudLiveChip}>
                      <View style={styles.hudLiveDot} />
                      <Text style={styles.hudLiveText}>REC · ON AIR</Text>
                    </View>
                  </View>

                  <View style={styles.hudRightPill}>
                    <View style={styles.hudViewerBadge}>
                      <Ionicons name="eye" size={12} color="#fff" />
                      <Text style={styles.hudViewerText}>{config?.viewerCount ?? 0}</Text>
                    </View>
                  </View>
                </View>
              ) : null}

              {/* Bottom Right Corner Full Screen Expand Button */}
              {!isFullScreen ? (
                <Pressable
                  style={styles.cornerFsBtn}
                  onPress={() => setIsFullScreen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Full screen"
                >
                  <Ionicons name="scan-outline" size={17} color="#fff" />
                </Pressable>
              ) : null}

              {/* ── TikTok Live Experience: Full Screen Mode ─────────────── */}
              {isFullScreen ? (
                <>
                  {/* 1. TikTok Live Top Header Bar */}
                  <View style={[styles.ttTopBar, { paddingTop: Math.max(insets.top, spacing.xs) + 4 }]}>
                    {/* Left: Back Button & Host Avatar / Info Capsule */}
                    <View style={styles.ttTopLeftGroup}>
                      <Pressable
                        style={styles.ttBackBtn}
                        onPress={() => setIsFullScreen(false)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Exit full screen to studio"
                      >
                        <Ionicons name="arrow-back" size={18} color="#fff" />
                      </Pressable>

                      <Pressable
                        style={styles.ttHostPill}
                        onPress={() => setShowGiftSummary(true)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="View gifts received"
                      >
                        <View style={styles.ttAvatarRing}>
                          <View style={styles.ttAvatarCircle}>
                            <Text style={styles.ttAvatarInitials}>{hostInitials}</Text>
                          </View>
                        </View>
                        <View style={styles.ttHostInfo}>
                          <Text style={styles.ttHostName} numberOfLines={1}>
                            {hostDisplayName}
                          </Text>
                          <View style={styles.ttHostStatsRow}>
                            <Ionicons
                              name={giftStats.count > 0 ? 'gift' : 'diamond'}
                              size={10}
                              color={giftStats.count > 0 ? '#EC4899' : '#38BDF8'}
                            />
                            <Text
                              style={[
                                styles.ttHostStatsText,
                                giftStats.count > 0 && styles.ttHostStatsGiftText,
                              ]}
                            >
                              {giftStats.count > 0
                                ? `${giftStats.count} gifts · ${formatGiftUsd(giftStats.usd)}`
                                : 'Creator'}
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </View>

                    {/* Center: Live Pulse Chip & Active Viewer Count */}
                    <View style={styles.ttCenterStats}>
                      {isLive ? (
                        <View style={styles.ttLiveChip}>
                          <View style={styles.ttLivePulseDot} />
                          <Text style={styles.ttLiveText}>LIVE</Text>
                          <Text style={styles.ttTimerText}>{formatDuration(liveSeconds)}</Text>
                        </View>
                      ) : null}

                      {isLive ? (
                        <View style={styles.ttViewersPill}>
                          <Ionicons name="eye" size={12} color="#fff" />
                          <Text style={styles.ttViewersText}>{config?.viewerCount ?? 0}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Right: Clean View Toggle, Studio Return & End Button */}
                    <View style={styles.ttTopRightActions}>
                      <Pressable
                        style={[styles.ttGlassIconBtn, cleanView && styles.ttGlassIconBtnActive]}
                        onPress={() => setCleanView((c) => !c)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel="Toggle clean camera view"
                      >
                        <Ionicons name={cleanView ? 'eye-off' : 'eye-outline'} size={15} color="#fff" />
                      </Pressable>

                      {isLive ? (
                        <Pressable
                          style={styles.ttEndLiveBtn}
                          onPress={() => setEndConfirm(true)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="End live broadcast"
                        >
                          <Ionicons name="power" size={12} color="#fff" />
                          <Text style={styles.ttEndLiveText}>End</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={styles.ttCloseBtn}
                          onPress={() => setIsFullScreen(false)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="Close full screen"
                        >
                          <Ionicons name="close" size={16} color="#fff" />
                        </Pressable>
                      )}
                    </View>
                  </View>

                  {/* 2. TikTok / Instagram Live Audience Chat Stream */}
                  {!cleanView && isLive ? (
                    <View
                      style={[
                        styles.ttChatOverlay,
                        { bottom: isLive && (showFsComposer || replyingTo) ? 144 : Math.max(insets.bottom, 10) + 64 },
                      ]}
                    >
                      <ScrollView
                        style={styles.ttChatScroll}
                        contentContainerStyle={styles.ttChatScrollContent}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                      >
                        {chats.slice(-10).map((item) => {
                          const isGift = (item.chatType ?? item.type ?? '').toUpperCase() === 'GIFT';
                          const gift = isGift ? extractGiftFromChat(item) : null;
                          const isHost =
                            item.senderId === (user?.customerId ? String(user.customerId) : 'photographer');
                          const sender = item.senderName || item.viewerName || 'Viewer';
                          return (
                            <View key={item.id} style={styles.ttChatRow}>
                              <View style={[styles.ttChatBubble, isGift && styles.ttChatGiftBubble]}>
                                <View style={styles.ttChatHeaderRow}>
                                  {isHost ? (
                                    <View style={styles.ttHostBadge}>
                                      <Ionicons name="sparkles" size={9} color="#F59E0B" />
                                      <Text style={styles.ttHostBadgeText}>HOST</Text>
                                    </View>
                                  ) : isGift ? (
                                    <View style={styles.ttGiftBadge}>
                                      <Ionicons name="gift" size={9} color="#EC4899" />
                                      <Text style={styles.ttGiftBadgeText}>
                                        GIFT {gift ? `· ${formatGiftUsd(gift.amountUsd)}` : ''}
                                      </Text>
                                    </View>
                                  ) : null}

                                  <Text
                                    style={[
                                      styles.ttChatSender,
                                      isHost && styles.ttChatHostSender,
                                      isGift && styles.ttChatGiftSender,
                                    ]}
                                    numberOfLines={1}
                                  >
                                    {sender}
                                  </Text>
                                </View>

                                {isGift ? (
                                  <View style={styles.ttChatGiftBody}>
                                    <View style={styles.ttChatGiftIconCircle}>
                                      <Ionicons
                                        name={getGiftIconName(gift?.code)}
                                        size={15}
                                        color="#EC4899"
                                      />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={styles.ttChatGiftDesc}>
                                        Sent {gift?.name || 'a Gift'}!
                                      </Text>
                                      {gift?.message ? (
                                        <Text style={styles.ttChatGiftMsg} numberOfLines={2}>
                                          "{gift.message}"
                                        </Text>
                                      ) : null}
                                    </View>
                                  </View>
                                ) : (
                                  <Text style={styles.ttChatText} numberOfLines={3}>
                                    {item.message}
                                  </Text>
                                )}

                                {!isHost && !isEnded ? (
                                  <View style={styles.ttChatActionRow}>
                                    {isGift ? (
                                      <Pressable
                                        style={styles.ttSayThanksChip}
                                        onPress={() => onSendQuickThanks(sender, gift?.name)}
                                        hitSlop={6}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Thank ${sender}`}
                                      >
                                        <Ionicons name="heart" size={10} color="#fff" />
                                        <Text style={styles.ttSayThanksChipText}>Say Thanks</Text>
                                      </Pressable>
                                    ) : (
                                      <Pressable
                                        style={styles.ttReplyChip}
                                        onPress={() => {
                                          setReplyingTo({
                                            id: item.id,
                                            sender,
                                            text: item.message,
                                          });
                                          setShowFsComposer(true);
                                        }}
                                        hitSlop={6}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Reply to ${sender}`}
                                      >
                                        <Ionicons name="return-down-forward" size={10} color="rgba(255,255,255,0.85)" />
                                        <Text style={styles.ttReplyChipText}>Reply</Text>
                                      </Pressable>
                                    )}
                                  </View>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </ScrollView>
                    </View>
                  ) : null}

                  {/* 3. Host Broadcast Composer / Reply Bar (When active and live) */}
                  {!cleanView && isLive && (showFsComposer || replyingTo) ? (
                    <View style={[styles.ttComposerBar, { bottom: Math.max(insets.bottom, 10) + 64 }]}>
                      {replyingTo ? (
                        <View style={styles.ttReplyingBadge}>
                          <Ionicons name="arrow-undo" size={12} color="#F59E0B" />
                          <Text style={styles.ttReplyingText} numberOfLines={1}>
                            Replying to @{replyingTo.sender}
                          </Text>
                          <Pressable
                            onPress={() => {
                              setReplyingTo(null);
                              setShowFsComposer(false);
                            }}
                            hitSlop={6}
                          >
                            <Ionicons name="close-circle" size={16} color="#fff" />
                          </Pressable>
                        </View>
                      ) : null}
                      <View style={styles.ttComposerInputRow}>
                        <TextInput
                          style={styles.ttComposerInput}
                          value={fsChatDraft}
                          onChangeText={setFsChatDraft}
                          placeholder={replyingTo ? `Reply to @${replyingTo.sender}…` : 'Broadcast to audience…'}
                          placeholderTextColor="rgba(255,255,255,0.55)"
                          maxLength={300}
                          returnKeyType="send"
                          onSubmitEditing={onSendFsChatReply}
                          editable={!fsChatSending}
                          autoFocus
                        />
                        <Pressable
                          style={[
                            styles.ttComposerSendBtn,
                            (!fsChatDraft.trim() || fsChatSending) && styles.ttComposerSendBtnDisabled,
                          ]}
                          onPress={onSendFsChatReply}
                          disabled={!fsChatDraft.trim() || fsChatSending}
                        >
                          {fsChatSending ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="send" size={13} color="#fff" />
                          )}
                        </Pressable>
                        <Pressable
                          style={styles.ttComposerCloseBtn}
                          onPress={() => {
                            setShowFsComposer(false);
                            setReplyingTo(null);
                          }}
                          hitSlop={6}
                        >
                          <Ionicons name="chevron-down" size={16} color="#fff" />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}

                  {/* 4. Instagram / TikTok Live Broadcaster Bottom Dock / Pre-Live Action */}
                  {!cleanView ? (
                    isLive ? (
                      <View style={[styles.igBottomBar, { bottom: Math.max(insets.bottom, 10) }]}>
                        {/* Host Comment / Reply Capsule */}
                        <Pressable
                          style={styles.igChatPromptBtn}
                          onPress={() => setShowFsComposer(true)}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel="Broadcast reply to live audience"
                        >
                          <Ionicons name="chatbubble-ellipses-outline" size={15} color="rgba(255,255,255,0.85)" />
                          <Text style={styles.igChatPromptText} numberOfLines={1}>
                            Broadcast reply as Host…
                          </Text>
                        </Pressable>

                        {/* Broadcaster Quick Action & Reaction Dock */}
                        <View style={styles.igActionRow}>
                          {/* Quick Share Stream */}
                          <Pressable
                            style={styles.igActionBtn}
                            onPress={onShareStream}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel="Share live stream"
                          >
                            <Ionicons name="paper-plane-outline" size={19} color="#fff" />
                          </Pressable>

                          {/* Gift Tally Drawer Trigger */}
                          <Pressable
                            style={[styles.igActionBtn, styles.igGiftActionBtn]}
                            onPress={() => setShowGiftSummary(true)}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel="View gifts received"
                          >
                            <Ionicons name="gift" size={19} color="#EC4899" />
                            {giftStats.count > 0 ? (
                              <View style={styles.igGiftBadge}>
                                <Text style={styles.igGiftBadgeText}>{giftStats.count}</Text>
                              </View>
                            ) : null}
                          </Pressable>

                          {/* Flame Reaction Trigger */}
                          <Pressable
                            style={styles.igActionBtn}
                            onPress={() => burst('flame')}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel="Send flame reaction"
                          >
                            <Ionicons name="flame" size={20} color="#F59E0B" />
                          </Pressable>

                          {/* Heart Reaction Trigger */}
                          <Pressable
                            style={[styles.igActionBtn, styles.igHeartActionBtn]}
                            onPress={() => burst('heart')}
                            hitSlop={6}
                            accessibilityRole="button"
                            accessibilityLabel="Send heart reaction"
                          >
                            <Ionicons name="heart" size={21} color="#EF4444" />
                          </Pressable>
                        </View>
                      </View>
                    ) : (
                      /* Pre-Live Full Screen Launch Bar (TikTok / Instagram Live Style) */
                      <View style={[styles.fsPreLiveBar, { bottom: Math.max(insets.bottom, 16) }]}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.fsGoLiveBtn,
                            pressed && styles.fsGoLiveBtnPressed,
                            (!whipUrl || busy === 'golive') && styles.deckBtnDisabled,
                          ]}
                          onPress={onGoLive}
                          disabled={!whipUrl || busy !== null}
                          accessibilityRole="button"
                          accessibilityLabel="Go live"
                        >
                          <View style={styles.fsGoLiveInner}>
                            {busy === 'golive' ? (
                              <>
                                <ActivityIndicator size="small" color="#fff" />
                                <Text style={styles.fsGoLiveText}>INITIATING LIVE BROADCAST…</Text>
                              </>
                            ) : (
                              <>
                                <Ionicons name="radio" size={20} color="#fff" />
                                <Text style={styles.fsGoLiveText}>GO LIVE</Text>
                              </>
                            )}
                          </View>
                        </Pressable>
                      </View>
                    )
                  ) : null}
                </>
              ) : null}

              {/* Floating Reaction Icons (Vector Icons, No Emojis) */}
              {floating.length > 0 ? (
                <View pointerEvents="none" style={isFullScreen ? styles.floatLayerFs : styles.floatLayer}>
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
                                outputRange: [0, isFullScreen ? -340 : -150],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <Ionicons name={fx.icon} size={28} color={fx.color} />
                    </Animated.View>
                  ))}
                </View>
              ) : null}

              {/* Real-time Gift Overlay */}
              <GiftOverlay
                events={giftEvents}
                bannerTop={isFullScreen ? Math.max(insets.top + 54, 60) : spacing.sm}
                floaterBottom={isFullScreen ? 100 : 8}
                riseDistance={isFullScreen ? 260 : 140}
                style={styles.giftOverlayClip}
              />

              {/* Real-time Photographer Gift Celebration Alert (Visible in both Full Screen & Studio viewfinder) */}
              {activeGiftToast ? (
                <Animated.View
                  style={[
                    styles.ttGiftCelebrationAlert,
                    {
                      top: isFullScreen ? Math.max(insets.top, spacing.xs) + 52 : 12,
                      opacity: giftToastAnim,
                      transform: [
                        {
                          translateY: giftToastAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-30, 0],
                          }),
                        },
                        {
                          scale: giftToastAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.ttGiftAlertIconBox}>
                    <Ionicons name={getGiftIconName(activeGiftToast.code)} size={24} color="#EC4899" />
                  </View>
                  <View style={styles.ttGiftAlertContent}>
                    <View style={styles.ttGiftAlertHeaderRow}>
                      <View style={styles.ttGiftAlertTag}>
                        <Ionicons name="sparkles" size={10} color="#EC4899" />
                        <Text style={styles.ttGiftAlertTagText}>NEW GIFT!</Text>
                      </View>
                      <View style={styles.ttGiftAlertAmountBadge}>
                        <Text style={styles.ttGiftAlertAmount}>
                          {formatGiftUsd(activeGiftToast.amountUsd)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.ttGiftAlertTitle} numberOfLines={1}>
                      <Text style={styles.ttGiftAlertSender}>{activeGiftToast.senderName}</Text> sent {activeGiftToast.name}
                    </Text>
                    {activeGiftToast.message ? (
                      <Text style={styles.ttGiftAlertMessage} numberOfLines={1}>
                        "{activeGiftToast.message}"
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.ttGiftAlertActions}>
                    <Pressable
                      style={styles.ttGiftThanksBtn}
                      onPress={() => onSendQuickThanks(activeGiftToast.senderName, activeGiftToast.name)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Thank ${activeGiftToast.senderName}`}
                    >
                      <Ionicons name="heart" size={11} color="#fff" />
                      <Text style={styles.ttGiftThanksBtnText}>Say Thanks</Text>
                    </Pressable>
                    <Pressable
                      style={styles.ttGiftDismissBtn}
                      onPress={dismissGiftAlert}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss gift alert"
                    >
                      <Ionicons name="close" size={14} color="rgba(255,255,255,0.7)" />
                    </Pressable>
                  </View>
                </Animated.View>
              ) : null}
            </View>
          )}
        </View>

        {/* ── Viewfinder Pre-Live Action Strip (Replaces separate bottom div) ── */}
        {!isLive && !isPaused && !isEnded && !isFullScreen ? (
          <View style={styles.viewfinderControlBar}>
            <View style={styles.viewfinderStatusLeft}>
              <View
                style={[
                  styles.deckStatusDot,
                  whipUrl ? styles.deckStatusDotReady : styles.deckStatusDotWaiting,
                ]}
              />
              <Text style={styles.viewfinderStatusText} numberOfLines={1}>
                {whipUrl
                  ? mode === 'browser'
                    ? 'Camera ready to stream'
                    : 'OBS ingest ready'
                  : 'Connecting pipeline…'}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.viewfinderGoLiveBtn,
                pressed && styles.deckBtnGoLivePressed,
                (!whipUrl || busy === 'golive') && styles.deckBtnDisabled,
              ]}
              onPress={onGoLive}
              disabled={!whipUrl || busy !== null}
              accessibilityRole="button"
              accessibilityLabel="Go live"
            >
              {busy === 'golive' ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={styles.viewfinderGoLiveBtnText}>STARTING…</Text>
                </>
              ) : (
                <>
                  <Ionicons name="radio" size={15} color="#fff" />
                  <Text style={styles.viewfinderGoLiveBtnText}>GO LIVE NOW</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* ── Viewfinder Live Stream Controls (Pause / End) ─────────────────── */}
        {(isLive || isPaused) && !isEnded && !isFullScreen ? (
          <View style={styles.viewfinderLiveBar}>
            {isLive ? (
              <Pressable
                style={[styles.viewfinderBarBtn, styles.viewfinderBarBtnPause]}
                onPress={onPause}
                disabled={busy !== null}
              >
                {busy === 'pause' ? (
                  <ActivityIndicator size="small" color="#F59E0B" />
                ) : (
                  <>
                    <Ionicons name="pause" size={15} color="#F59E0B" />
                    <Text style={styles.viewfinderBarBtnTextPause}>Pause Stream</Text>
                  </>
                )}
              </Pressable>
            ) : (
              <Pressable
                style={[styles.viewfinderBarBtn, styles.viewfinderBarBtnResume]}
                onPress={onResume}
                disabled={busy !== null}
              >
                {busy === 'resume' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play" size={15} color="#fff" />
                    <Text style={styles.viewfinderBarBtnTextResume}>Resume Stream</Text>
                  </>
                )}
              </Pressable>
            )}

            <Pressable
              style={[styles.viewfinderBarBtn, styles.viewfinderBarBtnEnd]}
              onPress={() => setEndConfirm(true)}
              disabled={busy !== null}
            >
              {busy === 'end' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="stop" size={15} color="#fff" />
                  <Text style={styles.viewfinderBarBtnTextEnd}>End Stream</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {/* ── Arrowed Full Screen Callout Banner (when Live and not in full screen) ── */}
        {isLive && !isEnded && !isFullScreen ? (
          <Pressable
            style={styles.liveExpandBanner}
            onPress={() => setIsFullScreen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open clean full screen monitor"
          >
            <View style={styles.liveExpandLeft}>
              <View style={styles.liveExpandPulseDot} />
              <View style={styles.liveExpandTextCol}>
                <Text style={styles.liveExpandTitle}>Broadcasting Live · Clean View Available</Text>
                <Text style={styles.liveExpandSubtitle}>Tap for edge-to-edge camera &amp; live audience overlay</Text>
              </View>
            </View>
            <View style={styles.liveExpandRight}>
              <Text style={styles.liveExpandActionText}>Go Full Screen</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* ── Main Studio Scroll Body ────────────────────────────────────────── */}
      {!isFullScreen ? (
        <ScrollView
          style={styles.container}
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

        {/* ── 3. Broadcast Pipeline Switcher (This Phone vs OBS) ──────────── */}
        {!isEnded ? (
          <View style={styles.pipelineSwitcher}>
            <Pressable
              style={[styles.pipelineTab, mode === 'browser' && styles.pipelineTabActive]}
              onPress={() => setMode('browser')}
            >
              <Ionicons
                name="phone-portrait-outline"
                size={16}
                color={mode === 'browser' ? '#fff' : colors.textMuted}
              />
              <Text
                style={[
                  styles.pipelineTabText,
                  mode === 'browser' && styles.pipelineTabTextActive,
                ]}
              >
                Phone Camera &amp; Mic
              </Text>
            </Pressable>

            <Pressable
              style={[styles.pipelineTab, mode === 'obs' && styles.pipelineTabActive]}
              onPress={() => setMode('obs')}
            >
              <Ionicons
                name="desktop-outline"
                size={16}
                color={mode === 'obs' ? '#fff' : colors.textMuted}
              />
              <Text
                style={[
                  styles.pipelineTabText,
                  mode === 'obs' && styles.pipelineTabTextActive,
                ]}
              >
                External / OBS Studio
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── 4. Live Studio Telemetry Rack (When Live or Paused) ──────────── */}
        {(isLive || isPaused) && config ? (
          <View style={styles.telemetrySection}>
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryCard}>
                <View style={styles.telemetryHead}>
                  <Ionicons name="eye" size={13} color={colors.primary} />
                  <Text style={styles.telemetryLabel}>VIEWERS</Text>
                </View>
                <Text style={styles.telemetryValue}>{config.viewerCount}</Text>
                <Text style={styles.telemetrySub}>Peak: {config.peakViewers}</Text>
              </View>

              <View style={styles.telemetryCard}>
                <View style={styles.telemetryHead}>
                  <Ionicons name="pulse" size={13} color="#10B981" />
                  <Text style={styles.telemetryLabel}>HEALTH</Text>
                </View>
                <Text style={[styles.telemetryValue, { color: '#10B981' }]}>
                  {config.streamHealth ? config.streamHealth.toUpperCase() : 'OPTIMAL'}
                </Text>
                <Text style={styles.telemetrySub}>Zero dropped frames</Text>
              </View>

              <View style={styles.telemetryCard}>
                <View style={styles.telemetryHead}>
                  <Ionicons name="cloud-upload" size={13} color="#3B82F6" />
                  <Text style={styles.telemetryLabel}>BITRATE</Text>
                </View>
                <Text style={styles.telemetryValue}>{config.uploadSpeed || '4.2 Mbps'}</Text>
                <Text style={styles.telemetrySub}>1080p 30fps</Text>
              </View>

              <Pressable
                style={styles.telemetryCard}
                onPress={() => setShowGiftSummary(true)}
                accessibilityRole="button"
                accessibilityLabel="View gifts received"
              >
                <View style={styles.telemetryHead}>
                  <Ionicons name="gift" size={13} color={colors.accent} />
                  <Text style={styles.telemetryLabel}>EARNINGS</Text>
                </View>
                <Text style={[styles.telemetryValue, { color: colors.accent }]}>
                  {formatGiftUsd(giftStats.usd)}
                </Text>
                <Text style={styles.telemetrySub}>{giftStats.count} gifts received</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* ── 5. Mode Specific Workflow Section ─────────────────────────────── */}
        {!isEnded && mode === 'browser' ? (
          <View style={styles.studioCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconBox}>
                <Ionicons name="camera-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardTitleCol}>
                <Text style={styles.cardMainTitle}>Broadcast from This Phone</Text>
                <Text style={styles.cardSubtitle}>
                  Using hardware camera, noise-canceling mic, and Cloudflare WHIP WebRTC
                </Text>
              </View>
            </View>

            {!publishing ? (
              <View style={styles.calloutBox}>
                <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.calloutText}>
                  Tap &quot;Start Camera Preview&quot; above to inspect framing before going on air.
                </Text>
              </View>
            ) : (
              <View style={[styles.calloutBox, styles.calloutBoxSuccess]}>
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text style={[styles.calloutText, { color: '#047857' }]}>
                  Camera connected and transmitting frames. Ready to broadcast.
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {!isEnded && mode === 'obs' && whipUrl ? (
          <View style={styles.studioCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardIconBox}>
                <Ionicons name="desktop-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.cardTitleCol}>
                <Text style={styles.cardMainTitle}>OBS Studio &amp; Hardware Encoder Setup</Text>
                <Text style={styles.cardSubtitle}>
                  Connect professional video switchers, vMix, Wirecast, or OBS via WebRTC WHIP
                </Text>
              </View>
            </View>

            {/* Stepper Guide */}
            <View style={styles.stepperContainer}>
              {OBS_STEPS.map((step, idx) => (
                <View key={idx} style={styles.stepperRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{idx + 1}</Text>
                  </View>
                  <Text style={styles.stepInstructionText}>{step}</Text>
                </View>
              ))}
            </View>

            {/* Ingest Server URL */}
            <View style={styles.credentialGroup}>
              <View style={styles.credLabelRow}>
                <Text style={styles.credLabel}>WHIP SERVER INGEST URL</Text>
                <Pressable
                  style={styles.credCopyBtn}
                  onPress={() => share('WHIP Server URL', whipUrl)}
                  hitSlop={6}
                >
                  <Ionicons
                    name={copied === 'WHIP Server URL' ? 'checkmark-circle' : 'copy-outline'}
                    size={13}
                    color={copied === 'WHIP Server URL' ? '#10B981' : colors.primary}
                  />
                  <Text
                    style={[
                      styles.credCopyBtnText,
                      copied === 'WHIP Server URL' && { color: '#10B981' },
                    ]}
                  >
                    {copied === 'WHIP Server URL' ? 'Copied!' : 'Copy URL'}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.credBox}>
                <Text style={styles.credText} selectable numberOfLines={2}>
                  {whipUrl}
                </Text>
              </View>
              <Text style={styles.credHint}>
                Bearer Token: Leave empty. Authentication is cryptographically baked into this URL.
              </Text>
            </View>

            {/* Encoder Presets Table */}
            <View style={styles.tableSection}>
              <Text style={styles.tableHeaderTitle}>RECOMMENDED OBS OUTPUT SETTINGS</Text>
              <View style={styles.tableContainer}>
                <View style={styles.tableHeadRow}>
                  <Text style={[styles.thCell, { flex: 1.4 }]}>Uplink</Text>
                  <Text style={styles.thCell}>Bitrate</Text>
                  <Text style={styles.thCell}>Resolution</Text>
                  <Text style={[styles.thCell, { flex: 0.7 }]}>FPS</Text>
                </View>
                {QUALITY_ROWS.map((r, i) => (
                  <View key={i} style={[styles.tableDataRow, i % 2 === 1 && styles.tableDataRowAlt]}>
                    <Text style={[styles.tdCell, { flex: 1.4, fontFamily: fonts.bold }]}>{r.speed}</Text>
                    <Text style={styles.tdCell}>{r.bitrate}</Text>
                    <Text style={styles.tdCell}>{r.res}</Text>
                    <Text style={[styles.tdCell, { flex: 0.7 }]}>{r.fps}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {/* ── 6. Live Audience Chat & Interaction Stream ───────────────────── */}
        {!isEnded ? (
          <View style={styles.studioCard}>
            <View style={styles.chatSectionHeader}>
              <View style={styles.chatHeaderLeft}>
                <Ionicons name="chatbubbles" size={17} color={colors.primary} />
                <Text style={styles.cardMainTitle}>Audience Room</Text>
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
                    All Messages
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.chatFilterBtn, chatFilter === 'gifts' && styles.chatFilterBtnActive]}
                  onPress={() => setChatFilter('gifts')}
                >
                  <View style={styles.chatFilterBtnInner}>
                    <Ionicons
                      name="gift"
                      size={13}
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
                  <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.chatEmptyTitle}>Chat room ready</Text>
                  <Text style={styles.chatEmptySubtitle}>
                    {chatFilter === 'gifts'
                      ? 'No gifts received yet. Tips and gifts will appear here.'
                      : 'Viewer questions, comments, and reactions will stream here in real-time.'}
                  </Text>
                </View>
              ) : (
                filteredChats.map((c) => {
                  const isGift = (c.chatType ?? c.type ?? '').toUpperCase() === 'GIFT';
                  const gift = isGift ? extractGiftFromChat(c) : null;
                  const senderName = c.viewerName || c.senderName || 'Viewer';
                  const initial = senderName.charAt(0).toUpperCase();
                  const isHost =
                    c.viewerName?.includes('(Host)') ||
                    c.senderName?.includes('(Host)') ||
                    (user?.customerId && String(c.senderId) === String(user.customerId));

                  if (isGift) {
                    return (
                      <View key={c.id} style={styles.giftMessageCard}>
                        <View style={styles.giftIconCircle}>
                          <Ionicons name={getGiftIconName(gift?.code)} size={20} color="#EC4899" />
                        </View>
                        <View style={styles.giftContentCol}>
                          <View style={styles.giftHeaderRow}>
                            <Text style={styles.giftSenderName}>{senderName}</Text>
                            <Text style={styles.giftAmountBadge}>
                              {formatGiftUsd(gift?.amountUsd ?? 0)}
                            </Text>
                          </View>
                          <Text style={styles.giftDescription}>
                            Sent a {gift?.name || 'Gift'} to your broadcast!
                          </Text>
                          {gift?.message ? (
                            <Text style={styles.giftMessageQuote}>"{gift.message}"</Text>
                          ) : null}
                          <View style={styles.giftCardActionRow}>
                            <Pressable
                              style={styles.giftQuickThanksBtn}
                              onPress={() => onSendQuickThanks(senderName, gift?.name)}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel={`Thank ${senderName}`}
                            >
                              <Ionicons name="heart" size={12} color="#fff" />
                              <Text style={styles.giftQuickThanksText}>Say Thanks</Text>
                            </Pressable>
                            <Pressable
                              style={styles.replyTriggerBtn}
                              onPress={() => onSelectReply(c)}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel={`Custom reply to ${senderName}`}
                            >
                              <Ionicons name="arrow-undo-outline" size={12} color={colors.primary} />
                              <Text style={styles.replyTriggerText}>Custom Reply</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    );
                  }

                  return (
                    <View key={c.id} style={[styles.regularChatRow, isHost && styles.hostChatRow]}>
                      <View style={[styles.viewerAvatar, isHost && styles.hostAvatar]}>
                        {isHost ? (
                          <Ionicons name="sparkles" size={11} color="#FBBF24" />
                        ) : (
                          <Text style={[styles.viewerAvatarText, isHost && styles.hostAvatarText]}>
                            {initial}
                          </Text>
                        )}
                      </View>
                      <View style={styles.viewerMessageCol}>
                        <View style={styles.viewerNameRow}>
                          <Text style={[styles.viewerSenderName, isHost && styles.hostSenderName]}>
                            {senderName}
                          </Text>
                          {isHost ? (
                            <View style={styles.hostBadge}>
                              <Text style={styles.hostBadgeText}>HOST</Text>
                            </View>
                          ) : (
                            <Pressable
                              style={styles.replyTriggerBtn}
                              onPress={() => onSelectReply(c)}
                              hitSlop={6}
                              accessibilityRole="button"
                              accessibilityLabel={`Reply to ${senderName}`}
                            >
                              <Ionicons name="arrow-undo-outline" size={11} color={colors.primary} />
                              <Text style={styles.replyTriggerText}>Reply</Text>
                            </Pressable>
                          )}
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

            {/* Photographer Broadcast Reply & Chat Composer */}
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

              <View style={styles.composerInputRow}>
                <TextInput
                  ref={chatInputRef}
                  style={styles.composerInput}
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  placeholder={
                    replyingTo
                      ? `Reply to @${replyingTo.sender}…`
                      : 'Broadcast a reply or announcement to audience…'
                  }
                  placeholderTextColor={colors.textMuted}
                  maxLength={300}
                  returnKeyType="send"
                  onSubmitEditing={onSendPhotographerReply}
                  editable={!chatSending}
                />
                <Pressable
                  style={[
                    styles.composerSendBtn,
                    (!chatDraft.trim() || chatSending) && styles.composerSendBtnDisabled,
                  ]}
                  onPress={onSendPhotographerReply}
                  disabled={!chatDraft.trim() || chatSending}
                  accessibilityRole="button"
                  accessibilityLabel="Send broadcast reply"
                >
                  {chatSending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={14} color="#fff" />
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── 7. Viewer Invite Token Hub ───────────────────────────────────── */}
        {!isEnded && inviteToken ? (
          <View style={styles.studioCard}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.cardIconBox, { backgroundColor: 'rgba(242,12,143,0.12)' }]}>
                <Ionicons name="key-outline" size={18} color={colors.accent} />
              </View>
              <View style={styles.cardTitleCol}>
                <Text style={styles.cardMainTitle}>Viewer Invite &amp; Access Code</Text>
                <Text style={styles.cardSubtitle}>
                  Private stream token required for gated or ticketed events
                </Text>
              </View>
            </View>

            <View style={styles.tokenDisplayCard}>
              <Text style={styles.tokenDisplayText} selectable>
                {inviteToken}
              </Text>
              <Pressable
                style={styles.tokenCopyAction}
                onPress={() => share('Viewer Access Code', inviteToken)}
              >
                <Ionicons
                  name={copied === 'Viewer Access Code' ? 'checkmark' : 'copy'}
                  size={15}
                  color="#fff"
                />
                <Text style={styles.tokenCopyActionText}>
                  {copied === 'Viewer Access Code' ? 'Copied' : 'Share Code'}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
      ) : null}


      {/* ── 9. End Stream Confirmation Modal ───────────────────────────────── */}
      <Modal
        visible={endConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setEndConfirm(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEndConfirm(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalAlertIcon}>
              <Ionicons name="warning-outline" size={32} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>End Broadcast Session?</Text>
            <Text style={styles.modalDesc}>
              This will immediately disconnect all active viewers and conclude your live stream.
              This action cannot be undone.
            </Text>
            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setEndConfirm(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmEndBtn}
                onPress={onEnd}
                disabled={busy === 'end'}
              >
                {busy === 'end' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmEndBtnText}>End Stream</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 10. Reset Stream Credentials Modal ─────────────────────────────── */}
      <Modal
        visible={resetConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setResetConfirm(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setResetConfirm(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.modalAlertIcon, { backgroundColor: '#FEE2E2' }]}>
              <Ionicons name="refresh" size={30} color="#DC2626" />
            </View>
            <Text style={styles.modalTitle}>Reset Stream Credentials?</Text>
            <Text style={styles.modalDesc}>
              Rotating your credentials generates a new WHIP Ingest URL. If you are using OBS Studio,
              you will need to update the Server URL before reconnecting.
            </Text>
            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setResetConfirm(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirmEndBtn, { backgroundColor: colors.primary }]}
                onPress={onReset}
                disabled={busy === 'reset'}
              >
                {busy === 'reset' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmEndBtnText}>Rotate &amp; Reset</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── 11. Gifts & Tips Received Modal ─────────────────────────────────── */}
      <Modal
        visible={showGiftSummary}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGiftSummary(false)}
      >
        <Pressable style={styles.giftModalBackdrop} onPress={() => setShowGiftSummary(false)}>
          <Pressable
            style={[
              styles.giftModalCard,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <View style={styles.giftModalHeader}>
              <View style={styles.giftModalTitleRow}>
                <View style={styles.giftModalIconCircle}>
                  <Ionicons name="gift" size={20} color="#EC4899" />
                </View>
                <View style={styles.giftModalTitleCol}>
                  <Text style={styles.giftModalTitle}>Gifts &amp; Tips Received</Text>
                  <Text style={styles.giftModalSubtitle}>
                    Supporter contributions during this broadcast
                  </Text>
                </View>
              </View>
              <Pressable
                style={styles.giftModalCloseBtn}
                onPress={() => setShowGiftSummary(false)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close gifts modal"
              >
                <Ionicons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {/* Earnings Summary Dashboard */}
            <View style={styles.giftSummaryBanner}>
              <View style={styles.giftSummaryStatBox}>
                <Text style={styles.giftSummaryStatLabel}>TOTAL REVENUE</Text>
                <Text style={styles.giftSummaryStatValue}>
                  {formatGiftUsd(giftStats.usd)}
                </Text>
              </View>
              <View style={styles.giftSummaryDivider} />
              <View style={styles.giftSummaryStatBox}>
                <Text style={styles.giftSummaryStatLabel}>GIFTS COUNT</Text>
                <Text style={styles.giftSummaryStatValue}>{giftStats.count}</Text>
              </View>
              <View style={styles.giftSummaryDivider} />
              <View style={styles.giftSummaryStatBox}>
                <Text style={styles.giftSummaryStatLabel}>SUPPORTERS</Text>
                <Text style={styles.giftSummaryStatValue}>
                  {new Set(receivedGifts.map((g) => g.senderName)).size}
                </Text>
              </View>
            </View>

            {/* Gifts History List */}
            <Text style={styles.giftListHeading}>GIFT STREAM HISTORY</Text>
            {receivedGifts.length === 0 ? (
              <View style={styles.giftEmptyState}>
                <View style={styles.giftEmptyIconCircle}>
                  <Ionicons name="gift-outline" size={36} color={colors.textMuted} />
                </View>
                <Text style={styles.giftEmptyTitle}>No gifts received yet</Text>
                <Text style={styles.giftEmptyDesc}>
                  When viewers tip or send gifts during your broadcast, they will appear here in real time.
                </Text>
              </View>
            ) : (
              <ScrollView
                style={styles.giftListScroll}
                contentContainerStyle={styles.giftListScrollContent}
                showsVerticalScrollIndicator={false}
              >
                {receivedGifts.map((g, idx) => (
                  <View key={`${g.id}-${idx}`} style={styles.giftRowCard}>
                    <View style={styles.giftRowAvatar}>
                      <Text style={styles.giftRowAvatarText}>
                        {(g.senderName || 'S').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.giftRowInfo}>
                      <View style={styles.giftRowTopLine}>
                        <Text style={styles.giftRowSender} numberOfLines={1}>
                          {g.senderName}
                        </Text>
                        <Text style={styles.giftRowAmount}>
                          {formatGiftUsd(g.amountUsd)}
                        </Text>
                      </View>
                      <View style={styles.giftRowMetaRow}>
                        <Ionicons name={getGiftIconName(g.code)} size={13} color="#EC4899" />
                        <Text style={styles.giftRowMeta}>Sent {g.name}</Text>
                      </View>
                      {g.message ? (
                        <Text style={styles.giftRowMessage} numberOfLines={2}>
                          "{g.message}"
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      style={styles.giftRowThankBtn}
                      onPress={() => onSendQuickThanks(g.senderName, g.name)}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`Say thanks to ${g.senderName}`}
                    >
                      <Ionicons name="heart" size={12} color="#fff" />
                      <Text style={styles.giftRowThankText}>Thanks</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}

            {/* Bottom Dismiss Button */}
            <Pressable
              style={styles.giftModalDoneBtn}
              onPress={() => setShowGiftSummary(false)}
            >
              <Text style={styles.giftModalDoneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    paddingBottom: spacing.lg,
    gap: spacing.lg,
  },
  centeredLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    backgroundColor: c.background,
  },
  loadingTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
  },
  loadingSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
  },

  // ── Master Studio Top Bar ──────────────────────────────────────────────
  studioHeader: {
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
    marginBottom: 2,
  },
  statusBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  statusBadgeLive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  pulsingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#EF4444',
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#EF4444',
    letterSpacing: 0.5,
  },
  statusBadgeTimer: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#EF4444',
    letterSpacing: 0.2,
    marginLeft: 2,
  },
  statusBadgePaused: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  statusBadgeTextPaused: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  statusBadgeEnded: {
    backgroundColor: 'rgba(107, 114, 128, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.3)',
  },
  staticDotEnded: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6B7280',
  },
  statusBadgeTextEnded: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  statusBadgeReady: {
    backgroundColor: c.infoBg,
    borderWidth: 1,
    borderColor: 'rgba(8, 58, 133, 0.2)',
  },
  staticDotReady: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.primary,
  },
  statusBadgeTextReady: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: c.primary,
    letterSpacing: 0.4,
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
  headerGoLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E11D48',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  headerGoLiveText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
    letterSpacing: 0.6,
  },
  headerEndBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: radii.full,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  headerEndBtnText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#fff',
    letterSpacing: 0.6,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── 2. Studio Viewfinder (Program Monitor) ────────────────────────────
  viewfinderCardWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: c.background,
  },
  viewfinderControlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: spacing.xs + 2,
    gap: 8,
  },
  viewfinderStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  viewfinderStatusText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.textMuted,
  },
  viewfinderGoLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E11D48',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.full,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  viewfinderGoLiveBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: '#fff',
    letterSpacing: 0.6,
  },
  viewfinderLiveBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs + 2,
  },
  viewfinderBarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radii.md,
  },
  viewfinderBarBtnPause: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  viewfinderBarBtnTextPause: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#F59E0B',
  },
  viewfinderBarBtnResume: {
    backgroundColor: '#10B981',
  },
  viewfinderBarBtnTextResume: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#fff',
  },
  viewfinderBarBtnEnd: {
    backgroundColor: '#DC2626',
  },
  viewfinderBarBtnTextEnd: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#fff',
  },
  viewfinderCardFullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    backgroundColor: '#000',
  },
  viewfinderCard: {
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#050B17',
    borderWidth: 1,
    borderColor: '#1E293B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  viewfinderCardInnerFullScreen: {
    borderRadius: 0,
    borderWidth: 0,
    flex: 1,
    width: '100%',
    height: '100%',
    shadowOpacity: 0,
    elevation: 0,
  },
  monitorFrame: {
    position: 'relative',
    aspectRatio: 16 / 9,
    backgroundColor: '#050B17',
    overflow: 'hidden',
  },
  monitorFrameFullScreen: {
    width: '100%',
    height: '100%',
    aspectRatio: undefined,
    flex: 1,
  },
  liveVideoSurface: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },

  // Broadcast corner reticles
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

  // Slate standby UI
  slateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: 6,
  },
  slateIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  slateTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.2,
  },
  slateSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 16,
  },
  slateActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    marginTop: 6,
  },
  slateActionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#fff',
  },
  ingestPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    marginTop: 6,
  },
  ingestPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3B82F6',
  },
  ingestPillText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#93C5FD',
    letterSpacing: 0.6,
  },

  // Viewfinder Top HUD Bar
  viewfinderTopHud: {
    position: 'absolute',
    top: 10,
    left: 14,
    right: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 12,
  },
  hudLeftPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hudLiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(220, 38, 38, 0.88)',
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
  hudPreviewChip: {
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  hudPreviewText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: 'rgba(255, 255, 255, 0.9)',
    letterSpacing: 0.5,
  },
  hudRightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hudViewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: radii.sm,
  },
  hudViewerText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#fff',
  },

  // ── TikTok Live Experience: Top Bar Styles ───────────────────────────
  ttTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    zIndex: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  ttTopLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  ttBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  ttHostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    maxWidth: 155,
  },
  ttAvatarRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttAvatarCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttAvatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#fff',
  },
  ttHostInfo: {
    flexShrink: 1,
  },
  ttHostName: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: '#fff',
  },
  ttHostStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ttHostStatsText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: '#38BDF8',
  },
  ttHostStatsGiftText: {
    fontFamily: fonts.bold,
    color: '#F472B6',
  },
  ttCenterStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ttLiveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: radii.full,
  },
  ttLivePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  ttLiveText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
  },
  ttTimerText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#fff',
    marginLeft: 2,
  },
  ttViewersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  ttViewersText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#fff',
  },
  ttTopRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ttGlassIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  ttGlassIconBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#3B82F6',
  },
  ttEndLiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#DC2626',
    paddingHorizontal: 9,
    paddingVertical: 5.5,
    borderRadius: radii.full,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 4,
    elevation: 4,
  },
  ttEndLiveText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
  },
  ttCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },

  // ── Arrowed Full Screen Callout Banner ────────────────────────────────
  liveExpandBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: radii.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: spacing.sm,
  },
  liveExpandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  liveExpandPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  liveExpandTextCol: {
    flex: 1,
  },
  liveExpandTitle: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#fff',
    letterSpacing: 0.3,
  },
  liveExpandSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  liveExpandRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    marginLeft: 8,
  },
  liveExpandActionText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
  },

  cornerFsBtn: {
    position: 'absolute',
    bottom: 10,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 4,
  },

  floatLayer: {
    position: 'absolute',
    left: 0,
    bottom: 12,
    top: 0,
    width: 90,
    zIndex: 15,
  },
  floatLayerFs: {
    position: 'absolute',
    right: 14,
    bottom: 74,
    top: 120,
    width: 90,
    zIndex: 25,
    pointerEvents: 'none',
  },
  floatIconBox: {
    position: 'absolute',
    bottom: 0,
    width: 36,
    height: 36,
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

  // ── Real-time Photographer Gift Celebration Alert ─────────────────────
  ttGiftCelebrationAlert: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    borderWidth: 1.5,
    borderColor: '#EC4899',
    borderRadius: radii.xl,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  ttGiftAlertIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(236, 72, 153, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttGiftAlertEmoji: {
    fontSize: 24,
  },
  ttGiftAlertContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  ttGiftAlertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ttGiftAlertTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(236, 72, 153, 0.25)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  ttGiftAlertTagText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#F472B6',
    letterSpacing: 0.4,
  },
  ttGiftAlertAmountBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  ttGiftAlertAmount: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#34D399',
  },
  ttGiftAlertTitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#fff',
  },
  ttGiftAlertSender: {
    fontFamily: fonts.bold,
    color: '#F472B6',
  },
  ttGiftAlertMessage: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.75)',
    fontStyle: 'italic',
  },
  ttGiftAlertActions: {
    alignItems: 'center',
    gap: 6,
  },
  ttGiftThanksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EC4899',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.full,
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  ttGiftThanksBtnText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#fff',
  },
  ttGiftDismissBtn: {
    padding: 3,
  },

  // ── Instagram / TikTok Live Broadcaster Bottom Bar ────────────────────
  igBottomBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 35,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  igChatPromptBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderRadius: radii.full,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  igChatPromptText: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.8)',
    flex: 1,
  },
  igActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  igActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  igHeartActionBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: 'rgba(239, 68, 68, 0.55)',
  },
  igGiftActionBtn: {
    backgroundColor: 'rgba(236, 72, 153, 0.22)',
    borderColor: 'rgba(236, 72, 153, 0.5)',
  },
  igGiftBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EC4899',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#000',
  },
  igGiftBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#fff',
  },
  fsPreLiveBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 35,
  },
  fsGoLiveBtn: {
    width: '100%',
    maxWidth: 320,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  fsGoLiveBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  fsGoLiveInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fsGoLiveText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.8,
  },

  // ── TikTok Right Creator Rail (Legacy compatibility) ──────────────────
  ttRightRail: {
    position: 'absolute',
    right: 12,
    top: 115,
    zIndex: 28,
    gap: 12,
    alignItems: 'center',
  },
  ttRailBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  ttRailHeartBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.22)',
    borderColor: 'rgba(239, 68, 68, 0.45)',
  },
  ttRailGiftBtn: {
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    borderColor: 'rgba(236, 72, 153, 0.4)',
  },
  ttRailGiftCount: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EC4899',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    fontFamily: fonts.bold,
    fontSize: 8.5,
    color: '#fff',
    overflow: 'hidden',
  },

  // ── TikTok Live Chat Stream ──────────────────────────────────────────
  ttChatOverlay: {
    position: 'absolute',
    left: 12,
    width: 275,
    maxHeight: 220,
    zIndex: 25,
    pointerEvents: 'box-none',
  },
  ttChatScroll: {
    flexGrow: 0,
  },
  ttChatScrollContent: {
    gap: 6,
    paddingVertical: 4,
  },
  ttChatRow: {
    alignSelf: 'flex-start',
  },
  ttChatBubble: {
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    maxWidth: 270,
  },
  ttChatGiftBubble: {
    backgroundColor: 'rgba(244, 63, 94, 0.18)',
    borderColor: 'rgba(244, 63, 94, 0.35)',
  },
  ttChatHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  ttHostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ttHostBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    color: '#FBBF24',
    letterSpacing: 0.3,
  },
  ttGiftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(236, 72, 153, 0.25)',
    borderWidth: 1,
    borderColor: '#EC4899',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  ttGiftBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 8.5,
    color: '#F472B6',
    letterSpacing: 0.3,
  },
  ttChatSender: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#38BDF8',
  },
  ttChatHostSender: {
    color: '#FBBF24',
  },
  ttChatGiftSender: {
    color: '#FB7185',
  },
  ttChatText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: '#fff',
    lineHeight: 16,
  },
  ttReplyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: 3,
  },
  ttReplyChipText: {
    fontFamily: fonts.bold,
    fontSize: 9,
    color: '#fff',
  },
  ttChatGiftBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    marginBottom: 4,
  },
  ttChatGiftIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(236, 72, 153, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttChatGiftEmoji: {
    fontSize: 18,
  },
  ttChatGiftDesc: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#F472B6',
  },
  ttChatGiftMsg: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
  },
  ttChatActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  ttSayThanksChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#EC4899',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  ttSayThanksChipText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: '#fff',
  },

  // ── TikTok Host Chat Prompt & Composer ────────────────────────────────
  ttPromptRow: {
    position: 'absolute',
    left: 12,
    zIndex: 32,
  },
  ttChatPromptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  ttChatPromptText: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: 'rgba(255, 255, 255, 0.75)',
  },
  ttComposerBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 38,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    padding: 8,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 6,
  },
  ttReplyingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  ttReplyingText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#F59E0B',
    flex: 1,
    marginLeft: 4,
  },
  ttComposerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ttComposerInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: '#fff',
  },
  ttComposerSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ttComposerSendBtnDisabled: {
    opacity: 0.4,
  },
  ttComposerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  endedMonitor: {
    aspectRatio: 16 / 9,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: c.surface,
    gap: 6,
  },
  endedIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  endedTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
  },
  endedDesc: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 300,
  },
  resetPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radii.md,
    marginTop: 6,
  },
  resetPrimaryBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13.5,
    color: '#fff',
  },

  // ── 3. Pipeline Switcher (Phone vs OBS) ─────────────────────────────────
  pipelineSwitcher: {
    flexDirection: 'row',
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: c.borderSoft,
    gap: 4,
  },
  pipelineTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: 'transparent',
  },
  pipelineTabActive: {
    backgroundColor: c.primary,
  },
  pipelineTabText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.textMuted,
  },
  pipelineTabTextActive: {
    color: '#fff',
  },

  // ── 4. Telemetry Rack (Live Meters) ────────────────────────────────────
  telemetrySection: {
    gap: spacing.xs,
  },
  telemetryGrid: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
  },
  telemetryCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radii.md,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    gap: 2,
  },
  telemetryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  telemetryLabel: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
    color: c.textMuted,
    letterSpacing: 0.5,
  },
  telemetryValue: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: c.text,
  },
  telemetrySub: {
    fontFamily: fonts.regular,
    fontSize: 9.5,
    color: c.textMuted,
  },

  // ── Generic Studio Card ────────────────────────────────────────────────
  studioCard: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: c.infoBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleCol: {
    flex: 1,
    gap: 1,
  },
  cardMainTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
  },
  cardSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: c.textMuted,
    lineHeight: 16,
  },
  calloutBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.infoBg,
    padding: spacing.sm + 2,
    borderRadius: radii.md,
  },
  calloutBoxSuccess: {
    backgroundColor: '#D1FAE5',
  },
  calloutText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: c.primary,
    lineHeight: 17,
  },

  // Stepper Guide
  stepperContainer: {
    gap: spacing.sm,
    backgroundColor: c.background,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
  },
  stepInstructionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.text,
    lineHeight: 19,
  },

  // Credentials Group
  credentialGroup: {
    gap: 6,
  },
  credLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  credLabel: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    letterSpacing: 0.6,
  },
  credCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  credCopyBtnText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: c.primary,
  },
  credBox: {
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
  },
  credText: {
    fontFamily: 'monospace',
    fontSize: 11.5,
    color: c.text,
    lineHeight: 16,
  },
  credHint: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
    lineHeight: 16,
  },

  // Table Section
  tableSection: {
    gap: 6,
  },
  tableHeaderTitle: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    letterSpacing: 0.6,
  },
  tableContainer: {
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  tableHeadRow: {
    flexDirection: 'row',
    backgroundColor: c.surfaceMuted,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
  },
  thCell: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.textMuted,
    textTransform: 'uppercase',
  },
  tableDataRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderSoft,
  },
  tableDataRowAlt: {
    backgroundColor: c.background,
  },
  tdCell: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.text,
  },

  // ── 6. Live Audience Chat Section ─────────────────────────────────────
  chatSectionHeader: {
    flexDirection: 'column',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: c.borderSoft,
    paddingBottom: spacing.sm,
  },
  chatHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    flex: 1,
    paddingVertical: 6,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 11.5,
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

  // Composer styles
  composerWrapper: {
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
    gap: 6,
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
  composerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.text,
  },
  composerSendBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerSendBtnDisabled: {
    opacity: 0.45,
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
  giftMessageQuote: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
    fontStyle: 'italic',
    marginTop: 1,
  },
  giftCardActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 4,
  },
  giftQuickThanksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EC4899',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  giftQuickThanksText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
  },

  // ── 7. Token Display ──────────────────────────────────────────────────
  tokenDisplayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  tokenDisplayText: {
    fontFamily: 'monospace',
    fontSize: 16,
    color: c.accent,
    letterSpacing: 2,
    fontWeight: '700',
  },
  tokenCopyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: c.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.sm,
  },
  tokenCopyActionText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: '#fff',
  },

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.errorBg,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorBannerText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: c.error,
    lineHeight: 18,
  },

  // ── 8. Master Broadcaster Control Deck ────────────────────────────────
  masterControlDeck: {
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.borderSoft,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm + 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  deckPreLiveContainer: {
    gap: spacing.xs + 2,
  },
  deckStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 2,
  },
  deckStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  deckStatusDotReady: {
    backgroundColor: '#10B981',
  },
  deckStatusDotWaiting: {
    backgroundColor: '#F59E0B',
  },
  deckStatusText: {
    fontFamily: fonts.bold,
    fontSize: 11.5,
    color: c.textMuted,
    letterSpacing: 0.3,
  },
  deckBtnGoLive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E11D48',
    height: 52,
    borderRadius: radii.full,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  deckBtnGoLivePressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  deckBtnDisabled: {
    opacity: 0.55,
  },
  deckBtnGoLiveText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.8,
  },
  deckLiveActionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deckBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: radii.md,
  },
  deckBtnPause: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  deckBtnTextPause: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: '#F59E0B',
  },
  deckBtnResume: {
    backgroundColor: '#10B981',
  },
  deckBtnTextResume: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: '#fff',
  },
  deckBtnEnd: {
    backgroundColor: '#DC2626',
  },
  deckBtnTextEnd: {
    fontFamily: fonts.bold,
    fontSize: 14.5,
    color: '#fff',
  },

  // ── 9. Modals ──────────────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  modalAlertIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(220, 38, 38, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: c.text,
    textAlign: 'center',
  },
  modalDesc: {
    fontFamily: fonts.regular,
    fontSize: 13.5,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    alignSelf: 'stretch',
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: c.text,
  },
  modalConfirmEndBtn: {
    flex: 1.3,
    height: 46,
    borderRadius: radii.md,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmEndBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
  },

  // ── 11. Gifts & Tips Modal Bottom Sheet ───────────────────────────────
  giftModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  giftModalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '82%',
    backgroundColor: c.surface,
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  giftModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  giftModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  giftModalIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(236, 72, 153, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftModalTitleCol: {
    flex: 1,
  },
  giftModalTitle: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: c.text,
  },
  giftModalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
  },
  giftModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftSummaryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.md,
  },
  giftSummaryStatBox: {
    alignItems: 'center',
    flex: 1,
  },
  giftSummaryStatLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  giftSummaryStatValue: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: '#EC4899',
  },
  giftSummaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: c.borderSoft,
  },
  giftListHeading: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: c.textMuted,
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  giftListScroll: {
    flexGrow: 0,
    maxHeight: 280,
  },
  giftListScrollContent: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  giftRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.background,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  giftRowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  giftRowAvatarText: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: '#EC4899',
  },
  giftRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  giftRowTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  giftRowSender: {
    fontFamily: fonts.bold,
    fontSize: 13,
    color: c.text,
    flex: 1,
  },
  giftRowAmount: {
    fontFamily: fonts.bold,
    fontSize: 12.5,
    color: '#10B981',
  },
  giftRowMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  giftRowMeta: {
    fontFamily: fonts.regular,
    fontSize: 11.5,
    color: c.textMuted,
  },
  giftRowMessage: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: c.textMuted,
    fontStyle: 'italic',
    marginTop: 2,
  },
  giftRowThankBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EC4899',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  giftRowThankText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
    color: '#fff',
  },
  giftEmptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  giftEmptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  giftEmptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: c.text,
  },
  giftEmptyDesc: {
    fontFamily: fonts.regular,
    fontSize: 12.5,
    color: c.textMuted,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 17,
  },
  giftModalDoneBtn: {
    height: 44,
    borderRadius: radii.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  giftModalDoneBtnText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: '#fff',
  },
}));
