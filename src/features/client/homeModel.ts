/**
 * What the client Home decides, kept out of the screen so each rule can be tested.
 *
 * Honesty rules, each a defect in the previous Home:
 *   - An event "has a live stream" is not "is live". Only ONGOING, or a stream
 *     that is connected and not ended, is live. The old screen called every
 *     event that carried a stream LIVE NOW.
 *   - Days are compared as local calendar days. The old screen compared a UTC
 *     ISO date, so an evening event in Kigali dropped off Home a day early.
 *   - Amounts due come from the pending-payments feed. Those figures are USD
 *     ledger values (`amountInUsd` in the mapper), so they are formatted as USD,
 *     not relabelled to the wallet currency.
 */
import type { PendingPayment } from '@/features/analytics/api';
import type { EventItem } from '@/features/events/types';
import { bucketOf, byStart, isUpcoming, parseDayKey } from '@/features/photographer/schedule';

export type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** Pending-payment amounts are USD ledger values. */
export const DUE_CURRENCY = 'USD';

/** Whole local calendar days from `today` to `day` (negative when past). */
export function daysUntil(day: string, today: string): number {
  const ms = parseDayKey(day).getTime() - parseDayKey(today).getTime();
  return Math.round(ms / 86_400_000);
}

export function countdownLabel(days: number): string {
  if (days < 0) return 'Past';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days to go`;
}

/** Live right now: the event is ONGOING, or its stream is up and has not ended. */
export function isLiveNow(e: Pick<EventItem, 'status' | 'streamStatus'>): boolean {
  const stream = (e.streamStatus ?? '').toLowerCase();
  if (stream === 'ended') return false;
  if ((e.status ?? '').toUpperCase() === 'ONGOING') return true;
  return stream === 'live' || stream === 'connected' || stream === 'streaming';
}

/** The booking, in the client's words. Bookings the photographer has not answered are not "scheduled". */
export function clientStatus(e: Pick<EventItem, 'status' | 'bookingStatus' | 'streamStatus'>): { label: string; tone: Tone } {
  if (isLiveNow(e)) return { label: 'Live now', tone: 'error' };
  switch (bucketOf(e)) {
    case 'pending':
      return { label: 'Awaiting photographer', tone: 'warning' };
    case 'ongoing':
      return { label: 'In progress', tone: 'success' };
    case 'completed':
      return { label: 'Completed', tone: 'neutral' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'error' };
    default:
      return (e.bookingStatus ?? '').toUpperCase() === 'ACCEPTED'
        ? { label: 'Photographer confirmed', tone: 'success' }
        : { label: 'Scheduled', tone: 'info' };
  }
}

/** The one event the Home leads with: anything live, otherwise the soonest open one. */
export function pickNextEvent(events: readonly EventItem[], today: string): EventItem | undefined {
  const live = events.find((e) => isLiveNow(e) && bucketOf(e) !== 'cancelled' && bucketOf(e) !== 'completed');
  if (live) return live;
  return events.filter((e) => isUpcoming(e, today)).sort(byStart)[0];
}

/** What is still owed on one payment. Never negative. */
export function remaining(p: Pick<PendingPayment, 'amount' | 'paidAmount'>): number {
  return Math.max(0, p.amount - (p.paidAmount ?? 0));
}

/** Payments with something left to pay, failed ones first so the person sees what needs action. */
export function payable(pending: readonly PendingPayment[]): PendingPayment[] {
  return pending
    .filter((p) => remaining(p) > 0)
    .sort((a, b) => Number(b.status === 'failed') - Number(a.status === 'failed'));
}

export function totalDue(pending: readonly PendingPayment[]): number {
  return payable(pending).reduce((sum, p) => sum + remaining(p), 0);
}

/** "Oct 13" for a due date, or undefined when the feed has none. */
export function dueText(p: Pick<PendingPayment, 'dueDate'>): string | undefined {
  const d = p.dueDate?.slice(0, 10);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  try {
    return parseDayKey(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return undefined;
  }
}
