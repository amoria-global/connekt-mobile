import { api } from '@/api/client';
import {
  getCustomerAnalytics,
  getCustomerTrends,
  getCustomerPerformance,
  getCustomerPendingPayments,
  getPhotographerAnalytics,
  getCoordinatorAnalytics,
} from './api';

jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn(),
  },
}));

describe('Analytics API Client', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('fetches and maps customer analytics defensively', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      action: 1,
      data: {
        totalEvents: 10,
        totalBookings: 8,
        totalSpent: 1250.5,
        pendingAmount: 350.0,
        gifts: 50.0,
        totalPhotos: 240,
        bookmarkedPhotographers: 5,
      },
    });

    const result = await getCustomerAnalytics();
    expect(api.get).toHaveBeenCalledWith('/customer/analytics');
    expect(result.totalEvents).toBe(10);
    expect(result.totalBookings).toBe(8);
    expect(result.totalSpent).toBe(1250.5);
    expect(result.pendingAmount).toBe(350.0);
    expect(result.gifts).toBe(50.0);
    expect(result.totalPhotos).toBe(240);
    expect(result.bookmarkedPhotographers).toBe(5);
  });

  it('maps customer trends with percentage formatting and direction', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      action: 1,
      data: {
        totalSpent: { changePercent: 12.4, trend: 'up' },
        pending: { changePercent: -5.2, trend: 'down' },
        events: { changePercent: 0, trend: 'up' },
      },
    });

    const trends = await getCustomerTrends('week');
    expect(api.get).toHaveBeenCalledWith('/customer/analytics/trends?period=week');
    expect(trends.totalSpent).toEqual({ percentage: '12.4%', direction: 'up' });
    expect(trends.pending).toEqual({ percentage: '5.2%', direction: 'down' });
    expect(trends.events).toEqual({ percentage: '0.0%', direction: 'up' });
  });

  it('parses custom date range in customer performance', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      action: 1,
      data: [
        { day: 'Sun', value1: 15, value2: 5 },
        { day: 'Mon', value1: 30, value2: 12 },
      ],
    });

    const perf = await getCustomerPerformance('custom', '2025-01-01', '2025-01-07');
    expect(api.get).toHaveBeenCalledWith(
      '/customer/analytics/performance?period=custom&from=2025-01-01&to=2025-01-07',
    );
    expect(perf).toHaveLength(2);
    expect(perf[0]).toEqual({ day: 'Sun', value1: 15, value2: 5 });
  });

  it('maps pending payments properly', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      action: 1,
      data: [
        {
          id: 'pay-123',
          eventTitle: 'Wedding Gala',
          photographerName: 'Alex Smith',
          photographerImage: 'https://example.com/alex.jpg',
          amountInUsd: 500,
          paidAmountInUsd: 100,
          status: 'PARTIAL',
        },
      ],
    });

    const pending = await getCustomerPendingPayments();
    expect(api.get).toHaveBeenCalledWith('/customer/payments/pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toEqual({
      id: 'pay-123',
      eventName: 'Wedding Gala',
      photographerName: 'Alex Smith',
      photographerImage: 'https://example.com/alex.jpg',
      amount: 500,
      paidAmount: 100,
      dueDate: undefined,
      status: 'partially_paid',
      paymentType: undefined,
    });
  });

  it('fetches photographer analytics defensively', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      action: 1,
      data: {
        totalEarnings: 3200,
        totalClients: 14,
        averageRating: 4.9,
      },
    });

    const result = await getPhotographerAnalytics();
    expect(api.get).toHaveBeenCalledWith('/photographer/analytics');
    expect(result.totalEarnings).toBe(3200);
    expect(result.totalClients).toBe(14);
    expect(result.averageRating).toBe(4.9);
  });

  it('fetches coordinator analytics defensively', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      action: 1,
      data: {
        totalRevenue: 15000,
        totalEvents: 42,
        totalPhotographers: 18,
      },
    });

    const result = await getCoordinatorAnalytics();
    expect(api.get).toHaveBeenCalledWith('/coordinator/analytics');
    expect(result.totalRevenue).toBe(15000);
    expect(result.totalEvents).toBe(42);
    expect(result.totalPhotographers).toBe(18);
  });
});
