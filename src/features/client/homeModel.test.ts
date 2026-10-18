import type { PendingPayment } from '@/features/analytics/api';
import type { EventItem } from '@/features/events/types';
import {
  clientStatus,
  countdownLabel,
  daysUntil,
  isLiveNow,
  payable,
  pickNextEvent,
  remaining,
  totalDue,
} from './homeModel';

const ev = (o: Partial<EventItem>): EventItem => ({ id: 'e', title: 'Shoot', ...o }) as EventItem;
const pay = (o: Partial<PendingPayment>): PendingPayment =>
  ({ id: 'p', eventName: 'Shoot', photographerName: 'A', amount: 100, paidAmount: 0, status: 'pending', ...o }) as PendingPayment;

describe('countdown', () => {
  it('counts local calendar days, including across a month end', () => {
    expect(daysUntil('2026-10-18', '2026-10-10')).toBe(8);
    expect(daysUntil('2026-11-02', '2026-10-30')).toBe(3);
    expect(daysUntil('2026-10-09', '2026-10-10')).toBe(-1);
  });

  it('words today, tomorrow and later days', () => {
    expect(countdownLabel(0)).toBe('Today');
    expect(countdownLabel(1)).toBe('Tomorrow');
    expect(countdownLabel(8)).toBe('8 days to go');
    expect(countdownLabel(-2)).toBe('Past');
  });
});

describe('live detection', () => {
  it('a stream that exists is not a stream that is live', () => {
    expect(isLiveNow({ status: 'PUBLISHED', streamStatus: 'disconnected' })).toBe(false);
    expect(isLiveNow({ status: 'PUBLISHED', streamStatus: undefined })).toBe(false);
  });

  it('ONGOING or a connected stream is live, an ended stream never is', () => {
    expect(isLiveNow({ status: 'ONGOING' })).toBe(true);
    expect(isLiveNow({ status: 'PUBLISHED', streamStatus: 'connected' })).toBe(true);
    expect(isLiveNow({ status: 'ONGOING', streamStatus: 'ended' })).toBe(false);
  });
});

describe('client status words', () => {
  it('does not call an unanswered booking scheduled', () => {
    expect(clientStatus({ bookingStatus: 'PENDING' }).label).toBe('Awaiting photographer');
  });
  it('says confirmed only when the photographer accepted', () => {
    expect(clientStatus({ bookingStatus: 'ACCEPTED' }).label).toBe('Photographer confirmed');
    expect(clientStatus({}).label).toBe('Scheduled');
  });
  it('declined and cancelled are cancelled', () => {
    expect(clientStatus({ bookingStatus: 'DECLINED' })).toEqual({ label: 'Cancelled', tone: 'error' });
  });
});

describe('next event', () => {
  const today = '2026-10-10';
  it('leads with a live event over an earlier scheduled one', () => {
    const next = pickNextEvent(
      [ev({ id: 'a', eventDate: '2026-10-11' }), ev({ id: 'b', eventDate: '2026-10-30', status: 'ONGOING' })],
      today,
    );
    expect(next?.id).toBe('b');
  });
  it('otherwise the soonest open event, skipping past, completed and cancelled', () => {
    const next = pickNextEvent(
      [
        ev({ id: 'past', eventDate: '2026-10-01' }),
        ev({ id: 'done', eventDate: '2026-10-12', status: 'COMPLETED' }),
        ev({ id: 'gone', eventDate: '2026-10-12', bookingStatus: 'CANCELLED' }),
        ev({ id: 'later', eventDate: '2026-10-20' }),
        ev({ id: 'soon', eventDate: '2026-10-15' }),
      ],
      today,
    );
    expect(next?.id).toBe('soon');
  });
  it('an event today still counts, and nothing open is undefined', () => {
    expect(pickNextEvent([ev({ id: 't', eventDate: '2026-10-10' })], today)?.id).toBe('t');
    expect(pickNextEvent([], today)).toBeUndefined();
  });
});

describe('amounts due', () => {
  it('remaining is never negative and a settled payment is not payable', () => {
    expect(remaining(pay({ amount: 100, paidAmount: 130 }))).toBe(0);
    expect(payable([pay({ amount: 100, paidAmount: 100 })])).toEqual([]);
  });
  it('totals what is left and puts failed payments first', () => {
    const list = [pay({ id: 'a', amount: 100, paidAmount: 40 }), pay({ id: 'b', amount: 50, status: 'failed' })];
    expect(totalDue(list)).toBe(110);
    expect(payable(list)[0].id).toBe('b');
  });
});
