import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { DataList } from '@/components/ui/DataList';
import { Segmented } from '@/components/ui/Segmented';
import { useAsync } from '@/hooks/useAsync';
import { listCoordinatorEvents, listEvents, listPhotographerEvents } from './api';
import { EventCard } from './EventCard';

type Filter = 'upcoming' | 'past' | 'all';
type Variant = 'default' | 'photographer';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export function EventsList({
  coordinator = false,
  variant = 'default',
  title,
  subtitle,
  topInset,
}: {
  coordinator?: boolean;
  variant?: Variant;
  title?: string;
  subtitle?: string;
  topInset?: number;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('upcoming');
  const fetcher = useCallback(() => {
    if (variant === 'photographer') return listPhotographerEvents();
    return coordinator ? listCoordinatorEvents() : listEvents();
  }, [coordinator, variant]);
  const { data, loading, error, refresh } = useAsync(fetcher);

  /**
   * Filter + sort. Newest-first across every tab — sorting by
   * eventDate alone meant a brand-new booking for next month appeared
   * BELOW a year-old upcoming event, which read as random ordering to
   * the photographer. Primary key is `createdAt` (request/booking
   * insert time), with `eventDate` as a tie-break for legacy rows
   * that pre-date the createdAt mapping.
   *
   *   • upcoming → newest booking first
   *   • past     → most-recently-completed first
   *   • all      → newest booking first
   *
   * Undated rows fall to the bottom of each list.
   */
  const filtered = useMemo(() => {
    if (!data) return data;
    const today = startOfToday();
    const list = filter === 'all'
      ? [...data]
      : data.filter((e) => {
          const t = e.eventDate ? new Date(e.eventDate).getTime() : NaN;
          if (Number.isNaN(t)) return filter === 'upcoming';
          return filter === 'upcoming' ? t >= today : t < today;
        });

    const ts = (s?: string) => (s ? new Date(s).getTime() : NaN);
    return list.sort((a, b) => {
      const ca = ts(a.createdAt);
      const cb = ts(b.createdAt);
      if (!Number.isNaN(ca) && !Number.isNaN(cb) && ca !== cb) return cb - ca;
      if (!Number.isNaN(cb) && Number.isNaN(ca)) return 1;
      if (!Number.isNaN(ca) && Number.isNaN(cb)) return -1;
      const ea = ts(a.eventDate);
      const eb = ts(b.eventDate);
      if (Number.isNaN(ea) && Number.isNaN(eb)) return 0;
      if (Number.isNaN(ea)) return 1;
      if (Number.isNaN(eb)) return -1;
      return eb - ea;
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
          onPress={() => router.push(`/(app)/event/${item.id}` as never)}
        >
          <EventCard event={item} variant={variant} onChanged={refresh} />
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
