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

// --- Web dashboard parity: search, event type filter, totals, unviewed videos -------------------------------------
// app/pages/client/streams.tsx is the reference for each rule below.

/** What the chat history added to a stream, loaded after the list. Absent until read, and absent when the read failed. */
export type StreamCounts = { messages: number; videos: number };

/** Web: a stream matches when the query is in its title or its event type, case-insensitive. */
export function searchStreams(streams: readonly Stream[], query: string): Stream[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...streams];
  return streams.filter((s) => s.title.toLowerCase().includes(q) || (s.eventType ?? '').toLowerCase().includes(q));
}

/** Web: the event type filter, "all" or an exact case-insensitive type. */
export function filterByType(streams: readonly Stream[], type: string): Stream[] {
  if (type === 'all') return [...streams];
  return streams.filter((s) => (s.eventType ?? '').toLowerCase() === type.toLowerCase());
}

/**
 * The chips of the type filter. The web hard-codes Wedding, Birthday, Corporate and Baby Shower, which hides any other
 * category. Here the chips are the types the list actually contains, so no stream is unreachable.
 */
export function eventTypesOf(streams: readonly Stream[]): string[] {
  const seen = new Map<string, string>();
  for (const s of streams) {
    const t = (s.eventType ?? '').trim();
    if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** Web: `s.totalMessages || uniqueMessages.length`. A feed total of 0 is not trusted (the client feed hardcodes video 0). */
export function messageTotal(s: Stream, c?: StreamCounts): number | undefined {
  return s.messageCount || c?.messages || (c ? 0 : s.messageCount);
}
export function videoTotal(s: Stream, c?: StreamCounts): number | undefined {
  return s.videoCount || c?.videos || (c ? 0 : s.videoCount);
}

export type StreamTotals = { streams: number; viewers: number; messages?: number; videos?: number };

/**
 * The four headline cards. Streams and viewers come from the list. Messages and videos need the chat histories, so they
 * are `undefined` (shown as a dash) until every stream's history has been read, never a partial sum shown as a total.
 */
export function streamTotals(streams: readonly Stream[], counts: Readonly<Record<string, StreamCounts | undefined>>): StreamTotals {
  const complete = streams.every((s) => counts[s.id] !== undefined);
  let messages = 0;
  let videos = 0;
  for (const s of streams) {
    messages += messageTotal(s, counts[s.id]) ?? 0;
    videos += videoTotal(s, counts[s.id]) ?? 0;
  }
  return {
    streams: streams.length,
    viewers: streams.reduce((a, s) => a + (s.viewerCount ?? 0), 0),
    messages: complete ? messages : undefined,
    videos: complete ? videos : undefined,
  };
}

/** Web: the "N new" badge counts the videos not yet opened. */
export function unviewedCount(videoIds: readonly string[], viewed: ReadonlySet<string>): number {
  return videoIds.filter((id) => !viewed.has(id)).length;
}
