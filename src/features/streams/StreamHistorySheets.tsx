/**
 * The two sheets behind a stream card, the mobile form of the web's "Chat Messages" and "Video Messages" modals
 * (app/pages/client/streams.tsx): the messages with who sent them and when, and the viewers' video messages with a
 * player, NEW and viewed marks, and their durations. A failed read is an error with a retry, never "no messages".
 */
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, Text, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { ErrorNotice, EmptyNote, SkeletonCard } from '@/features/photographer/kit';
import { makeStyles, radii, spacing, useTheme, onFill, onMedia, viewerTokens } from '@/theme';
import type { Stream, StreamHistory, StreamMessage, StreamVideo } from './api';
import { whenLabel } from './streamsModel';

type SheetState = { history?: StreamHistory; loading: boolean; error?: string; onRetry: () => void };

function Avatar({ uri, name, size = 36 }: { uri?: string; name: string; size?: number }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const initial = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Text style={[styles.avatarText, { color: colors.textMuted }]}>{initial}</Text>
      )}
    </View>
  );
}

function body({ history, loading, error, onRetry }: SheetState, render: (h: StreamHistory) => React.ReactNode) {
  if (loading && !history) return <SkeletonCard height={90} />;
  if (error && !history) return <ErrorNotice flush message={error} onRetry={onRetry} />;
  if (!history) return null;
  return render(history);
}

export function StreamChatsSheet({ stream, state, onClose }: { stream: Stream; state: SheetState; onClose: () => void }) {
  const styles = useStyles();
  const when = whenLabel({ date: stream.date });
  return (
    <Sheet title={`Chat messages: ${stream.title}`} onClose={onClose}>
      {body(state, (h) => (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              Total messages: <Text style={styles.strong}>{h.messages.length}</Text>
            </Text>
            {when ? (
              <Text style={styles.summaryText}>
                Stream date: <Text style={styles.strong}>{when}</Text>
              </Text>
            ) : null}
          </View>
          {h.messages.length === 0 ? (
            <EmptyNote compact icon="chatbubble-outline" title="No messages" body="No messages were sent during this stream." />
          ) : (
            h.messages.map((m: StreamMessage, i) => (
              <View key={m.id} style={[styles.msg, i % 2 === 1 && styles.msgAlt]}>
                <Avatar uri={m.avatar} name={m.username} />
                <View style={styles.msgBody}>
                  <View style={styles.msgHead}>
                    <Text style={styles.user} numberOfLines={2}>
                      @{m.username || 'viewer'}
                    </Text>
                    {m.time ? <Text style={styles.time}>{m.time}</Text> : null}
                  </View>
                  <Text style={styles.msgText}>{m.message || (m.chatType ? m.chatType.toLowerCase() : '')}</Text>
                </View>
              </View>
            ))
          )}
        </>
      ))}
    </Sheet>
  );
}

function Player({ video }: { video: StreamVideo }) {
  const styles = useStyles();
  const player = useVideoPlayer({ uri: video.videoUrl }, (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <View style={styles.player}>
      <VideoView player={player} style={styles.video} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
    </View>
  );
}

export function StreamVideosSheet({
  stream,
  state,
  viewed,
  onOpenVideo,
  onClose,
}: {
  stream: Stream;
  state: SheetState;
  viewed: ReadonlySet<string>;
  onOpenVideo: (videoId: string) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <Sheet title={`Video messages: ${stream.title}`} onClose={onClose}>
      {body(state, (h) => {
        const current = h.videos.find((v) => v.id === selected);
        return (
          <>
            <View style={styles.summary}>
              <Text style={styles.summaryText}>
                Total videos: <Text style={styles.strong}>{h.videos.length}</Text>
              </Text>
            </View>
            {current ? (
              <View>
                {current.videoUrl ? <Player key={current.id} video={current} /> : null}
                <View style={styles.playerFoot}>
                  <Avatar uri={current.avatar} name={current.username} size={30} />
                  <Text style={styles.user} numberOfLines={2}>
                    @{current.username || 'viewer'}
                  </Text>
                  <Text style={styles.time}>
                    {current.duration}
                    {current.time ? `  ${current.time}` : ''}
                  </Text>
                </View>
              </View>
            ) : null}
            {h.videos.length === 0 ? (
              <EmptyNote compact icon="videocam-outline" title="No video messages" body="No video messages were sent during this stream." />
            ) : (
              <View style={styles.grid}>
                {h.videos.map((v) => {
                  const seen = viewed.has(v.id);
                  const on = selected === v.id;
                  return (
                    <Pressable
                      key={v.id}
                      onPress={() => {
                        setSelected(v.id);
                        if (!seen) onOpenVideo(v.id);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Video from ${v.username || 'viewer'}, ${v.duration}${seen ? '' : ', new'}`}
                      accessibilityState={{ selected: on }}
                      style={[styles.tile, on && styles.tileOn]}
                    >
                      <View style={styles.thumb}>
                        {v.thumbnailUrl ? (
                          <Image source={{ uri: v.thumbnailUrl }} style={styles.thumbImg} contentFit="cover" accessibilityIgnoresInvertColors />
                        ) : null}
                        <View style={styles.play}>
                          <Ionicons name="play" size={16} color={onFill} />
                        </View>
                        {seen ? (
                          <View style={styles.seen}>
                            <Ionicons name="checkmark" size={12} color={onFill} />
                          </View>
                        ) : (
                          <View style={styles.newTag}>
                            <Text style={styles.newText}>NEW</Text>
                          </View>
                        )}
                        <View style={styles.dur}>
                          <Text style={styles.durText}>{v.duration}</Text>
                        </View>
                      </View>
                      <View style={styles.tileFoot}>
                        <Text style={[styles.user, { color: colors.primary }]} numberOfLines={2}>
                          @{v.username || 'viewer'}
                        </Text>
                        {v.time ? <Text style={styles.time}>{v.time}</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        );
      })}
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  summary: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.md, borderRadius: radii.md, backgroundColor: c.surfaceMuted },
  summaryText: { color: c.textMuted, fontSize: 13 },
  strong: { color: c.text, fontWeight: '700' },
  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.surfaceMuted },
  avatarText: { fontSize: 14, fontWeight: '700' },
  msg: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radii.md },
  msgAlt: { backgroundColor: c.surfaceMuted },
  msgBody: { flex: 1, minWidth: 0, gap: 2 },
  msgHead: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  user: { flexShrink: 1, color: c.primary, fontSize: 13, fontWeight: '700' },
  time: { color: c.textMuted, fontSize: 12 },
  msgText: { color: c.text, fontSize: 14, lineHeight: 20 },
  player: { borderRadius: radii.md, overflow: 'hidden', backgroundColor: onMedia.black },
  video: { width: '100%', height: 220 },
  playerFoot: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { width: '47.5%', borderRadius: radii.md, overflow: 'hidden', borderWidth: 2, borderColor: c.border, backgroundColor: c.surface },
  tileOn: { borderColor: c.primary },
  thumb: { height: 100, backgroundColor: viewerTokens.surface, alignItems: 'center', justifyContent: 'center' },
  thumbImg: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const) },
  play: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  newTag: { position: 'absolute', top: 4, right: 4, backgroundColor: c.error, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  newText: { color: c.textOnPrimary, fontSize: 10, fontWeight: '700' },
  seen: { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center' },
  dur: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  durText: { color: c.textOnPrimary, fontSize: 11 },
  tileFoot: { padding: spacing.sm, gap: 2 },
}));
