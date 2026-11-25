import {
  dismissReceivedPhotobook,
  getPhotobook,
  listPhotobooks,
  listReceivedPhotobooks,
  resubmitPhotobook,
  acceptPhotobook,
  requestPhotobookChanges,
  listPickerAlbums,
  listPickerPhotos,
  createPhotobook,
} from './api';

const mockGetOk = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/client', () => ({
  api: {
    getOk: async (...a: unknown[]) => jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));

beforeEach(() => {
  mockGetOk.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
});

const book = { id: 'b1', name: 'Wedding', status: 'SENT_TO_PHOTOGRAPHER', senderName: 'Amina', mediaItems: [{ id: 'm1', fileUrl: 'https://x/1.jpg' }] };

describe('photographer photobooks use the photographer namespace', () => {
  it('lists books clients sent to the photographer from /photographer/photobooks, not the customer shelf', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, data: [book] });
    const rows = await listReceivedPhotobooks();
    expect(mockGetOk).toHaveBeenCalledWith('/photographer/photobooks');
    expect(rows).toEqual([expect.objectContaining({ id: 'b1', status: 'SENT_TO_PHOTOGRAPHER', photographerName: 'Amina' })]);
  });

  it('accepts a Spring page as the web does', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { content: [book] } });
    expect(await listReceivedPhotobooks()).toHaveLength(1);
  });

  it('opens a received book through the photographer detail endpoint, and an owned one through the customer endpoint', async () => {
    mockGetOk.mockResolvedValue({ action: 1, data: book });
    const d = await getPhotobook('b1', true);
    expect(mockGetOk).toHaveBeenLastCalledWith('/photographer/photobooks/b1');
    expect(d.photos).toEqual([expect.objectContaining({ id: 'm1', url: 'https://x/1.jpg' })]);
    await getPhotobook('b1');
    expect(mockGetOk).toHaveBeenLastCalledWith('/customer/events/photobooks/b1');
  });

  it('treats HTTP 200 with action 0 as a failure, not an empty shelf', async () => {
    mockGetOk.mockResolvedValue({ action: 0, message: 'Not allowed' });
    await expect(listReceivedPhotobooks()).rejects.toMatchObject({ message: 'Not allowed' });
    await expect(listPhotobooks()).rejects.toMatchObject({ message: 'Not allowed' });
  });

  it('resubmits and dismisses through the web endpoints, and surfaces a refusal', async () => {
    mockPost.mockResolvedValueOnce({ action: 1 });
    await resubmitPhotobook('b1');
    expect(mockPost).toHaveBeenCalledWith('/photographer/photobooks/b1/resubmit');
    mockDelete.mockResolvedValueOnce({ action: 1 });
    await dismissReceivedPhotobook('b1');
    expect(mockDelete).toHaveBeenCalledWith('/photographer/photobooks/b1');
    mockPost.mockResolvedValueOnce({ action: 0, message: 'Already resubmitted' });
    await expect(resubmitPhotobook('b1')).rejects.toMatchObject({ message: 'Already resubmitted' });
  });
});

describe('new fields and calls', () => {
  it('maps the source-aware fields and keeps who the book went to apart from who sent it', async () => {
    mockGetOk.mockResolvedValueOnce({
      action: 1,
      data: {
        id: 'b2', name: 'Mixed', status: 'COMPLETED', photographerName: 'Joseph M.', senderName: 'Aline U.', closedByPhotographer: true,
        sources: ['event', 'free'], sourceType: 'mixed', changeRequestNote: 'Swap the cover', completedAt: '2026-11-25T10:00:00',
        mediaItems: [
          { id: 'p1', fileUrl: 'https://x/o.jpg', sourceType: 'event', original: true },
          { id: 'p2', fileUrl: null, sourceType: 'purchased', original: false, watermarked: true },
        ],
      },
    });
    const d = await getPhotobook('b2');
    expect(d).toMatchObject({ toName: 'Joseph M.', senderName: 'Aline U.', closedByPhotographer: true, sources: ['event', 'free'], changeRequestNote: 'Swap the cover' });
    expect(d.photos[1]).toMatchObject({ id: 'p2', url: undefined, original: false, watermarked: true });
    expect(d.previews).toEqual(['https://x/o.jpg']);
  });

  it('accepts and requests changes through the customer endpoints', async () => {
    mockPost.mockResolvedValue({ action: 1 });
    await acceptPhotobook('b1');
    expect(mockPost).toHaveBeenLastCalledWith('/customer/events/photobook/b1/accept');
    await requestPhotobookChanges('b1', '  Swap the cover ');
    expect(mockPost).toHaveBeenLastCalledWith('/customer/events/photobook/b1/request-changes', { note: 'Swap the cover' });
  });

  it('lists the picker albums and only the photos the server allows', async () => {
    mockGetOk.mockResolvedValueOnce({ action: 1, data: [{ id: 'a1', title: 'Gala', sourceType: 'event', priced: false, photoCount: 10, usableCount: 10, ownerId: 'u1', eventId: 'e1' }] });
    const albums = await listPickerAlbums();
    expect(mockGetOk).toHaveBeenLastCalledWith('/customer/events/photobook/sources');
    expect(albums[0]).toMatchObject({ id: 'a1', ownerId: 'u1', eventId: 'e1', usableCount: 10 });
    mockGetOk.mockResolvedValueOnce({ action: 1, data: { total: 1, items: [{ id: 'p1', thumbUrl: 'https://x/t.jpg', sourceType: 'event' }] } });
    const photos = await listPickerPhotos('a1');
    expect(photos.items).toEqual([{ id: 'p1', thumbUrl: 'https://x/t.jpg', sourceType: 'event', caption: undefined }]);
  });

  it('a refused create surfaces the server message', async () => {
    mockPost.mockResolvedValueOnce({ action: 0, message: 'Some photos are not allowed.' });
    await expect(createPhotobook({ name: 'x', mediaIds: ['p1'] })).rejects.toMatchObject({ message: 'Some photos are not allowed.' });
  });
});
