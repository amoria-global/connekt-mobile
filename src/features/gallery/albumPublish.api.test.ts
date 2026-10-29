import { createPaidAlbum, ensureAlbumInviteCode, getAlbum, publishAlbumToFaceSearch } from './api';

const mockGet = jest.fn();
const mockPost = jest.fn();
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
});

describe('publishAlbumToFaceSearch', () => {
  it('returns the invite code the share link is built from', async () => {
    mockPost.mockResolvedValue({ action: 1, data: { published: true, inviteCode: 'ALB1234ABCD' } });
    await expect(publishAlbumToFaceSearch('a1')).resolves.toEqual({ inviteCode: 'ALB1234ABCD' });
    expect(mockPost).toHaveBeenCalledWith('/photographer/albums/a1/publish', {});
  });

  it('sends the price and currency only when both are set', async () => {
    mockPost.mockResolvedValue({ action: 1, data: {} });
    await publishAlbumToFaceSearch('a1', { pricePerImage: '2000', currencyId: 'c1' });
    expect(mockPost.mock.calls[0][1]).toEqual({ pricePerImage: 2000, currencyId: 'c1' });
    await publishAlbumToFaceSearch('a1', { pricePerImage: '2000' });
    expect(mockPost.mock.calls[1][1]).toEqual({});
  });

  it('a refusal (no credits) is an error, not a success', async () => {
    mockPost.mockResolvedValue({ action: 0, message: 'Not enough AI credits' });
    await expect(publishAlbumToFaceSearch('a1')).rejects.toMatchObject({ message: 'Not enough AI credits' });
  });
});

describe('createPaidAlbum', () => {
  const input = { title: 'Wedding', pricePerImage: '2000', currencyId: 'c1' };

  it('publishes to Find My Photos after creating, as the web does', async () => {
    mockPost
      .mockResolvedValueOnce({ action: 1, data: { id: 'a1' } })
      .mockResolvedValueOnce({ action: 1, data: { inviteCode: 'ALB1234ABCD' } });
    const res = await createPaidAlbum(input);
    expect(mockPost.mock.calls[1][0]).toBe('/photographer/albums/a1/publish');
    expect(mockPost.mock.calls[1][1]).toEqual({ pricePerImage: 2000, currencyId: 'c1' });
    expect(res).toMatchObject({ id: 'a1', inviteCode: 'ALB1234ABCD', published: true });
  });

  it('still returns the album when publishing fails', async () => {
    mockPost.mockResolvedValueOnce({ action: 1, data: { id: 'a1' } }).mockResolvedValueOnce({ action: 0, message: 'no' });
    const res = await createPaidAlbum(input);
    expect(res.id).toBe('a1');
    expect(res.published).toBeUndefined();
  });
});

describe('ensureAlbumInviteCode and getAlbum', () => {
  it('reads the code from the response', async () => {
    mockPost.mockResolvedValue({ action: 1, data: { inviteCode: 'ALB9' } });
    await expect(ensureAlbumInviteCode('a1')).resolves.toBe('ALB9');
    mockPost.mockResolvedValue({ action: 1, data: 'ALB8' });
    await expect(ensureAlbumInviteCode('a1')).resolves.toBe('ALB8');
  });

  it('the photographer album carries its codes and live state', async () => {
    mockGet.mockResolvedValue({ action: 1, data: { id: 'a1', title: 'Wedding', freeAlbum: true, accessCode: '482913', inviteCode: 'ALB1', faceRecognitionEnabled: true, images: [] } });
    const a = await getAlbum('a1', true);
    expect(a).toMatchObject({ isFreeAlbum: true, accessCode: '482913', inviteCode: 'ALB1', faceRecognitionEnabled: true });
  });
});

describe('getAlbum: standalone', () => {
  it('flags a standalone album so a paid one is not offered Send to client', async () => {
    mockGet.mockResolvedValue({ action: 1, data: { id: 'a1', title: 'T', albumType: 'standalone', freeAlbum: false, images: [] } });
    const a = await getAlbum('a1');
    expect(a.isStandalone).toBe(true);
    expect(a.isFreeAlbum).toBe(false);
  });
  it('does not flag an event album', async () => {
    mockGet.mockResolvedValue({ action: 1, data: { id: 'a2', title: 'T', albumType: 'event', images: [] } });
    expect((await getAlbum('a2')).isStandalone).toBe(false);
  });
});
