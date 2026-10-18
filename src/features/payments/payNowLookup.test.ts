import type { PendingPayment } from '@/features/analytics/api';
import { matchDue, pendingFor } from './payNowLookup';

const pay = (o: Partial<PendingPayment>): PendingPayment =>
  ({ id: 'p', eventName: 'Wedding', photographerName: 'A', amount: 100, paidAmount: 0, status: 'pending', ...o }) as PendingPayment;

describe('pendingFor', () => {
  it('matches the declaration id exactly, taking the real paid amount from the feed', () => {
    const feed = [pay({ id: 'd1', paidAmount: 40 }), pay({ id: 'd2' })];
    expect(pendingFor({ id: 'rec1', declarationId: 'd1' }, feed)?.paidAmount).toBe(40);
  });
  it('falls back to the record id, and finds nothing for an unknown payment', () => {
    expect(pendingFor({ id: 'd2' }, [pay({ id: 'd2' })])).toBeDefined();
    expect(pendingFor({ id: 'x', declarationId: 'y' }, [pay({ id: 'd2' })])).toBeUndefined();
    expect(pendingFor({ id: '' }, [pay({ id: '' })])).toBeUndefined();
  });
});

describe('matchDue', () => {
  const events = [{ title: 'Wedding' }, { title: 'Birthday' }];
  it('one event and one payment with that title is a certain match', () => {
    const r = matchDue({ title: ' wedding ' }, [pay({ id: 'a', eventName: 'Wedding' })], events);
    expect(r.kind).toBe('one');
  });
  it('no payment with that title is none', () => {
    expect(matchDue({ title: 'Birthday' }, [pay({})], events).kind).toBe('none');
    expect(matchDue({ title: '' }, [pay({})], events).kind).toBe('none');
  });
  it('two payments with the same title are ambiguous, never guessed', () => {
    expect(matchDue({ title: 'Wedding' }, [pay({ id: 'a' }), pay({ id: 'b' })], events).kind).toBe('ambiguous');
  });
  it('two events with the same title are ambiguous even with one payment', () => {
    expect(matchDue({ title: 'Wedding' }, [pay({ id: 'a' })], [{ title: 'Wedding' }, { title: 'wedding' }]).kind).toBe('ambiguous');
  });
});
