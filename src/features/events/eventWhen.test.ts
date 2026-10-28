import { calendarUrl, eventWhen, formatClock, formatLongDay, timezoneLabel } from './eventWhen';

describe('eventWhen', () => {
  it('formats the day with the year and the weekday', () => {
    expect(formatLongDay('2026-11-27')).toBe('Fri, 27 Nov 2026');
    expect(formatLongDay('2026-11-27T16:11:00')).toBe('Fri, 27 Nov 2026');
    expect(formatLongDay(undefined)).toBe('');
  });

  it('formats the clock in 12 hours', () => {
    expect(formatClock('16:11')).toBe('4:11 PM');
    expect(formatClock('00:05:00')).toBe('12:05 AM');
    expect(formatClock('12:00')).toBe('12:00 PM');
    expect(formatClock('')).toBe('');
  });

  it('names the timezone, Kigali by default', () => {
    expect(timezoneLabel(undefined)).toBe('Kigali time (CAT)');
    expect(timezoneLabel('Africa/Nairobi')).toBe('Nairobi time (EAT)');
    expect(timezoneLabel('America/New_York')).toBe('America/New York');
  });

  it('builds the two lines of the card', () => {
    expect(eventWhen({ eventDate: '2026-11-27', startTime: '16:11' })).toEqual({ date: 'Fri, 27 Nov 2026', time: '4:11 PM · Kigali time (CAT)' });
    expect(eventWhen({ eventDate: '2026-11-27', startTime: '16:00', endTime: '18:30' }).time).toBe('4:00 PM to 6:30 PM · Kigali time (CAT)');
    expect(eventWhen({ eventDate: '2026-11-27' })).toEqual({ date: 'Fri, 27 Nov 2026', time: '' });
  });

  it('links a timed event to its real instants (Kigali is UTC+2)', () => {
    const url = calendarUrl({ title: 'Bible Revival', eventDate: '2026-11-27', startTime: '16:11', endTime: '18:00', location: 'Kigali' })!;
    const q = new URL(url).searchParams;
    expect(q.get('dates')).toBe('20261127T141100Z/20261127T160000Z');
    expect(q.get('text')).toBe('Bible Revival');
    expect(q.get('location')).toBe('Kigali');
  });

  it('runs two hours when there is no end, and into the next day when the end is earlier', () => {
    expect(new URL(calendarUrl({ eventDate: '2026-11-27', startTime: '16:00' })!).searchParams.get('dates')).toBe('20261127T140000Z/20261127T160000Z');
    expect(new URL(calendarUrl({ eventDate: '2026-11-27', startTime: '22:00', endTime: '01:00' })!).searchParams.get('dates')).toBe('20261127T200000Z/20261127T230000Z');
  });

  it('makes a dateless-time event all day, and gives nothing for an unreadable day', () => {
    expect(new URL(calendarUrl({ eventDate: '2026-11-27' })!).searchParams.get('dates')).toBe('20261127/20261128');
    expect(calendarUrl({ eventDate: 'soon' })).toBeNull();
  });
});
