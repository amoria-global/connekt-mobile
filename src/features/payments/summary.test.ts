import { summarizePayments } from './summary';

describe('summarizePayments', () => {
  it('adds amounts within one currency', () => {
    const s = summarizePayments([
      { amount: 100, currency: 'USD', bucket: 'paid' },
      { amount: 50, currency: 'USD', bucket: 'pending' },
      { amount: 25, currency: 'USD', bucket: 'failed' },
    ]);
    expect(s.totals).toEqual([{ currency: 'USD', total: 175, paid: 100, pending: 50 }]);
    expect(s.uncounted).toBe(0);
  });

  it('never adds across currencies: a RWF and a USD payment stay separate', () => {
    const s = summarizePayments([
      { amount: 50000, currency: 'RWF', bucket: 'paid' },
      { amount: 40, currency: 'USD', bucket: 'paid' },
    ]);
    expect(s.totals.map((t) => t.currency)).toEqual(['RWF', 'USD']);
    expect(s.totals.find((t) => t.currency === 'RWF')?.total).toBe(50000);
    expect(s.totals.find((t) => t.currency === 'USD')?.total).toBe(40);
  });

  it('treats the same currency in different case and padding as one', () => {
    const s = summarizePayments([
      { amount: 1, currency: 'usd', bucket: 'paid' },
      { amount: 2, currency: ' USD ', bucket: 'paid' },
    ]);
    expect(s.totals).toEqual([{ currency: 'USD', total: 3, paid: 3, pending: 0 }]);
  });

  it('counts a row with no currency or no amount as uncounted instead of guessing', () => {
    const s = summarizePayments([
      { amount: 10, currency: undefined, bucket: 'paid' },
      { amount: undefined, currency: 'USD', bucket: 'pending' },
      { amount: Number.NaN, currency: 'USD', bucket: 'paid' },
      { amount: 5, currency: 'USD', bucket: 'paid' },
    ]);
    expect(s.uncounted).toBe(3);
    expect(s.totals).toEqual([{ currency: 'USD', total: 5, paid: 5, pending: 0 }]);
  });

  it('leaves unfinished declarations out entirely, and an empty list has no totals', () => {
    expect(summarizePayments([{ amount: 99, currency: 'USD', bucket: 'unfinished' }])).toEqual({ totals: [], uncounted: 0 });
    expect(summarizePayments([])).toEqual({ totals: [], uncounted: 0 });
  });

  it('a genuine zero amount is a real zero in its own currency', () => {
    expect(summarizePayments([{ amount: 0, currency: 'USD', bucket: 'paid' }]).totals).toEqual([{ currency: 'USD', total: 0, paid: 0, pending: 0 }]);
  });
});

import { totalsByCurrency } from './summary';

describe('totalsByCurrency', () => {
  it('never adds two currencies into one figure', () => {
    expect(totalsByCurrency([
      { amount: 1000, currency: 'rwf' },
      { amount: 5, currency: 'USD' },
      { amount: 500, currency: 'RWF' },
    ])).toEqual([{ currency: 'RWF', total: 1500 }, { currency: 'USD', total: 5 }]);
  });
  it('is empty when there is nothing to add', () => {
    expect(totalsByCurrency([])).toEqual([]);
  });
});
