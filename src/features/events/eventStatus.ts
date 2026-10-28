/**
 * ONE place that decides what state an event is in: ENDED, LIVE or UPCOMING. Explore (tabs, counts, story rings, card
 * badges, headers) and My hosted events use it, so a tab, a badge and a count can never disagree and an event is in
 * exactly one tab. The web apps carry the same function (lib/events/eventStatus.ts) with the same tests.
 *
 * Order of the rules:
 *  a. the stream ended, an end time is recorded, or the event is completed, awaiting review or cancelled -> ENDED
 *  b. the stream is live now -> LIVE
 *  c. the start is in the future -> UPCOMING
 *  d. the start has passed, it never went live, and the end (or the end of the event day) has passed -> ENDED
 *  e. otherwise (inside the event window, not live yet) -> UPCOMING, and `isStartingSoon` is true
 *
 * Dates and times are compared as full instants in the event's timezone (Africa/Kigali unless the event says
 * otherwise). A date-only string such as "2026-10-27" is never parsed as UTC.
 */

export type EventStatus = 'ENDED' | 'LIVE' | 'UPCOMING';

export type StatusInput = {
  id?: string;
  /** Calendar day, "YYYY-MM-DD", or an ISO timestamp (only its first ten characters are read). */
  eventDate?: string | null;
  /** "HH:mm" or "HH:mm:ss". */
  startTime?: string | null;
  endTime?: string | null;
  /** The event's own state as the server reports it (eventStatus, or status on list rows). */
  eventStatus?: string | null;
  status?: string | null;
  streamStatus?: string | null;
  endedAt?: string | null;
  streamEndedAt?: string | null;
  hasLiveStream?: boolean | null;
  hlsManifestUrl?: string | null;
  whepUrl?: string | null;
  timezone?: string | null;
};

export const DEFAULT_TIMEZONE = 'Africa/Kigali';

const ENDED_STATES = new Set(['COMPLETED', 'AWAITING_REVIEW', 'CANCELLED', 'CANCELED', 'ENDED', 'DONE']);
const LIVE_STREAM_STATES = new Set(['live', 'connected', 'active', 'broadcasting', 'streaming']);

/** Offsets in minutes east of UTC for zones without daylight saving that we expect; others go through Intl. */
const FIXED_OFFSETS: Record<string, number> = { 'Africa/Kigali': 120, 'Africa/Nairobi': 180, 'Africa/Kampala': 180, UTC: 0 };

function zoneOffsetMinutes(timezone: string, atUtcMs: number): number {
  if (timezone in FIXED_OFFSETS) return FIXED_OFFSETS[timezone];
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(atUtcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return Math.round((asUtc - Math.floor(atUtcMs / 1000) * 1000) / 60000);
  } catch {
    return FIXED_OFFSETS[DEFAULT_TIMEZONE];
  }
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/;

/** The instant (ms since epoch) of a wall-clock day and time in a timezone, or null when the day is unreadable. */
export function instantOf(day: string | null | undefined, time: string | null | undefined, timezone: string = DEFAULT_TIMEZONE, endOfDay = false): number | null {
  const d = (day ?? '').match(DAY);
  if (!d) return null;
  const t = (time ?? '').match(TIME);
  const [h, m, s] = t ? [Number(t[1]), Number(t[2]), Number(t[3] ?? 0)] : endOfDay ? [23, 59, 59] : [0, 0, 0];
  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h, m, s, endOfDay && !t ? 999 : 0);
  // Two passes settle the offset around a zone change.
  let guess = wall - zoneOffsetMinutes(timezone, wall) * 60000;
  guess = wall - zoneOffsetMinutes(timezone, guess) * 60000;
  return guess;
}

export function eventStartMs(e: StatusInput): number | null {
  return instantOf(e.eventDate, e.startTime, e.timezone || DEFAULT_TIMEZONE);
}

/** The end: the end time on the event day (or the next day when it is earlier than the start), else the end of the day. */
export function eventEndMs(e: StatusInput): number | null {
  const tz = e.timezone || DEFAULT_TIMEZONE;
  const start = eventStartMs(e);
  if (start == null) return null;
  if (e.endTime && TIME.test(e.endTime)) {
    let end = instantOf(e.eventDate, e.endTime, tz);
    if (end != null && end < start) end += 24 * 3600 * 1000;
    return end;
  }
  return instantOf(e.eventDate, null, tz, true);
}

function isLiveNow(e: StatusInput): boolean {
  const eventState = (e.eventStatus || e.status || '').toUpperCase();
  const stream = (e.streamStatus || '').toLowerCase();
  // The stream lifecycle is the most reliable signal once broadcasting has started; some rows stay PUBLISHED while
  // the input is already connected.
  if (LIVE_STREAM_STATES.has(stream)) return true;
  if (eventState !== 'ONGOING') return false;
  return e.hasLiveStream === true || !!e.hlsManifestUrl || !!e.whepUrl;
}

export function getEventStatus(e: StatusInput, now: number | Date = Date.now(), liveStreamIds?: Set<string>): EventStatus {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const eventState = (e.eventStatus || e.status || '').toUpperCase();
  const stream = (e.streamStatus || '').toLowerCase();

  // a. Finished by any signal. The stream input's status is not reset when an event completes, so a terminal event
  //    state wins over a stale "connected".
  if (stream === 'ended' || e.endedAt || e.streamEndedAt || ENDED_STATES.has(eventState)) return 'ENDED';

  // b. On air.
  if (isLiveNow(e) || (eventState === 'ONGOING' && !!e.id && !!liveStreamIds?.has(e.id))) return 'LIVE';

  const start = eventStartMs(e);
  // No readable date: nothing says it is over, so it is upcoming.
  if (start == null) return 'UPCOMING';

  // c. Not started.
  if (start > nowMs) return 'UPCOMING';

  // d. Started, never went live, and the event window is over.
  const end = eventEndMs(e);
  if (end != null && end < nowMs) return 'ENDED';

  // e. Inside the window and not live yet.
  return 'UPCOMING';
}

/** An UPCOMING event whose start has passed but whose window is still open: "Starting soon" is allowed. */
export function isStartingSoon(e: StatusInput, now: number | Date = Date.now(), liveStreamIds?: Set<string>): boolean {
  if (getEventStatus(e, now, liveStreamIds) !== 'UPCOMING') return false;
  const start = eventStartMs(e);
  const nowMs = typeof now === 'number' ? now : now.getTime();
  return start != null && start <= nowMs;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Tue, 27 Oct" from the calendar day, read as a civil date so no timezone can move it. */
export function formatEventDay(day: string | null | undefined): string {
  const m = (day ?? '').match(DAY);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return `${WEEKDAYS[d.getUTCDay()]}, ${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}`;
}
