import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { CameraErrorKind } from '@/features/streams/CameraPublisher';
import { useSharedT } from '@/i18n/sharedStrings';
import { fonts, onFill, darkPalette, onMedia, paper, viewerTokens } from '@/theme';
import { S } from './theme';

type IconName = keyof typeof Ionicons.glyphMap;

function Center({
  icon,
  title,
  body,
  children,
  spinner,
}: {
  icon?: IconName;
  title: string;
  body?: string;
  children?: ReactNode;
  spinner?: boolean;
}) {
  const { tr } = useSharedT();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      {spinner ? <ActivityIndicator color={onFill} /> : icon ? <Ionicons name={icon} size={40} color={S.text} /> : null}
      <Text style={styles.title}>{tr(title)}</Text>
      {body ? <Text style={styles.body}>{tr(body)}</Text> : null}
      {children}
    </View>
  );
}

function PrimaryBtn({ label, onPress, icon }: { label: string; onPress: () => void; icon?: IconName }) {
  const { tr } = useSharedT();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {icon ? <Ionicons name={icon} size={18} color={paper.ink} /> : null}
      <Text style={styles.btnText}>{tr(label)}</Text>
    </Pressable>
  );
}

/** Camera could not start (permission / not found / other), existing error signal, polished. */
export function CameraErrorOverlay({
  kind,
  onRetry,
}: {
  kind: CameraErrorKind;
  onRetry: () => void;
}) {
  const { tr } = useSharedT();
  const permission = kind === 'permission';
  return (
    <View style={styles.fillDark}>
      <Center
        icon="videocam-off"
        title="Camera unavailable"
        body={
          permission
            ? 'Please check your camera and microphone permissions, then try again.'
            : kind === 'notfound'
              ? 'No camera or microphone was found on this device.'
              : kind === 'unsupported'
                ? 'This device cannot access the camera.'
                : 'We could not start your camera. Please try again.'
        }
      >
        <PrimaryBtn label="Try Again" icon="refresh" onPress={onRetry} />
        {permission ? (
          <Pressable
            onPress={() => Linking.openSettings().catch(() => {})}
            accessibilityRole="button"
            accessibilityLabel="Open app settings"
            style={styles.link}
          >
            <Text style={styles.linkText}>{tr('Open Settings')}</Text>
          </Pressable>
        ) : null}
      </Center>
    </View>
  );
}

/** Stand-in for the camera surface when there is no phone-camera feed. */
export function CameraSlate({ kind, whipReady }: { kind: 'connecting' | 'obs' | 'standby'; whipReady?: boolean }) {
  if (kind === 'connecting') {
    return (
      <View style={styles.fillDark}>
        <Center spinner title="Preparing your camera…" />
      </View>
    );
  }
  if (kind === 'obs') {
    return (
      <View style={styles.fillDark}>
        <Center
          icon="desktop-outline"
          title="Waiting for OBS signal"
          body={
            whipReady
              ? 'Start streaming from your encoder. Your feed will appear here once it connects.'
              : 'Establishing encoder ingest…'
          }
        />
      </View>
    );
  }
  return (
    <View style={styles.fillDark}>
      <Center icon="videocam-outline" title="Camera off" />
    </View>
  );
}

/** Full-screen failure when the stream could not be initialised at all. */
export function StartFailure({
  message,
  onRetry,
  onBack,
}: {
  message?: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  const { tr } = useSharedT();
  return (
    <View style={[styles.fillDark, styles.solid]}>
      <Center
        icon="cloud-offline-outline"
        title="Unable to start LIVE"
        body={message || 'Please try again.'}
      >
        <PrimaryBtn label="Retry" icon="refresh" onPress={onRetry} />
        <Pressable onPress={onBack} style={styles.link} accessibilityRole="button" accessibilityLabel="Go back">
          <Text style={styles.linkText}>{tr('Go back')}</Text>
        </Pressable>
      </Center>
    </View>
  );
}

export function BootLoading() {
  return (
    <View style={[styles.fillDark, styles.solid]}>
      <Center spinner title="Preparing your studio…" body="Setting up your video channel" />
    </View>
  );
}

/** Dismissible inline banner for action errors while on the camera screen. */
export function ErrorBanner({
  title,
  message,
  actionLabel,
  onAction,
  onDismiss,
  top,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  top: number;
}) {
  const { tr } = useSharedT();
  return (
    <View style={[styles.banner, { top }]} accessibilityLiveRegion="assertive">
      <Ionicons name="alert-circle" size={22} color={darkPalette.error} />
      <View style={{ flex: 1 }}>
        <Text style={styles.bannerTitle}>{tr(title)}</Text>
        {message ? <Text style={styles.bannerMsg}>{tr(message)}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.bannerBtn} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text style={styles.bannerBtnText}>{tr(actionLabel)}</Text>
        </Pressable>
      ) : null}
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Dismiss message">
        <Ionicons name="close" size={20} color={S.textDim} />
      </Pressable>
    </View>
  );
}

/** Centre prompt while paused. */
export function PausedOverlay({ onResume, busy }: { onResume: () => void; busy: boolean }) {
  const { tr } = useSharedT();
  return (
    <View style={styles.paused} pointerEvents="box-none">
      <View style={styles.pausedCard}>
        <Ionicons name="pause-circle" size={34} color={S.warn} />
        <Text style={styles.title}>{tr('Stream paused')}</Text>
        <Text style={styles.body}>{tr('Viewers are waiting. Resume when you are ready.')}</Text>
        <Pressable
          onPress={onResume}
          disabled={busy}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
          accessibilityLabel="Resume stream"
        >
          {busy ? <ActivityIndicator color={paper.ink} /> : <Ionicons name="play" size={18} color={paper.ink} />}
          <Text style={styles.btnText}>{tr('Resume')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fillDark: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(8,10,16,0.94)' },
  solid: { backgroundColor: viewerTokens.bg, zIndex: 70 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  title: { fontFamily: fonts.bold, fontSize: 24, color: S.text, textAlign: 'center' },
  body: { fontFamily: fonts.regular, fontSize: 17, color: S.textDim, textAlign: 'center', maxWidth: 320 },
  btn: {
    minHeight: 50,
    paddingHorizontal: 28,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: onMedia.text,
    marginTop: 8,
  },
  btnText: { fontFamily: fonts.bold, fontSize: 18, color: paper.ink },
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
  linkText: { fontFamily: fonts.bold, fontSize: 16, color: S.textDim, textDecorationLine: 'underline' },
  banner: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(40,12,14,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(252,165,165,0.4)',
  },
  bannerTitle: { fontFamily: fonts.bold, fontSize: 16, color: S.text },
  bannerMsg: { fontFamily: fonts.regular, fontSize: 14, color: S.textDim },
  bannerBtn: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: onMedia.text,
  },
  bannerBtnText: { fontFamily: fonts.bold, fontSize: 15, color: paper.ink },
  paused: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 6 },
  pausedCard: {
    alignItems: 'center',
    gap: 8,
    padding: 22,
    borderRadius: 22,
    backgroundColor: 'rgba(8,10,16,0.82)',
    maxWidth: 320,
  },
});
