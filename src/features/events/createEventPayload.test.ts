import { createEvent } from './api';

const mockPost = jest.fn();
jest.mock('@/api/client', () => ({
  api: { post: (...a: unknown[]) => mockPost(...a) },
}));

const CUR = '3f2b6c1e-8a4d-4c1b-9d57-0a1b2c3d4e5f';
const base = { title: 'Gala', category: 'Entertainment', eventDate: '2026-12-01', startTime: '18:00', attendanceMode: 'STREAM_ONLY' as const };

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ action: 1, data: { id: 'e1', title: 'Gala' } });
});

describe('self-streamed event payload', () => {
  it('sends the chosen stream fee currency so the server charges in it', async () => {
    await createEvent({ ...base, eventVisibility: 'PRIVATE', streamFee: 500, streamFeeCurrencyId: CUR, currency: 'USD' });
    expect(mockPost.mock.calls[0][0]).toBe('/customer/events/book');
    expect(mockPost.mock.calls[0][1]).toMatchObject({ streamFee: 500, streamFeeCurrencyId: CUR });
  });

  it('leaves the currency id out when it is not a real id, so the server default applies', async () => {
    await createEvent({ ...base, streamFee: 500, streamFeeCurrencyId: 'cur-rwf' }, true);
    expect(mockPost.mock.calls[0][0]).toBe('/coordinator/events/book');
    expect(mockPost.mock.calls[0][1]).not.toHaveProperty('streamFeeCurrencyId');
  });
});
