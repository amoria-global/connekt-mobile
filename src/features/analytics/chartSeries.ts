/**
 * What the Analytics screen's charts plot. The performance feeds label their own buckets (verified in
 * CustomerAnalyticsController.getPerformanceChart): "Sun".."Sat" for a week, "12AM".."8PM" in six 4-hour blocks for
 * today and "Week 1".."Week 4" for a month. The charts used to keep a point only when its label started with a weekday
 * name and otherwise drew an all-zero Sun to Sat, so Today and This month showed "zero activity" over real figures.
 * The series is now exactly what the feed sent, in its own order and with its own labels; nothing is added.
 */
import type { PerformancePoint } from './api';

const WEEKDAY = /^(sun|mon|tue|wed|thu|fri|sat)/i;

const finite = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function chartSeries(data: readonly PerformancePoint[] | null | undefined): PerformancePoint[] {
  if (!Array.isArray(data)) return [];
  return data.map((p) => ({ day: String(p?.day ?? ''), value1: finite(p?.value1), value2: finite(p?.value2) }));
}

/** A weekday is shortened to three letters; any other bucket label is shown whole ("12AM", "Week 1"). */
export function axisLabel(day: string): string {
  return WEEKDAY.test(day) ? day.slice(0, 3) : day;
}

export type SeriesState = 'unavailable' | 'empty' | 'zero' | 'data';

/** A failed read, no buckets at all, buckets that are all genuinely zero, and real activity are four different states. */
export function seriesState(data: readonly PerformancePoint[] | null | undefined, failed: boolean): SeriesState {
  if (failed) return 'unavailable';
  const s = chartSeries(data);
  if (s.length === 0) return 'empty';
  return s.some((p) => p.value1 !== 0 || p.value2 !== 0) ? 'data' : 'zero';
}
