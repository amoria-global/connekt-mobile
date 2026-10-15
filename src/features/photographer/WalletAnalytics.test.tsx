import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { PaymentTrendChart, trendCaption } from './WalletAnalytics';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/api/client', () => ({ api: { getOk: jest.fn() } }));
jest.mock('@/store/auth', () => ({ isApiError: () => false }));

describe('trendCaption', () => {
  it('spells out direction and the comparison period', () => {
    expect(trendCaption({ percentage: '12.0%', direction: 'up' }, 'month')).toBe('Up 12.0% vs last month');
    expect(trendCaption({ percentage: '5.5%', direction: 'down' }, 'week')).toBe('Down 5.5% vs last week');
  });
  it('says no change for 0%, instead of an up arrow on nothing', () => {
    expect(trendCaption({ percentage: '0.0%', direction: 'up' }, 'today')).toBe('No change vs yesterday');
  });
  it('says nothing when the backend sent no trend', () => {
    expect(trendCaption(undefined, 'week')).toBeUndefined();
  });
});

describe('PaymentTrendChart', () => {
  const render = (points: { day: string; value1: number; value2: number }[]) => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(<PaymentTrendChart points={points} />);
    });
    return r;
  };
  it('tells an empty period apart from a chart of zeros', () => {
    const r = render([
      { day: 'Week 1', value1: 0, value2: 0 },
      { day: 'Week 2', value1: 0, value2: 0 },
    ]);
    expect(r.root.findAllByType(Text).map((t) => t.props.children).join(' ')).toContain('No payments received');
  });
  it('describes the chart for a screen reader and names the highest interval', () => {
    const r = render([
      { day: 'Week 1', value1: 10, value2: 1 },
      { day: 'Week 2', value1: 40, value2: 2 },
    ]);
    const chart = r.root.findAll((n) => n.props?.accessibilityRole === 'image')[0];
    expect(chart.props.accessibilityLabel).toBe('Payment activity over 2 intervals. Highest: Week 2.');
  });
});
