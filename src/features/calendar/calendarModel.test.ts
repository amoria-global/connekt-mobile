import type { EventItem } from '@/features/events/types';
import type { PendingPayment } from '@/features/analytics/api';
import { agendaFrom, buildEntries, entriesOn, filterEntries, kindsByDay, timeRange, weekLabel } from './calendarModel';

const ev = (o: Partial<EventItem>): EventItem => ({ id: 'e1', title: 'Launch', eventDate: '2026-10-16', ...o });
const pay = (o: Partial<PendingPayment>): PendingPayment => ({
  id: 'p1',
  eventName: 'Launch',
  photographerName: 'Joseph',
  amount: 150,
  paidAmount: 0,
  status: 'pending',
  paymentType: 'BOOKING',
  ...o,
});

describe('calendar entries', () => {
  it('places an event on its own day with its real times, place and people', () => {
    const [e] = buildEntries([ev({ startTime: '09:00', endTime: '10:00', location: 'Kigali', clientName: 'Kigali Brands', category: 'Corporate' })], []);
    expect(e).toMatchObject({ kind: 'event', day: '2026-10-16', timeLabel: '9:00 AM', title: 'Launch', actionLabel: 'View', href: '/event/e1' });
    expect(e.when).toBe('9:00 AM - 10:00 AM · Kigali');
    expect(e.who).toBe('Kigali Brands · Corporate');
  });

  it('marks an event with a live stream as live, until the stream has ended', () => {
    expect(buildEntries([ev({ hasLiveStream: true })], [])[0]).toMatchObject({ kind: 'live', actionLabel: 'Check stream' });
    expect(buildEntries([ev({ hasLiveStream: true, streamStatus: 'ended' })], [])[0].kind).toBe('event');
  });

  it('drops events with no day and cancelled bookings, and never invents a time', () => {
    const list = buildEntries([ev({ id: 'a', eventDate: undefined }), ev({ id: 'b', status: 'CANCELLED' }), ev({ id: 'c' })], []);
    expect(list.map((x) => x.key)).toEqual(['event:c']);
    expect(list[0].timeLabel).toBe('All day');
    expect(list[0].when).toBe('Time to be confirmed');
  });

  it('puts a payment on its due date with what is still owed, and keeps an undated one off the calendar days', () => {
    const [due, undated] = buildEntries([], [pay({ dueDate: '2026-10-16T00:00:00', paidAmount: 50 }), pay({ id: 'p2', dueDate: undefined })]);
    expect(due).toMatchObject({ kind: 'payment', day: '2026-10-16', title: 'Photographer payment due', actionLabel: 'Review & Pay', href: '/payments' });
    expect(due.when).toContain('$100.00 owed');
    expect(undated.day).toBeNull();
  });

  it('orders a day by start time and puts untimed entries last', () => {
    const list = buildEntries([ev({ id: 'late', startTime: '17:00' }), ev({ id: 'early', startTime: '09:00' })], [pay({ dueDate: '2026-10-16' })]);
    expect(list.map((x) => x.key)).toEqual(['event:early', 'event:late', 'payment:p1']);
  });

  it('filters by kind, lists a day, and reports the kinds on each day', () => {
    const list = buildEntries([ev({ id: 'a' }), ev({ id: 'b', hasLiveStream: true, eventDate: '2026-10-17' })], [pay({ dueDate: '2026-10-16' })]);
    expect(filterEntries(list, 'live').map((x) => x.key)).toEqual(['event:b']);
    expect(filterEntries(list, 'all')).toHaveLength(3);
    expect(entriesOn(list, '2026-10-16')).toHaveLength(2);
    expect([...(kindsByDay(list).get('2026-10-16') ?? [])].sort()).toEqual(['event', 'payment']);
  });

  it('builds the agenda from today on, with undated payments apart', () => {
    const list = buildEntries([ev({ id: 'past', eventDate: '2026-10-01' }), ev({ id: 'next', eventDate: '2026-10-20' })], [pay({ dueDate: undefined })]);
    const a = agendaFrom(list, '2026-10-16');
    expect(a.days.map(([d]) => d)).toEqual(['2026-10-20']);
    expect(a.undated).toHaveLength(1);
  });

  it('words ranges and weeks', () => {
    expect(timeRange('09:00', '09:00')).toBe('9:00 AM');
    expect(timeRange(undefined, '10:00')).toBe('');
    expect(weekLabel(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'])).toBe('12 - 18 October 2026');
    expect(weekLabel(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])).toBe('28 Sep - 4 Oct 2026');
  });
});
