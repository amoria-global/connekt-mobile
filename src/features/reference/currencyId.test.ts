import { currencyIdFor, resetCurrencyCache } from './api';
import { createPublicDonation } from '@/features/donations/api';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}));

const list = {
  action: 1,
  data: [
    { id: '11111111-1111-4111-8111-111111111111', code: 'RWF', name: 'Rwandan franc' },
    { id: '22222222-2222-4222-8222-222222222222', code: 'USD', name: 'US Dollar' },
  ],
};

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  resetCurrencyCache();
});

describe('currency ids come from the backend, never from the app', () => {
  it('reads the id for a code from /public/currencies', async () => {
    mockGet.mockResolvedValue(list);
    await expect(currencyIdFor('usd')).resolves.toBe('22222222-2222-4222-8222-222222222222');
    expect(mockGet).toHaveBeenCalledWith('/public/currencies', { skipAuth: true });
  });

  it('passes an id through without a request', async () => {
    await expect(currencyIdFor('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).resolves.toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('refuses a currency the backend does not list instead of falling back to RWF', async () => {
    mockGet.mockResolvedValue(list);
    await expect(currencyIdFor('JPY')).rejects.toMatchObject({ message: 'JPY is not available right now.' });
  });

  it('refuses when no currency was chosen', async () => {
    await expect(currencyIdFor(undefined)).rejects.toMatchObject({ message: 'Choose a currency first.' });
  });

  it('does not remember a failed read, and reads the list once otherwise', async () => {
    mockGet.mockRejectedValueOnce({ message: 'offline' }).mockResolvedValue(list);
    await expect(currencyIdFor('USD')).rejects.toMatchObject({ message: 'offline' });
    await expect(currencyIdFor('USD')).resolves.toBeTruthy();
    await currencyIdFor('RWF');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});

describe('a donation', () => {
  it('is recorded with the backend id for the chosen currency and no invented donor name', async () => {
    mockGet.mockResolvedValue(list);
    mockPost.mockResolvedValue({ action: 1, data: { id: 'd1', amount: 5 } });
    await createPublicDonation({ amount: 5, currencyCode: 'USD', paymentMethod: 'CARD' });
    const url = mockPost.mock.calls[0][0] as string;
    expect(url).toContain('currencyId=22222222-2222-4222-8222-222222222222');
    expect(url).not.toContain('donorName');
  });

  it('is not sent at all when the currency cannot be resolved', async () => {
    mockGet.mockResolvedValue(list);
    await expect(createPublicDonation({ amount: 5, currencyCode: 'JPY' })).rejects.toMatchObject({ message: 'JPY is not available right now.' });
    expect(mockPost).not.toHaveBeenCalled();
  });
});
