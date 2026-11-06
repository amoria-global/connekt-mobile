import { getHybridProfile } from './api';
import { api } from '@/api/client';

jest.mock('@/api/client', () => ({ api: { get: jest.fn() }, assertOk: jest.fn() }));

describe('getHybridProfile pending Instagram change', () => {
  const envelope = (data: Record<string, unknown>) => ({ action: 1, data });

  it('keeps the live handle and surfaces the one waiting for admin approval', async () => {
    (api.get as jest.Mock).mockResolvedValue(
      envelope({ instagramHandle: 'joseph.maranatha', instagramStatus: 'CONNECTED', pendingInstagramHandle: '__j.a.x.o.n' }),
    );
    const p = await getHybridProfile();
    expect(p.instagramHandle).toBe('joseph.maranatha');
    expect(p.pendingInstagramHandle).toBe('__j.a.x.o.n');
  });

  it('has no pending handle when the server sends none', async () => {
    (api.get as jest.Mock).mockResolvedValue(
      envelope({ instagramHandle: 'joseph.maranatha', instagramStatus: 'CONNECTED', pendingInstagramHandle: null }),
    );
    expect((await getHybridProfile()).pendingInstagramHandle).toBeUndefined();
  });
});
