/**
 * The backend answers a failed read with HTTP 200 and action 0. Read as data, that was an empty inbox, an empty
 * notification list and an empty album shelf, so a failure told people nothing had arrived. These loaders now throw
 * on a refusal, and still accept the raw arrays some endpoints return without an envelope.
 */
const mockGet = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return { ...actual, api: { get: (...a: unknown[]) => mockGet(...a), getOk: async (...a: unknown[]) => actual.requireOk(await mockGet(...a)), post: jest.fn() } };
});
jest.mock('@/store/auth', () => ({ useAuth: { getState: () => ({ user: { customerId: 'me' } }) }, isApiError: () => true }));

import { listConversations, listMessages } from '@/features/inbox/api';
import { listNotifications } from '@/features/notifications/api';
import { listGalleries } from '@/features/gallery/api';

const refused = { action: 0, message: 'Service unavailable' };

beforeEach(() => mockGet.mockReset());

describe.each([
  ['listConversations', () => listConversations()],
  ['listMessages', () => listMessages('ph1')],
  ['listNotifications', () => listNotifications('Client')],
  ['listGalleries', () => listGalleries('Client')],
])('%s', (_name, load) => {
  it('throws the server message on a refused response instead of returning an empty list', async () => {
    mockGet.mockResolvedValue(refused);
    await expect(load()).rejects.toMatchObject({ message: 'Service unavailable' });
  });

  it('accepts a successful empty list', async () => {
    mockGet.mockResolvedValue({ action: 1, data: [] });
    await expect(load()).resolves.toEqual([]);
  });
});

describe('raw arrays without an envelope still load', () => {
  it('listMessages reads a bare array', async () => {
    mockGet.mockResolvedValue([{ id: 'm1', content: 'Hi', senderId: 'ph1', createdAt: '2026-10-18T09:00:00' }]);
    const msgs = await listMessages('ph1');
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('Hi');
  });
});
