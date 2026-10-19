/**
 * Which pending payment a "Pay now" on the payment history is about.
 *
 * The history record carries the amount in its own currency and no paid amount. The old screen built a payment from
 * it with paidAmount 0 and the sheet then labelled that amount as USD, so a RWF 50,000 booking read "$50,000.00" and a
 * part-paid booking read as fully owed. The pending feed is the source of what is really owed (USD ledger value, real
 * paid amount, payment type), and a declaration id is unique, so the match is exact or there is none.
 */
import type { PendingPayment } from '@/features/analytics/api';

export function pendingFor(
  item: { id: string; declarationId?: string },
  feed: readonly PendingPayment[],
): PendingPayment | undefined {
  const key = item.declarationId || item.id;
  if (!key) return undefined;
  return feed.find((p) => p.id === key);
}

/**
 * A payment can be matched to an event by title only when that is certain: exactly one event and exactly one
 * payment carry that title. Otherwise the person chooses the payment themselves from the list.
 */
export type DueMatch = { kind: 'none' } | { kind: 'one'; payment: PendingPayment } | { kind: 'ambiguous' };

export function matchDue(
  event: { title?: string },
  payments: readonly PendingPayment[],
  events: readonly { title?: string }[],
): DueMatch {
  const t = (event.title ?? '').trim().toLowerCase();
  if (!t) return { kind: 'none' };
  const sameTitle = (x?: string) => (x ?? '').trim().toLowerCase() === t;
  const hits = payments.filter((p) => sameTitle(p.eventName));
  if (hits.length === 0) return { kind: 'none' };
  if (hits.length > 1 || events.filter((e) => sameTitle(e.title)).length > 1) return { kind: 'ambiguous' };
  return { kind: 'one', payment: hits[0] };
}
