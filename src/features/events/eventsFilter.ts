/**
 * What the Events screen shows: the status chips (All, Upcoming, Ongoing, Completed), an optional date filter, search,
 * the grouping (Ongoing now, Upcoming soonest first, Completed newest first) and the empty-result help.
 *
 * Statuses come from getEventStatus, the one rule every tab, badge and count uses, so a chip's count is always the number
 * of rows its filter would show. There is NO default date: the screen opens on Any date and a date only filters once the
 * user picks one (and it disappears when they clear it). Pure and mirrored line for line on the web.
 */
import { eventStartMs, getEventStatus, type StatusInput } from './eventStatus';

export type StatusKey = 'upcoming' | 'ongoing' | 'completed';
export type StatusFilter = 'all' | StatusKey;
/** A day or a range of days (inclusive, YYYY-MM-DD). null means Any date. */
export type DateFilter = { from: string; to: string } | null;

export type FilterItem = StatusInput & { id: string; title?: string; clientName?: string; category?: string };
export type Filters = { status: StatusFilter; date: DateFilter; search: string };
export type Counts = Record<StatusFilter, number>;

export const STATUS_LABEL: Record<StatusFilter, string> = { all: 'All', upcoming: 'Upcoming', ongoing: 'Ongoing', completed: 'Completed' };
export const DEFAULT_FILTERS: Filters = { status: 'all', date: null, search: '' };

export function statusOf(e: StatusInput, now: number = Date.now()): StatusKey {
  const s = getEventStatus(e, now);
  return s === 'LIVE' ? 'ongoing' : s === 'ENDED' ? 'completed' : 'upcoming';
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;
export const dayOf = (e: Pick<StatusInput, 'eventDate'>): string | null => (e.eventDate ?? '').match(DAY)?.[0] ?? null;

const utc = (key: string) => {
  const m = key.match(DAY)!;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (k: string, n: number) => key(utc(k) + n * 86400000);

export const dayFilter = (k: string): DateFilter => ({ from: k, to: k });
export const rangeFilter = (a: string, b: string): DateFilter => (a <= b ? { from: a, to: b } : { from: b, to: a });

export function inDate(e: StatusInput, date: DateFilter): boolean {
  if (!date) return true;
  const d = dayOf(e);
  return !!d && d >= date.from && d <= date.to;
}

const matchesSearch = (e: FilterItem, q: string) => {
  const s = q.trim().toLowerCase();
  return !s || (e.title ?? '').toLowerCase().includes(s) || (e.clientName ?? '').toLowerCase().includes(s) || (e.category ?? '').toLowerCase().includes(s);
};

/** Everything the date and search filters allow, before the status chip. */
export const baseOf = <T extends FilterItem>(events: readonly T[], f: Pick<Filters, 'date' | 'search'>): T[] =>
  events.filter((e) => inDate(e, f.date) && matchesSearch(e, f.search));

/** Chip counts under the current date and search, so each chip equals what tapping it would list. */
export function countsOf(events: readonly FilterItem[], f: Pick<Filters, 'date' | 'search'>, now: number = Date.now()): Counts {
  const c: Counts = { all: 0, upcoming: 0, ongoing: 0, completed: 0 };
  for (const e of baseOf(events, f)) {
    c.all += 1;
    c[statusOf(e, now)] += 1;
  }
  return c;
}

export function filterEvents<T extends FilterItem>(events: readonly T[], f: Filters, now: number = Date.now()): T[] {
  return baseOf(events, f).filter((e) => f.status === 'all' || statusOf(e, now) === f.status);
}

const startOf = (e: StatusInput) => eventStartMs(e) ?? 0;

export type Groups<T> = { ongoing: T[]; upcoming: T[]; completed: T[] };

/** Ongoing now, Upcoming (soonest first), Completed (newest first). */
export function groupEvents<T extends FilterItem>(list: readonly T[], now: number = Date.now()): Groups<T> {
  const g: Groups<T> = { ongoing: [], upcoming: [], completed: [] };
  for (const e of list) g[statusOf(e, now)].push(e);
  g.ongoing.sort((a, b) => startOf(a) - startOf(b));
  g.upcoming.sort((a, b) => startOf(a) - startOf(b));
  g.completed.sort((a, b) => startOf(b) - startOf(a));
  return g;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** "Wed, 28 Oct" */
export function dayLabel(k: string): string {
  const d = new Date(utc(k));
  return `${WEEKDAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
/** "Wed, 28 Oct" for a day, "26 Oct to 1 Nov" for a range. */
export function dateChipLabel(date: NonNullable<DateFilter>): string {
  if (date.from === date.to) return dayLabel(date.from);
  const a = new Date(utc(date.from));
  const b = new Date(utc(date.to));
  return `${a.getUTCDate()} ${MONTHS[a.getUTCMonth()]} to ${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]}`;
}

export type EmptyInfo = {
  title: string;
  /** "29 upcoming events on other days." or null. */
  otherDays: string | null;
  /** The next day with a matching event after the chosen date (or after today), for "Jump to next". */
  nextDay: string | null;
};

/** The message, the count on other days and the next matching day when a filter returns nothing. */
export function emptyInfo(events: readonly FilterItem[], f: Filters, now: number = Date.now()): EmptyInfo {
  const word = f.status === 'all' ? '' : `${STATUS_LABEL[f.status].toLowerCase()} `;
  const title = f.date ? `No ${word}events on ${dateChipLabel(f.date)}` : `No ${word}events`;
  const matchStatus = (e: FilterItem) => f.status === 'all' || statusOf(e, now) === f.status;
  const elsewhere = events.filter((e) => matchesSearch(e, f.search) && matchStatus(e) && !inDate(e, f.date) && dayOf(e));
  const n = elsewhere.length;
  const today = key(now + 2 * 3600000);
  const after = f.date ? f.date.to : addDays(today, -1);
  const next = elsewhere.map((e) => dayOf(e)!).filter((d) => d > after).sort()[0] ?? null;
  return {
    title,
    otherDays: f.date && n > 0 ? `${n} ${word}event${n === 1 ? '' : 's'} on other days.` : null,
    nextDay: f.date ? next : null,
  };
}
