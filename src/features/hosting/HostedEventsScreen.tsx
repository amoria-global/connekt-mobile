/**
 * My hosted events: the events the photographer created and streams themselves, kept apart from the
 * events they were booked for. Upcoming, live and ended, with a way to go live from any that is not over.
 */
import { useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Screen } from '@/components/ui/Screen';
import { PrimaryButton } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { SkeletonList } from '@/components/ui/Skeleton';
import { Segmented } from '@/components/ui/Segmented';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAsync } from '@/hooks/useAsync';
import type { EventItem } from '@/features/events/types';
import { makeStyles, spacing, useTheme } from '@/theme';
import { getHostingEligibility, listHostedEvents } from './api';
import { bucketOf, type HostedBucket } from './hostFlow';
import { NotAvailable } from './HostEventScreen';

const TABS: { value: HostedBucket; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'live', label: 'Live' },
  { value: 'ended', label: 'Ended' },
];

export default function HostedEventsScreen() {
  const styles = useStyles();
  const router = useRouter();
  const [tab, setTab] = useState<HostedBucket>('upcoming');

  const eligibility = useAsync(getHostingEligibility);
  const events = useAsync(() => listHostedEvents());

  const shown = useMemo(() => (events.data ?? []).filter((e) => bucketOf(e.status) === tab), [events.data, tab]);

  if (eligibility.loading && !eligibility.data) {
    return (
      <Screen>
        <SkeletonList rows={3} accessibilityLabel="Loading" />
      </Screen>
    );
  }
  if (eligibility.error && !eligibility.data) {
    return (
      <Screen>
        <ErrorState message={eligibility.error} onRetry={eligibility.refresh} />
      </Screen>
    );
  }
  if (!eligibility.data?.canHostFree) {
    return (
      <Screen>
        <NotAvailable eligibility={eligibility.data ?? { enabled: false, canHostFree: false, canHostPaid: false, reason: 'HOSTING_DISABLED' }} />
      </Screen>
    );
  }

  const host = () => router.push('/host/new' as Href);

  return (
    <Screen>
      <Segmented value={tab} options={TABS} onChange={setTab} />
      {events.loading && !events.data ? (
        <SkeletonList rows={3} accessibilityLabel="Loading your events" />
      ) : events.error && !events.data ? (
        <ErrorState message={events.error} onRetry={events.refresh} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshing={events.loading}
          onRefresh={events.refresh}
          ListEmptyComponent={
            <EmptyState
              icon="videocam-outline"
              title={tab === 'live' ? 'Nothing live right now' : tab === 'ended' ? 'No ended events yet' : 'No upcoming events'}
              message={tab === 'ended' ? 'Events you have streamed will show here.' : 'Create an event and go live in a minute.'}
              action={tab === 'ended' ? undefined : { label: 'Host an event', onPress: host }}
            />
          }
          renderItem={({ item }) => <HostedRow event={item} onOpen={() => router.push(`/event/${item.id}` as Href)} onLive={() => router.push(`/stream/control/${item.id}` as Href)} />}
        />
      )}
      <View style={styles.footer}>
        <PrimaryButton title="Host an event" onPress={host} />
      </View>
    </Screen>
  );
}

function HostedRow({ event, onOpen, onLive }: { event: EventItem; onOpen: () => void; onLive: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const bucket = bucketOf(event.status);
  return (
    <GlassCard>
      <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${event.title}. Open`} style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.title} numberOfLines={2}>
            {event.title}
          </Text>
          <Text style={styles.meta}>{[event.eventDate, bucket === 'live' ? 'Live now' : undefined].filter(Boolean).join('  ')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
      {bucket !== 'ended' ? (
        <Pressable
          onPress={onLive}
          accessibilityRole="button"
          accessibilityLabel={bucket === 'live' ? `Return to the live stream of ${event.title}` : `Go live with ${event.title}`}
          style={styles.liveBtn}
          hitSlop={6}
        >
          <Ionicons name="radio-outline" size={18} color={colors.primary} />
          <Text style={styles.liveText}>{bucket === 'live' ? 'Back to stream' : 'Go live'}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  footer: { paddingVertical: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  rowText: { flex: 1, gap: 2 },
  title: { color: c.text, fontSize: 16, fontWeight: '700' },
  meta: { color: c.textMuted, fontSize: 13 },
  liveBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44, marginTop: spacing.xs },
  liveText: { color: c.primary, fontSize: 14, fontWeight: '700' },
}));
