/**
 * The coordinator Calendar's rules, kept out of the screen so each can be tested.
 *
 * Everything on the calendar is a real record the existing APIs return, placed on the day the record gives:
 *   - an event the coordinator runs (`/coordinator/events`) on its event date, as an "event", or as "live" when it
 *     carries a live stream;
 *   - an unsettled payment (`/coordinator/payments`) on its due date. A payment with no due date has no day, so it is
 *     listed apart in the agenda and never put on a day it does not have.
 * Nothing here invents a crew count, a delivery or a task: the feeds carry none, so the calendar shows none.
 */
import type { EventItem } from '@/features/events/types';
import type { PendingPayment } from '@/features/analytics/api';
import { bucketOf, byStart, clock12, dayKey, eventDay, minutesOf } from '@/features/photographer/schedule';

export type CalendarKind = 'event' | 'live' | 'payment';
export type CalendarFilter = 'all' | CalendarKind;

export const CALENDAR_FILTERS: readonly { key: CalendarFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'event', label: 'Events' },
  { key: 'live', label: 'Live' },
  { key: 'payment', label: 'Payments' },
];

export type CalendarEntry = {
  key: string;
  kind: CalendarKind;
  /** Local calendar day "YYYY-MM-DD", or null for a payment with no due date. */
  day: string | null;
  /** Minutes since midnight, or null when the record has no start time (shown as "All day"). */
  startMin: number | null;
  /** "9:00 AM", or "All day" / "Due" when there is no time. */
  timeLabel: string;
  title: string;
  /** First meta line: who and what. */
  who: string;
  /** Second meta line: when and where, or what is owed. */
  when: string;
  actionLabel: string;
  /** In-app route the action opens. */
  href: string;
};

const join = (parts: (string | undefined | false | null)[], sep = ' · ') => parts.filter(Boolean).join(sep);

/** "9:00 AM - 10:00 AM", "9:00 AM", or "" when there is no start time. */
export function timeRange(start?: string, end?: string): string {
  if (minutesOf(start) == null) return '';
  const s = clock12(start);
  const e = minutesOf(end) != null && end !== start ? clock12(end) : '';
  return e ? `${s} - ${e}` : s;
}

function eventEntry(e: EventItem): CalendarEntry | null {
  const day = eventDay(e);
  if (!day) return null;
  const bucket = bucketOf(e);
  // A cancelled booking is not on anyone's calendar.
  if (bucket === 'cancelled') return null;
  const live = e.hasLiveStream === true && (e.streamStatus ?? '').toLowerCase() !== 'ended';
  const startMin = minutesOf(e.startTime);
  return {
    key: `event:${e.id}`,
    kind: live ? 'live' : 'event',
    day,
    startMin,
    timeLabel: startMin == null ? 'All day' : clock12(e.startTime),
    title: e.title,
    who: join([e.clientName, e.photographerName, live ? 'Live event' : e.category]) || 'Event',
    when: join([timeRange(e.startTime, e.endTime), e.location]) || 'Time to be confirmed',
    actionLabel: live ? 'Check stream' : 'View',
    href: `/event/${e.id}`,
  };
}

function paymentEntry(p: PendingPayment): CalendarEntry {
  const day = p.dueDate?.slice(0, 10);
  const owed = Math.max(0, p.amount - p.paidAmount);
  return {
    key: `payment:${p.id}`,
    kind: 'payment',
    day: day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null,
    startMin: null,
    timeLabel: 'Due',
    title: p.paymentType === 'BOOKING' ? 'Photographer payment due' : 'Payment due',
    who: join([p.photographerName, p.eventName]),
    when: join([p.status === 'failed' ? 'Last attempt failed' : p.status === 'partially_paid' ? 'Part paid' : 'Unpaid', `$${owed.toFixed(2)} owed`]),
    actionLabel: 'Review & Pay',
    href: '/payments',
  };
}

/** Every dated record as one list, in calendar order (day, then start time, payments after the day's events). */
export function buildEntries(events: readonly EventItem[], payments: readonly PendingPayment[]): CalendarEntry[] {
  const sortedEvents = [...events].sort(byStart);
  const entries = [...sortedEvents.map(eventEntry), ...payments.map(paymentEntry)].filter((x): x is CalendarEntry => x !== null);
  return entries.sort((a, b) => {
    const da = a.day ?? '9999-99-99';
    const db = b.day ?? '9999-99-99';
    if (da !== db) return da < db ? -1 : 1;
    return (a.startMin ?? 24 * 60) - (b.startMin ?? 24 * 60);
  });
}

export function filterEntries(entries: readonly CalendarEntry[], filter: CalendarFilter): CalendarEntry[] {
  return filter === 'all' ? [...entries] : entries.filter((e) => e.kind === filter);
}

export function entriesOn(entries: readonly CalendarEntry[], day: string): CalendarEntry[] {
  return entries.filter((e) => e.day === day);
}

/** The kinds present on each day, for the dots under a date. */
export function kindsByDay(entries: readonly CalendarEntry[]): Map<string, Set<CalendarKind>> {
  const out = new Map<string, Set<CalendarKind>>();
  for (const e of entries) {
    if (!e.day) continue;
    const set = out.get(e.day);
    if (set) set.add(e.kind);
    else out.set(e.day, new Set([e.kind]));
  }
  return out;
}

/** Entries from `today` on, grouped by day in order; payments with no due date come back apart. */
export function agendaFrom(entries: readonly CalendarEntry[], today: string): { days: [string, CalendarEntry[]][]; undated: CalendarEntry[] } {
  const map = new Map<string, CalendarEntry[]>();
  const undated: CalendarEntry[] = [];
  for (const e of entries) {
    if (!e.day) undated.push(e);
    else if (e.day >= today) map.set(e.day, [...(map.get(e.day) ?? []), e]);
  }
  return { days: [...map.entries()], undated };
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const day = (k: string) => new Date(`${k}T00:00:00`);

/** "12 - 18 October 2026", "28 Sep - 4 Oct 2026" or "30 Dec 2026 - 5 Jan 2027" for a week's seven days. Fixed English names, so it reads the same on every device. */
export function weekLabel(week: readonly string[]): string {
  const a = day(week[0]);
  const b = day(week[week.length - 1]);
  const short = (d: Date) => MONTHS[d.getMonth()].slice(0, 3);
  if (a.getFullYear() !== b.getFullYear()) return `${a.getDate()} ${short(a)} ${a.getFullYear()} - ${b.getDate()} ${short(b)} ${b.getFullYear()}`;
  if (a.getMonth() !== b.getMonth()) return `${a.getDate()} ${short(a)} - ${b.getDate()} ${short(b)} ${b.getFullYear()}`;
  return `${a.getDate()} - ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

/** "Friday, 16 October". */
export function dayHeading(key: string): string {
  const d = day(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "October 2026". */
export function monthHeading(key: string): string {
  const d = day(key);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const todayKey = (now: Date = new Date()): string => dayKey(now);
