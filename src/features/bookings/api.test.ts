import { api } from '@/api/client';
import { listBookings, acceptBooking, rejectBooking } from './api';

jest.mock('@/api/client', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe('Bookings API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listBookings', () => {
    it('fetches and maps direct bookings correctly, sorting by newest createdAt', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({
        action: 1,
        data: [
          {
            id: 'b-1',
            event: { id: 'e-1', title: 'Summer Wedding', eventDate: '2026-11-15' },
            client: { firstName: 'Alice', lastName: 'Smith' },
            status: 'PENDING',
            proposedPrice: 250000,
            currency: 'RWF',
            createdAt: '2026-10-01T10:00:00Z',
          },
          {
            id: 'b-2',
            event: { id: 'e-2', title: 'Corporate Gala', eventDate: '2026-12-05' },
            client: { name: 'Bob Jones' },
            status: 'ACCEPTED',
            proposedPrice: 500000,
            currency: 'RWF',
            createdAt: '2026-10-03T14:00:00Z',
          },
        ],
      });

      const bookings = await listBookings();
      expect(bookings).toHaveLength(2);
      // b-2 has newer createdAt, so it should be first
      expect(bookings[0].id).toBe('b-2');
      expect(bookings[0].clientName).toBe('Bob Jones');
      expect(bookings[0].eventTitle).toBe('Corporate Gala');

      expect(bookings[1].id).toBe('b-1');
      expect(bookings[1].clientName).toBe('Alice Smith');
      expect(bookings[1].proposedPrice).toBe(250000);
    });

    it('returns empty array if response data is missing', async () => {
      (api.get as jest.Mock).mockResolvedValueOnce({ action: 1, data: null });
      const bookings = await listBookings();
      expect(bookings).toEqual([]);
    });
  });

  describe('acceptBooking', () => {
    it('posts to accept endpoint and succeeds when action is 1', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({ action: 1, message: 'Booking accepted' });
      await expect(acceptBooking('b-123')).resolves.toBeUndefined();
      expect(api.post).toHaveBeenCalledWith('/bookings/b-123/accept');
    });

    it('throws ApiError when action is not 1', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({ action: 0, message: 'Booking already expired' });
      await expect(acceptBooking('b-123')).rejects.toMatchObject({
        status: 400,
        message: 'Booking already expired',
      });
    });
  });

  describe('rejectBooking', () => {
    it('posts reason to reject endpoint and succeeds when action is 1', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({ action: 1, message: 'Booking declined' });
      await expect(rejectBooking('b-123', 'Unavailable on this date')).resolves.toBeUndefined();
      expect(api.post).toHaveBeenCalledWith('/bookings/b-123/reject', {
        reason: 'Unavailable on this date',
      });
    });

    it('throws ApiError when rejection fails', async () => {
      (api.post as jest.Mock).mockResolvedValueOnce({ action: 0, message: 'Cannot decline' });
      await expect(rejectBooking('b-123', 'Reason')).rejects.toMatchObject({
        status: 400,
        message: 'Cannot decline',
      });
    });
  });
});
