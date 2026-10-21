/**
 * Streams. A coordinator sees the streams of the events they run; a client sees their stream history (what they
 * streamed or paid to watch), so it is mostly replays. A failed read is an error with a retry, never "no streams".
 */
import { useCallback, useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { UserHeaderBand } from '@/components/ui/UserHeaderBand';
import { ActionButton, Chip, EmptyNote, ErrorNotice, SkeletonCard } from '@/features/photographer/kit';
import { listStreams } from '@/features/streams/api';
import { StreamCard } from '@/features/streams/StreamCard';
import { STREAM_FILTERS, countByPhase, filterStreams, type StreamFilter } from '@/features/streams/streamsModel';
import { useAsync } from '@/hooks/useAsync';
import { useLanguage } from '@/hooks/useLanguage';
import { useRole } from '@/features/auth/role';
import { makeStyles, spacing, useTheme } from '@/theme';

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
  const [pulling, setPulling] = useState(false);
  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refresh();
    } finally {
      setPulling(false);
    }
  }, [refresh]);

  const counts = useMemo(() => (data ? countByPhase(data) : null), [data]);
  const rows = useMemo(() => (data ? filterStreams(data, filter) : []), [data, filter]);
  const failed = !!error && !data;
  const showSkeleton = loading && !data && !error;

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <UserHeaderBand
          flush
          duplicatesHeader
          title={t('b2_streamsTitle')}
          subtitle={isCoordinator ? 'Streams of the events you coordinate' : 'Your stream history and replays'}
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
        {data && data.length > 0 ? (
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
                count={counts ? counts[f.key] : undefined}
                selected={filter === f.key}
                onPress={() => setFilter(f.key)}
              />
            ))}
          </ScrollView>
        ) : null}
        {data && data.length === 0 ? (
          <View style={styles.flushNote}>
            <EmptyNote
              compact
              icon="videocam-outline"
              title={t('b2_streamsEmptyTitle')}
              body={
                isCoordinator
                  ? 'Streams of your events appear here once an event goes live.'
                  : 'Streams you host or pay to watch appear here, with their replays.'
              }
            />
          </View>
        ) : null}
        {data && data.length > 0 && rows.length === 0 ? (
          <View style={styles.flushNote}>
            <EmptyNote
              compact
              icon="funnel-outline"
              title="Nothing in this filter"
              body="Pick another filter to see the rest."
              actionLabel="Show all"
              onAction={() => setFilter('all')}
            />
          </View>
        ) : null}
        <View style={styles.group}>
          {rows.map((s) => (
            <StreamCard
              key={`${s.id}-${s.streamId ?? ''}`}
              stream={s}
              onPress={() => router.push(`/stream/${s.id}` as Href)}
              footer={
                isCoordinator ? (
                  <ActionButton
                    compact
                    label="Manage event"
                    icon="settings-outline"
                    onPress={() => router.push(`/event/${s.id}` as Href)}
                  />
                ) : undefined
              }
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  content: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  group: { gap: spacing.md },
  chipsWrap: { flexGrow: 0, marginHorizontal: -spacing.lg },
  chips: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: 'center' },
  flushNote: { marginHorizontal: -spacing.lg },
}));
