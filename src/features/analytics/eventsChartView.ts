import type { PerformancePoint } from './api';

/**
 * The photographer Performance chart.
 *
 * `/photographer/performance` returns two series per bucket: value1 is the sum of paid minus refunded amounts on payment
 * declarations created in that bucket, value2 is the count of the photographer's events. The amounts are summed as
 * stored, in whatever currency each declaration used (the declaration has its own currency and the response carries no
 * currency or per-currency split), so value1 can add RWF to USD and cannot be shown as one valid figure. Only the event
 * count is charted. `paymentsComparable` is false on purpose: it is the single place that says the payment series is
 * not drawn, so a chart can never imply a single-currency aggregate.
 */
export const PAYMENTS_NOT_CHARTED_NOTE =
  'Payment amounts are not charted here. The server adds payments in whatever currency each booking used, so one total could mix currencies. Your balance is in Wallet and every payment is in Transactions.';

export type EventsBar = { label: string; count: number };

export type EventsChartView =
  /** The series did not load (or has not yet): never drawn as zeros. */
  | { state: 'unavailable' }
  /** Loaded, and no event falls in the period. */
  | { state: 'empty'; paymentsComparable: false }
  | { state: 'ready'; bars: EventsBar[]; ticks: number[]; total: number; paymentsComparable: false };

/** A whole number axis: at least 0..4, topped up to a multiple of 4 so the four gridlines are integers. */
export function eventTicks(max: number): number[] {
  const top = Math.max(4, Math.ceil(max / 4) * 4);
  return [top, (top * 3) / 4, top / 2, top / 4, 0];
}

export function eventsChartView(points: PerformancePoint[] | null | undefined): EventsChartView {
  if (!points || points.length === 0) return { state: 'unavailable' };
  const bars = points.map((p) => ({ label: p.day, count: Number.isFinite(p.value2) && p.value2 > 0 ? Math.round(p.value2) : 0 }));
  const total = bars.reduce((n, b) => n + b.count, 0);
  if (total === 0) return { state: 'empty', paymentsComparable: false };
  return { state: 'ready', bars, ticks: eventTicks(Math.max(...bars.map((b) => b.count))), total, paymentsComparable: false };
}

/** One sentence for screen readers, since the bars carry no text of their own. */
export function eventsChartSummary(view: EventsChartView): string {
  if (view.state === 'unavailable') return 'Events chart unavailable.';
  if (view.state === 'empty') return 'No events in this period.';
  return `Events per period: ${view.bars.map((b) => `${b.label} ${b.count}`).join(', ')}. ${view.total} in total.`;
}
