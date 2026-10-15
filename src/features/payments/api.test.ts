import { api } from '@/api/client';
import {
  getPayment,
  listStreamingPayments,
  listGiftPayments,
  PAYMENT_NOT_FOUND_MESSAGE,
} from './api';

jest.mock('@/api/client', () => {
  const get = jest.fn();
  return { api: { post: jest.fn(), get, getOk: (...a: unknown[]) => get(...a) } };
});

/**
 * Tapping a coordinator's "Payment Failed" notification opened a blank screen
 * that read "No static resource api/remote/coordinator/payments/<id>". The
 * endpoint did not exist (it now does, CoordinatorController#getPaymentById),
 * and the raw Spring 404 text went straight to the user. These tests pin the
 * path each role calls and the sentence a 404 turns into.
 */
const get = api.get as jest.Mock;

beforeEach(() => get.mockReset());

describe('getPayment', () => {
  it('asks the coordinator endpoint for a coordinator', async () => {
    get.mockResolvedValue({ action: 1, data: { id: 'd1', paymentType: 'GIFT', status: 'PENDING', amount: 2 } });

    const p = await getPayment('d1', 'Coordinator');

    expect(get).toHaveBeenCalledWith('/coordinator/payments/d1');
    expect(p).toMatchObject({ id: 'd1', paymentType: 'GIFT', status: 'PENDING', amount: 2 });
  });

  it('asks the customer endpoint for every other role', async () => {
    get.mockResolvedValue({ action: 1, data: { id: 'd2' } });

    await getPayment('d2', 'Client');

    expect(get).toHaveBeenCalledWith('/customer/payments/d2');
  });

  it('turns a 404 into a sentence instead of the server text', async () => {
    get.mockRejectedValue({ status: 404, message: 'No static resource api/remote/coordinator/payments/d3.' });

    await expect(getPayment('d3', 'Coordinator')).rejects.toMatchObject({
      status: 404,
      message: PAYMENT_NOT_FOUND_MESSAGE,
    });
  });

  it('leaves other failures untouched', async () => {
    const offline = { status: 0, message: 'You appear to be offline.' };
    get.mockRejectedValue(offline);

    await expect(getPayment('d4', 'Coordinator')).rejects.toBe(offline);
  });
});

describe('listStreamingPayments', () => {
  it('calls /coordinator/payments/streaming and normalizes stream fee items', async () => {
    get.mockResolvedValue({
      action: 1,
      totalStreamingRevenue: 5000,
      data: [
        {
          id: 's1',
          eventTitle: 'Concert Live',
          viewerName: 'Alice',
          viewerEmail: 'alice@example.com',
          amount: 2500,
          currencyAbbreviation: 'RWF',
          paymentMethod: 'MOMO',
          status: 'COMPLETED',
          createdAt: '2026-09-25T10:00:00Z',
        },
      ],
    });

    const res = await listStreamingPayments();
    expect(get).toHaveBeenCalledWith('/coordinator/payments/streaming');
    expect(res.totalStreamingRevenue).toBe(5000);
    expect(res.payments).toHaveLength(1);
    expect(res.payments[0]).toEqual({
      id: 's1',
      eventTitle: 'Concert Live',
      viewerName: 'Alice',
      viewerEmail: 'alice@example.com',
      date: '2026-09-25T10:00:00Z',
      amount: 2500,
      currency: 'RWF',
      method: 'MOMO',
      status: 'completed',
    });
  });
});

describe('listGiftPayments', () => {
  // The net share comes from the backend split (withdrawableAmount); the client
  // used to assume 65% when it was missing.
  it('calls /coordinator/payments?type=GIFT and takes the net share from the backend', async () => {
    get.mockResolvedValue({
      action: 1,
      data: [
        {
          id: 'g1',
          eventTitle: 'Wedding Stream',
          amount: 10000,
          withdrawableAmount: 6500,
          currencyAbbreviation: 'RWF',
          giftMessage: 'Congrats!',
          senderName: 'Bob',
          paymentMethod: 'CARD',
          status: 'COMPLETED',
          paymentCompletedAt: '2026-09-25T12:00:00Z',
        },
      ],
    });

    const gifts = await listGiftPayments();
    expect(get).toHaveBeenCalledWith('/coordinator/payments?type=GIFT&page=0&size=100');
    expect(gifts).toHaveLength(1);
    expect(gifts[0]).toEqual({
      id: 'g1',
      eventTitle: 'Wedding Stream',
      amount: 10000,
      netAmount: 6500,
      currency: 'RWF',
      giftMessage: 'Congrats!',
      customerPhone: 'Bob',
      method: 'CARD',
      status: 'completed',
      date: '2026-09-25T12:00:00Z',
    });
  });
});

