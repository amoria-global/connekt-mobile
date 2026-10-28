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
import { useNow } from '@/hooks/useNow';
import type { EventItem } from '@/features/events/types';
import { formatEventDay, getEventStatus, isStartingSoon } from '@/features/events/eventStatus';
import { getUnpublishImpact, publishEvent, unpublishEvent } from '@/features/events/api';
import { StatusChip, type ChipTone } from '@/components/ui/StatusChip';
import { alpha, makeStyles, spacing, useTheme } from '@/theme';
import { getHostingEligibility, listHostedEvents } from './api';
import { bucketOf, type HostedBucket } from './hostFlow';
import { NotAvailable } from './HostEventScreen';
import { EventOverflowMenu } from './EventOverflowMenu';
import { publishActionFor } from './publishFlow';

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

  // One rule for the tab, the badge and the actions: getEventStatus, from the stream and the date-times.
  const now = useNow();
  const shown = useMemo(() => (events.data ?? []).filter((e) => bucketOf(e, now) === tab), [events.data, tab, now]);

  if (eligibility.loading && !eligibility.data) {
    return (
      <Screen edges={[]}>
        <SkeletonList rows={3} accessibilityLabel="Loading" />
      </Screen>
    );
  }
  if (eligibility.error && !eligibility.data) {
    return (
      <Screen edges={[]}>
        <ErrorState message={eligibility.error} onRetry={eligibility.refresh} />
      </Screen>
    );
  }
  if (!eligibility.data?.canHostFree) {
    return (
      <Screen edges={[]}>
        <NotAvailable eligibility={eligibility.data ?? { enabled: false, canHostFree: false, canHostPaid: false, reason: 'HOSTING_DISABLED' }} />
      </Screen>
    );
  }

  const host = () => router.push('/host/new' as Href);

  return (
    <Screen edges={[]}>
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
          renderItem={({ item }) => <HostedRow event={item} onOpen={() => router.push(`/event/${item.id}` as Href)} onLive={() => router.push(`/stream/control/${item.id}` as Href)} onChanged={events.refresh} now={now} />}
        />
      )}
      <View style={styles.footer}>
        <PrimaryButton title="Host an event" onPress={host} />
      </View>
    </Screen>
  );
}

function HostedRow({ event, now, onOpen, onLive, onChanged }: { event: EventItem; now: number; onOpen: () => void; onLive: () => void; onChanged: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const status = getEventStatus(event, now);
  const unpublished = event.published === false;
  const soon = isStartingSoon(event, now);
  const tone: ChipTone = status === 'LIVE' ? 'live' : status === 'ENDED' ? 'neutral' : 'primary';
  const label = status === 'LIVE' ? 'Live now' : status === 'ENDED' ? 'Ended' : soon ? 'Starting soon' : 'Upcoming';
  const action = publishActionFor(event.published, status);
  // Going live needs a public event that is not over.
  const canGoLive = status !== 'ENDED' && !unpublished;
  return (
    <GlassCard style={styles.card}>
      <View style={styles.row}>
        <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`${event.title}. Open`} style={styles.rowMain}>
          <View style={styles.rowText}>
            <Text style={styles.title} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={styles.meta}>{formatEventDay(event.eventDate) || event.eventDate}</Text>
            <View style={styles.badges}>
              <StatusChip label={label} tone={tone} dot={status === 'LIVE'} />
              {unpublished ? <StatusChip label="Unpublished" tone="pending" /> : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
        <EventOverflowMenu
          title={event.title}
          action={action}
          loadImpact={() => getUnpublishImpact(event.id)}
          onUnpublish={async () => {
            await unpublishEvent(event.id);
            onChanged();
          }}
          onRepublish={async () => {
            await publishEvent(event.id);
            onChanged();
          }}
        />
      </View>
      {canGoLive ? (
        <Pressable
          onPress={onLive}
          accessibilityRole="button"
          accessibilityLabel={status === 'LIVE' ? `Return to the live stream of ${event.title}` : `Go live with ${event.title}`}
          style={({ pressed }) => [styles.liveBtn, pressed && styles.liveBtnPressed]}
          hitSlop={6}
        >
          <Ionicons name="radio-outline" size={18} color={colors.liveText} />
          <Text style={styles.liveText}>{status === 'LIVE' ? 'Back to stream' : 'Go live'}</Text>
        </Pressable>
      ) : null}
    </GlassCard>
  );
}

const useStyles = makeStyles((c) => ({
  list: { gap: spacing.md, paddingVertical: spacing.md, flexGrow: 1 },
  footer: { paddingVertical: spacing.md },
  card: { padding: spacing.md, gap: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  rowText: { flex: 1, gap: 2 },
  title: { color: c.text, fontSize: 16, fontWeight: '700' },
  meta: { color: c.textMuted, fontSize: 13 },
  // A red secondary button: red tint fill, 1px red border, red label (Compact Glass: tappable means a coloured signal).
  liveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 44, marginTop: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: alpha(c.live, 0.5), backgroundColor: alpha(c.live, 0.12) },
  liveBtnPressed: { transform: [{ scale: 0.97 }], borderColor: c.live },
  liveText: { color: c.liveText, fontSize: 14, fontWeight: '700' },
}));
