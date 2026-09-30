import { CARD_FAILED_GRACE_MS, interpretStatus, pollHandoff } from './nativeCheckout';

jest.mock('@/api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));
jest.mock('@/features/photos/api', () => ({ getPublicPaymentStatus: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getPublicPaymentStatus } = require('@/features/photos/api') as {
  getPublicPaymentStatus: jest.Mock;
};

const instant = () => Promise.resolve();

describe('interpretStatus', () => {
  it('ignores an early FAILED on a card, which the gateway reports before the card is typed', () => {
    expect(interpretStatus('failed', 1000, true)).toBe('pending');
    expect(interpretStatus('failed', CARD_FAILED_GRACE_MS, true)).toBe('failed');
  });
  it('trusts FAILED straight away for mobile money', () => {
    expect(interpretStatus('failed', 1000, false)).toBe('failed');
  });
  it('always passes success through', () => {
    expect(interpretStatus('success', 0, true)).toBe('success');
  });
});

describe('pollHandoff', () => {
  beforeEach(() => getPublicPaymentStatus.mockReset());

  it('resolves success once the gateway settles', async () => {
    getPublicPaymentStatus
      .mockResolvedValueOnce('pending')
      .mockResolvedValueOnce('success');
    await expect(pollHandoff('r1', false, instant).done).resolves.toBe('success');
  });

  it('keeps polling through a failed status read instead of calling it a failure', async () => {
    getPublicPaymentStatus
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce('success');
    await expect(pollHandoff('r1', false, instant).done).resolves.toBe('success');
  });

  it('resolves unknown, never failed, when it runs out of budget', async () => {
    // The charge may have landed. Calling this "failed" invites a second charge.
    getPublicPaymentStatus.mockResolvedValue('pending');
    await expect(pollHandoff('r1', false, instant).done).resolves.toBe('unknown');
  });

  it('resolves failed for a declined mobile money charge', async () => {
    getPublicPaymentStatus.mockResolvedValue('failed');
    await expect(pollHandoff('r1', false, instant).done).resolves.toBe('failed');
  });
});
