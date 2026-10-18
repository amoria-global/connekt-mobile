/**
 * The client Events list's rules, kept out of the screen so each can be tested.
 *
 * Differences from the coordinator list (OwnerEventsDashboard) that are deliberate:
 *   - Past and upcoming compare local calendar days. The old list parsed an ISO date as
 *     UTC midnight and compared it with local midnight, so an event today could read as
 *     past in a zone ahead of UTC.
 *   - A status is a word and a tone from the theme, not a hard-coded colour pair.
 *   - "Not published" stays visible: an unpublished event cannot be found on connekyt.com.
 */
import type { EventItem } from '@/features/events/types';
import { friendlyEventStatus, isOpenHybrid } from '@/features/hybrid/hybridUi';
import { eventDay } from '@/features/photographer/schedule';

export type EventFilter = 'all' | 'upcoming' | 'published' | 'past';
export type EventSort = 'newest' | 'oldest' | 'date_asc' | 'title_asc';
export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export const FILTERS: readonly { key: EventFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'published', label: 'Published' },
  { key: 'past', label: 'Past' },
];

/** An event with a known day before `today`. An event with no day is never "past". */
export function isPastEvent(e: Pick<EventItem, 'eventDate'>, today: string): boolean {
  const day = eventDay(e);
  return !!day && day < today;
}

export function filterEvents(
  events: readonly EventItem[],
  filter: EventFilter,
  search: string,
  today: string,
): EventItem[] {
  const q = search.trim().toLowerCase();
  return events.filter((e) => {
    if (filter === 'upcoming' && isPastEvent(e, today)) return false;
    if (filter === 'past' && !isPastEvent(e, today)) return false;
    if (filter === 'published' && !e.published) return false;
    if (!q) return true;
    return (
      (e.title ?? '').toLowerCase().includes(q) ||
      (e.location ?? '').toLowerCase().includes(q) ||
      (e.photographerName ?? '').toLowerCase().includes(q) ||
      (e.category ?? '').toLowerCase().includes(q)
    );
  });
}

export function countByFilter(events: readonly EventItem[], today: string): Record<EventFilter, number> {
  const c = { all: events.length, upcoming: 0, published: 0, past: 0 };
  for (const e of events) {
    if (e.published) c.published += 1;
    if (isPastEvent(e, today)) c.past += 1;
    else c.upcoming += 1;
  }
  return c;
}

const time = (iso?: string) => {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isNaN(t) ? 0 : t;
};

export function sortEvents(events: readonly EventItem[], sort: EventSort): EventItem[] {
  const list = [...events];
  switch (sort) {
    case 'newest':
      return list.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    case 'oldest':
      return list.sort((a, b) => time(a.createdAt) - time(b.createdAt));
    case 'date_asc':
      return list.sort((a, b) => (eventDay(a) ?? '9999').localeCompare(eventDay(b) ?? '9999'));
    case 'title_asc':
      return list.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
  }
}

/** The event's state in the client's words, with a tone for its badge. */
export function eventStatus(e: EventItem): { label: string; tone: Tone } {
  const s = (e.status ?? '').toUpperCase();
  // A posted event is hidden from the public until a photographer is booked, so it is never "published".
  if (isOpenHybrid(e.bookingMode, s, !!e.photographerName)) {
    const ended = s === 'HYBRID_TIMEOUT' || s === 'MATCHING_FAILED';
    return { label: friendlyEventStatus(s), tone: ended ? 'warning' : 'info' };
  }
  if (s === 'ONGOING' || s === 'IN_PROGRESS') return { label: 'Ongoing', tone: 'success' };
  if (s === 'COMPLETED' || s === 'DONE') return { label: 'Completed', tone: 'neutral' };
  if (s === 'CANCELLED' || s === 'CANCELED') return { label: 'Cancelled', tone: 'error' };
  if (s === 'PAUSED') return { label: 'Paused', tone: 'neutral' };
  if (s === 'MATCHES_AWAITING_SELECTION') return { label: 'Candidates ready', tone: 'info' };
  if (s === 'HYBRID_MATCHING') return { label: 'Matching active', tone: 'info' };
  if (s === 'HYBRID_TIMEOUT') return { label: 'Match timeout', tone: 'warning' };
  if (e.published) return { label: 'Published', tone: 'success' };
  // An unpublished event is invisible on connekyt.com; "Upcoming" would read as though nothing is left to do.
  return { label: 'Not published', tone: 'warning' };
}

/** Next page of a "Show more" list: how many rows to show and whether more remain. */
export function visibleSlice<T>(items: readonly T[], shown: number): { rows: T[]; hasMore: boolean } {
  return { rows: items.slice(0, shown), hasMore: items.length > shown };
}
