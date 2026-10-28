/**
 * The host's Go Live page, laid out like the viewer's live page (docs/LIVE_EVENT_STRUCTURE.md):
 *   1 header  2 camera preview + Go live / End + stream health  3 info  4 tabs
 *   6 invite (prominent)  8 moderation queue  9 chat.   Section 5, sending wishes, is hidden for the host.
 *
 * It takes the same props as StreamerLiveScreen and wires every action to the same handlers: the camera mounts once,
 * in the preview frame, and flip, mic, camera, source, settings, info, OBS, pause, resume, end and chat all still work.
 * StreamerLiveScreen (the immersive layout) is kept.
 */
import { useCallback, useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraPublisher, type CameraErrorKind } from '@/features/streams/CameraPublisher';
import { HlsPlayer } from '@/features/streams/HlsPlayer';
import { EventHeader, EventInfo, EventTabs, InviteOthers, LivePlayer, ModerationQueue, type LiveTab } from '@/features/live/sections';
import { PillButton, SectionCard } from '@/features/live/sections/shared';
import { useHostWishes } from '@/features/wishes/useWishFeed';
import { WishVideoModal } from '@/features/live/sections/WishVideoModal';
import type { Wish } from '@/features/wishes/types';
import { V } from '@/features/streams/viewer/viewerTheme';
import { fonts, onFill } from '@/theme';
import { BottomSheet } from './BottomSheet';
import { CommentsSheet } from './CommentsSheet';
import { EndLiveConfirmation } from './EndLiveConfirmation';
import { ObsSetupSheet } from './ObsSetupSheet';
import { PostLiveSummary } from './PostLiveSummary';
import { SheetRow, SheetSection } from './SheetParts';
import { CameraErrorOverlay, CameraSlate, ErrorBanner, PausedOverlay } from './StateOverlays';
import { StreamInfoSheet } from './StreamInfoSheet';
import { StreamSettingsSheet } from './StreamSettingsSheet';
import type { StreamerLiveScreenProps } from './StreamerLiveScreen';
import { Toast, useToast } from './Toast';
import { CONNECTION_COPY, formatCount, formatDuration } from './viewModel';

type Sheet = null | 'settings' | 'comments' | 'info' | 'obs' | 'source';

const FILL = { ...StyleSheet.absoluteFill, aspectRatio: undefined, borderRadius: 0 } as const;

function IconAction({ icon, label, onPress, off }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; off?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={[s.iconBtn, off && s.iconBtnOff]}>
      <Ionicons name={icon} size={20} color={off ? V.live : V.text} />
    </Pressable>
  );
}

export function HostEventPage({ cameraRef, ...p }: StreamerLiveScreenProps & { eventId: string }) {
  const { vm } = p;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 720;
  const { toast, show } = useToast();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [tab, setTab] = useState<LiveTab>('live');
  const [playing, setPlaying] = useState<Wish | null>(null);
  const hostWishes = useHostWishes(p.eventId);

  const onAir = (vm.isLive || vm.isPaused) && p.busy !== 'golive';
  const phone = p.mode === 'browser';
  const showCameraError = phone && p.publishing && p.publishStatus === 'error' && p.cameraError && p.cameraError !== 'network';
  const connectionDropped = phone && onAir && p.publishStatus === 'error' && p.cameraError === 'network';
  const pending = hostWishes.wishes.filter((w) => w.visibility === 'public' && w.status === 'pending').length;

  const onBackPress = useCallback(() => {
    if (vm.isLive || vm.isPaused) setConfirmEnd(true);
    else p.onExit();
  }, [vm.isLive, vm.isPaused, p]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirmEnd) return setConfirmEnd(false), true;
      if (sheet) return setSheet(null), true;
      if (vm.isEnded) return false;
      onBackPress();
      return true;
    });
    return () => sub.remove();
  }, [confirmEnd, sheet, vm.isEnded, onBackPress]);

  const toggleMic = useCallback(() => {
    show(p.device.micOff ? 'Microphone On' : 'Microphone Off');
    cameraRef.current?.toggleMic();
  }, [cameraRef, p.device.micOff, show]);
  const toggleCam = useCallback(() => {
    show(p.device.camOff ? 'Video On' : 'Video Off');
    cameraRef.current?.toggleCam();
  }, [cameraRef, p.device.camOff, show]);
  const flip = useCallback(() => {
    show('Camera switched');
    cameraRef.current?.flip();
  }, [cameraRef, show]);
  const changeMode = useCallback(
    (m: 'browser' | 'obs') => {
      if (m !== p.mode) {
        p.onModeChange(m);
        show(m === 'browser' ? 'Source: this phone' : 'Source: external / OBS');
      }
    },
    [p, show],
  );
  const endNow = useCallback(async () => {
    await p.onEnd();
    setConfirmEnd(false);
  }, [p]);

  if (vm.isEnded) {
    return (
      <View style={s.root}>
        <StatusBar style="light" />
        <PostLiveSummary eventTitle={p.eventTitle} summary={p.summary} resetting={p.busy === 'reset'} onDone={p.onExit} onStartNew={p.onReset} />
        {p.error ? <ErrorBanner title="Something went wrong" message={p.error} onDismiss={p.onDismissError} top={insets.top + 8} /> : null}
      </View>
    );
  }

  const conn = CONNECTION_COPY[vm.connection];

  /* 2 ── camera preview with its status chips, then Go live / End and stream health */
  const preview = (
    <>
      <LivePlayer>
        <View style={StyleSheet.absoluteFill}>
          {phone ? (
            p.whipUrl ? (
              p.publishing ? (
                <CameraPublisher
                  key={p.cameraNonce}
                  ref={cameraRef}
                  whipUrl={p.whipUrl}
                  publish={p.publishing}
                  nativeUi
                  fill
                  onStatusChange={p.onPublishStatus}
                  onDeviceState={p.onDeviceState}
                  onCameraError={p.onCameraError}
                />
              ) : (
                <CameraSlate kind="standby" />
              )
            ) : (
              <CameraSlate kind="connecting" />
            )
          ) : vm.isLive && p.previewHls ? (
            <HlsPlayer url={p.previewHls} style={FILL} />
          ) : (
            <CameraSlate kind="obs" whipReady={!!p.whipUrl} />
          )}
        </View>
        <View style={s.chips} pointerEvents="none">
          <View style={[s.chip, onAir && vm.isLive && { backgroundColor: V.live }]}>
            <Text style={s.chipText}>{vm.isPaused ? 'PAUSED' : onAir ? 'LIVE' : 'OFFLINE'}</Text>
          </View>
          {onAir ? (
            <View style={s.chip}>
              <Text style={s.chipText}>{formatDuration(p.seconds)}</Text>
            </View>
          ) : null}
          {onAir ? (
            <View style={s.chip}>
              <Text style={s.chipText}>{formatCount(vm.viewerCount)} watching</Text>
            </View>
          ) : null}
        </View>
        {vm.isPaused && onAir ? <PausedOverlay onResume={p.onResume} busy={p.busy === 'resume'} /> : null}
        {showCameraError ? <CameraErrorOverlay kind={p.cameraError as CameraErrorKind} onRetry={p.onRetryCamera} /> : null}
      </LivePlayer>

      <View style={s.controls}>
        {onAir ? (
          <PillButton label="End live" icon="stop-circle-outline" onPress={() => setConfirmEnd(true)} busy={p.busy === 'end'} />
        ) : (
          <PillButton label="Go live" icon="radio-outline" tone="primary" onPress={p.onGoLive} busy={p.busy === 'golive'} disabled={!p.whipUrl && phone} />
        )}
        {onAir ? (
          vm.isPaused ? (
            <PillButton label="Resume" icon="play" onPress={p.onResume} busy={p.busy === 'resume'} />
          ) : (
            <PillButton label="Pause" icon="pause" onPress={p.onPause} busy={p.busy === 'pause'} />
          )
        ) : null}
        <View style={s.iconRow}>
          {phone ? (
            <>
              <IconAction icon="camera-reverse-outline" label="Flip camera" onPress={flip} />
              <IconAction icon={p.device.micOff ? 'mic-off' : 'mic-outline'} label={p.device.micOff ? 'Turn microphone on' : 'Turn microphone off'} onPress={toggleMic} off={p.device.micOff} />
              <IconAction icon={p.device.camOff ? 'videocam-off' : 'videocam-outline'} label={p.device.camOff ? 'Turn video on' : 'Turn video off'} onPress={toggleCam} off={p.device.camOff} />
            </>
          ) : null}
          <IconAction icon="swap-horizontal-outline" label="Video source" onPress={() => setSheet('source')} />
          <IconAction icon="settings-outline" label="Stream settings" onPress={() => setSheet('settings')} />
          <IconAction icon="information-circle-outline" label="Stream info" onPress={() => setSheet('info')} />
        </View>
      </View>

      <View style={s.health} accessible accessibilityLabel={`Stream health: ${conn.label}`}>
        <Ionicons name={conn.icon} size={16} color={conn.color} />
        <Text style={s.healthText} numberOfLines={1}>
          {conn.label}
          {p.streamHealth ? ` · ${p.streamHealth}` : ''}
          {p.uploadSpeed ? ` · ${p.uploadSpeed}` : ''}
        </Text>
      </View>

      {connectionDropped ? (
        <View style={s.padH}>
          <SectionCard>
            <Text style={s.errTitle}>Connection interrupted</Text>
            <Text style={s.errBody}>Your preview is still running. Try reconnecting.</Text>
            <PillButton label="Reconnect" onPress={p.onRetryCamera} />
          </SectionCard>
        </View>
      ) : null}
      {p.error ? (
        <View style={s.padH}>
          <SectionCard>
            <Text style={s.errTitle}>{vm.isPreLive ? 'Unable to start LIVE' : 'Something went wrong'}</Text>
            <Text style={s.errBody}>{p.error}</Text>
            <View style={s.iconRow}>
              {vm.isPreLive && p.busy === null ? <PillButton label="Retry" onPress={p.onGoLive} tone="primary" /> : null}
              <PillButton label="Dismiss" onPress={p.onDismissError} />
            </View>
          </SectionCard>
        </View>
      ) : null}
    </>
  );

  /* 3 + 4 ── info and tabs */
  const info = (
    <EventInfo title={p.eventTitle} hostName="You" live={onAir && vm.isLive} viewerCount={onAir ? vm.viewerCount : null} />
  );
  const tabs = <EventTabs value={tab} onChange={setTab} wishCount={pending || undefined} />;

  /* Live tab: 6 invite (prominent) and 9 chat. Wishes tab: 8 moderation queue. */
  const content =
    tab === 'live' ? (
      <View style={[s.stack, s.padH]}>
        <InviteOthers eventId={p.eventId} title={p.eventTitle} prominent />
        <SectionCard title="Live chat" subtitle={p.chats.length ? `${p.chats.length} messages` : undefined}>
          {p.chats.length === 0 ? (
            <Text style={s.errBody}>No messages yet. Viewers can chat once you are live.</Text>
          ) : (
            p.chats.slice(-4).map((c) => (
              <Text key={c.id} style={s.chatLine} numberOfLines={2}>
                <Text style={s.chatName}>{c.senderName || c.viewerName || 'Viewer'}  </Text>
                {c.message}
              </Text>
            ))
          )}
          <PillButton label="Open chat" icon="chatbubbles-outline" onPress={() => setSheet('comments')} />
        </SectionCard>
      </View>
    ) : (
      <View style={s.padH}>
        <ModerationQueue
          state={hostWishes.state}
          wishes={hostWishes.wishes}
          busyId={hostWishes.busyId}
          onApprove={(w) => hostWishes.approve(w).catch(() => show('Could not approve it'))}
          onHide={(w) => hostWishes.hide(w).catch(() => show('Could not hide it'))}
          onRetry={hostWishes.reload}
          onPlay={setPlaying}
        />
      </View>
    );

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar style="light" />
      {wide ? (
        <View style={s.wideRow}>
          <ScrollView style={s.wideMain} contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            <EventHeader title={p.eventTitle} onBack={onBackPress} onShare={p.onShareStream} topInset={insets.top} />
            {preview}
            {info}
          </ScrollView>
          <ScrollView style={s.wideSide} contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}>
            {tabs}
            {content}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }} keyboardShouldPersistTaps="handled">
          <EventHeader title={p.eventTitle} onBack={onBackPress} onShare={p.onShareStream} topInset={insets.top} />
          {preview}
          {info}
          {tabs}
          {content}
        </ScrollView>
      )}

      <Toast message={toast} top={insets.top + 64} />

      <StreamSettingsSheet
        visible={sheet === 'settings'}
        onClose={() => setSheet(null)}
        eventTitle={p.eventTitle}
        mode={p.mode}
        onModeChange={changeMode}
        isLive={vm.isLive}
        isPaused={vm.isPaused}
        busy={p.busy}
        micOff={p.device.micOff}
        camOff={p.device.camOff}
        facing={p.device.facing}
        cleanView={false}
        inviteToken={p.inviteToken}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onFlip={flip}
        onToggleCleanView={() => undefined}
        onPause={() => {
          setSheet(null);
          p.onPause();
        }}
        onResume={() => {
          setSheet(null);
          p.onResume();
        }}
        onShare={p.onShareStream}
        onShareInvite={p.onShareInvite}
        onOpenInfo={() => setSheet('info')}
        onOpenObs={() => setSheet('obs')}
      />
      <StreamInfoSheet
        visible={sheet === 'info'}
        onClose={() => setSheet(null)}
        eventTitle={p.eventTitle}
        statusLabel={vm.isLive ? 'Live now' : vm.isPaused ? 'Paused' : 'Not live yet'}
        viewerCount={vm.viewerCount}
        peakViewers={vm.peakViewers}
        seconds={p.seconds}
        connection={vm.connection}
        streamHealth={p.streamHealth}
        uploadSpeed={p.uploadSpeed}
        inviteToken={p.inviteToken}
        onShare={p.onShareStream}
        onShareInvite={p.onShareInvite}
      />
      <CommentsSheet
        visible={sheet === 'comments'}
        onClose={() => setSheet(null)}
        chats={p.chats}
        hostCustomerId={p.hostCustomerId}
        draft={p.chatDraft}
        onDraftChange={p.onChatDraftChange}
        replyingTo={p.replyingTo}
        onReply={p.onSelectReply}
        onCancelReply={p.onCancelReply}
        sending={p.chatSending}
        onSend={p.onSendChat}
      />
      <ObsSetupSheet visible={sheet === 'obs'} onClose={() => setSheet(null)} whipUrl={p.whipUrl} copied={false} onCopy={p.onShareWhip} />
      <BottomSheet visible={sheet === 'source'} onClose={() => setSheet(null)} title="Video source">
        <SheetSection title="Broadcast from">
          <SheetRow
            icon="phone-portrait-outline"
            label="This phone"
            hint="Use the camera and microphone on this device"
            value={phone ? 'Selected' : undefined}
            onPress={() => {
              changeMode('browser');
              setSheet(null);
            }}
          />
          <SheetRow
            icon="desktop-outline"
            label="External / OBS"
            hint="Send video from OBS, vMix or a hardware encoder"
            value={!phone ? 'Selected' : undefined}
            onPress={() => {
              changeMode('obs');
              setSheet('obs');
            }}
            last
          />
        </SheetSection>
      </BottomSheet>
      <EndLiveConfirmation visible={confirmEnd} busy={p.busy === 'end'} onContinue={() => setConfirmEnd(false)} onEnd={endNow} />
      <WishVideoModal wish={playing} onClose={() => setPlaying(null)} />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: V.bg },
  wideRow: { flex: 1, flexDirection: 'row' },
  wideMain: { flex: 3 },
  wideSide: { flex: 2, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: V.border, backgroundColor: V.surface },
  padH: { paddingHorizontal: 14 },
  stack: { gap: 12 },
  chips: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { height: 24, paddingHorizontal: 9, borderRadius: 12, justifyContent: 'center', backgroundColor: V.chipStrong },
  chipText: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.4, color: onFill },
  controls: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 10 },
  iconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  iconBtn: { width: V.hit, height: V.hit, borderRadius: V.hit / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: V.surfaceRaised, borderWidth: 1, borderColor: V.border },
  iconBtnOff: { borderColor: V.live },
  health: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingTop: 8 },
  healthText: { flex: 1, fontFamily: fonts.regular, fontSize: 12.5, color: V.textSoft },
  errTitle: { fontFamily: fonts.bold, fontSize: 14, color: V.text },
  errBody: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: V.textSoft },
  chatLine: { fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19, color: V.textSoft },
  chatName: { fontFamily: fonts.bold, color: V.text },
});

