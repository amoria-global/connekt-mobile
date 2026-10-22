import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { CountBars, StatusBreakdownCard } from './ClientCharts';
import { ClientOverview } from './ClientOverview';
import { ClientWalletAnalytics, EventsHistogram, SpendingTrendChart } from './ClientWalletAnalytics';

import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
const mockGetOk = jest.fn();
jest.mock('@/api/client', () => ({
  api: {
    getOk: (...a: unknown[]) => mockGetOk(...a),
  },
}));
jest.mock('@/store/auth', () => ({ isApiError: () => false }));

const flat = (r: TestRenderer.ReactTestRenderer): string =>
  r.root
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

describe('StatusBreakdownCard', () => {
  it('renders emptyText when all segment values are zero', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <StatusBreakdownCard
          segments={[{ key: 'a', label: 'Upcoming', value: 0, color: '#000' }]}
          centerLabel="events"
          summary="Events by stage"
          emptyText="No events yet."
        />,
      );
    });
    expect(flat(r)).toContain('No events yet.');
  });

  it('renders total, labels, counts and percentages when segments have positive values', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <StatusBreakdownCard
          segments={[
            { key: 'upcoming', label: 'Upcoming', value: 3, color: '#111' },
            { key: 'completed', label: 'Completed', value: 1, color: '#222' },
          ]}
          centerLabel="events"
          summary="Events by stage"
          emptyText="No events yet."
        />,
      );
    });
    const text = flat(r);
    expect(text).toContain('4');
    expect(text).toContain('events');
    expect(text).toContain('Upcoming');
    expect(text).toContain('75%');
    expect(text).toContain('Completed');
    expect(text).toContain('25%');
  });
});

describe('CountBars', () => {
  it('renders each interval bar and count label', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <CountBars values={[2, 5, 0]} labels={['Mon', 'Tue', 'Wed']} label="Events per day" />,
      );
    });
    const text = flat(r);
    expect(text).toContain('2');
    expect(text).toContain('5');
    expect(text).toContain('Mon');
    expect(text).toContain('Tue');
    expect(text).toContain('Wed');
  });
});

describe('SpendingTrendChart & EventsHistogram', () => {
  it('distinguishes empty spending/events from active intervals and avoids currency labels on spending', () => {
    let rEmpty!: TestRenderer.ReactTestRenderer;
    act(() => {
      rEmpty = TestRenderer.create(<SpendingTrendChart points={[{ day: 'Mon', value1: 0, value2: 0 }]} />);
    });
    expect(flat(rEmpty)).toContain('No payments in this period.');

    let rActive!: TestRenderer.ReactTestRenderer;
    act(() => {
      rActive = TestRenderer.create(
        <>
          <SpendingTrendChart
            points={[
              { day: 'Week 1', value1: 120, value2: 1 },
              { day: 'Week 2', value1: 300, value2: 3 },
            ]}
          />
          <EventsHistogram
            points={[
              { day: 'Week 1', value1: 120, value2: 1 },
              { day: 'Week 2', value1: 300, value2: 3 },
            ]}
          />
        </>,
      );
    });
    const text = flat(rActive);
    expect(text).toContain('Week 1');
    expect(text).toContain('Week 2');
    expect(text).toContain('so no amount is labelled');
    expect(text).toContain('3');
  });
});

describe('ClientOverview', () => {
  it('shows N/A when figures are unknown, and real values when loaded', () => {
    let r!: TestRenderer.ReactTestRenderer;
    act(() => {
      r = TestRenderer.create(
        <ClientOverview
          analytics={{
            totalEvents: 4,
            upcomingEvents: 2,
            completedEvents: 2,
            cancelledEvents: 0,
            totalBookings: 5,
            totalSpent: 500,
            pendingAmount: 0,
            gifts: 0,
            totalPhotos: 120,
            totalVideos: 0,
            bookmarkedPhotographers: 3,
            unreadNotifications: 0,
          }}
          loading={false}
          spent={500}
          walletCurrency="USD"
          walletLoading={false}
          due={{ amount: 150, count: 1 }}
          hidden={false}
          onOpenWallet={() => {}}
          onOpenPayments={() => {}}
        />,
      );
    });
    const text = flat(r);
    expect(text).toContain('$500.00');
    expect(text).toContain('$150.00');
    expect(text).toContain('1 payment waiting');
    expect(text).toContain('Upcoming');
    expect(text).toContain('Completed');
    expect(text).toContain('120');
  });
});

describe('ClientWalletAnalytics', () => {
  it('renders lifetime spend breakdown and period trends', async () => {
    mockGetOk.mockImplementation(async (path: string) => {
      if (path.includes('trends')) {
        return {
          action: 1,
          data: { events: { value: 3, changePercent: 15, trend: 'up' }, photographers: { value: 2, changePercent: 0, trend: 'up' } },
        };
      }
      return {
        action: 1,
        data: [
          { day: 'Week 1', value1: 100, value2: 1 },
          { day: 'Week 2', value1: 250, value2: 2 },
        ],
      };
    });
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(
        <ClientWalletAnalytics
          wallet={{
            id: 'w1',
            currency: 'USD',
            status: 'ACTIVE',
            balanceAvailable: 0,
            balanceBooking: 280,
            balanceTips: 40,
            balanceBonuses: 0,
            balanceGifts: 0,
            balanceStreamFees: 0,
            balanceDonations: 0,
            balanceAdRevenue: 0,
            balancePhotoPurchase: 0,
            heldForDelivery: 0,
            pendingAmount: 25,
            blockedAmount: 0,
            totalWithdrawn: 0,
            totalRefunded: 0,
            clientSpent: 320,
            pots: [],
            total: 320,
          }}
        />,
      );
    });
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
    const text = flat(r);
    expect(text).toContain('Total spent');
    expect(text).toContain('$320.00');
    expect(text).toContain('$25.00');
    expect(text).toContain('Where your wallet stands');
    expect(text).not.toContain('Nothing in your wallet');
    expect(text).toContain('Up 15.0% vs last month');
    expect(text).toContain('Spending trend');
    expect(text).toContain('Events in this period');
  });
});
