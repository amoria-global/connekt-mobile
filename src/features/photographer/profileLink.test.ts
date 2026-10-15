import { photographerProfileUrl } from './profileLink';

const mockGet = jest.fn();
jest.mock('@/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) } }));
jest.mock('@/config/env', () => ({ env: { webBaseUrl: 'https://connekyt.com/' } }));

beforeEach(() => mockGet.mockReset());

describe('photographerProfileUrl', () => {
  it('uses the landing profile route with the server-issued slug', async () => {
    mockGet.mockResolvedValueOnce({ slug: 'amina-k', type: 'photographer' });
    expect(await photographerProfileUrl('u1')).toBe('https://connekyt.com/photographers/amina-k');
    expect(mockGet).toHaveBeenCalledWith('/public/seo/slug-for?type=photographer&id=u1', { skipAuth: true });
  });
  it('falls back to the site home when there is no slug or the lookup fails', async () => {
    mockGet.mockResolvedValueOnce({ slug: '' });
    expect(await photographerProfileUrl('u1')).toBe('https://connekyt.com');
    mockGet.mockRejectedValueOnce({ status: 404, message: 'No slug for id' });
    expect(await photographerProfileUrl('u2')).toBe('https://connekyt.com');
    expect(await photographerProfileUrl(undefined)).toBe('https://connekyt.com');
  });
});
