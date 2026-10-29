import { createEvent, getPublicEventDetailed, setWishInvites, updateEvent } from '@/features/events/api';
import { listWishes } from './api';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockPut = jest.fn();
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), put: (...a: unknown[]) => mockPut(...a) },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));
jest.mock('@/utils/deviceId', () => ({ getDeviceId: jest.fn(async () => 'device-1') }));

const input = { title: 'Rooftop set', category: 'Music', eventDate: '2026-11-10', startTime: '18:00', endTime: '21:00' };

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset().mockResolvedValue({ action: 1, data: { id: 'e1' } });
  mockPut.mockReset().mockResolvedValue({ action: 1, data: { id: 'e1' } });
});

describe('Wish invites on the wire', () => {
  it('create sends the choice, either way', async () => {
    await createEvent({ ...input, allowWishInvites: true });
    expect(mockPost.mock.calls[0][1]).toMatchObject({ allowWishInvites: true });
    await createEvent({ ...input, allowWishInvites: false });
    expect(mockPost.mock.calls[1][1]).toMatchObject({ allowWishInvites: false });
  });

  it('editing sends the saved or changed value, and the coordinator route for coordinators', async () => {
    await updateEvent('e1', { ...input, allowWishInvites: false });
    expect(mockPut.mock.calls[0][0]).toBe('/customer/events/e1');
    expect(mockPut.mock.calls[0][1]).toMatchObject({ allowWishInvites: false });
    await updateEvent('e1', { ...input, allowWishInvites: true }, true);
    expect(mockPut.mock.calls[1][0]).toBe('/coordinator/events/e1');
  });

  it('the host toggle changes only the flag, and a refusal is an error', async () => {
    await setWishInvites('e1', false);
    expect(mockPut).toHaveBeenCalledWith('/customer/events/e1/wish-invites', { allowWishInvites: false });
    mockPut.mockResolvedValue({ action: 0, message: 'Not yours' });
    await expect(setWishInvites('e1', true)).rejects.toMatchObject({ message: 'Not yours' });
  });

  it('reads the setting from the event, and leaves it undefined for an older server', async () => {
    mockGet.mockResolvedValue({ action: 1, data: { id: 'e1', title: 'A', allowWishInvites: false } });
    expect((await getPublicEventDetailed('e1')).allowWishInvites).toBe(false);
    mockGet.mockResolvedValue({ action: 1, data: { id: 'e1', title: 'A' } });
    expect((await getPublicEventDetailed('e1')).allowWishInvites).toBeUndefined();
  });

  it('the wishes feed carries the current setting, so a live viewer sees a change on the refresh they already do', async () => {
    mockGet.mockResolvedValue({ action: 1, data: { items: [], page: 0, totalPages: 0, total: 0, allowWishInvites: false } });
    expect((await listWishes('e1')).allowWishInvites).toBe(false);
  });
});
