import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { PerformanceWaveCard } from '@/features/dashboard/PerformanceWaveCard';
import { useCurrency, DEFAULT_CURRENCIES } from '@/store/currency';
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * RENDERED chart (react-test-renderer, not a device). Honesty is the point: with no real series the
 * card is a flat baseline that says so (no invented wave, no hard-coded "0" or "60" labels), an
 * unknown figure is "N/A" rather than a zero, and money is masked when the Home masks it.
 */
const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

const analytics = {
  totalCustomers: 4, totalPhotographers: 3, totalEvents: 7, totalRevenue: 1500, totalPaid: 0, totalPending: 0,
  pendingProfileReviews: 0, activeStreams: 0, totalNotifications: 0, unreadContactMessages: 0,
};

const mount = (props: Partial<React.ComponentProps<typeof PerformanceWaveCard>> = {}) => {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => {
    r = TestRenderer.create(
      <PerformanceWaveCard analytics={analytics} trends={{}} period="week" onPeriodChange={() => {}} currency="USD" {...props} />,
    );
  });
  return r;
};

beforeEach(() => useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES }));

describe('performance wave card as rendered', () => {
  it('says so when there is no series, and draws no invented labels', () => {
    const r = mount();
    const text = flat(r.root);
    expect(text).toContain('No trend data for this period');
    expect(text).not.toContain('60');
    expect(r.root.findAll((n) => n.props?.fill === 'url(#waveGlowGradient)').length).toBe(0);
  });

  it('an unknown figure is N/A, not a zero', () => {
    const r = mount({ analytics: null });
    expect(flat(r.root)).toContain('N/A');
    expect(flat(r.root)).not.toContain('$0.00');
  });

  it('masks money when hidden, but not counts', () => {
    const shown = flat(mount().root);
    expect(shown).toContain('$1,500.00');
    const masked = flat(mount({ hidden: true }).root);
    expect(masked).toContain('••••');
    expect(masked).not.toContain('$1,500.00');
  });

  it('with a real series it labels the points with their values', () => {
    const series = ['16/10', '17/10', '18/10', '19/10', '20/10', '21/10'].map((day, i) => ({ day, value1: i * 100, value2: i }));
    const r = mount({ performanceData: series });
    const text = flat(r.root);
    expect(text).not.toContain('No trend data for this period');
    // Chart labels are SVG text, not RN Text, so look for them by their children.
    expect(r.root.findAll((n) => n.props?.children === '$500.00').length).toBeGreaterThan(0);
    expect(r.root.findAll((n) => n.props?.fill === 'url(#waveGlowGradient)').length).toBeGreaterThan(0);
  });
});

describe('performance wave card, failed read', () => {
  it('says the data could not be loaded instead of "no trend data"', () => {
    const text = flat(mount({ emptyText: 'Trend data could not be loaded' }).root);
    expect(text).toContain('Trend data could not be loaded');
    expect(text).not.toContain('No trend data for this period');
  });
});
