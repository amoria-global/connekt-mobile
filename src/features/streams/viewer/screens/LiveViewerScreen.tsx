import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type TextInput,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from '@/utils/safeScreenOrientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GiftCheckoutSheet } from '@/features/streams/gifting/GiftCheckoutSheet';
import { GiftOverlay } from '@/features/streams/gifting/GiftOverlay';
import { GiftTray } from '@/features/streams/gifting/GiftTray';
import type { GiftCatalogItem, StreamChat } from '@/features/streams/api';
import { giftsEnabled } from '@/features/payments/policy';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useFloatingReactions } from '../hooks/useFloatingReactions';
import { useStreamChat } from '../hooks/useStreamChat';
import { useStreamPlayback } from '../hooks/useStreamPlayback';
import { useViewerChrome } from '../hooks/useViewerChrome';
import type { ChatMode, LiveViewerUIState, ReplyTarget } from '../types';
import { isGiftChat, mapStreamToViewerModel } from '../utils';
import { CHAT_SIDE_WIDTH, V, VIDEO_ASPECT, WIDE_BREAKPOINT } from '../viewerTheme';
import { ChatOverlayFeed } from '../components/ChatOverlayFeed';
import { LiveChat } from '../components/LiveChat';
import { LiveOptionsMenu } from '../components/LiveOptionsMenu';
import { LiveOverlay } from '../components/LiveOverlay';
import { LiveVideoSurface } from '../components/LiveVideoSurface';
import { ReactionOverlay, ReactionRail } from '../components/ReactionOverlay';
import { ShareSheet } from '../components/ShareSheet';
import { EventHeader, EventInfo, EventTabs, LivePlayer, WishesPanel, AccessChip, LiveScrubber, type LiveTab } from '@/features/live/sections';
import { useLiveEventInfo } from '@/features/live/liveEventInfo';
import { StreamStateOverlay } from '../components/StreamStateOverlay';
import { ViewerError, ViewerSkeleton } from '../components/ViewerStates';

import { onMedia } from '@/theme';
type UIAction =
  | { type: 'set'; patch: Partial<LiveViewerUIState> }
  | { type: 'toggle'; key: 'chatOpen' | 'fullscreen' };

const initialUI: LiveViewerUIState = {
  controlsVisible: true,
  chatOpen: true,
  fullscreen: false,
  showShareSheet: false,
  showOptions: false,
};

function uiReducer(s: LiveViewerUIState, a: UIAction): LiveViewerUIState {
  if (a.type === 'set') return { ...s, ...a.patch };
  return { ...s, [a.key]: !s[a.key] };
}

export default function LiveViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const pb = useStreamPlayback(id);
  const model = useMemo(() => mapStreamToViewerModel(id, pb.data), [id, pb.data]);
  const chat = useStreamChat(pb.data?.eventId);
  const { items: floating, burst } = useFloatingReactions(reduced);

  const eventInfo = useLiveEventInfo(pb.data?.eventId);
  const [tab, setTab] = useState<LiveTab>('live');
  const [ui, dispatch] = useReducer(uiReducer, initialUI);
  const [mode, setMode] = useState<ChatMode>('all');
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [giftTray, setGiftTray] = useState(false);
  const [giftPay, setGiftPay] = useState<GiftCatalogItem | null>(null);
  const [keyboardUp, setKeyboardUp] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const lastTap = useRef(0);

  const fs = ui.fullscreen;
  const wide = width >= WIDE_BREAKPOINT && !fs;
  const pinned = pb.phase !== 'playing';
  const chrome = useViewerChrome(pinned, reduced);
  const canControl = pb.phase === 'playing' || pb.phase === 'buffering';

  /* ── keyboard (hide the info block so chat input + list keep room) ── */
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setKeyboardUp(true),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setKeyboardUp(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /* ── fullscreen + orientation ── */
  const enterFullscreen = useCallback(async () => {
    dispatch({ type: 'set', patch: { fullscreen: true } });
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } catch {
      /* unsupported (web / restricted), stays immersive in current orientation */
    }
  }, []);

  const exitFullscreen = useCallback(async () => {
    dispatch({ type: 'set', patch: { fullscreen: false } });
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (fs) exitFullscreen();
    else enterFullscreen();
  }, [fs, enterFullscreen, exitFullscreen]);

  useEffect(() => {
    if (!fs) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exitFullscreen();
      return true;
    });
    return () => sub.remove();
  }, [fs, exitFullscreen]);

  useEffect(
    () => () => {
      // Always hand orientation back to the app default when leaving the viewer.
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    },
    [],
  );

  /* ── interactions (all map to the existing handlers) ── */
  const react = useCallback(
    (key: string) => {
      burst(key);
      chat.sendReaction(key);
    },
    [burst, chat],
  );

  const onVideoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      lastTap.current = 0;
      react('heart');
      chrome.show();
      return;
    }
    lastTap.current = now;
    chrome.toggle();
  }, [react, chrome]);

  const onSend = useCallback(async () => {
    const ok = await chat.sendMessage(draft, reply?.sender);
    if (ok) {
      setDraft('');
      setReply(null);
    }
  }, [chat, draft, reply]);

  const onReplyTo = useCallback((c: StreamChat) => {
    setReply({ id: c.id, sender: c.sender || 'Viewer', text: c.message });
    inputRef.current?.focus();
  }, []);

  const openShare = useCallback(() => dispatch({ type: 'set', patch: { showShareSheet: true } }), []);
  const openOptions = useCallback(() => dispatch({ type: 'set', patch: { showOptions: true } }), []);
  const openGift = useCallback(() => setGiftTray(true), []);
  const toggleChat = useCallback(() => dispatch({ type: 'toggle', key: 'chatOpen' }), []);
  const goBack = useCallback(() => router.back(), [router]);

  const shownChats = useMemo(() => (mode === 'gifts' ? chat.chats.filter(isGiftChat) : chat.chats), [chat.chats, mode]);

  /* ── screen-level states ── */
  if (pb.loading && !pb.data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <ViewerSkeleton />
      </>
    );
  }
  if (pb.error && !pb.data) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <ViewerError
          message="Something went wrong while loading this live stream."
          onRetry={() => pb.refresh()}
          onBack={goBack}
        />
      </>
    );
  }

  const statusLabel = pb.phase === 'ended' ? 'ENDED' : model.isLive ? undefined : pb.phase === 'waiting' ? 'OFFLINE' : 'CONNECTING';

  const video = (
    <LiveVideoSurface
      player={pb.player}
      hasSource={!!pb.playUrl}
      whep={
        pb.engine === 'whep' && pb.whepUrl
          ? { url: pb.whepUrl, nonce: pb.whepNonce, handleRef: pb.whepRef, onStatus: pb.onWhepStatus }
          : undefined
      }
      fullscreen={fs}
      onTap={onVideoTap}
    >
      <StreamStateOverlay phase={pb.phase} retrying={pb.retrying} onRetry={pb.retry} onBack={goBack} />
      <GiftOverlay
        events={chat.giftEvents}
        bannerTop={fs ? insets.top + 56 : 56}
        floaterBottom={8}
        riseDistance={140}
        style={styles.clip}
      />
      <ReactionOverlay items={floating} rightInset={(fs ? insets.right : 0) + (fs ? 76 : 14)} bottom={fs ? 64 : 56} />
      {fs && pb.phase === 'playing' ? (
        <ChatOverlayFeed chats={chat.chats} left={insets.left + 12} bottom={fs ? 64 : 56} />
      ) : null}
      <LiveOverlay
        opacity={chrome.opacity}
        visible={chrome.visible}
        insetTop={fs ? 4 : 0}
        insetLeft={fs ? insets.left : 0}
        insetRight={fs ? insets.right : 0}
        live={model.isLive && pb.phase !== 'ended'}
        statusLabel={statusLabel}
        viewerCount={model.viewerCount}
        muted={pb.muted}
        playing={pb.playing}
        fullscreen={fs}
        canControl={canControl}
        showBack={fs}
        accessChip={eventInfo ? <AccessChip access={eventInfo.access} /> : undefined}
        scrubber={<LiveScrubber atLive={model.isLive && pb.phase === 'playing'} onGoLive={() => { if (!(model.isLive && pb.phase === 'playing')) pb.retry(); }} />}
        onBack={fs ? exitFullscreen : goBack}
        onMore={openOptions}
        onShare={openShare}
        onToggleMute={pb.toggleMute}
        onTogglePlay={pb.togglePlay}
        onToggleFullscreen={toggleFullscreen}
      />
    </LiveVideoSurface>
  );

  const sheets = (
    <>
      <ShareSheet
        visible={ui.showShareSheet}
        onClose={() => dispatch({ type: 'set', patch: { showShareSheet: false } })}
        eventId={model.eventId}
        title={model.title}
        reducedMotion={reduced}
      />
      <LiveOptionsMenu
        visible={ui.showOptions}
        onClose={() => dispatch({ type: 'set', patch: { showOptions: false } })}
        reducedMotion={reduced}
        chatOpen={ui.chatOpen}
        canGift={giftsEnabled}
        onShare={openShare}
        onToggleChat={toggleChat}
        onRefresh={pb.retry}
        onGift={openGift}
      />
      <GiftTray
        visible={giftTray}
        onClose={() => setGiftTray(false)}
        onSendGift={(g) => {
          setGiftTray(false);
          setGiftPay(g);
        }}
      />
      <GiftCheckoutSheet
        visible={!!giftPay}
        onClose={() => setGiftPay(null)}
        eventId={pb.data?.eventId ?? id}
        gift={giftPay}
        eventTitle={pb.data?.title}
      />
    </>
  );

  /* ── Fullscreen / immersive ── */
  if (fs) {
    return (
      <View style={styles.fsRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar hidden />
        {video}
        <View
          pointerEvents="box-none"
          style={[styles.fsRail, { right: insets.right + 12, bottom: 56 }]}
        >
          <ReactionRail onReact={react} onGift={giftsEnabled ? openGift : undefined} vertical />
        </View>
        {sheets}
      </View>
    );
  }

  const chatPanel = (
    <LiveChat
      chats={shownChats}
      totalCount={chat.chats.length}
      mode={mode}
      onModeChange={setMode}
      giftCount={chat.giftCount}
      connection={chat.connection}
      onRetryConnection={chat.retryConnection}
      creatorName={model.creatorName}
      collapsed={!ui.chatOpen}
      onToggleCollapsed={toggleChat}
      draft={draft}
      onDraftChange={setDraft}
      onSend={onSend}
      sending={chat.sending}
      reply={reply}
      onReply={onReplyTo}
      onCancelReply={() => setReply(null)}
      inputRef={inputRef}
      bottomInset={insets.bottom}
    />
  );

  const info = (
    <EventInfo
      title={model.title}
      tagline={eventInfo?.tagline}
      location={eventInfo?.location}
      hostName={model.creatorName}
      live={model.isLive && pb.phase !== 'ended'}
      viewerCount={model.viewerCount}
    />
  );
  const wishes = (
    <WishesPanel eventId={model.eventId} title={model.title} closed={eventInfo?.wishesClosed} bottomInset={insets.bottom} />
  );

  /* ── Tablet / desktop: video + info left, chat right ── */
  if (wide) {
    return (
      <View style={styles.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar style="light" />
        <View style={styles.wideRow}>
          <View style={styles.wideMain}>
            <EventHeader title={model.title} onBack={goBack} onShare={openShare} topInset={insets.top} />
            <LivePlayer>{video}</LivePlayer>
            {info}
            <EventTabs value={tab} onChange={setTab} />
            {tab === 'live' ? (
              <View style={styles.railRow}>
                <ReactionRail onReact={react} onGift={giftsEnabled ? openGift : undefined} />
              </View>
            ) : (
              wishes
            )}
          </View>
          <View style={[styles.sideChat, { width: CHAT_SIDE_WIDTH, paddingTop: insets.top }]}>{chatPanel}</View>
        </View>
        {sheets}
      </View>
    );
  }

  /* ── Phone portrait ── */
  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />
      {keyboardUp ? null : <EventHeader title={model.title} onBack={goBack} onShare={openShare} topInset={insets.top} />}
      <LivePlayer topInset={keyboardUp ? insets.top : 0}>{video}</LivePlayer>
      {keyboardUp ? null : (
        <>
          {info}
          <EventTabs value={tab} onChange={setTab} />
        </>
      )}
      {tab === 'live' ? (
        <>
          {keyboardUp ? null : (
            <View style={styles.railRow}>
              <ReactionRail onReact={react} onGift={giftsEnabled ? openGift : undefined} />
            </View>
          )}
          <View style={[styles.chatWrap, !ui.chatOpen && styles.chatCollapsed]}>{chatPanel}</View>
        </>
      ) : (
        <View style={styles.chatWrap}>{wishes}</View>
      )}
      {sheets}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: V.bg },
  fsRoot: { flex: 1, backgroundColor: onMedia.black },
  fsRail: { position: 'absolute' },
  clip: { overflow: 'hidden' },
  railRow: { paddingHorizontal: 14, paddingVertical: 12 },
  chatWrap: { flex: 1, marginTop: 4 },
  chatCollapsed: { flex: 0 },
  wideRow: { flex: 1, flexDirection: 'row' },
  wideMain: { flex: 1 },
  sideChat: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: V.border, backgroundColor: V.surface },
});
