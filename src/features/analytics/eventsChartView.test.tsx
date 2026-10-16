import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { EventsChart } from './EventsChart';
import { eventTicks, eventsChartSummary, eventsChartView, PAYMENTS_NOT_CHARTED_NOTE } from './eventsChartView';
import type { PerformancePoint } from './api';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// value1 is the backend's payment sum (possibly mixed currencies). value2 is the event count.
const week: PerformancePoint[] = [
  { day: 'Sun', value1: 120000, value2: 0 },
  { day: 'Mon', value1: 45.5, value2: 2 },
  { day: 'Tue', value1: 0, value2: 0 },
  { day: 'Wed', value1: 900000, value2: 5 },
  { day: 'Thu', value1: 0, value2: 1 },
  { day: 'Fri', value1: 0, value2: 0 },
  { day: 'Sat', value1: 30, value2: 0 },
];

const text = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const mount = (points: PerformancePoint[] | null) => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(<EventsChart points={points} />);
  });
  return r;
};

describe('photographer performance chart view', () => {
  it('charts only the event count and never marks the payment series as comparable', () => {
    const v = eventsChartView(week);
    expect(v.state).toBe('ready');
    if (v.state !== 'ready') return;
    expect(v.bars.map((b) => b.count)).toEqual([0, 2, 0, 5, 1, 0, 0]);
    expect(v.total).toBe(8);
    expect(v.paymentsComparable).toBe(false);
    // No payment figure leaks into the view.
    expect(JSON.stringify(v)).not.toMatch(/120000|900000|45\.5/);
  });

  it('uses a whole number axis that fits the largest count', () => {
    expect(eventTicks(0)).toEqual([4, 3, 2, 1, 0]);
    expect(eventTicks(5)).toEqual([8, 6, 4, 2, 0]);
    expect(eventTicks(13)).toEqual([16, 12, 8, 4, 0]);
    expect(eventTicks(5).every(Number.isInteger)).toBe(true);
  });

  it('treats a missing series as unavailable, not as a week of zeros', () => {
    expect(eventsChartView(null).state).toBe('unavailable');
    expect(eventsChartView([]).state).toBe('unavailable');
  });

  it('tells a quiet period apart from a failed load', () => {
    const quiet = week.map((p) => ({ ...p, value2: 0 }));
    expect(eventsChartView(quiet).state).toBe('empty');
    expect(eventsChartSummary(eventsChartView(quiet))).toBe('No events in this period.');
    expect(eventsChartSummary(eventsChartView(null))).toBe('Events chart unavailable.');
  });
});

describe('photographer performance chart rendering', () => {
  it('shows the counts and the currency note, and no payment legend or amount', () => {
    const r = mount(week);
    const t = text(r.root);
    expect(t).toContain(PAYMENTS_NOT_CHARTED_NOTE);
    expect(t).toContain('Wed');
    expect(t).not.toMatch(/Net payments received|Current V1|Current V2/);
    expect(t).not.toMatch(/120000|900000|45\.5|\$|USD|RWF\s?\d/);
    const label = r.root.find((n) => n.props?.accessibilityRole === 'image').props.accessibilityLabel as string;
    expect(label).toContain('Wed 5');
    expect(label).toContain('8 in total');
  });

  it('says the chart is unavailable instead of drawing zeros when nothing loaded', () => {
    const t = text(mount(null).root);
    expect(t).toContain('Events chart unavailable');
    expect(t).toContain(PAYMENTS_NOT_CHARTED_NOTE);
  });

  it('says the period is quiet when there are no events', () => {
    const t = text(mount(week.map((p) => ({ ...p, value2: 0 }))).root);
    expect(t).toContain('No events in this period');
  });
});
