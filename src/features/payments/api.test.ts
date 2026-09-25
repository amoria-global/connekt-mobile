import { api } from '@/api/client';
import { getPayment, PAYMENT_NOT_FOUND_MESSAGE } from './api';

jest.mock('@/api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

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
