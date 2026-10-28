import { countsOf, dateChipLabel, dayFilter, DEFAULT_FILTERS, emptyInfo, filterEvents, groupEvents, rangeFilter, statusOf } from './eventsFilter';

// Wed 28 Oct 2026, 10:00 in Kigali (UTC+2).
const NOW = Date.parse('2026-10-28T08:00:00Z');
const ev = (id: string, eventDate: string, startTime: string, o: Record<string, unknown> = {}) => ({ id, title: id, eventDate, startTime, eventStatus: 'PUBLISHED', ...o });
const events = [
  ev('gala', '2026-10-28', '09:00', { eventStatus: 'ONGOING', streamStatus: 'connected', endTime: '23:00' }),
  ev('soon', '2026-10-28', '18:00'),
  ev('later', '2026-11-27', '16:11'),
  ev('dec', '2026-12-05', '10:00'),
  ev('old', '2026-10-10', '12:00', { eventStatus: 'COMPLETED' }),
  ev('older', '2026-09-01', '12:00', { eventStatus: 'COMPLETED' }),
];

describe('eventsFilter', () => {
  it('opens on All, Any date: nothing is filtered out by default', () => {
    expect(DEFAULT_FILTERS).toEqual({ status: 'all', date: null, search: '' });
    expect(filterEvents(events, DEFAULT_FILTERS, NOW)).toHaveLength(6);
  });

  it('takes each status from getEventStatus', () => {
    expect(events.map((e) => statusOf(e, NOW))).toEqual(['ongoing', 'upcoming', 'upcoming', 'upcoming', 'completed', 'completed']);
  });

  it('status chips filter across all dates, and each count equals the rows it lists', () => {
    const c = countsOf(events, DEFAULT_FILTERS, NOW);
    expect(c).toEqual({ all: 6, upcoming: 3, ongoing: 1, completed: 2 });
    for (const s of ['upcoming', 'ongoing', 'completed'] as const) {
      expect(filterEvents(events, { ...DEFAULT_FILTERS, status: s }, NOW)).toHaveLength(c[s]);
    }
  });

  it('a chosen day combines with the status, and the counts follow it', () => {
    const f = { ...DEFAULT_FILTERS, date: dayFilter('2026-10-28') };
    expect(countsOf(events, f, NOW)).toEqual({ all: 2, upcoming: 1, ongoing: 1, completed: 0 });
    expect(filterEvents(events, { ...f, status: 'upcoming' }, NOW).map((e) => e.id)).toEqual(['soon']);
    expect(filterEvents(events, { ...f, date: null }, NOW)).toHaveLength(6);
  });

  it('a range includes both ends', () => {
    const f = { ...DEFAULT_FILTERS, date: rangeFilter('2026-11-27', '2026-10-28') };
    expect(filterEvents(events, f, NOW).map((e) => e.id).sort()).toEqual(['gala', 'later', 'soon']);
  });

  it('groups Ongoing now, Upcoming soonest first, Completed newest first', () => {
    const g = groupEvents(events, NOW);
    expect(g.ongoing.map((e) => e.id)).toEqual(['gala']);
    expect(g.upcoming.map((e) => e.id)).toEqual(['soon', 'later', 'dec']);
    expect(g.completed.map((e) => e.id)).toEqual(['old', 'older']);
  });

  it('search combines with the rest and with the counts', () => {
    expect(countsOf(events, { date: null, search: 'gal' }, NOW).all).toBe(1);
  });

  it('labels a day and a range without dashes', () => {
    expect(dateChipLabel(dayFilter('2026-10-28')!)).toBe('Wed, 28 Oct');
    expect(dateChipLabel(rangeFilter('2026-10-26', '2026-11-01')!)).toBe('26 Oct to 1 Nov');
  });

  it('explains an empty result: what, how many elsewhere, and the next day', () => {
    const f = { status: 'completed' as const, date: dayFilter('2026-10-28'), search: '' };
    expect(filterEvents(events, f, NOW)).toHaveLength(0);
    const e = emptyInfo(events, f, NOW);
    expect(e.title).toBe('No completed events on Wed, 28 Oct');
    expect(e.otherDays).toBe('2 completed events on other days.');
    expect(e.nextDay).toBeNull();
    const up = emptyInfo(events, { status: 'upcoming', date: dayFilter('2026-11-01'), search: '' }, NOW);
    expect(up.title).toBe('No upcoming events on Sun, 1 Nov');
    expect(up.otherDays).toBe('3 upcoming events on other days.');
    expect(up.nextDay).toBe('2026-11-27');
  });

  it('with no date and no events the message is plain', () => {
    expect(emptyInfo([], { ...DEFAULT_FILTERS, status: 'ongoing' }, NOW)).toEqual({ title: 'No ongoing events', otherDays: null, nextDay: null });
  });
});
