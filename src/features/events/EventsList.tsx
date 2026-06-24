import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Segmented } from '@/components/ui/Segmented';
import { useAsync } from '@/hooks/useAsync';
import { listCoordinatorEvents, listEvents } from './api';
import { EventCard } from './EventCard';

type Filter = 'upcoming' | 'past' | 'all';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function EventsList({
  coordinator = false,
  title,
  subtitle,
  topInset,
}: {
  coordinator?: boolean;
  title?: string;
  subtitle?: string;
  topInset?: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const { data, loading, error, refresh } = useAsync(
    useCallback(() => (coordinator ? listCoordinatorEvents() : listEvents()), [coordinator]),
  );

  const filtered = useMemo(() => {
    if (!data || filter === 'all') return data;
    const today = startOfToday();
    return data.filter((e) => {
      const t = e.eventDate ? new Date(e.eventDate).getTime() : NaN;
      if (Number.isNaN(t)) return filter === 'upcoming'; // undated → treat as upcoming
      return filter === 'upcoming' ? t >= today : t < today;
    });
  }, [data, filter]);

  return (
    <DataList
      data={filtered}
      loading={loading}
      error={error}
      onRefresh={refresh}
      title={title}
      subtitle={subtitle}
      topInset={topInset}
      headerExtra={
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { label: 'Upcoming', value: 'upcoming' },
            { label: 'Past', value: 'past' },
            { label: 'All', value: 'all' },
          ]}
        />
      }
      keyExtractor={(e) => e.id}
      renderItem={({ item }) => (
        <Pressable
          // Explicit width + opacity feedback so the tap is obvious.
          // Without this, on smaller phones the card felt inert because
          // there was no visual confirmation of the press before the
          // navigation kicked in.
          accessibilityRole="button"
          accessibilityLabel={`Open ${item.title}`}
          android_ripple={{ color: 'rgba(0,0,0,0.06)' }}
          style={({ pressed }) => ({
            width: '100%',
            opacity: pressed ? 0.85 : 1,
            transform: pressed ? [{ scale: 0.99 }] : undefined,
          })}
          onPress={() => router.push(`/event/${item.id}` as never)}
        >
          <EventCard event={item} />
        </Pressable>
      )}
      emptyIcon="calendar-outline"
      emptyTitle={filter === 'past' ? 'No past events' : 'No events yet'}
      emptyMessage={
        filter === 'past'
          ? 'Your completed events will show up here.'
          : 'Your upcoming events will appear here once you book or get booked.'
      }
    />
  );
}
