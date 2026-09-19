import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { digitalPurchasesEnabled } from '@/features/payments/policy';
import { liveGiftUrl, openWebCheckout } from '@/features/payments/webCheckout';
import { getStream, joinStream, listStreamChats, sendInAppStreamChat, type StreamChat } from '@/features/streams/api';
import { formatGiftUsd, parseGiftMeta } from '@/features/streams/gifting/GiftOverlay';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { spacing, radii, fontSize, fontWeight, makeStyles, useTheme } from '@/theme';

export default function StreamDetailScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isCoordinator } = useRole();
  const { data, loading, error, refresh } = useAsync(useCallback(() => getStream(id), [id]));
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [chats, setChats] = useState<StreamChat[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
    p.muted = false;
    p.audioMixingMode = 'auto';
  });

  // Surface native playback errors. Without this, Android ExoPlayer
  // failures (codec not supported, segment 404, manifest empty) sat
  // silently behind a frozen black box.
  useEffect(() => {
    const sub = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' && error?.message) {
        console.warn('[stream] playback error', error.message);
      }
    });
    return () => sub.remove();
  }, [player]);

  /**
   * Auto-fetch HLS manifest as soon as we have an event id, and refresh
   * every 8s until one becomes available. Cloudflare HLS goes live
   * after the photographer connects OBS — without polling, the viewer
   * had to back out and re-open the screen to pick up the manifest.
   *
   * Backend has no GET /streams/{id} so we read the event detail and
   * use its hlsManifestUrl / playbackUrl / whepUrl.
   */
  useEffect(() => {
    if (data?.playbackUrl && !playUrl) setPlayUrl(data.playbackUrl);
  }, [data?.playbackUrl, playUrl]);

  useEffect(() => {
    if (playUrl || !id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        await refresh();
      } catch {
        /* ignore — keep polling */
      }
    };
    const handle = setInterval(tick, 8000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [playUrl, id, refresh]);

  // Drive the player whenever the URL flips. Use the object-form
  // source so native HLS picks the right loader (bare strings can
  // leave ExoPlayer in a permanent stalled state on Android).
  useEffect(() => {
    if (!playUrl) return;
    try {
      player.replace({ uri: playUrl });
      player.play();
    } catch (e) {
      Alert.alert('Playback unavailable', isApiError(e) ? e.message : 'Could not start the stream.');
    }
  }, [playUrl, player]);

  // Poll live chat while watching.
  useEffect(() => {
    if (!playUrl || !data?.eventId) return;
    let active = true;
    const load = async () => {
      try {
        const msgs = await listStreamChats(data.eventId!);
        if (active) setChats(msgs);
      } catch {
        // ignore transient errors
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [playUrl, data?.eventId]);

  // Manual "Retry now" — most users won't need it since the 8s poll
  // picks up the stream automatically, but on flaky networks the user
  // wants control.
  const onRetry = async () => {
    try {
      const url = (await joinStream(id)) ?? data?.playbackUrl;
      if (url) setPlayUrl(url);
      else Alert.alert('Not live yet', 'The photographer hasn’t connected the encoder.');
    } catch (e) {
      Alert.alert('Could not refresh', isApiError(e) ? e.message : 'Please try again.');
    }
  };

  const onSendChat = async () => {
    const msg = chatDraft.trim();
    if (!msg || !data?.eventId) return;
    setChatSending(true);
    try {
      await sendInAppStreamChat(data.eventId, msg);
      setChatDraft('');
      // Optimistic — the poll will pick up the real row on the next tick.
      setChats((prev) => [
        ...prev,
        { id: `local-${Date.now()}`, sender: 'You', message: msg, createdAt: new Date().toISOString() },
      ]);
    } catch (e) {
      Alert.alert('Could not send', isApiError(e) ? e.message : 'Please try again.');
    } finally {
      setChatSending(false);
    }
  };

  // Gifts are completed on the web — the app collects no payment. Gated to
  // iOS/web; on Android the button never renders.
  const onGift = () => {
    if (!digitalPurchasesEnabled) return;
    void openWebCheckout(liveGiftUrl(data?.eventId ?? id));
  };

  if (loading && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMuted} />
          <Text style={styles.muted}>{error}</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          {playUrl ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              fullscreenOptions={{ enable: true }}
              nativeControls
            />
          ) : (
            <Ionicons name="videocam" size={40} color={colors.textOnPrimary} />
          )}
          {data?.isLive ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.title}>{data?.title}</Text>
        {data?.photographerName ? <Text style={styles.meta}>{data.photographerName}</Text> : null}

        {!playUrl ? (
          <View style={styles.waitingCard}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.waitingTitle}>Waiting for the stream…</Text>
            <Text style={styles.waitingText}>
              {data?.isLive
                ? "The photographer is online but the player hasn't received video yet."
                : 'The stream hasn’t started. We will start playing as soon as it goes live.'}
            </Text>
            <Pressable onPress={onRetry} hitSlop={6}>
              <Text style={styles.waitingLink}>Tap to refresh</Text>
            </Pressable>
          </View>
        ) : null}

        {digitalPurchasesEnabled ? (
          <View style={styles.tipSection}>
            <Text style={styles.tipTitle}>Support this creator</Text>
            <Button title="Send a gift on connekyt.com" onPress={onGift} />
          </View>
        ) : null}

        {playUrl ? (
          <View style={styles.chatSection}>
            <Text style={styles.tipTitle}>Live chat</Text>
            {chats.length ? (
              chats.map((c) => {
                // GIFT rows render as pink-tinted gift lines: emoji +
                // "sent a {name} · $X". giftMeta is parsed defensively;
                // fall back to the row's human text when it's unusable.
                const isGift = (c.chatType ?? '').toUpperCase() === 'GIFT';
                const gift = isGift ? parseGiftMeta(c.giftMeta) : null;
                return (
                  <View key={c.id} style={[styles.chatRow, isGift && styles.chatRowGift]}>
                    {c.sender ? (
                      <Text style={[styles.chatSender, isGift && styles.chatSenderGift]}>{c.sender}</Text>
                    ) : null}
                    {isGift ? (
                      <Text style={styles.chatMsgGift}>
                        {gift
                          ? `${gift.emoji} sent a ${gift.name} · ${formatGiftUsd(gift.amountUsd)}`
                          : `🎁 ${c.message}`}
                      </Text>
                    ) : (
                      <Text style={styles.chatMsg}>{c.message}</Text>
                    )}
                  </View>
                );
              })
            ) : (
              <Text style={styles.chatEmpty}>No messages yet.</Text>
            )}

            {/*
             * Composer is Coordinator-only — the backend's
             * /coordinator/streams/{id}/chats endpoint enforces the
             * coordinator role, so clients/viewers/photographers in
             * the in-app stream watch the chat but can't post. The
             * web behaves the same way (it routes to the coord
             * endpoint only for coordinator userRole).
             */}
            {isCoordinator ? (
              <View style={styles.composer}>
                <TextInput
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  placeholder="Say something…"
                  placeholderTextColor={colors.textMuted}
                  style={styles.composerInput}
                  returnKeyType="send"
                  onSubmitEditing={onSendChat}
                  editable={!chatSending}
                />
                <Pressable
                  style={[styles.sendBtn, (chatSending || !chatDraft.trim()) && { opacity: 0.5 }]}
                  onPress={onSendChat}
                  disabled={chatSending || !chatDraft.trim()}
                >
                  {chatSending ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: c.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
  scroll: { padding: spacing.xl, gap: spacing.lg },
  hero: {
    height: 220,
    borderRadius: radii.xl,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  liveBadge: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    backgroundColor: c.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  liveText: { color: c.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.extrabold },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: c.text },
  meta: { fontSize: fontSize.md, color: c.textMuted, marginTop: -spacing.sm },
  tipSection: { gap: spacing.md, marginTop: spacing.sm },
  tipTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: c.text },
  tipRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  tipChip: {
    flexGrow: 1,
    minWidth: 70,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  tipText: { color: c.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  chatSection: { gap: spacing.sm, marginTop: spacing.sm },
  chatRow: {
    backgroundColor: c.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.borderSoft,
    padding: spacing.md,
    gap: 2,
  },
  chatSender: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: c.primary },
  chatMsg: { fontSize: fontSize.sm, color: c.text },
  chatEmpty: { fontSize: fontSize.sm, color: c.textMuted },
  // GIFT rows: pink-tinted card + accent copy, mirroring the live screens'
  // gift language (emoji + "sent a {name} · $X").
  chatRowGift: {
    backgroundColor: 'rgba(242,12,143,0.06)',
    borderColor: 'rgba(242,12,143,0.35)',
  },
  chatSenderGift: { color: c.accent },
  chatMsgGift: { fontSize: fontSize.sm, color: c.accent, fontWeight: fontWeight.bold },
  waitingCard: {
    padding: spacing.lg,
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.borderSoft,
    alignItems: 'center',
    gap: 6,
  },
  waitingTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: c.text },
  waitingText: { fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center' },
  waitingLink: { color: c.primary, fontSize: fontSize.sm, fontWeight: fontWeight.bold, marginTop: 4 },

  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  composerInput: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: c.text,
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderColor: c.borderSoft,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
