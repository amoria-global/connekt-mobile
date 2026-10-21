import { listPublicEventsDetailed } from './api';

const mockGet = jest.fn();
jest.mock('@/api/client', () => ({
  api: { get: (...a: unknown[]) => mockGet(...a) },
  requireOk: (r: unknown) => jest.requireActual('@/api/client').requireOk(r),
}));

beforeEach(() => mockGet.mockReset());

describe('listPublicEventsDetailed', () => {
  it('a refused read (HTTP 200, action 0) is an error, not an empty page that Explore and search read as "no events"', async () => {
    mockGet.mockResolvedValue({ action: 0, message: 'Events are unavailable' });
    await expect(listPublicEventsDetailed({ search: 'wed' })).rejects.toMatchObject({ message: 'Events are unavailable' });
  });

  it('a successful empty page is an empty page', async () => {
    mockGet.mockResolvedValue({ action: 1, message: 'ok', data: { content: [], totalPages: 0, totalElements: 0 } });
    await expect(listPublicEventsDetailed({})).resolves.toMatchObject({ content: [], totalElements: 0 });
  });

  it('maps a populated page', async () => {
    mockGet.mockResolvedValue({ action: 1, data: { content: [{ id: 'e1', title: 'Wedding' }], totalPages: 1, totalElements: 1 } });
    const page = await listPublicEventsDetailed({});
    expect(page.content.map((e) => e.id)).toEqual(['e1']);
  });
});
