import { initiateWithdrawal, verifyWithdrawal } from './api';
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
