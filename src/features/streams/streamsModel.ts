import type { Href } from 'expo-router';
/**
 * What the Streams screen decides, kept out of the screen so each rule can be tested.
 * Live first, then upcoming, then ended; inside a phase the most recent date first. A row with no date sorts last in its phase.
 */
import type { Stream, StreamPhase } from './api';

export type StreamFilter = 'all' | StreamPhase;

export const STREAM_FILTERS: { key: StreamFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ended', label: 'Replays' },
];

const ORDER: Record<StreamPhase, number> = { live: 0, upcoming: 1, ended: 2 };

export function countByPhase(streams: readonly Stream[]): Record<StreamFilter, number> {
  const c: Record<StreamFilter, number> = { all: streams.length, live: 0, upcoming: 0, ended: 0 };
  for (const s of streams) c[s.phase] += 1;
  return c;
}

export function sortStreams(streams: readonly Stream[]): Stream[] {
  return [...streams].sort((a, b) => {
    const byPhase = ORDER[a.phase] - ORDER[b.phase];
    if (byPhase !== 0) return byPhase;
    const da = a.date ?? '';
    const db = b.date ?? '';
    if (da !== db) return da < db ? 1 : -1; // newer first; an empty date sorts last
    return (b.time ?? '').localeCompare(a.time ?? '');
  });
}

export function filterStreams(streams: readonly Stream[], filter: StreamFilter): Stream[] {
  return sortStreams(filter === 'all' ? streams : streams.filter((s) => s.phase === filter));
}

/** "Oct 29, 2026 · 10:00" for a stream, or undefined when the feed gave no date. */
export function whenLabel(s: Pick<Stream, 'date' | 'time'>): string | undefined {
  if (!s.date || !/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return undefined;
  const [y, m, d] = s.date.split('-').map(Number);
  let day: string;
  try {
    day = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    day = s.date;
  }
  return s.time ? `${day} · ${s.time}` : day;
}

/** "1,204 viewers", "1 viewer", "12 watching" while live, or undefined when the feed said nothing (a real zero is shown). */
export function viewersLabel(count: number | undefined, phase: StreamPhase): string | undefined {
  if (count == null) return undefined;
  const n = count.toLocaleString('en-US');
  if (phase === 'live') return `${n} watching`;
  return `${n} ${count === 1 ? 'viewer' : 'viewers'}`;
}

/**
 * Where a card opens. A coordinator created the event, so the owner viewer (`/stream/<event id>`, which reads
 * `/customer/events/{id}`) admits them. A client's history also holds streams they only PAID to watch
 * (ClientStreamService unions creator, paid and guest-email events); that endpoint refuses a non-creator, so clients
 * go where the rest of the client app sends them to watch: the access-aware public viewer.
 */
export function streamHref(eventId: string, asCoordinator: boolean): Href {
  return (asCoordinator ? `/stream/${eventId}` : `/(public)/events/live-stream?id=${encodeURIComponent(eventId)}`) as Href;
}
