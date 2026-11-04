import { api } from '@/api/client';
import { requestFreeAlbumAccess, verifyFreeAlbumAccess } from './api';

jest.mock('@/api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

/**
 * Free-album codes: the server decides. A refusal reaches the screen with its attempts left and wait, and a
 * request answers when Resend unlocks on the server's clock.
 */
describe('requestFreeAlbumAccess', () => {
  const post = api.post as jest.Mock;
  beforeEach(() => post.mockReset());

  it('returns the device deadline for Resend from the server timers', async () => {
    const now = Date.now();
    post.mockResolvedValue({
      action: 1,
      data: { resendAvailableAt: new Date(now + 180_000).toISOString(), serverTime: new Date(now).toISOString() },
    });
    const at = await requestFreeAlbumAccess('123456', 'A@B.co');
    expect(at).toBeGreaterThan(now + 170_000);
    expect(post).toHaveBeenCalledWith('/public/albums/free/request-access', { accessCode: '123456', email: 'a@b.co' });
  });

  it('returns null from an older backend that sends no timers', async () => {
    post.mockResolvedValue({ action: 1, data: { customerId: 'c' } });
    await expect(requestFreeAlbumAccess('123456', 'a@b.co')).resolves.toBeNull();
  });

  it('throws the rate limit with its wait', async () => {
    post.mockResolvedValue({ action: 0, errorCode: 'RATE_LIMITED', retryAfterSeconds: 480, message: 'Too many codes.' });
    await expect(requestFreeAlbumAccess('123456', 'a@b.co')).rejects.toMatchObject({ errorCode: 'RATE_LIMITED', retryAfterSeconds: 480 });
  });
});

describe('verifyFreeAlbumAccess', () => {
  const post = api.post as jest.Mock;
  beforeEach(() => post.mockReset());

  it('throws a wrong code with the tries left', async () => {
    post.mockResolvedValue({ action: 0, errorCode: 'WRONG_CODE', attemptsLeft: 2, message: 'That code did not work.' });
    await expect(verifyFreeAlbumAccess('123456', 'a@b.co', '000000')).rejects.toMatchObject({ codeError: true, errorCode: 'WRONG_CODE', attemptsLeft: 2 });
  });

  it('throws a lock with its wait', async () => {
    post.mockResolvedValue({ action: 0, errorCode: 'LOCKED', retryAfterSeconds: 900, message: 'Locked' });
    await expect(verifyFreeAlbumAccess('123456', 'a@b.co', '000000')).rejects.toMatchObject({ errorCode: 'LOCKED', retryAfterSeconds: 900 });
  });
});
