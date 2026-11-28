/**
 * The buyerId a purchase carries. Found by a sandbox purchase with a signed-in QA viewer: sending the customer id as
 * buyerId was refused ("Buyer not found"); an identified album buyer record is what the backend expects.
 */
const mockPost = jest.fn();
jest.mock('@/api/client', () => ({ api: { post: (...a: unknown[]) => mockPost(...a), get: jest.fn() } }));
import { resolveBuyerId } from './api';

const who = { name: 'Aline Uwase', email: 'aline@example.com', phone: '250780000000' };
beforeEach(() => mockPost.mockReset());

describe('resolveBuyerId', () => {
  it('identifies a signed-in buyer on the album and uses the buyer record id', async () => {
    mockPost.mockResolvedValue({ data: { buyerId: 'buyer-1', purchasedPhotoIds: [] } });
    await expect(resolveBuyerId(true, 'alb-1', who)).resolves.toBe('buyer-1');
    expect(mockPost.mock.calls[0][0]).toBe('/public/albums/alb-1/identify-buyer');
    expect(mockPost.mock.calls[0][1]).toMatchObject(who);
  });
  it('sends nothing for a guest, so the purchase goes by email', async () => {
    await expect(resolveBuyerId(false, 'alb-1', who)).resolves.toBeUndefined();
    expect(mockPost).not.toHaveBeenCalled();
  });
  it('falls back to a guest purchase when identifying fails, instead of blocking the buyer', async () => {
    mockPost.mockRejectedValue(new Error('offline'));
    await expect(resolveBuyerId(true, 'alb-1', who)).resolves.toBeUndefined();
  });
});
