/**
 * Pure schedule logic for the photographer workspace: status buckets, local-day
 * keys, week navigation, grouping and genuine overlap detection. No React and
 * no network, so it is cheap to test.
 *
 * Dates: the backend sends `eventDate` as a calendar day (or an ISO timestamp
 * whose first ten characters are that day). A day is handled as a local
 * "YYYY-MM-DD" key and never round-tripped through UTC, otherwise an event can
 * land on the neighbouring day near midnight.
 */
import type { EventItem } from '@/features/events/types';

export type EventBucket = 'pending' | 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

/** Collapse the many backend status strings into five buckets (same rules as the events list). */
export function bucketOf(e: Pick<EventItem, 'bookingStatus' | 'status'>): EventBucket {
  const booking = (e.bookingStatus ?? '').toUpperCase();
  if (booking === 'PENDING') return 'pending';
  if (booking === 'DECLINED' || booking === 'CANCELLED' || booking === 'CANCELED') return 'cancelled';
  switch ((e.status ?? '').toUpperCase()) {
    case 'PENDING':
    case 'PROPOSED':
    case 'ASSIGNED':
      return 'pending';
    case 'ONGOING':
    case 'IN_PROGRESS':
      return 'ongoing';
    case 'COMPLETED':
    case 'DONE':
    case 'AWAITING_REVIEW':
      return 'completed';
    case 'CANCELLED':
    case 'CANCELED':
    case 'DECLINED':
    case 'REJECTED':
      return 'cancelled';
    default:
      return 'upcoming';
  }
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of `d` as "YYYY-MM-DD". */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function shiftDays(key: string, days: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return dayKey(d);
}

/** The event's calendar day, or null when it has none. */
export function eventDay(e: Pick<EventItem, 'eventDate'>): string | null {
  const s = e.eventDate?.slice(0, 10);
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Monday-first week containing `key`. */
export function weekOf(key: string): string[] {
  const d = parseDayKey(key);
  const sinceMonday = (d.getDay() + 6) % 7;
  const monday = shiftDays(key, -sinceMonday);
  return Array.from({ length: 7 }, (_, i) => shiftDays(monday, i));
}

/** Minutes since midnight from "HH:mm" or "HH:mm:ss", or null. */
export function minutesOf(time?: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(time ?? '');
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
}

/** "13:00" -> "1:00 PM". Anything unparseable is returned as given. */
export function clock12(time?: string): string {
  const mins = minutesOf(time);
  if (mins == null) return time ?? '';
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}:${pad(mins % 60)} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Chronological comparator: day, then start time. Events with no day sort last. */
export function byStart(a: EventItem, b: EventItem): number {
  const da = eventDay(a) ?? '9999-99-99';
  const db = eventDay(b) ?? '9999-99-99';
  if (da !== db) return da < db ? -1 : 1;
  return (minutesOf(a.startTime) ?? 24 * 60) - (minutesOf(b.startTime) ?? 24 * 60);
}

/** Work still ahead: open status, and today or later (an event with no day is kept). */
export function isUpcoming(e: EventItem, today: string): boolean {
  const bucket = bucketOf(e);
  if (bucket === 'completed' || bucket === 'cancelled') return false;
  const day = eventDay(e);
  return !day || day >= today;
}

export function upcomingEvents(events: readonly EventItem[], today: string): EventItem[] {
  return events.filter((e) => isUpcoming(e, today)).sort(byStart);
}

export function groupByDay(events: readonly EventItem[]): Map<string, EventItem[]> {
  const out = new Map<string, EventItem[]>();
  for (const e of [...events].sort(byStart)) {
    const day = eventDay(e);
    if (!day) continue;
    const list = out.get(day);
    if (list) list.push(e);
    else out.set(day, [e]);
  }
  return out;
}

/**
 * Pairs of accepted (non-pending) events on the same day whose time ranges
 * genuinely overlap. An event without both a start and an end time cannot be
 * shown to overlap anything, so it is never reported: no false warnings.
 */
export function findConflicts(events: readonly EventItem[]): [EventItem, EventItem][] {
  const live = events.filter((e) => {
    const b = bucketOf(e);
    return b === 'upcoming' || b === 'ongoing';
  });
  const pairs: [EventItem, EventItem][] = [];
  for (const list of groupByDay(live).values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const aS = minutesOf(list[i].startTime);
        const aE = minutesOf(list[i].endTime);
        const bS = minutesOf(list[j].startTime);
        const bE = minutesOf(list[j].endTime);
        if (aS == null || aE == null || bS == null || bE == null) continue;
        if (aS < bE && bS < aE) pairs.push([list[i], list[j]]);
      }
    }
  }
  return pairs;
}

/** Ids of every event that is part of at least one conflict. */
export function conflictIds(events: readonly EventItem[]): Set<string> {
  const ids = new Set<string>();
  for (const [a, b] of findConflicts(events)) {
    ids.add(String(a.id));
    ids.add(String(b.id));
  }
  return ids;
}

/** Monday-first weeks (7 day keys each) covering the month that contains `key`. Days outside the month are included to fill the grid. */
export function monthGrid(key: string): string[][] {
  const first = parseDayKey(key);
  first.setDate(1);
  const firstKey = dayKey(first);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const lastKey = dayKey(last);
  const weeks: string[][] = [];
  let cursor = weekOf(firstKey)[0];
  while (cursor <= lastKey) {
    weeks.push(Array.from({ length: 7 }, (_, i) => shiftDays(cursor, i)));
    cursor = shiftDays(cursor, 7);
  }
  return weeks;
}

/** First day of the month `delta` months from the month containing `key`. */
export function shiftMonth(key: string, delta: number): string {
  const d = parseDayKey(key);
  return dayKey(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}
