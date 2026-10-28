/**
 * The one "when" card on the event page: "Fri, 27 Nov 2026" and "4:11 PM · Kigali time (CAT)", plus an add-to-calendar
 * link built from the event's own date, start and end. Pure, so the web page mirrors it line for line.
 */
import { DEFAULT_TIMEZONE, instantOf } from './eventStatus';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME = /^(\d{1,2}):(\d{2})/;

const ZONES: Record<string, string> = {
  'Africa/Kigali': 'Kigali time (CAT)',
  'Africa/Nairobi': 'Nairobi time (EAT)',
  'Africa/Kampala': 'Kampala time (EAT)',
  UTC: 'UTC',
};

export type WhenInput = { eventDate?: string | null; startTime?: string | null; endTime?: string | null; timezone?: string | null };

/** "Fri, 27 Nov 2026", or '' when the day is unreadable. */
export function formatLongDay(day: string | null | undefined): string {
  const m = (day ?? '').match(DAY);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAYS[d.getUTCDay()]}, ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/** "4:11 PM" from "16:11" (seconds ignored), or '' when unreadable. */
export function formatClock(time: string | null | undefined): string {
  const m = (time ?? '').match(TIME);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** "Kigali time (CAT)" for the zones we run in, else the zone id with underscores opened up. */
export function timezoneLabel(timezone?: string | null): string {
  const tz = timezone || DEFAULT_TIMEZONE;
  return ZONES[tz] ?? tz.replace(/_/g, ' ');
}

/** The two lines of the card. `time` is '' when the event has no start time. */
export function eventWhen(e: WhenInput): { date: string; time: string } {
  const start = formatClock(e.startTime);
  const end = formatClock(e.endTime);
  if (!start) return { date: formatLongDay(e.eventDate), time: '' };
  return { date: formatLongDay(e.eventDate), time: `${end ? `${start} to ${end}` : start} · ${timezoneLabel(e.timezone)}` };
}

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/**
 * A Google Calendar "add event" link, or null when the event has no readable date. A timed event runs to its end time
 * (two hours when none is set); one with no start time becomes an all-day entry.
 */
export function calendarUrl(e: WhenInput & { title?: string | null; location?: string | null }): string | null {
  const tz = e.timezone || DEFAULT_TIMEZONE;
  const day = (e.eventDate ?? '').match(DAY);
  if (!day) return null;
  let dates: string;
  if (TIME.test(e.startTime ?? '')) {
    const start = instantOf(e.eventDate, e.startTime, tz);
    if (start == null) return null;
    let end = TIME.test(e.endTime ?? '') ? instantOf(e.eventDate, e.endTime, tz) : null;
    if (end == null) end = start + 2 * 3600 * 1000;
    else if (end <= start) end += 24 * 3600 * 1000;
    dates = `${stamp(start)}/${stamp(end)}`;
  } else {
    const from = Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
    const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');
    dates = `${ymd(from)}/${ymd(from + 24 * 3600 * 1000)}`;
  }
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title || 'Event', dates });
  if (e.location) q.set('location', e.location);
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
