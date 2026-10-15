import {
  dismissReceivedPhotobook,
  getPhotobook,
  listPhotobooks,
  listReceivedPhotobooks,
  resubmitPhotobook,
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
    expect(d.photos).toEqual([{ id: 'm1', url: 'https://x/1.jpg', caption: undefined }]);
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
