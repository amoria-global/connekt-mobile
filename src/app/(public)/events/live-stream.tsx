/**
 * Public live-stream viewer.
 *
 * Two entry shapes:
 *   1. /events/live-stream?id=…&viewerId=…   (post-payment, paid stream)
 *      → checkAnonymousAccessStatus → render HLS via expo-video
 *   2. /events/live-stream?id=…              (free stream / invite token)
 *      → token input → validateStreamToken → render HLS
 *
 * The web equivalents are `events/live-stream/page.tsx` (anonymous viewer
 * resume) and `events/join-event/page.tsx` (free + token flow).
 */
import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Screen } from '@/components/ui/Screen';
import { getPublicEventDetailed } from '@/features/events/api';
import {
  checkAnonymousAccessStatus,
  getPublicViewerCount,
  validateStreamToken,
} from '@/features/streams/api';
import { useAsync } from '@/hooks/useAsync';
import { isApiError } from '@/store/auth';
import { colors, fontSize, fontWeight, radii, spacing } from '@/theme';

export default function PublicLiveStreamScreen() {
  const { id, viewerId, token: initialToken } = useLocalSearchParams<{
    id: string;
    viewerId?: string;
    token?: string;
  }>();
  const router = useRouter();

  const event = useAsync(useCallback(() => getPublicEventDetailed(id), [id]));
  const [token, setToken] = useState(initialToken ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [viewerCount, setViewerCount] = useState<number>(0);

  // Auto-resume paid anonymous-viewer access if we already have a viewerId.
  useEffect(() => {
    if (!viewerId) return;
    let cancelled = false;
    setBusy(true);
    checkAnonymousAccessStatus(id, viewerId)
      .then((res) => {
        if (cancelled) return;
        if (res.active && res.hlsManifestUrl) {
          setManifestUrl(res.hlsManifestUrl);
        } else {
          setError('Your viewer access is not active yet — please retry the payment.');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(isApiError(e) ? e.message : 'Could not verify your access.');
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [id, viewerId]);

  // Poll public viewer count for the badge.
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const c = await getPublicViewerCount(id);
        if (!cancelled) setViewerCount(c);
      } catch {
        /* not fatal */
      }
    };
    tick();
    const handle = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [id]);

  const onJoinWithToken = async () => {
    if (!token.trim()) {
      setError('Please paste the invite token from your invitation.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await validateStreamToken(id, token.trim());
      if (!res.valid) {
        setError('That token is not valid for this event.');
        return;
      }
      if (res.requiresPayment) {
        // Forward to the payment screen for a paid stream.
        router.replace(`/events/join?id=${id}` as unknown as Href);
        return;
      }
      if (res.hlsManifestUrl) {
        setManifestUrl(res.hlsManifestUrl);
      } else {
        setError(
          res.hasLiveStream
            ? 'The stream is starting soon. Please try again in a moment.'
            : 'This event has no live stream right now.',
        );
      }
    } catch (e) {
      setError(isApiError(e) ? e.message : 'Could not validate the token.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen padded={false} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2}>
            {event.data?.title ?? 'Live stream'}
          </Text>
          {viewerCount > 0 ? (
            <View style={styles.viewerBadge}>
              <Ionicons name="eye-outline" size={14} color="#fff" />
              <Text style={styles.viewerBadgeText}>{viewerCount.toLocaleString()}</Text>
            </View>
          ) : null}
        </View>

        {manifestUrl ? (
          <Player url={manifestUrl} />
        ) : (
          <View style={styles.placeholder}>
            {busy ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Ionicons name="videocam-outline" size={48} color={colors.textMuted} />
            )}
            <Text style={styles.placeholderText}>
              {busy ? 'Connecting to the stream…' : 'Stream will appear here.'}
            </Text>
          </View>
        )}

        {!manifestUrl && !viewerId ? (
          <View style={styles.tokenCard}>
            <Text style={styles.tokenLabel}>Have an invite token?</Text>
            <Input
              value={token}
              onChangeText={setToken}
              placeholder="Paste the token from your invitation"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Button title="Join stream" onPress={onJoinWithToken} loading={busy} />
            <Pressable onPress={() => router.replace(`/event/${id}` as unknown as Href)}>
              <Text style={styles.linkText}>← Back to event details</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.loop = false;
    p.muted = false;
    p.play();
  });
  return (
    <View style={styles.playerWrap}>
      <VideoView
        player={player}
        style={styles.player}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.xl, gap: spacing.lg, paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1, fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: colors.text },
  viewerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  viewerBadgeText: { color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  placeholder: {
    aspectRatio: 16 / 9,
    backgroundColor: '#0F1217',
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  placeholderText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.sm },

  playerWrap: { aspectRatio: 16 / 9, borderRadius: radii.lg, overflow: 'hidden', backgroundColor: '#000' },
  player: { width: '100%', height: '100%' },

  tokenCard: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    gap: spacing.md,
  },
  tokenLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text },
  linkText: { textAlign: 'center', color: colors.primary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.errorBg,
    padding: spacing.lg,
    borderRadius: radii.lg,
  },
  errorText: { flex: 1, color: colors.error, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
});
