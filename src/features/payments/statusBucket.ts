/**
 * Reading a free-form money status. Order matters: "unpaid", "partially_paid"
 * and "incomplete" contain "paid" and "complete", and "PENDING_APPROVAL"
 * contains "approv", so the not-yet and failed families are checked first.
 * Before 2026-10-11 they were checked last, so unpaid bookings counted toward
 * the Paid total and a withdrawal awaiting approval showed green.
 */
export type StatusTone = 'success' | 'warning' | 'error' | 'info';

const FAILED = /(fail|cancel|declin|reject|error|\block)/;
const NOT_YET = /(unpaid|partial|incomplete|pend|await|process|initiat|hold)/;
const DONE = /(paid|complet|success|approv|accept|active)/;

export function statusTone(status?: string): StatusTone {
  const s = (status ?? '').toLowerCase();
  if (FAILED.test(s)) return 'error';
  if (NOT_YET.test(s)) return 'warning';
  if (DONE.test(s)) return 'success';
  return 'info';
}

export function paymentBucket(status?: string): 'paid' | 'pending' | 'failed' {
  const t = statusTone(status);
  return t === 'error' ? 'failed' : t === 'success' ? 'paid' : 'pending';
}
