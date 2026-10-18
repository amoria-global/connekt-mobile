/**
 * Totals for the Payments screen, kept per currency.
 *
 * The old screen added every amount together and labelled the sum with the first
 * payment's currency, so a RWF booking and a USD booking became one invented figure.
 * Amounts are only ever added within one currency. A row with no amount or no
 * currency cannot be labelled honestly, so it is counted as `uncounted` and the
 * screen says so, rather than being guessed into a total.
 */
export type SummaryBucket = 'paid' | 'pending' | 'failed' | 'unfinished';

export type SummaryRow = { amount?: number; currency?: string; bucket: SummaryBucket };

export type CurrencyTotals = { currency: string; total: number; paid: number; pending: number };

export type PaymentsSummary = { totals: CurrencyTotals[]; uncounted: number };

export function summarizePayments(rows: readonly SummaryRow[]): PaymentsSummary {
  const byCurrency = new Map<string, CurrencyTotals>();
  let uncounted = 0;
  for (const r of rows) {
    // Unfinished declarations (a viewer's abandoned ticket) are not part of anyone's spending.
    if (r.bucket === 'unfinished') continue;
    const currency = r.currency?.trim().toUpperCase();
    if (typeof r.amount !== 'number' || !Number.isFinite(r.amount) || !currency) {
      uncounted += 1;
      continue;
    }
    const t = byCurrency.get(currency) ?? { currency, total: 0, paid: 0, pending: 0 };
    t.total += r.amount;
    if (r.bucket === 'paid') t.paid += r.amount;
    else if (r.bucket === 'pending') t.pending += r.amount;
    byCurrency.set(currency, t);
  }
  return { totals: [...byCurrency.values()].sort((a, b) => b.total - a.total), uncounted };
}
