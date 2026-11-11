import { getAlbumFaceStatus, listAlbums, createPaidAlbum, describePublishFailure, ensureAlbumInviteCode, getAlbum, publishAlbumToFaceSearch, PUBLISH_TIMEOUT_MS } from './api';

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
    mockPost.mockResolvedValue({ action: 1, data: { published: true, inviteCode: 'ALB1234ABCD', facesIndexed: 12 } });
    await expect(publishAlbumToFaceSearch('a1')).resolves.toEqual({ inviteCode: 'ALB1234ABCD', facesIndexed: 12 });
    // The server indexes every photo before it answers, so this call gets more than the 20 s default.
    expect(mockPost).toHaveBeenCalledWith('/photographer/albums/a1/publish', {}, { timeoutMs: PUBLISH_TIMEOUT_MS });
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

  it('returns the album AND the reason when publishing fails, never a silent unpublished album', async () => {
    mockPost.mockResolvedValueOnce({ action: 1, data: { id: 'a1' } }).mockRejectedValueOnce({ status: 402, message: 'x', body: { code: 'INSUFFICIENT_AI_CREDITS', needed: 30, balance: 4 } });
    const res = await createPaidAlbum(input);
    expect(res.id).toBe('a1');
    expect(res.published).toBeUndefined();
    expect(res.publishFailure).toMatchObject({ kind: 'credits', needed: 30, balance: 4 });
    expect(res.publishFailure?.message).toMatch(/30 credits and have 4/);
  });

  it('a refusal answered with action 0 carries the server message', async () => {
    mockPost.mockResolvedValueOnce({ action: 1, data: { id: 'a1' } }).mockResolvedValueOnce({ action: 0, message: 'Price per image is required to publish PAID album' });
    const res = await createPaidAlbum(input);
    expect(res.publishFailure).toEqual({ kind: 'other', message: 'Price per image is required to publish PAID album' });
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

describe('describePublishFailure', () => {
  it('credits: names the shortfall and says to top up, then retry', () => {
    const f = describePublishFailure({ status: 402, message: 'Not enough AI credits to index faces for this album', body: { needed: 1, balance: 0 } });
    expect(f.kind).toBe('credits');
    expect(f.message).toContain('You need 1 credit and have 0');
    expect(f.message).toMatch(/Top up/);
  });
  it('credits without numbers still reads cleanly', () => {
    expect(describePublishFailure({ status: 402, message: 'x' }).message).toBe('Not enough credits to prepare these photos for Find my photos. Top up, then retry.');
  });
  it('a timeout says the work continues on the server and to retry, not to re-upload', () => {
    for (const status of [408, 502, 504]) {
      const f = describePublishFailure({ status, message: 'x' });
      expect(f.kind).toBe('timeout');
      expect(f.message).toMatch(/keeps going/);
      expect(f.message).toMatch(/Retry publishing/);
    }
  });
  it('offline reads as a connection problem', () => {
    expect(describePublishFailure({ status: 0, message: 'x' }).message).toMatch(/lost the connection/);
  });
  it('anything else keeps the server message, and falls back to a plain sentence', () => {
    expect(describePublishFailure({ status: 400, message: 'Price too low' }).message).toBe('Price too low');
    expect(describePublishFailure(undefined).message).toMatch(/Retry publishing/);
  });
});

describe('listAlbums carries what decides Find my photos visibility', () => {
  it('maps standalone, free and live flags from the photographer list', async () => {
    mockGet.mockResolvedValue({
      action: 1,
      data: [
        { id: 'p1', title: 'Paid not live', albumType: 'standalone', faceRecognitionEnabled: false },
        { id: 'p2', title: 'Paid live', albumType: 'standalone', faceRecognitionEnabled: true },
        { id: 'f1', title: 'Free', albumType: 'standalone', freeAlbum: true },
        { id: 'e1', title: 'Event', albumType: 'event' },
      ],
    });
    const list = await listAlbums(true);
    expect(list.map((a) => [a.id, a.isStandalone, a.isFreeAlbum, a.faceRecognitionEnabled])).toEqual([
      ['p1', true, false, false],
      ['p2', true, false, true],
      ['f1', true, true, false],
      ['e1', false, false, false],
    ]);
  });
});

describe('background indexing of a large album', () => {
  it('publish answers published but still indexing, with the totals, and createPaidAlbum carries them', async () => {
    mockPost
      .mockResolvedValueOnce({ action: 1, data: { id: 'a1' } })
      .mockResolvedValueOnce({ action: 1, data: { published: true, facesIndexed: 0, indexing: true, indexingTotal: 120, indexingDone: 0, inviteCode: 'ALB1' } });
    const res = await createPaidAlbum({ title: 'Wedding', pricePerImage: '2000', currencyId: 'c1' });
    expect(res).toMatchObject({ id: 'a1', published: true, inviteCode: 'ALB1', indexing: { total: 120, done: 0 } });
    expect(res.publishFailure).toBeUndefined();
  });

  it('a small album has no indexing block', async () => {
    mockPost.mockResolvedValue({ action: 1, data: { published: true, facesIndexed: 3 } });
    await expect(publishAlbumToFaceSearch('a1')).resolves.toMatchObject({ facesIndexed: 3, indexing: undefined });
  });

  it('face-status carries the job progress, and ignores a status it does not know', async () => {
    mockGet.mockResolvedValueOnce({ action: 1, data: { galleryImageCount: 120, indexing: { status: 'INDEXING', total: 120, done: 45 } } });
    await expect(getAlbumFaceStatus('a1')).resolves.toMatchObject({ indexing: { status: 'INDEXING', total: 120, done: 45 } });
    mockGet.mockResolvedValueOnce({ action: 1, data: { indexing: { status: 'WHAT', total: 1, done: 1 } } });
    expect((await getAlbumFaceStatus('a1')).indexing).toBeUndefined();
    mockGet.mockResolvedValueOnce({ action: 1, data: {} });
    expect((await getAlbumFaceStatus('a1')).indexing).toBeUndefined();
  });
});
