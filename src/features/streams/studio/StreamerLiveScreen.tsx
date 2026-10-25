/**
 * StreamerLiveScreen, Creator Live Studio presentation layer.
 *
 * This component owns ONLY visual UI state (sheets, dialogs, control
 * visibility, toasts). Everything backend-derived, stream status, viewers,
 * chats, credentials, and every action (go live, pause, end, send
 * chat…) is passed in by the route, which keeps using the existing services.
 *
 * Layering (back → front):
 *   camera feed → tap surface → scrims → status / rail / bottom controls /
 *   comments → banners & toasts → bottom sheets → confirmation dialogs
 *
 * The camera component sits at a fixed spot in the tree and is never
 * conditionally re-parented, so opening/closing sheets or switching between
 * pre-live and live does not remount it.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  Animated,
  BackHandler,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CameraPublisher,
  type CameraDeviceState,
  type CameraErrorKind,
  type CameraPublisherHandle,
  type PublishStatus,
} from '@/features/streams/CameraPublisher';
import { HlsPlayer } from '@/features/streams/HlsPlayer';
import type { PublicStreamChat } from '@/features/streams/api';
import { BottomLiveControls } from './BottomLiveControls';
import { BottomSheet } from './BottomSheet';
import { CommentsOverlay } from './CommentsOverlay';
import { CommentsSheet, type ReplyTarget } from './CommentsSheet';
import { EndLiveConfirmation } from './EndLiveConfirmation';
import { FloatingReactions, type FloatingReaction } from './FloatingReactions';
import { LiveStatusBar } from './LiveStatusBar';
import { ObsSetupSheet } from './ObsSetupSheet';
import { PostLiveSummary } from './PostLiveSummary';
import { PreLiveScreen } from './PreLiveScreen';
import { QuickActionRail } from './QuickActionRail';
import { SheetRow, SheetSection } from './SheetParts';
import { CameraErrorOverlay, CameraSlate, ErrorBanner, PausedOverlay } from './StateOverlays';
import { StreamInfoSheet } from './StreamInfoSheet';
import { StreamSettingsSheet } from './StreamSettingsSheet';
import { S, TOUCH } from './theme';
import { Toast, useToast } from './Toast';
import { useControlsAutoHide } from './useControlsAutoHide';
import { type LiveSummary, type StreamerLiveViewModel } from './viewModel';
import { fonts, onMedia } from '@/theme';

/** UI-only state (the "visual" half of the state architecture). */
type StreamerLiveUIState = {
  sheet: null | 'settings' | 'comments' | 'info' | 'obs' | 'source';
  endLiveConfirmationOpen: boolean;
  cleanView: boolean;
};

type Busy = null | 'golive' | 'pause' | 'resume' | 'end' | 'reset';

export type StreamerLiveScreenProps = {
  vm: StreamerLiveViewModel;
  eventTitle: string;
  mode: 'browser' | 'obs';
  onModeChange: (m: 'browser' | 'obs') => void;

  // Video source
  whipUrl?: string;
  previewHls?: string;
  publishing: boolean;
  publishStatus: PublishStatus;
  cameraRef: RefObject<CameraPublisherHandle | null>;
  cameraNonce: number;
  device: CameraDeviceState;
  cameraError: CameraErrorKind | null;
  onPublishStatus: (s: PublishStatus) => void;
  onDeviceState: (d: CameraDeviceState) => void;
  onCameraError: (k: CameraErrorKind) => void;
  onRetryCamera: () => void;

  // Lifecycle
  seconds: number;
  streamHealth?: string;
  uploadSpeed?: string;
  busy: Busy;
  error: string | null;
  onDismissError: () => void;
  onGoLive: () => void;
  onPause: () => void;
  onResume: () => void;
  /** Resolves when the existing stop handler has finished (success or failure). */
  onEnd: () => Promise<void>;
  onReset: () => void;
  onExit: () => void;

  // Sharing
  inviteToken?: string;
  onShareStream: () => void;
  onShareInvite: () => void;
  onShareWhip: () => void;

  // Chat
  chats: PublicStreamChat[];
  hostCustomerId?: string | number | null;
  chatDraft: string;
  onChatDraftChange: (v: string) => void;
  replyingTo: ReplyTarget | null;
  onSelectReply: (c: PublicStreamChat) => void;
  onCancelReply: () => void;
  chatSending: boolean;
  onSendChat: () => void;

  // Reactions
  floating: FloatingReaction[];

  summary: LiveSummary;
};

const FILL_VIDEO = { ...StyleSheet.absoluteFill, aspectRatio: undefined, borderRadius: 0 } as const;

export function StreamerLiveScreen(p: StreamerLiveScreenProps) {
  const { vm } = p;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 480;
  const { toast, show } = useToast();

  const [ui, setUi] = useState<StreamerLiveUIState>({
    sheet: null,
    endLiveConfirmationOpen: false,
    cleanView: false,
  });
  const setSheet = useCallback((sheet: StreamerLiveUIState['sheet']) => setUi((u) => ({ ...u, sheet })), []);
  const closeSheet = useCallback(() => setSheet(null), [setSheet]);

  const onAir = (vm.isLive || vm.isPaused) && p.busy !== 'golive';
  const showPreLive = vm.isPreLive || p.busy === 'golive';
  const phone = p.mode === 'browser';

  // ── Auto-hide controls (live only; never while something is open) ────────
  const hold = !onAir || vm.isPaused || ui.sheet !== null || ui.endLiveConfirmationOpen;
  const controls = useControlsAutoHide(hold, 6000);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.timing(controlsOpacity, {
      toValue: controls.visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [controls.visible, controlsOpacity]);

  // ── "You're live" confirmation once the existing go-live call succeeds ──
  const prevBusy = useRef<Busy>(p.busy);
  useEffect(() => {
    if (prevBusy.current === 'golive' && p.busy === null && vm.isLive) show('You’re live');
    prevBusy.current = p.busy;
  }, [p.busy, vm.isLive, show]);

  // ── Back handling: never leave a live stream with one accidental tap ─────
  const onBackPress = useCallback(() => {
    if (vm.isLive || vm.isPaused) {
      setUi((u) => ({ ...u, endLiveConfirmationOpen: true }));
    } else {
      p.onExit();
    }
  }, [vm.isLive, vm.isPaused, p]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ui.endLiveConfirmationOpen) {
        setUi((u) => ({ ...u, endLiveConfirmationOpen: false }));
        return true;
      }
      if (ui.sheet) {
        setSheet(null);
        return true;
      }
      if (vm.isEnded) return false;
      onBackPress();
      return true;
    });
    return () => sub.remove();
  }, [ui.endLiveConfirmationOpen, ui.sheet, vm.isEnded, onBackPress, setSheet]);

  // ── Handlers (thin wrappers: existing action + lightweight feedback) ─────
  const toggleMic = useCallback(() => {
    // `device` reflects the camera's real state; predict the flip for the toast.
    show(p.device.micOff ? 'Microphone On' : 'Microphone Off');
    p.cameraRef.current?.toggleMic();
  }, [p.cameraRef, p.device.micOff, show]);

  const toggleCam = useCallback(() => {
    show(p.device.camOff ? 'Video On' : 'Video Off');
    p.cameraRef.current?.toggleCam();
  }, [p.cameraRef, p.device.camOff, show]);

  const flip = useCallback(() => {
    show('Camera switched');
    p.cameraRef.current?.flip();
  }, [p.cameraRef, show]);

  const changeMode = useCallback(
    (m: 'browser' | 'obs') => {
      if (m !== p.mode) {
        p.onModeChange(m);
        show(m === 'browser' ? 'Source: this phone' : 'Source: external / OBS');
      }
    },
    [p, show],
  );

  const openComments = useCallback(() => setSheet('comments'), [setSheet]);
  const replyFromOverlay = useCallback(
    (c: PublicStreamChat) => {
      p.onSelectReply(c);
      setSheet('comments');
    },
    [p, setSheet],
  );

  const confirmEnd = useCallback(async () => {
    await p.onEnd();
    setUi((u) => ({ ...u, endLiveConfirmationOpen: false }));
  }, [p]);

  // ── Ended → summary (camera unmounts as the stream is over) ─────────────
  if (vm.isEnded) {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <PostLiveSummary
          eventTitle={p.eventTitle}
          summary={p.summary}
          resetting={p.busy === 'reset'}
          onDone={p.onExit}
          onStartNew={p.onReset}
        />
        {p.error ? (
          <ErrorBanner title="Something went wrong" message={p.error} onDismiss={p.onDismissError} top={insets.top + 8} />
        ) : null}
      </View>
    );
  }

  // ── Layout metrics ───────────────────────────────────────────────────────
  const barHeight = TOUCH + 10 + Math.max(insets.bottom, 10);
  const railWidth = 64;
  const showCameraError = phone && p.publishing && p.publishStatus === 'error' && p.cameraError && p.cameraError !== 'network';
  const connectionDropped = phone && onAir && p.publishStatus === 'error' && p.cameraError === 'network';

  return (
    <View
      style={styles.root}
      onTouchStart={onAir && controls.visible ? controls.poke : undefined}
    >
      <StatusBar style="light" />

      {/* 1 ── Camera / video surface (never remounted by UI changes) */}
      <View style={StyleSheet.absoluteFill}>
        {phone ? (
          p.whipUrl ? (
            p.publishing ? (
              <CameraPublisher
                key={p.cameraNonce}
                ref={p.cameraRef}
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
          <HlsPlayer url={p.previewHls} style={FILL_VIDEO} />
        ) : (
          <CameraSlate kind="obs" whipReady={!!p.whipUrl} />
        )}
      </View>

      {/* 2 ── Tap surface: show / hide controls while on air */}
      {onAir ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={controls.toggle}
          accessibilityRole="button"
          accessibilityLabel={
            controls.visible ? 'Camera preview. Tap to hide controls.' : 'Camera preview. Tap to show controls.'
          }
        />
      ) : null}

      {phone && p.device.camOff && p.publishing && !showCameraError ? (
        <View style={styles.camOffNote} pointerEvents="none">
          <Text style={styles.camOffText}>Video is off, viewers see a blank screen</Text>
        </View>
      ) : null}

      {/* 3 ── Scrims for legibility over any content */}
      {onAir ? (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0.5)', 'transparent']}
          style={[styles.topScrim, { height: insets.top + 110 }]}
        />
      ) : null}

      {/* 4 ── Pre-live setup */}
      {showPreLive ? (
        <PreLiveScreen
          eventTitle={p.eventTitle}
          mode={p.mode}
          ready={!!p.whipUrl}
          cameraRunning={p.publishStatus === 'publishing'}
          micOff={p.device.micOff}
          camOff={p.device.camOff}
          facing={p.device.facing}
          inviteToken={p.inviteToken}
          busy={p.busy === 'golive'}
          compact={compact}
          onBack={onBackPress}
          onFlip={flip}
          onToggleMic={toggleMic}
          onToggleCam={toggleCam}
          onOpenSource={() => setSheet('source')}
          onShare={p.onShareStream}
          onShareInvite={p.onShareInvite}
          onGoLive={p.onGoLive}
        />
      ) : null}

      {/* 5 ── Live overlays */}
      {onAir ? (
        <>
          <LiveStatusBar
            seconds={p.seconds}
            viewerCount={vm.viewerCount}
            connection={vm.connection}
            showDevices={phone}
            micOff={p.device.micOff}
            camOff={p.device.camOff}
            controlsOpacity={controlsOpacity}
            controlsInteractive={controls.visible}
            onBack={onBackPress}
            onMore={() => setSheet('settings')}
          />

          {!ui.cleanView ? (
            <>
              <CommentsOverlay
                chats={p.chats}
                hostCustomerId={p.hostCustomerId}
                bottom={barHeight + 4}
                rightGutter={insets.right + 12 + railWidth + 8}
                maxHeight={compact ? height * 0.38 : Math.min(height * 0.3, 260)}
                onPressComment={replyFromOverlay}
              />
              <FloatingReactions items={p.floating} bottom={barHeight + 16} travel={height * 0.35} />
            </>
          ) : null}

          <QuickActionRail
            showCameraControls={phone}
            micOff={p.device.micOff}
            camOff={p.device.camOff}
            facing={p.device.facing}
            commentCount={p.chats.length}
            compact={compact}
            bottomOffset={barHeight + 12}
            opacity={controlsOpacity}
            interactive={controls.visible}
            onFlip={flip}
            onToggleMic={toggleMic}
            onToggleCam={toggleCam}
            onOpenComments={openComments}
          />

          <BottomLiveControls
            opacity={controlsOpacity}
            interactive={controls.visible}
            ending={p.busy === 'end'}
            onOpenComposer={openComments}
            onShare={p.onShareStream}
            onSettings={() => setSheet('settings')}
            onEnd={() => setUi((u) => ({ ...u, endLiveConfirmationOpen: true }))}
          />

        </>
      ) : null}

      {vm.isPaused && onAir ? <PausedOverlay onResume={p.onResume} busy={p.busy === 'resume'} /> : null}

      {/* 6 ── State: camera errors / connection drops */}
      {showCameraError ? <CameraErrorOverlay kind={p.cameraError as CameraErrorKind} onRetry={p.onRetryCamera} /> : null}
      {connectionDropped ? (
        <ErrorBanner
          top={insets.top + 80}
          title="Connection interrupted"
          message="Your preview is still running. Try reconnecting."
          actionLabel="Reconnect"
          onAction={p.onRetryCamera}
          onDismiss={() => {}}
        />
      ) : null}
      {!connectionDropped && !showCameraError && onAir && vm.connection === 'lost' ? (
        <ErrorBanner
          top={insets.top + 80}
          title="Connection unavailable"
          message="We’ll keep trying to reconnect."
          onDismiss={() => {}}
        />
      ) : null}
      {p.error ? (
        <ErrorBanner
          top={insets.top + (onAir ? 120 : 60)}
          title={showPreLive ? 'Unable to start LIVE' : 'Something went wrong'}
          message={p.error}
          actionLabel={showPreLive && p.busy === null ? 'Retry' : undefined}
          onAction={showPreLive ? p.onGoLive : undefined}
          onDismiss={p.onDismissError}
        />
      ) : null}

      <Toast message={toast} top={insets.top + (onAir ? 96 : 64)} />

      {/* 7 ── Bottom sheets (in-tree, camera stays mounted behind) */}
      <StreamSettingsSheet
        visible={ui.sheet === 'settings'}
        onClose={closeSheet}
        eventTitle={p.eventTitle}
        mode={p.mode}
        onModeChange={changeMode}
        isLive={vm.isLive}
        isPaused={vm.isPaused}
        busy={p.busy}
        micOff={p.device.micOff}
        camOff={p.device.camOff}
        facing={p.device.facing}
        cleanView={ui.cleanView}
        inviteToken={p.inviteToken}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onFlip={flip}
        onToggleCleanView={(v) => {
          setUi((u) => ({ ...u, cleanView: v }));
          show(v ? 'Clean view on' : 'Clean view off');
        }}
        onPause={() => {
          closeSheet();
          p.onPause();
        }}
        onResume={() => {
          closeSheet();
          p.onResume();
        }}
        onShare={p.onShareStream}
        onShareInvite={p.onShareInvite}
        onOpenInfo={() => setSheet('info')}
        onOpenObs={() => setSheet('obs')}
      />

      <StreamInfoSheet
        visible={ui.sheet === 'info'}
        onClose={closeSheet}
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
        visible={ui.sheet === 'comments'}
        onClose={closeSheet}
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

      <ObsSetupSheet visible={ui.sheet === 'obs'} onClose={closeSheet} whipUrl={p.whipUrl} copied={false} onCopy={p.onShareWhip} />

      <BottomSheet visible={ui.sheet === 'source'} onClose={closeSheet} title="Video source">
        <SheetSection title="Broadcast from">
          <SheetRow
            icon="phone-portrait-outline"
            label="This phone"
            hint="Use the camera and microphone on this device"
            value={phone ? 'Selected' : undefined}
            onPress={() => {
              changeMode('browser');
              closeSheet();
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

      {/* 8 ── Confirmation */}
      <EndLiveConfirmation
        visible={ui.endLiveConfirmationOpen}
        busy={p.busy === 'end'}
        onContinue={() => setUi((u) => ({ ...u, endLiveConfirmationOpen: false }))}
        onEnd={confirmEnd}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: onMedia.black },
  topScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  camOffNote: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '45%',
    alignItems: 'center',
  },
  camOffText: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: S.textDim,
    backgroundColor: S.scrimStrong,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: 'hidden',
  },
});
