import { initiateWithdrawal, listWithdrawableSources, verifyWithdrawal } from './api';
import { api } from '@/api/client';

jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

const source = { source: 'balance', label: 'Available balance', availableBalance: 10, isGiftWithdrawal: false };

describe('withdraw API client', () => {
  afterEach(() => jest.clearAllMocks());

  it('posts the web’s initiate body to the role’s namespace, in USD', async () => {
    (api.post as jest.Mock).mockResolvedValueOnce({ action: 1, data: { verificationId: 'v1', requiresOtp: true } });
    await initiateWithdrawal('Photographer', { amount: 5, withdrawalMethodId: 'm1', donationAmount: 0.5, source });
    expect(api.post).toHaveBeenCalledWith('/photographer/withdraw/initiate', {
      amount: 5,
      withdrawalMethodId: 'm1',
      donationAmount: 0.5,
      isGiftWithdrawal: false,
      source: 'BALANCE',
    });
  });

  it('routes to KYC when the backend refuses with HTTP 400 and kycRequired (seen live)', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce({
      status: 400,
      message: 'KYC verification is required before you can withdraw funds.',
      body: { action: 0, kycRequired: true, message: 'KYC verification is required before you can withdraw funds.' },
    });
    const out = await initiateWithdrawal('Client', { amount: 1, withdrawalMethodId: 'm1', donationAmount: 0, source });
    expect(out.kind).toBe('kyc');
  });

  it('shows a 4xx refusal’s own message', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce({ status: 400, message: 'Insufficient balance. Available: 3' });
    const out = await initiateWithdrawal('Client', { amount: 9, withdrawalMethodId: 'm1', donationAmount: 0, source });
    expect(out).toEqual({ kind: 'error', message: 'Insufficient balance. Available: 3' });
  });

  it('lets a 401 and network errors through instead of calling them refusals', async () => {
    (api.post as jest.Mock).mockRejectedValueOnce({ status: 401, message: 'Unauthorized' });
    await expect(
      verifyWithdrawal('Client', { verificationId: 'v1', otp: '123456' }),
    ).rejects.toMatchObject({ status: 401 });
    (api.post as jest.Mock).mockRejectedValueOnce({ status: 0, message: 'Network error' });
    await expect(
      verifyWithdrawal('Client', { verificationId: 'v1', otp: '123456' }),
    ).rejects.toMatchObject({ status: 0 });
  });
});

describe('listWithdrawableSources: an unknown balance is a failure, never a zero', () => {
  afterEach(() => jest.clearAllMocks());

  it('maps a reported balance, including a reported zero', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({
      action: 1,
      data: [
        { source: 'BALANCE', label: 'Available balance', availableBalance: 0 },
        { source: 'GIFT', label: 'Gift earnings', availableBalance: '12.5', isGiftWithdrawal: true },
      ],
    });
    const out = await listWithdrawableSources('Photographer');
    expect(out.map((s) => s.availableBalance)).toEqual([0, 12.5]);
  });

  it('treats an empty list as an answer (no sources), not as an error', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ action: 1, data: [] });
    await expect(listWithdrawableSources('Photographer')).resolves.toEqual([]);
  });

  it.each([
    ['a source with no availableBalance', [{ source: 'BALANCE', label: 'Available balance' }]],
    ['a null availableBalance', [{ source: 'BALANCE', availableBalance: null }]],
    ['a non-numeric availableBalance', [{ source: 'BALANCE', availableBalance: 'n/a' }]],
    ['a blank availableBalance', [{ source: 'BALANCE', availableBalance: '  ' }]],
    ['one good and one unreadable source', [{ source: 'BALANCE', availableBalance: 5 }, { source: 'GIFT' }]],
  ])('fails the load for %s', async (_name, data) => {
    (api.get as jest.Mock).mockResolvedValueOnce({ action: 1, data });
    await expect(listWithdrawableSources('Photographer')).rejects.toMatchObject({ message: 'Could not read your balance.' });
  });

  it('fails the load when a success envelope carries no list', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ action: 1 });
    await expect(listWithdrawableSources('Photographer')).rejects.toMatchObject({ message: 'Could not read your balance.' });
  });

  it('fails the load on action 0 with the backend message (HTTP 200 with action 0 is a failure)', async () => {
    (api.get as jest.Mock).mockResolvedValueOnce({ action: 0, message: 'Wallet unavailable' });
    await expect(listWithdrawableSources('Client')).rejects.toMatchObject({ message: 'Wallet unavailable' });
  });
});
