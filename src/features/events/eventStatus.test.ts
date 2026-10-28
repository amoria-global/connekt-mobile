import { eventEndMs, eventStartMs, formatEventDay, getEventStatus, instantOf, isStartingSoon } from './eventStatus';

const at = (iso: string) => Date.parse(iso); // always written with an explicit offset
const base = { eventDate: '2026-10-27', startTime: '18:00', endTime: '22:00', eventStatus: 'PUBLISHED' };

describe('getEventStatus', () => {
  it('ended today: the stream ended, even though the date is today (the Gaming Center case)', () => {
    const e = { ...base, streamStatus: 'ended' };
    expect(getEventStatus(e, at('2026-10-27T12:00:00+02:00'))).toBe('ENDED');
    expect(getEventStatus({ ...base, eventStatus: 'COMPLETED' }, at('2026-10-27T12:00:00+02:00'))).toBe('ENDED');
    expect(getEventStatus({ ...base, endedAt: '2026-10-27T11:00:00Z' }, at('2026-10-27T12:00:00+02:00'))).toBe('ENDED');
  });

  it('treats completed, awaiting review and cancelled as ended, in either casing', () => {
    for (const s of ['COMPLETED', 'AWAITING_REVIEW', 'cancelled', 'CANCELED']) {
      expect(getEventStatus({ ...base, eventStatus: s }, at('2026-10-20T00:00:00+02:00'))).toBe('ENDED');
    }
  });

  it('ended yesterday: the window is over and it never went live', () => {
    expect(getEventStatus({ ...base, eventDate: '2026-10-26' }, at('2026-10-27T09:00:00+02:00'))).toBe('ENDED');
  });

  it('live now: the stream is up', () => {
    expect(getEventStatus({ ...base, streamStatus: 'connected' }, at('2026-10-27T19:00:00+02:00'))).toBe('LIVE');
    expect(getEventStatus({ ...base, eventStatus: 'ONGOING', hasLiveStream: true }, at('2026-10-27T19:00:00+02:00'))).toBe('LIVE');
    expect(getEventStatus({ ...base, eventStatus: 'ONGOING', id: 'x' }, at('2026-10-27T19:00:00+02:00'), new Set(['x']))).toBe('LIVE');
  });

  it('a stale "connected" never makes a finished event live', () => {
    expect(getEventStatus({ ...base, eventStatus: 'COMPLETED', streamStatus: 'connected' }, at('2026-10-27T19:00:00+02:00'))).toBe('ENDED');
  });

  it('upcoming later today and tomorrow', () => {
    expect(getEventStatus(base, at('2026-10-27T12:00:00+02:00'))).toBe('UPCOMING');
    expect(getEventStatus({ ...base, eventDate: '2026-10-28' }, at('2026-10-27T23:00:00+02:00'))).toBe('UPCOMING');
  });

  it('start passed but never went live: upcoming inside the window (starting soon), ended after it', () => {
    const now = at('2026-10-27T18:30:00+02:00');
    expect(getEventStatus(base, now)).toBe('UPCOMING');
    expect(isStartingSoon(base, now)).toBe(true);
    expect(isStartingSoon(base, at('2026-10-27T12:00:00+02:00'))).toBe(false);
    expect(getEventStatus(base, at('2026-10-27T22:00:01+02:00'))).toBe('ENDED');
  });

  it('with no end time the event day ends at midnight, and with no start time the day starts at midnight', () => {
    const noEnd = { eventDate: '2026-10-27', startTime: '18:00', eventStatus: 'PUBLISHED' };
    expect(getEventStatus(noEnd, at('2026-10-27T23:59:00+02:00'))).toBe('UPCOMING');
    expect(getEventStatus(noEnd, at('2026-10-28T00:00:01+02:00'))).toBe('ENDED');
    expect(getEventStatus({ eventDate: '2026-10-27' }, at('2026-10-27T00:00:01+02:00'))).toBe('UPCOMING');
  });

  it('an event that runs past midnight stays open until its end the next day', () => {
    const late = { eventDate: '2026-10-27', startTime: '21:00', endTime: '02:00', eventStatus: 'PUBLISHED' };
    expect(getEventStatus(late, at('2026-10-28T01:00:00+02:00'))).toBe('UPCOMING');
    expect(getEventStatus(late, at('2026-10-28T02:00:01+02:00'))).toBe('ENDED');
  });

  it('is decided in the event timezone, not the phone\'s or UTC', () => {
    // 23:30 in Kigali on the 27th is still 21:30 UTC on the 27th; 00:30 Kigali on the 28th is 22:30 UTC on the 27th.
    const e = { eventDate: '2026-10-27', startTime: '20:00', eventStatus: 'PUBLISHED' };
    expect(getEventStatus(e, at('2026-10-27T23:30:00+02:00'))).toBe('UPCOMING');
    expect(getEventStatus(e, at('2026-10-28T00:30:00+02:00'))).toBe('ENDED');
    expect(getEventStatus(e, Date.parse('2026-10-27T22:30:00Z'))).toBe('ENDED');
    // The same wall clock in another zone is a different instant.
    expect(eventStartMs({ ...e, timezone: 'UTC' })! - eventStartMs(e)!).toBe(2 * 3600 * 1000);
  });

  it('never reads a date-only string as UTC midnight', () => {
    expect(eventStartMs({ eventDate: '2026-10-27' })).toBe(at('2026-10-27T00:00:00+02:00'));
    expect(eventEndMs({ eventDate: '2026-10-27' })).toBe(at('2026-10-27T23:59:59.999+02:00'));
    expect(instantOf('2026-10-27T05:00:00Z', '18:30')).toBe(at('2026-10-27T18:30:00+02:00'));
  });

  it('with no readable date nothing says it is over', () => {
    expect(getEventStatus({ eventStatus: 'PUBLISHED' }, at('2026-10-27T12:00:00+02:00'))).toBe('UPCOMING');
  });
});

describe('formatEventDay', () => {
  it('writes the civil day as "Tue, 27 Oct"', () => {
    expect(formatEventDay('2026-10-27')).toBe('Tue, 27 Oct');
    expect(formatEventDay('2026-01-05T23:00:00Z')).toBe('Mon, 5 Jan');
    expect(formatEventDay(undefined)).toBe('');
  });
});
