import type { EventItem } from '@/features/events/types';
import {
  bucketOf,
  clock12,
  conflictIds,
  dayKey,
  eventDay,
  findConflicts,
  groupByDay,
  monthGrid,
  shiftDays,
  shiftMonth,
  upcomingEvents,
  weekOf,
} from './schedule';

const ev = (o: Partial<EventItem> & { id: string }): EventItem => ({ title: o.id, ...o }) as EventItem;

describe('bucketOf', () => {
  it('treats a pending booking as pending whatever the event status says', () => {
    expect(bucketOf({ bookingStatus: 'PENDING', status: 'UPCOMING' })).toBe('pending');
  });
  it('treats a declined booking as cancelled, not upcoming', () => {
    expect(bucketOf({ bookingStatus: 'DECLINED', status: 'UPCOMING' })).toBe('cancelled');
    expect(bucketOf({ status: 'REJECTED' })).toBe('cancelled');
  });
  it('maps lifecycle statuses', () => {
    expect(bucketOf({ status: 'IN_PROGRESS' })).toBe('ongoing');
    expect(bucketOf({ status: 'AWAITING_REVIEW' })).toBe('completed');
    expect(bucketOf({})).toBe('upcoming');
  });
});

describe('local days', () => {
  it('builds the day key from local fields, not UTC', () => {
    // 23:30 local on 9 Oct: toISOString() could already read 10 Oct east of UTC.
    expect(dayKey(new Date(2026, 9, 9, 23, 30))).toBe('2026-10-09');
    expect(dayKey(new Date(2026, 9, 10, 0, 15))).toBe('2026-10-10');
  });
  it('shifts across month ends', () => {
    expect(shiftDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('returns a Monday-first week', () => {
    // 16 Oct 2026 is a Friday.
    expect(weekOf('2026-10-16')).toEqual([
      '2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18',
    ]);
    // A Sunday belongs to the week that started the previous Monday.
    expect(weekOf('2026-10-18')[0]).toBe('2026-10-12');
  });
  it('reads the day from a date or an ISO timestamp, and null from junk', () => {
    expect(eventDay({ eventDate: '2026-10-16' })).toBe('2026-10-16');
    expect(eventDay({ eventDate: '2026-10-16T09:00:00' })).toBe('2026-10-16');
    expect(eventDay({ eventDate: 'soon' })).toBeNull();
    expect(eventDay({})).toBeNull();
  });
  it('formats clock times', () => {
    expect(clock12('13:00')).toBe('1:00 PM');
    expect(clock12('00:05:00')).toBe('12:05 AM');
    expect(clock12('nonsense')).toBe('nonsense');
  });
});

describe('upcomingEvents', () => {
  it('keeps open work from today on, in chronological order, and drops closed or past events', () => {
    const list = [
      ev({ id: 'late', eventDate: '2026-10-20', startTime: '10:00' }),
      ev({ id: 'past', eventDate: '2026-10-01' }),
      ev({ id: 'done', eventDate: '2026-10-16', status: 'COMPLETED' }),
      ev({ id: 'declined', eventDate: '2026-10-16', bookingStatus: 'DECLINED' }),
      ev({ id: 'today-pm', eventDate: '2026-10-14', startTime: '15:00' }),
      ev({ id: 'today-am', eventDate: '2026-10-14', startTime: '09:00' }),
    ];
    expect(upcomingEvents(list, '2026-10-14').map((e) => e.id)).toEqual(['today-am', 'today-pm', 'late']);
  });
});

describe('conflicts', () => {
  const a = ev({ id: 'a', eventDate: '2026-10-16', startTime: '09:00', endTime: '11:00' });
  it('reports a genuine overlap', () => {
    const b = ev({ id: 'b', eventDate: '2026-10-16', startTime: '10:30', endTime: '12:00' });
    expect(findConflicts([a, b])).toHaveLength(1);
    expect([...conflictIds([a, b])].sort()).toEqual(['a', 'b']);
  });
  it('does not report back-to-back or different days', () => {
    const next = ev({ id: 'n', eventDate: '2026-10-16', startTime: '11:00', endTime: '12:00' });
    const other = ev({ id: 'o', eventDate: '2026-10-17', startTime: '09:00', endTime: '11:00' });
    expect(findConflicts([a, next, other])).toHaveLength(0);
  });
  it('never warns when an end time is unknown, or for an unanswered request', () => {
    const noEnd = ev({ id: 'x', eventDate: '2026-10-16', startTime: '10:00' });
    const pending = ev({ id: 'p', eventDate: '2026-10-16', startTime: '10:00', endTime: '11:00', bookingStatus: 'PENDING' });
    expect(findConflicts([a, noEnd])).toHaveLength(0);
    expect(findConflicts([a, pending])).toHaveLength(0);
  });
});

describe('groupByDay', () => {
  it('groups by day in time order and skips undated events', () => {
    const g = groupByDay([
      ev({ id: '2', eventDate: '2026-10-16', startTime: '13:00' }),
      ev({ id: '1', eventDate: '2026-10-16', startTime: '09:00' }),
      ev({ id: 'nodate' }),
    ]);
    expect([...g.keys()]).toEqual(['2026-10-16']);
    expect(g.get('2026-10-16')!.map((e) => e.id)).toEqual(['1', '2']);
  });
});

describe('month grid', () => {
  it('covers October 2026 in Monday-first weeks, padded with neighbouring days', () => {
    const g = monthGrid('2026-10-16');
    expect(g).toHaveLength(5);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g[0][0]).toBe('2026-09-28'); // 1 Oct 2026 is a Thursday
    expect(g[0][3]).toBe('2026-10-01');
    expect(g[4][6]).toBe('2026-11-01'); // 31 Oct is a Saturday
  });
  it('adds a sixth week when the month needs it', () => {
    // 1 Aug 2026 is a Saturday and 31 Aug a Monday: six rows.
    expect(monthGrid('2026-08-10')).toHaveLength(6);
  });
  it('moves by whole months across a year end', () => {
    expect(shiftMonth('2026-12-20', 1)).toBe('2027-01-01');
    expect(shiftMonth('2026-01-31', -1)).toBe('2025-12-01');
  });
});
