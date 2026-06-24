import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Screen } from '@/components/ui/Screen';
import { useRole } from '@/features/auth/role';
import { getStream, joinStream, listStreamChats, sendInAppStreamChat, tipStream, type StreamChat } from '@/features/streams/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

const TIP_AMOUNTS = [500, 1000, 2000, 5000];

export default function StreamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isCoordinator } = useRole();
  const { data, loading, error } = useAsync(useCallback(() => getStream(id), [id]));
  const [joining, setJoining] = useState(false);
  const [tipping, setTipping] = useState<number | null>(null);
  const [playUrl, setPlayUrl] = useState<string | null>(null);
  const [chats, setChats] = useState<StreamChat[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  // Start playback once we have a URL (live HLS streams).
  useEffect(() => {
    if (!playUrl) return;
    try {
      player.replace(playUrl);
      player.play();
    } catch {
      // unsupported URL (e.g. WebRTC) — surface gracefully
      Alert.alert('Playback unavailable', 'This stream format cannot play in the app yet.');
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

  const onJoin = async () => {
    setJoining(true);
    try {
      const url = (await joinStream(id)) ?? data?.playbackUrl;
      if (url) {
        setPlayUrl(url);
      } else {
        Alert.alert('Stream unavailable', 'This stream cannot be opened right now.');
      }
    } catch {
      Alert.alert('Could not join', 'Please try again.');
    } finally {
      setJoining(false);
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

  const onTip = async (amount: number) => {
    setTipping(amount);
    try {
      await tipStream(id, amount);
      Alert.alert('Thank you!', 'Your tip has been sent.');
    } catch {
      Alert.alert('Tip failed', 'Please try again.');
    } finally {
      setTipping(null);
    }
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
              allowsFullscreen
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
          <Button title={data?.isLive ? 'Join stream' : 'Watch'} onPress={onJoin} loading={joining} />
        ) : null}

        <View style={styles.tipSection}>
          <Text style={styles.tipTitle}>Send a tip</Text>
          <View style={styles.tipRow}>
            {TIP_AMOUNTS.map((a) => (
              <Pressable
                key={a}
                style={({ pressed }) => [styles.tipChip, pressed && styles.pressed]}
                onPress={() => onTip(a)}
                disabled={tipping != null}
              >
                {tipping === a ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.tipText}>{a.toLocaleString()}</Text>
                )}
              </Pressable>
            ))}
          </View>
        </View>

        {playUrl ? (
          <View style={styles.chatSection}>
            <Text style={styles.tipTitle}>Live chat</Text>
            {chats.length ? (
              chats.map((c) => (
                <View key={c.id} style={styles.chatRow}>
                  {c.sender ? <Text style={styles.chatSender}>{c.sender}</Text> : null}
                  <Text style={styles.chatMsg}>{c.message}</Text>
                </View>
              ))
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

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  muted: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center' },
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
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  liveText: { color: colors.textOnPrimary, fontSize: fontSize.xs, fontWeight: fontWeight.extrabold },
  title: { fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  meta: { fontSize: fontSize.md, color: colors.textMuted, marginTop: -spacing.sm },
  tipSection: { gap: spacing.md, marginTop: spacing.sm },
  tipTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.text },
  tipRow: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  tipChip: {
    flexGrow: 1,
    minWidth: 70,
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  tipText: { color: colors.primary, fontSize: fontSize.md, fontWeight: fontWeight.bold },
  chatSection: { gap: spacing.sm, marginTop: spacing.sm },
  chatRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: spacing.md,
    gap: 2,
  },
  chatSender: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.primary },
  chatMsg: { fontSize: fontSize.sm, color: colors.text },
  chatEmpty: { fontSize: fontSize.sm, color: colors.textMuted },

  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  composerInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: fontSize.sm,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
