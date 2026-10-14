import { dismissPhotographerEvent, listPhotographerEvents } from './api';

const mockGetOk = jest.fn();
const mockPost = jest.fn();
jest.mock('@/api/client', () => ({
  api: {
    getOk: async (...a: unknown[]) => jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)),
    post: (...a: unknown[]) => mockPost(...a),
    get: (...a: unknown[]) => mockGetOk(...a),
  },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));

beforeEach(() => {
  mockGetOk.mockReset();
  mockPost.mockReset();
});

describe('photographer events API', () => {
  it('reports a refused list (HTTP 200, action 0) as an error, not as "no events"', async () => {
    mockGetOk.mockResolvedValue({ action: 0, message: 'Session expired' });
    await expect(listPhotographerEvents()).rejects.toMatchObject({ message: 'Session expired' });
  });

  it('dismisses through the web endpoint', async () => {
    mockPost.mockResolvedValueOnce({ action: 1 });
    await dismissPhotographerEvent('e 1');
    expect(mockPost).toHaveBeenCalledWith('/photographer/events/e%201/dismiss');
  });

  it('surfaces a refused dismissal instead of pretending the event is gone', async () => {
    mockPost.mockResolvedValueOnce({ action: 0, message: 'You are not authorized to dismiss this event' });
    await expect(dismissPhotographerEvent('e1')).rejects.toMatchObject({ message: 'You are not authorized to dismiss this event' });
  });
});
