import { api } from '@/api/client';
import {
  applyPackageTierNamingPolicy,
  bulkPublishPackages,
  draftsMissingPrice,
  extractPackagesWithAi,
  positivePrice,
  type CreatePackageInput,
  type Package,
} from './api';

const input = (name: string, price: number): CreatePackageInput => ({
  packageName: name,
  price,
  currencyId: 'curr-rwf',
  currencyCode: 'RWF',
  serviceType: 'STUDIO',
});
const existing: Package[] = [
  { id: 'old-1', name: 'Diamond', price: 1000, currency: 'RWF', serviceType: 'STUDIO' },
  { id: 'old-2', name: 'Gold', price: 900, currency: 'RWF', serviceType: 'STUDIO' },
];

afterEach(() => jest.restoreAllMocks());

describe('a brochure package with no price stays unpriced', () => {
  it('positivePrice accepts only a finite number above zero', () => {
    expect(positivePrice(150000)).toBe(150000);
    for (const bad of [0, -5, NaN, Infinity, undefined, null]) expect(positivePrice(bad as never)).toBeNull();
  });

  it('server extraction without a price gives null, never 100,000, and the draft is flagged as missing a price', async () => {
    jest.spyOn(api, 'get').mockResolvedValue({ action: 1, data: [] });
    jest.spyOn(api, 'post').mockResolvedValue({
      action: 1,
      data: {
        extractedPackages: [
          { packageName: 'Studio Portrait', serviceType: 'STUDIO', price: 150000, ingredients: ['50 photos'] },
          { packageName: 'Wedding Day', serviceType: 'OUTDOOR', ingredients: ['Full day'] },
          { packageName: 'Mini Shoot', serviceType: 'STUDIO', price: 0, ingredients: ['10 photos'] },
        ],
      },
    });
    const res = await extractPackagesWithAi({ rawText: 'Studio Portrait 150,000 RWF, Wedding Day, Mini Shoot' });
    const prices = res.extractedPackages.map((p) => p.price);
    expect(prices).not.toContain(100000);
    expect(prices.filter((p) => p === null)).toHaveLength(2);
    expect(draftsMissingPrice(res.extractedPackages)).toHaveLength(2);
  });

  it('an unpriced draft ranks last for tier naming and does not break it', () => {
    type Item = { packageName: string; originalTitle?: string; serviceType: 'STUDIO'; price: number | null };
    const items: Item[] = [
      { packageName: 'A', serviceType: 'STUDIO', price: null },
      { packageName: 'B', serviceType: 'STUDIO', price: 200000 },
      { packageName: 'C', serviceType: 'STUDIO', price: 100000 },
    ];
    const named = applyPackageTierNamingPolicy(items);
    expect(named.map((n) => [n.originalTitle, n.packageName])).toEqual([
      ['B', 'Diamond'],
      ['C', 'Gold'],
      ['A', 'Silver'],
    ]);
  });

  it('draftsMissingPrice is empty once every draft has a price', () => {
    expect(draftsMissingPrice([{ price: 1 }, { price: 250000 }])).toEqual([]);
    expect(draftsMissingPrice([{ price: 1 }, { price: null }, {}])).toHaveLength(2);
  });
});

describe('bulkPublishPackages only falls back on a 404', () => {
  const base = { mode: 'REPLACE_ALL' as const, packages: [input('Diamond', 200000), input('Gold', 100000)], existingPackages: existing };

  it('a server error stops everything: no deletes, no single creates, the error reaches the caller', async () => {
    const post = jest.spyOn(api, 'post').mockRejectedValue({ status: 500, message: 'Server error' });
    const del = jest.spyOn(api, 'delete');
    await expect(bulkPublishPackages(base)).rejects.toMatchObject({ status: 500 });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/photographer/packages/bulk-publish', expect.anything());
    expect(del).not.toHaveBeenCalled();
  });

  it('a network failure also stops with nothing changed', async () => {
    const post = jest.spyOn(api, 'post').mockRejectedValue({ status: 0, message: 'Network request failed' });
    const del = jest.spyOn(api, 'delete');
    await expect(bulkPublishPackages(base)).rejects.toMatchObject({ status: 0 });
    expect(post).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });

  it('HTTP 200 with action 0 is a refusal, not a reason to replay by hand', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({ action: 0, message: 'Delivery policy is required.' });
    const del = jest.spyOn(api, 'delete');
    await expect(bulkPublishPackages(base)).rejects.toMatchObject({ message: 'Delivery policy is required.' });
    expect(post).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });

  it('a successful bulk call returns the saved packages and does nothing else', async () => {
    const post = jest.spyOn(api, 'post').mockResolvedValue({
      action: 1,
      data: [{ id: 'n1', packageName: 'Diamond', price: 200000, currencyAbbreviation: 'RWF', serviceType: 'STUDIO' }],
    });
    const del = jest.spyOn(api, 'delete');
    const saved = await bulkPublishPackages(base);
    expect(saved.map((p) => p.id)).toEqual(['n1']);
    expect(post).toHaveBeenCalledTimes(1);
    expect(del).not.toHaveBeenCalled();
  });

  it('a 404 (a host without /bulk-publish) still falls back to delete then create', async () => {
    const post = jest.spyOn(api, 'post').mockImplementation(async (path: string) => {
      if (String(path).endsWith('/bulk-publish')) throw { status: 404, message: 'Not found' };
      return { action: 1, data: { id: `new-${Math.random()}`, packageName: 'x', price: 1, currencyAbbreviation: 'RWF' } };
    });
    const del = jest.spyOn(api, 'delete').mockResolvedValue({ action: 1 });
    const saved = await bulkPublishPackages(base);
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith('/photographer/packages/old-1');
    expect(del).toHaveBeenCalledWith('/photographer/packages/old-2');
    expect(post).toHaveBeenCalledTimes(3); // the bulk try, then one create per package
    expect(saved).toHaveLength(2);
  });
});
