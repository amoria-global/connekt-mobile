/**
 * Photographer Stream Control, Creator Live Studio (route).
 *
 * This route is the *logic* layer: it keeps using the existing services
 * (startPhotographerStream / resume / pause / stop / reset / config polling,
 * public + in-app chat, WHIP camera publisher) and the existing polling
 * loops, exactly one of each. All presentation lives in
 * `@/features/streams/studio` (StreamerLiveScreen and friends).
 *
 * No endpoint, payload, polling interval or stream lifecycle was changed.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Animated, Share, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  type CameraDeviceState,
  type CameraErrorKind,
  type CameraPublisherHandle,
  type PublishStatus,
} from '@/features/streams/CameraPublisher';
import {
  getPublicStreamChats,
  sendInAppStreamChat,
  sendPublicStreamChat,
  type PublicStreamChat,
} from '@/features/streams/api';
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
import { getReactionIcon, isGiftChat } from '@/features/streams/studio/chatUtils';
import type { FloatingReaction } from '@/features/streams/studio/FloatingReactions';
import { BootLoading, StartFailure } from '@/features/streams/studio/StateOverlays';
import { StreamerLiveScreen } from '@/features/streams/studio/StreamerLiveScreen';
import {
  createStreamerLiveViewModel,
  nextOnAirLatch,
  resolveStudioStatus,
  type LiveSummary,
} from '@/features/streams/studio/viewModel';
import { getEvent } from '@/features/events/api';
import type { EventItem } from '@/features/events/types';
import { env } from '@/config/env';
import { useAuth, isApiError } from '@/store/auth';
import { getDeviceId } from '@/utils/deviceId';

export default function StreamControlScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [event, setEvent] = useState<EventItem | null>(null);
  const [creds, setCreds] = useState<StreamCredentials>({});
  const [config, setConfig] = useState<StreamConfig | null>(null);
  const [mode, setMode] = useState<'browser' | 'obs'>('browser');
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState<PublishStatus>('idle');
  const [busy, setBusy] = useState<null | 'golive' | 'pause' | 'resume' | 'end' | 'reset'>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootNonce, setBootNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [optimisticStatus, setOptimisticStatus] = useState<StreamConnectionStatus | null>(null);
  const [networkError, setNetworkError] = useState(false);

  // Camera device state is reported back by the publisher; it is display-only.
  const cameraRef = useRef<CameraPublisherHandle | null>(null);
  const [cameraNonce, setCameraNonce] = useState(0);
  const [cameraError, setCameraError] = useState<CameraErrorKind | null>(null);
  const [device, setDevice] = useState<CameraDeviceState>({ micOff: false, camOff: false, facing: 'user' });

  // What the server last reported, and a latch for "the host has gone live".
  // The server confirms the encoder only after it is pushing, and reports
  // "disconnected" on any blip, so the studio must not fall back to pre-live then.
  const reportedStatus: StreamConnectionStatus = config?.connectionStatus ?? 'idle';
  const [onAir, setOnAir] = useState(false);
  useEffect(() => {
    setOnAir((prev) => nextOnAirLatch(reportedStatus, prev));
  }, [reportedStatus]);
  const serverStatus: StreamConnectionStatus = optimisticStatus ?? reportedStatus;
  const status: StreamConnectionStatus = resolveStudioStatus(serverStatus, onAir);
  const encoderPending = onAir && (serverStatus === 'disconnected' || serverStatus === 'idle');
  const isLive = status === 'connected';
  const isEnded = status === 'ended';
  const whipUrl = creds.whipUrl;
  const whepUrl = creds.whepUrl;
  const inviteToken = creds.inviteToken;

  // Live timer for elapsed on-air duration
  const [liveSeconds, setLiveSeconds] = useState(0);
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setLiveSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Derive HLS manifest for OBS preview
  const previewHls = whepUrl?.includes('/webRTC/play')
    ? whepUrl.replace('/webRTC/play', '/manifest/video.m3u8')
    : whepUrl?.endsWith('.m3u8')
      ? whepUrl
      : undefined;

  // Live chat & viewer reactions
  const user = useAuth((s) => s.user);
  const [chats, setChats] = useState<PublicStreamChat[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; sender: string; text?: string } | null>(null);
  const [floating, setFloating] = useState<FloatingReaction[]>([]);
  const burst = useCallback((key: string) => {
    const { icon, color } = getReactionIcon(key);
    const anim = new Animated.Value(0);
    const itemId = Math.random().toString(36).slice(2);
    const offset = 6 + Math.random() * 40;
    setFloating((prev) => [...prev.slice(-12), { id: itemId, icon, color, anim, offset }]);
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

  // Chat / reaction polling, the single existing realtime loop.
  useEffect(() => {
    if (isEnded) return;
    let cancelled = false;
    let first = true;
    const seen = new Set<string>();
    const tick = async () => {
      try {
        const page = await getPublicStreamChats(id);
        if (cancelled) return;
        // Gifts are a viewer feature, received by the event owner in the dashboard.
        // The host never sees or engages with them in the studio.
        setChats(page.messages.filter((m) => !isGiftChat(m)));
        for (const r of page.reactions) {
          if (seen.has(r.id)) continue;
          seen.add(r.id);
          if (!first) burst(r.message);
        }
        first = false;
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
  }, [id, isEnded, burst]);

  // Boot: start live input & poll config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      try {
        const c = await startPhotographerStream(id);
        if (!cancelled) {
          setCreds(c);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Could not reach the studio.');
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, bootNonce]);

  const refreshConfig = useCallback(async () => {
    try {
      const cfg = await getPhotographerStreamConfig(id);
      setConfig(cfg);
      setNetworkError(false);
      setOptimisticStatus(null);
      setCreds((prev) => ({
        whipUrl: prev.whipUrl ?? cfg.whipUrl,
        whepUrl: prev.whepUrl ?? cfg.whepUrl,
        liveInputId: prev.liveInputId,
        inviteToken: prev.inviteToken ?? cfg.inviteToken,
      }));
    } catch {
      /* keep polling, surfaced as "Connection unavailable" in the UI */
      setNetworkError(true);
    }
  }, [id]);

  useEffect(() => {
    refreshConfig();
    const h = setInterval(refreshConfig, 5000);
    return () => clearInterval(h);
  }, [refreshConfig]);

  // Camera preview starts as soon as the WHIP channel exists (same effect as
  // the old "Start Camera Preview" button, just without the extra tap).
  useEffect(() => {
    if (mode === 'browser' && whipUrl && !isEnded && !publishing && !cameraError) {
      setPublishing(true);
    }
  }, [mode, whipUrl, isEnded, publishing, cameraError]);

  // ── Camera plumbing ──────────────────────────────────────────────────────
  const onPublishStatus = useCallback((s: PublishStatus) => {
    setPublishStatus(s);
    if (s === 'starting' || s === 'publishing') setCameraError(null);
  }, []);

  const retryCamera = useCallback(() => {
    setCameraError(null);
    setPublishStatus('idle');
    setCameraNonce((n) => n + 1);
    setPublishing(true);
  }, []);

  // ── Lifecycle actions (unchanged service calls) ──────────────────────────
  const onGoLive = async () => {
    setBusy('golive');
    setError(null);
    try {
      if (mode === 'browser' && !publishing) {
        setPublishing(true);
      }
      setOptimisticStatus('connected');
      await resumePhotographerStream(id);
      // The server accepted GO LIVE. From here the live studio stays up even if
      // the encoder is not confirmed yet; it shows reconnecting, not pre-live.
      setOnAir(true);
      await refreshConfig();
    } catch (e) {
      setOptimisticStatus(null);
      setError(isApiError(e) ? e.message : 'Please try again.');
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
    setBusy('end');
    setError(null);
    try {
      // The camera stays up until the backend confirms the stop, so a failed
      // stop never leaves the creator on a dead preview.
      await stopPhotographerStream(id);
      setPublishing(false);
      setOptimisticStatus('ended');
      await refreshConfig();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not end the stream.');
    } finally {
      setBusy(null);
    }
  };

  const onReset = async () => {
    setBusy('reset');
    setError(null);
    try {
      setPublishing(false);
      const c = await resetPhotographerStream(id);
      setOnAir(false);
      setCreds(c);
      setLiveSeconds(0);
      setCameraError(null);
      setPublishStatus('idle');
      await refreshConfig();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not reset the stream.');
    } finally {
      setBusy(null);
    }
  };

  // ── Sharing ──────────────────────────────────────────────────────────────
  const onShareStream = useCallback(async () => {
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
  }, [id, inviteToken, event?.title]);

  const shareValue = useCallback(async (label: string, value?: string) => {
    if (!value) return;
    try {
      await Share.share({ title: label, message: value });
    } catch {
      /* dismissed */
    }
  }, []);

  // ── Chat ─────────────────────────────────────────────────────────────────
  const hostIdentity = useCallback(async () => {
    const fp = await getDeviceId().catch(() => 'photographer-device');
    const photographerId = user?.customerId ? String(user.customerId) : 'photographer';
    const photographerName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Host'
      : 'Host';
    return { fp, photographerId, photographerName };
  }, [user]);

  const postHostMessage = useCallback(
    async (message: string) => {
      const { fp, photographerId, photographerName } = await hostIdentity();
      try {
        await sendPublicStreamChat(id, { viewerId: photographerId, deviceFingerprint: fp, message });
      } catch {
        // Fallback to coordinator in-app chat endpoint
        await sendInAppStreamChat(id, message);
      }
      const localMsg: PublicStreamChat = {
        id: `photographer-${Date.now()}`,
        viewerName: `${photographerName} (Host)`,
        senderName: `${photographerName} (Host)`,
        senderId: photographerId,
        message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
      };
      setChats((prev) => [...prev, localMsg]);
    },
    [hostIdentity, id],
  );

  const onSendChat = useCallback(async () => {
    const rawMsg = chatDraft.trim();
    if (!rawMsg || chatSending || !id) return;
    const target = replyingTo?.sender;
    const finalMessage = replyingTo && !rawMsg.startsWith(`@${target}`) ? `@${target} ${rawMsg}` : rawMsg;
    setChatSending(true);
    try {
      await postHostMessage(finalMessage);
      setChatDraft('');
      setReplyingTo(null);
    } catch (err) {
      setError(isApiError(err) ? err.message : 'Could not send your message. Check your connection and try again.');
    } finally {
      setChatSending(false);
    }
  }, [chatDraft, chatSending, id, replyingTo, postHostMessage]);

  const onSelectReply = useCallback((c: PublicStreamChat) => {
    setReplyingTo({ id: c.id, sender: c.viewerName || c.senderName || 'Viewer', text: c.message });
  }, []);

  // ── Adapter: existing state → studio view model ──────────────────────────
  const vm = createStreamerLiveViewModel({
    status,
    mode,
    publishStatus,
    streamHealth: config?.streamHealth,
    encoderPending,
    viewerCount: config?.viewerCount,
    peakViewers: config?.peakViewers,
    networkError,
  });

  const summary: LiveSummary = useMemo(
    () => ({
      durationSec: liveSeconds > 0 ? liveSeconds : null,
      viewers: config?.viewerCount ?? 0,
      peakViewers: config?.peakViewers ?? 0,
      comments: chats.length,
    }),
    [liveSeconds, config?.viewerCount, config?.peakViewers, chats.length],
  );

  const onExit = useCallback(() => router.back(), [router]);
  const eventTitle = event?.title || 'Live broadcast';

  // ── Render ───────────────────────────────────────────────────────────────
  if (bootLoading && !whipUrl) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0D12' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <BootLoading />
      </View>
    );
  }

  if (!bootLoading && !whipUrl && error) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0D12' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <StartFailure message={error} onBack={onExit} onRetry={() => setBootNonce((n) => n + 1)} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: !(vm.isLive || vm.isPaused) }} />
      <StreamerLiveScreen
        vm={vm}
        eventTitle={eventTitle}
        mode={mode}
        onModeChange={setMode}
        whipUrl={whipUrl}
        previewHls={previewHls}
        publishing={publishing}
        publishStatus={publishStatus}
        cameraRef={cameraRef}
        cameraNonce={cameraNonce}
        device={device}
        cameraError={cameraError}
        onPublishStatus={onPublishStatus}
        onDeviceState={setDevice}
        onCameraError={setCameraError}
        onRetryCamera={retryCamera}
        seconds={liveSeconds}
        streamHealth={config?.streamHealth}
        uploadSpeed={config?.uploadSpeed}
        busy={busy}
        error={error}
        onDismissError={() => setError(null)}
        onGoLive={onGoLive}
        onPause={onPause}
        onResume={onResume}
        onEnd={onEnd}
        onReset={onReset}
        onExit={onExit}
        inviteToken={inviteToken}
        onShareStream={onShareStream}
        onShareInvite={() => shareValue('Viewer Access Code', inviteToken)}
        onShareWhip={() => shareValue('WHIP Server URL', whipUrl)}
        chats={chats}
        hostCustomerId={user?.customerId}
        chatDraft={chatDraft}
        onChatDraftChange={setChatDraft}
        replyingTo={replyingTo}
        onSelectReply={onSelectReply}
        onCancelReply={() => setReplyingTo(null)}
        chatSending={chatSending}
        onSendChat={onSendChat}
        floating={floating}
        summary={summary}
      />
    </>
  );
}
