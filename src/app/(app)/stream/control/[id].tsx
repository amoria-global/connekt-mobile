/**
 * Photographer Stream Control — mobile port of salo-run's StreamPreview
 * (app/components/StreamPreview.tsx) + the lifecycle handlers in
 * salo-run/app/pages/photographer/events.tsx.
 *
 * Two ways to broadcast, exactly like the web dashboard:
 *   • Browser camera — go live straight from this phone (getUserMedia →
 *     WHIP publish, with a live preview + mic/cam/flip controls).
 *   • External / OBS — copy the self-authenticating WHIP URL into OBS
 *     (or any WHIP encoder) on a laptop.
 *
 * All the web's controls are here: Go Live (resume), Pause, Resume, End
 * (stop), Reset & Restart, viewer + peak counts, stream health & upload
 * bitrate, status badge, the viewer invite token, and a live self-preview
 * over WHEP once the encoder is connected.
 *
 * Backend lifecycle lives under /photographer/events/{id}/stream/* —
 * see features/streams/photographer.ts.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { CameraPublisher, type PublishStatus } from '@/features/streams/CameraPublisher';
import { HlsPlayer } from '@/features/streams/HlsPlayer';
import { getPublicStreamChats, type PublicStreamChat } from '@/features/streams/api';
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
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

const OBS_STEPS = [
  'Open OBS → File → Settings.',
  'Go to the Stream tab.',
  'Set Service to WHIP.',
  'Paste the WHIP URL below into the Server field.',
  'Leave Bearer Token empty.',
  'Click Apply, then Start Streaming in OBS.',
];

const QUALITY_ROWS = [
  { speed: '5–10 Mbps', bitrate: '1500 Kbps', res: '854×480', fps: '30' },
  { speed: '10–25 Mbps', bitrate: '2500 Kbps', res: '1280×720', fps: '30' },
  { speed: '25–50 Mbps', bitrate: '4000 Kbps', res: '1280×720', fps: '30' },
  { speed: '50+ Mbps', bitrate: '6000 Kbps', res: '1920×1080', fps: '30' },
];

const STATUS_META: Record<
  StreamConnectionStatus,
  { label: string; color: string; dot: string }
> = {
  connected: { label: 'Live', color: '#10B981', dot: '#10B981' },
  paused: { label: 'Paused', color: '#F59E0B', dot: '#F59E0B' },
  ended: { label: 'Ended', color: '#6B7280', dot: '#6B7280' },
  disconnected: { label: 'Waiting for encoder', color: '#F59E0B', dot: '#F59E0B' },
  idle: { label: 'Not started', color: '#6B7280', dot: '#6B7280' },
};

export default function StreamControlScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

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

  const status: StreamConnectionStatus = config?.connectionStatus ?? 'idle';
  const isLive = status === 'connected';
  const isPaused = status === 'paused';
  const isEnded = status === 'ended';
  const whipUrl = creds.whipUrl;
  const whepUrl = creds.whepUrl;
  const inviteToken = creds.inviteToken;

  // expo-video / hls.js can't play a WHEP (WebRTC) URL — the OBS preview
  // needs the HLS manifest. Cloudflare's WHEP and HLS URLs share the same
  // customer hash + live-input id; only the path differs. Deriving it here
  // is what makes the OBS feed actually show in the preview (matching the
  // public viewer screen).
  const previewHls = whepUrl?.includes('/webRTC/play')
    ? whepUrl.replace('/webRTC/play', '/manifest/video.m3u8')
    : whepUrl?.endsWith('.m3u8')
      ? whepUrl
      : undefined;

  // ── Live chat + reactions (read-only) so the broadcaster sees viewer
  // activity right on the preview, like the web StreamPreview. ──
  const [chats, setChats] = useState<PublicStreamChat[]>([]);
  const [floating, setFloating] = useState<
    { id: string; emoji: string; anim: Animated.Value; offset: number }[]
  >([]);
  // Incoming gifts this session: GiftOverlay banners over the preview +
  // a running "🎁 $sum · count" chip. The first poll batch is history
  // from before this screen opened, so it's absorbed silently.
  const [giftEvents, setGiftEvents] = useState<GiftEvent[]>([]);
  const [giftStats, setGiftStats] = useState({ count: 0, usd: 0 });
  const chatScrollRef = useRef<ScrollView>(null);

  const burst = useCallback((emoji: string) => {
    const anim = new Animated.Value(0);
    const itemId = Math.random().toString(36).slice(2);
    const offset = 8 + Math.random() * 42;
    setFloating((prev) => [...prev, { id: itemId, emoji, anim, offset }]);
    Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }).start(() => {
      setFloating((prev) => prev.filter((x) => x.id !== itemId));
    });
  }, []);

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
        // GIFT rows → banner animations over the preview + session stats.
        // Deduped by row id; the first batch (pre-existing history) is
        // absorbed without animating or counting.
        for (const m of page.messages) {
          if ((m.chatType ?? m.type ?? '').toUpperCase() !== 'GIFT') continue;
          if (seenGifts.has(m.id)) continue;
          seenGifts.add(m.id);
          if (first) continue;
          const meta = parseGiftMeta(m.giftMeta);
          if (!meta) continue;
          const ev: GiftEvent = {
            ...meta,
            id: m.id,
            senderName: meta.senderName ?? m.viewerName ?? 'Someone',
          };
          setGiftEvents((prev) => [...prev.slice(-49), ev]);
          setGiftStats((s) => ({ count: s.count + 1, usd: s.usd + ev.amountUsd }));
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

  useEffect(() => {
    const t = setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [chats.length]);

  // ── Boot: start the live input, then poll config every 5s ───────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      try {
        const c = await startPhotographerStream(id);
        if (!cancelled) setCreds(c);
      } catch (e) {
        // Already started / transient — the config poll fills in the URLs.
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
      // Backfill credentials the start call may not have returned.
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

  // ── Lifecycle handlers ───────────────────────────────────────────────────
  const onGoLive = async () => {
    setBusy('golive');
    setError(null);
    try {
      await resumePhotographerStream(id);
      await refreshConfig();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not go live.');
    } finally {
      setBusy(null);
    }
  };

  const onPause = async () => {
    setBusy('pause');
    try {
      await pausePhotographerStream(id);
      await refreshConfig();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not pause.');
    } finally {
      setBusy(null);
    }
  };

  const onResume = async () => {
    setBusy('resume');
    try {
      await resumePhotographerStream(id);
      await refreshConfig();
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not resume.');
    } finally {
      setBusy(null);
    }
  };

  const onEnd = async () => {
    setEndConfirm(false);
    setBusy('end');
    try {
      setPublishing(false); // stop the local camera publish
      await stopPhotographerStream(id);
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
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 2000);
    } catch {
      /* dismissed */
    }
  };

  const meta = STATUS_META[status];

  // ── Render ───────────────────────────────────────────────────────────────
  if (bootLoading && !whipUrl) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.muted}>Setting up your stream…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Status bar */}
        <View style={[styles.statusBar, { borderColor: `${meta.color}55` }]}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, { backgroundColor: meta.dot }]} />
            <Text style={styles.statusLabel}>{meta.label}</Text>
          </View>
          {isLive ? (
            <View style={styles.watchingPill}>
              <Ionicons name="eye" size={12} color={colors.primary} />
              <Text style={styles.watchingText}>{config?.viewerCount ?? 0} watching</Text>
            </View>
          ) : null}
        </View>

        {/* Preview */}
        {isEnded ? (
          <View style={styles.endedBox}>
            <Ionicons name="stop-circle" size={42} color={colors.textMuted} />
            <Text style={styles.endedTitle}>Stream ended</Text>
            <Text style={styles.endedHint}>
              This stream has ended. You can restart with a fresh connection.
            </Text>
            <Button
              title={busy === 'reset' ? 'Resetting…' : 'Reset & Restart stream'}
              onPress={onReset}
              loading={busy === 'reset'}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <View style={styles.previewWrap}>
            {mode === 'browser' ? (
              // Live local camera preview + publish.
              whipUrl ? (
                <CameraPublisher
                  whipUrl={whipUrl}
                  publish={publishing}
                  onStatusChange={setPublishStatus}
                  style={styles.preview}
                />
              ) : (
                <View style={[styles.preview, styles.previewPlaceholder]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )
            ) : isLive && previewHls ? (
              // OBS mode + live → show what viewers see, via the HLS manifest
              // derived from the WHEP URL (expo-video has no WebRTC codec).
              <HlsPlayer url={previewHls} style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.previewPlaceholder]}>
                <Ionicons name="desktop-outline" size={40} color="rgba(255,255,255,0.7)" />
                <Text style={styles.previewPlaceholderText}>
                  {whipUrl ? 'Waiting for OBS to connect…' : 'Preparing stream…'}
                </Text>
              </View>
            )}

            {/* Floating reaction bursts from viewers, rising over the preview. */}
            {floating.length ? (
              <View pointerEvents="none" style={styles.floatLayer}>
                {floating.map((fx) => (
                  <Animated.Text
                    key={fx.id}
                    style={[
                      styles.floatEmoji,
                      {
                        left: fx.offset,
                        opacity: fx.anim.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                        transform: [
                          { translateY: fx.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -160] }) },
                        ],
                      },
                    ]}
                  >
                    {fx.emoji}
                  </Animated.Text>
                ))}
              </View>
            ) : null}

            {/* Incoming gift banners / risers / takeovers, over the preview —
                the broadcaster sees gifts land in real time. Clipped to the
                preview's rounded corners. Sized down for the 16:9 card. */}
            <GiftOverlay
              events={giftEvents}
              bannerTop={spacing.sm}
              floaterBottom={8}
              riseDistance={140}
              style={styles.giftOverlayClip}
            />
          </View>
        )}

        {/* Stats (live or paused) */}
        {(isLive || isPaused) && config ? (
          <View style={styles.statsRow}>
            <Stat label="Health" value={cap(config.streamHealth) || 'N/A'} icon="pulse" />
            <Stat label="Upload" value={config.uploadSpeed || 'N/A'} icon="arrow-up-circle" />
            <Stat label="Viewers" value={String(config.viewerCount)} icon="eye" />
            <Stat label="Peak" value={String(config.peakViewers)} icon="trending-up" />
          </View>
        ) : null}

        {/* Live chat (read-only view of viewer activity) */}
        {!isEnded ? (
          <View style={styles.card}>
            <View style={styles.chatHead}>
              <Ionicons name="chatbubbles-outline" size={16} color={colors.primary} />
              <Text style={styles.cardTitle}>Live chat</Text>
              <Text style={styles.chatCount}>{chats.length}</Text>
              {/* Gifts received THIS session (first poll batch excluded). */}
              {giftStats.count > 0 ? (
                <View
                  style={styles.giftChip}
                  accessibilityLabel={`${giftStats.count} gifts received this session, ${formatGiftUsd(giftStats.usd)} total`}
                >
                  <Text style={styles.giftChipText}>
                    🎁 {formatGiftUsd(giftStats.usd)} · {giftStats.count}
                  </Text>
                </View>
              ) : null}
            </View>
            <ScrollView ref={chatScrollRef} style={styles.chatList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {chats.length === 0 ? (
                <Text style={styles.chatEmpty}>No messages yet. Viewer comments appear here live.</Text>
              ) : (
                chats.map((c) => {
                  const isGift = (c.chatType ?? c.type ?? '').toUpperCase() === 'GIFT';
                  const gift = isGift ? parseGiftMeta(c.giftMeta) : null;
                  return (
                    <View key={c.id} style={styles.chatRow}>
                      <Text style={[styles.chatName, isGift && styles.chatNameGift]}>
                        {c.viewerName || 'Guest'}
                      </Text>
                      {isGift ? (
                        <Text style={styles.chatGift}>
                          {gift
                            ? `${gift.emoji} sent a ${gift.name} · ${formatGiftUsd(gift.amountUsd)}`
                            : `🎁 ${c.message}`}
                        </Text>
                      ) : (
                        <Text style={styles.chatMsg}>{c.videoUrl ? '🎬 Video message' : c.message}</Text>
                      )}
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        ) : null}

        {/* Mode toggle (hidden once ended) */}
        {!isEnded ? (
          <View style={styles.modeRow}>
            <ModeTab
              active={mode === 'browser'}
              icon="phone-portrait-outline"
              label="This phone"
              onPress={() => setMode('browser')}
            />
            <ModeTab
              active={mode === 'obs'}
              icon="desktop-outline"
              label="External / OBS"
              onPress={() => setMode('obs')}
            />
          </View>
        ) : null}

        {/* Browser-camera controls */}
        {!isEnded && mode === 'browser' ? (
          <View style={styles.card}>
            {!publishing ? (
              <>
                <Text style={styles.cardTitle}>Broadcast from this phone</Text>
                <Text style={styles.cardHint}>
                  Use your phone’s camera and mic. Tap Start camera to preview, then Go Live.
                </Text>
                <Button
                  title="Start camera"
                  onPress={() => setPublishing(true)}
                  disabled={!whipUrl}
                />
              </>
            ) : (
              <>
                {publishStatus === 'error' ? (
                  <Text style={styles.cardHint}>
                    Couldn’t start the camera. Check permissions, or switch to External / OBS.
                  </Text>
                ) : publishStatus === 'publishing' ? (
                  <Text style={styles.okHint}>
                    <Ionicons name="checkmark-circle" size={13} color={colors.success} /> Camera
                    connected. {isLive ? 'You are live.' : 'Tap Go Live to broadcast.'}
                  </Text>
                ) : (
                  <Text style={styles.cardHint}>Connecting camera…</Text>
                )}
                <Pressable style={styles.stopCamera} onPress={() => setPublishing(false)}>
                  <Ionicons name="close" size={14} color={colors.textMuted} />
                  <Text style={styles.stopCameraText}>Stop camera</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        {/* OBS credentials */}
        {!isEnded && mode === 'obs' && whipUrl ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>OBS setup (WHIP)</Text>
            {OBS_STEPS.map((s, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}

            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>WHIP URL</Text>
              <Pressable style={styles.copyChip} onPress={() => share('WHIP URL', whipUrl)}>
                <Ionicons name="share-outline" size={12} color={colors.primary} />
                <Text style={styles.copyChipText}>{copied === 'WHIP URL' ? 'Shared' : 'Share / Copy'}</Text>
              </Pressable>
            </View>
            <View style={styles.urlBox}>
              <Text style={styles.urlText} selectable>
                {whipUrl}
              </Text>
            </View>
            <Text style={styles.noteText}>
              No stream key or bearer token needed. The URL is self-authenticating.
            </Text>

            {/* Recommended encoder settings */}
            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Recommended OBS output</Text>
            <View style={styles.table}>
              <View style={[styles.tr, styles.trHead]}>
                <Text style={[styles.th, { flex: 1.4 }]}>Internet</Text>
                <Text style={styles.th}>Bitrate</Text>
                <Text style={styles.th}>Resolution</Text>
                <Text style={[styles.th, { flex: 0.6 }]}>FPS</Text>
              </View>
              {QUALITY_ROWS.map((r) => (
                <View key={r.speed} style={styles.tr}>
                  <Text style={[styles.td, { flex: 1.4 }]}>{r.speed}</Text>
                  <Text style={styles.td}>{r.bitrate}</Text>
                  <Text style={styles.td}>{r.res}</Text>
                  <Text style={[styles.td, { flex: 0.6 }]}>{r.fps}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Invite token */}
        {!isEnded && inviteToken ? (
          <View style={styles.card}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>Viewer invite token</Text>
              <Pressable style={styles.copyChip} onPress={() => share('Invite token', inviteToken)}>
                <Ionicons name="share-outline" size={12} color={colors.primary} />
                <Text style={styles.copyChipText}>
                  {copied === 'Invite token' ? 'Shared' : 'Share / Copy'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.tokenBox}>
              <Text style={styles.tokenText} selectable>
                {inviteToken}
              </Text>
            </View>
            <Text style={styles.noteText}>Share this with viewers to grant stream access.</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Action buttons */}
        {!isEnded ? (
          <View style={styles.actions}>
            {isLive ? (
              <>
                <Button
                  title="Pause stream"
                  variant="outline"
                  onPress={onPause}
                  loading={busy === 'pause'}
                />
                <Button
                  title="End stream"
                  onPress={() => setEndConfirm(true)}
                  style={styles.endBtn}
                  textStyle={{ color: '#fff' }}
                />
              </>
            ) : isPaused ? (
              <>
                <Button title="Resume stream" onPress={onResume} loading={busy === 'resume'} />
                <Button
                  title="End stream"
                  onPress={() => setEndConfirm(true)}
                  style={styles.endBtn}
                  textStyle={{ color: '#fff' }}
                />
              </>
            ) : (
              <Button
                title={isLive ? 'Live' : 'Go Live'}
                onPress={onGoLive}
                loading={busy === 'golive'}
                disabled={mode === 'browser' && publishStatus !== 'publishing'}
              />
            )}
          </View>
        ) : null}
      </ScrollView>

      {/* End confirm */}
      <Modal visible={endConfirm} transparent animationType="fade" onRequestClose={() => setEndConfirm(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEndConfirm(false)}>
          <Pressable style={styles.confirmCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.confirmIcon}>
              <Ionicons name="stop-circle" size={28} color="#fff" />
            </View>
            <Text style={styles.confirmTitle}>End stream?</Text>
            <Text style={styles.confirmText}>
              This ends the live stream for everyone. All viewers will be disconnected. You can
              restart later with Reset.
            </Text>
            <View style={styles.confirmRow}>
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setEndConfirm(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="End stream"
                onPress={onEnd}
                loading={busy === 'end'}
                style={[styles.endBtn, { flex: 1.3 }]}
                textStyle={{ color: '#fff' }}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function cap(s?: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function Stat({ label, value, icon }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Ionicons name={icon} size={11} color={colors.primary} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function ModeTab({
  active,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable style={[styles.modeTab, active && styles.modeTabActive]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={active ? colors.primary : colors.textMuted} />
      <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 140 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingTop: 80 },
  muted: { color: c.textMuted, fontSize: fontSize.sm },

  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  watchingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.infoBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  watchingText: { fontSize: 12, fontWeight: '700', color: c.primary },

  previewWrap: { position: 'relative' },
  preview: { aspectRatio: 16 / 9, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: '#000' },
  previewPlaceholder: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  previewPlaceholderText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm, textAlign: 'center' },
  floatLayer: { position: 'absolute', left: 0, bottom: 8, top: 0, width: 90 },
  floatEmoji: { position: 'absolute', bottom: 0, fontSize: 26 },
  // Clip gift banners/takeovers to the preview's rounded 16:9 card.
  giftOverlayClip: { borderRadius: radii.lg, overflow: 'hidden' },

  chatHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatCount: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '800',
    color: c.primary,
    backgroundColor: c.infoBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: 'hidden',
  },
  chatList: { maxHeight: 160 },
  chatEmpty: { fontSize: fontSize.sm, color: c.textMuted, fontStyle: 'italic' },
  chatRow: { flexDirection: 'row', gap: 6, paddingVertical: 3, flexWrap: 'wrap' },
  chatName: { fontSize: fontSize.sm, fontWeight: '800', color: c.primary },
  chatNameGift: { color: c.accent },
  chatMsg: { fontSize: fontSize.sm, color: c.text, flexShrink: 1 },
  chatGift: { fontSize: fontSize.sm, color: c.accent, fontWeight: '800', flexShrink: 1 },
  giftChip: {
    marginLeft: 6,
    backgroundColor: 'rgba(242,12,143,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(242,12,143,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  giftChipText: { fontSize: 12, fontWeight: '800', color: c.accent },

  statsRow: { flexDirection: 'row', gap: 6 },
  stat: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderSoft,
    borderRadius: radii.md,
    paddingVertical: 8,
    alignItems: 'center',
    gap: 2,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontSize: 10, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase' },
  statValue: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: c.text },

  modeRow: { flexDirection: 'row', gap: 8 },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.md,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1.5,
    borderColor: c.borderSoft,
  },
  modeTabActive: { borderColor: c.primary, backgroundColor: c.infoBg },
  modeTabText: { fontSize: fontSize.sm, fontWeight: '700', color: c.textMuted },
  modeTabTextActive: { color: c.primary },

  card: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  cardHint: { fontSize: fontSize.sm, color: c.textMuted, lineHeight: 20 },
  okHint: { fontSize: fontSize.sm, color: c.text, lineHeight: 20 },
  stopCamera: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4 },
  stopCameraText: { fontSize: fontSize.xs, color: c.textMuted, fontWeight: '600' },

  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  stepNum: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stepText: { flex: 1, fontSize: fontSize.sm, color: c.text, lineHeight: 19 },

  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  fieldLabel: { fontSize: fontSize.xs, fontWeight: '700', color: c.textSoft, letterSpacing: 0.4, textTransform: 'uppercase' },
  copyChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  copyChipText: { fontSize: 12, color: c.primary, fontWeight: '700' },
  urlBox: { backgroundColor: c.surfaceMuted, borderRadius: radii.md, padding: spacing.md },
  urlText: { fontSize: 12, color: c.text, fontFamily: 'monospace' },
  noteText: { fontSize: 12, color: c.textMuted, fontStyle: 'italic' },

  table: { borderWidth: 1, borderColor: c.borderSoft, borderRadius: radii.md, overflow: 'hidden' },
  tr: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: c.borderSoft },
  trHead: { backgroundColor: c.surfaceMuted },
  th: { flex: 1, fontSize: 10, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase' },
  td: { flex: 1, fontSize: 11, color: c.text },

  tokenBox: { backgroundColor: c.infoBg, borderRadius: radii.md, padding: spacing.md, alignItems: 'center' },
  tokenText: { fontSize: 18, fontWeight: '800', letterSpacing: 3, color: c.primary },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.errorBg,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  errorText: { flex: 1, color: c.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  actions: { gap: spacing.sm },
  endBtn: { backgroundColor: c.error },

  endedBox: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.xl,
    alignItems: 'center',
    gap: 6,
  },
  endedTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  endedHint: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  confirmCard: {
    backgroundColor: c.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    maxWidth: 420,
  },
  confirmIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  confirmText: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center', lineHeight: 20 },
  confirmRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignSelf: 'stretch' },
}));
