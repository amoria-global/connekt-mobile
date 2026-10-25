/**
 * Streams, in step with the web dashboard's Streams page (app/pages/client/streams.tsx): four headline totals,
 * search, an event type filter, and per stream the chat messages, the video messages (with NEW marks) and delete.
 * A coordinator sees the streams of the events they run; a client sees their stream history (what they streamed or
 * paid to watch). Live and upcoming streams stay listed here, which the web page does not. A failed read is an error
 * with a retry, never "no streams" and never a zero.
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Alert } from '@/components/ui/dialog';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { ActionButton, Chip, EmptyNote, ErrorNotice, SkeletonCard } from '@/features/photographer/kit';
import { deleteStreamRecord, listStreams, markVideoViewed, type Stream } from '@/features/streams/api';
import { StreamCard } from '@/features/streams/StreamCard';
import { StreamChatsSheet, StreamVideosSheet } from '@/features/streams/StreamHistorySheets';
import {
  STREAM_FILTERS,
  countByPhase,
  eventTypesOf,
  filterByType,
  filterStreams,
  messageTotal,
  searchStreams,
  streamHref,
  streamTotals,
  unviewedCount,
  videoTotal,
  type StreamFilter,
} from '@/features/streams/streamsModel';
import { useStreamExtras, withExtras } from '@/features/streams/useStreamExtras';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/hooks/useLanguage';
import { useRole } from '@/features/auth/role';
import { makeStyles, radii, spacing, useTheme } from '@/theme';
import { StatGrid } from '@/components/ui/Compact';

/** Shown in place of a total that is not known yet. */
const DASH = '\u2026';

export default function StreamsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { colors } = useTheme();
  const styles = useStyles();
  const { isCoordinator } = useRole();
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => listStreams(isCoordinator), [isCoordinator]),
  );
  const [filter, setFilter] = useState<StreamFilter>('all');
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const [viewed, setViewed] = useState<ReadonlySet<string>>(new Set());
  const [sheet, setSheet] = useState<{ kind: 'chats' | 'videos'; id: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const base = useMemo(() => (data ? data.filter((s) => !removed.has(s.id)) : undefined), [data, removed]);
  const { entries, counts, reload, forget, resetAll } = useStreamExtras(base, isCoordinator);
  const streams = useMemo(() => (base ? base.map((s) => withExtras(s, entries[s.id]?.extras)) : undefined), [base, entries]);

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      resetAll();
      await refresh();
    } finally {
      setPulling(false);
    }
  }, [refresh, resetAll]);

  const phaseCounts = useMemo(() => (streams ? countByPhase(streams) : null), [streams]);
  const types = useMemo(() => (streams ? eventTypesOf(streams) : []), [streams]);
  const totals = useMemo(() => (streams ? streamTotals(streams, counts) : null), [streams, counts]);
  const rows = useMemo(
    () => (streams ? filterStreams(filterByType(searchStreams(streams, query), type), filter) : []),
    [streams, query, type, filter],
  );
  const failed = !!error && !data;
  const showSkeleton = loading && !data && !error;
  const narrowing = query.trim() !== '' || type !== 'all' || filter !== 'all';

  const sheetStream = sheet && streams ? streams.find((s) => s.id === sheet.id) : undefined;
  const sheetEntry = sheetStream ? entries[sheetStream.id] : undefined;
  const sheetState = {
    history: sheetEntry?.history,
    loading: !!sheetStream && !sheetEntry,
    error: sheetEntry?.failed && !sheetEntry.history ? 'Could not load the messages for this stream.' : undefined,
    onRetry: () => {
      if (sheetStream) void reload(sheetStream);
    },
  };

  const confirmDelete = (s: Stream) =>
    Alert.alert(
      'Delete stream record?',
      `This will permanently delete the stream record for "${s.title}". All chat messages and video messages from this stream will be removed. This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete stream',
          style: 'destructive',
          onPress: async () => {
            setDeleting(s.id);
            try {
              await deleteStreamRecord(s, isCoordinator);
              setRemoved((prev) => new Set(prev).add(s.id));
              forget(s.id);
            } catch (e) {
              const message = (e as { message?: string })?.message;
              Alert.alert('Could not delete this stream', message || 'Please try again.');
            } finally {
              setDeleting(null);
            }
          },
        },
      ],
    );

  const num = (n: number | undefined) => (n === undefined ? DASH : n.toLocaleString('en-US'));

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <UserHeaderBand
          flush
          duplicatesHeader
          eyebrow="Library"
          title={t('b2_streamsTitle')}
          subtitle="Browse messages and videos from your event streams."
        />
        {failed ? <ErrorNotice flush message={error as string} onRetry={refresh} /> : null}
        {error && data ? (
          <ErrorNotice flush compact message={`Could not refresh. Showing the last list. ${error}`} onRetry={refresh} />
        ) : null}
        {showSkeleton ? (
          <View style={styles.group}>
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
            <SkeletonCard height={120} />
          </View>
        ) : null}

        {totals ? (
          <StatGrid
            items={[
              { key: 'streams', label: 'Total streams', value: num(totals.streams) },
              { key: 'viewers', label: 'Total viewers', value: num(totals.viewers) },
              { key: 'messages', label: 'Chat messages', value: num(totals.messages) },
              { key: 'videos', label: 'Video messages', value: num(totals.videos) },
            ]}
          />
        ) : null}

        {data && data.length > 0 ? (
          <>
            <View style={styles.search}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search streams"
                placeholderTextColor={colors.textMuted}
                returnKeyType="search"
                autoCorrect={false}
                accessibilityLabel="Search streams"
                style={styles.searchInput}
              />
            </View>
            {types.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Filter by event type" style={styles.chipsWrap}>
                <Chip label="All" selected={type === 'all'} onPress={() => setType('all')} />
                {types.map((tp) => (
                  <Chip key={tp} label={tp} selected={type.toLowerCase() === tp.toLowerCase()} onPress={() => setType(tp)} />
                ))}
              </ScrollView>
            ) : null}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              accessibilityLabel="Filter streams"
              style={styles.chipsWrap}
            >
              {STREAM_FILTERS.map((f) => (
                <Chip
                  key={f.key}
                  label={f.label}
                  count={phaseCounts ? phaseCounts[f.key] : undefined}
                  selected={filter === f.key}
                  onPress={() => setFilter(f.key)}
                />
              ))}
            </ScrollView>
          </>
        ) : null}

        {data && data.length === 0 ? (
          <View style={styles.flushNote}>
            <EmptyNote
              compact
              icon="videocam-outline"
              title="No completed streams found"
              body="Your completed event streams will appear here with viewer messages and videos."
            />
          </View>
        ) : null}
        {data && data.length > 0 && rows.length === 0 ? (
          <View style={styles.flushNote}>
            <EmptyNote
              compact
              icon="funnel-outline"
              title="No completed streams found"
              body={narrowing ? 'Try a different keyword or filter. Your past streams will appear here once they match.' : 'Nothing to show yet.'}
              actionLabel={narrowing ? 'Clear filters' : undefined}
              onAction={
                narrowing
                  ? () => {
                      setQuery('');
                      setType('all');
                      setFilter('all');
                    }
                  : undefined
              }
            />
          </View>
        ) : null}

        <View style={styles.group}>
          {rows.map((s) => {
            const entry = entries[s.id];
            const messages = messageTotal(s, counts[s.id]);
            const videos = videoTotal(s, counts[s.id]);
            const unviewed = entry?.history ? unviewedCount(entry.history.videos.map((v) => v.id), viewed) : undefined;
            return (
              <StreamCard
                key={`${s.id}-${s.streamId ?? ''}`}
                stream={s}
                messages={messages}
                videos={videos}
                unviewed={unviewed}
                onPress={() => router.push(streamHref(s.id, isCoordinator))}
                footer={
                  <View style={styles.actions}>
                    <ActionButton compact label="View chats" icon="chatbubble-outline" onPress={() => setSheet({ kind: 'chats', id: s.id })} style={styles.action} />
                    <ActionButton
                      compact
                      label="Videos"
                      icon="videocam-outline"
                      badge={unviewed || undefined}
                      onPress={() => setSheet({ kind: 'videos', id: s.id })}
                      style={styles.action}
                    />
                    {isCoordinator ? (
                      <ActionButton compact label="Manage event" icon="settings-outline" onPress={() => router.push(`/event/${s.id}` as Href)} style={styles.action} />
                    ) : null}
                    <ActionButton
                      compact
                      variant="destructive"
                      label={deleting === s.id ? 'Deleting' : 'Delete'}
                      icon="trash-outline"
                      busy={deleting === s.id}
                      disabled={deleting !== null}
                      onPress={() => confirmDelete(s)}
                      style={styles.action}
                    />
                  </View>
                }
              />
            );
          })}
        </View>
      </ScrollView>

      {sheet?.kind === 'chats' && sheetStream ? (
        <StreamChatsSheet stream={sheetStream} state={sheetState} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === 'videos' && sheetStream ? (
        <StreamVideosSheet
          key={sheetStream.id}
          stream={sheetStream}
          state={sheetState}
          viewed={viewed}
          onOpenVideo={(id) => {
            setViewed((prev) => new Set(prev).add(id));
            void markVideoViewed(sheetStream.streamId ?? sheetStream.id, id, isCoordinator);
          }}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  content: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  group: { gap: spacing.md },
  chipsWrap: { flexGrow: 0, marginHorizontal: -spacing.lg },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  flushNote: { marginHorizontal: -spacing.lg },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '45%', gap: 4, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  statLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  statValue: { color: c.text, fontSize: 24, fontWeight: '800' },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.md, borderRadius: radii.lg, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface },
  searchInput: { flex: 1, minHeight: 48, color: c.text, fontSize: 15 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { flexGrow: 1 },
}));
