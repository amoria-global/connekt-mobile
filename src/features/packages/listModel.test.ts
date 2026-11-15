import type { Package } from './api';
import { cardRows, cleanFeatureLabel, filterBySession, packagePrice, splitBySession, statParts, topTierIds } from './listModel';
import { tp } from '@/i18n/plural';
import { batch2En, batch2Es, batch2Fr } from '@/i18n/batch2';
import { batch2Rw } from '@/i18n/batch1_3_rw';
import { batch2Sw } from '@/i18n/batch1_3_sw';

const pkg = (over: Partial<Package>): Package => ({ id: 'p', name: 'Basic', price: 1000, currency: 'RWF', serviceType: 'OUTDOOR', ...over });

describe('My packages list model', () => {
  it('shows the package own stored currency and amount with the ISO code, never the display symbol', () => {
    expect(packagePrice(pkg({ price: 100000, currency: 'RWF' }))).toBe('RWF 100,000');
    expect(packagePrice(pkg({ price: 700, currency: 'USD' }))).toBe('USD 700');
    expect(packagePrice(pkg({ price: 60000, currency: 'RF' }))).toBe('RWF 60,000');
    expect(packagePrice(pkg({ price: undefined }))).toBeNull();
  });

  it('counts and filters by session type, highest price first', () => {
    const all = [
      pkg({ id: 'o1', price: 5, serviceType: 'OUTDOOR' }),
      pkg({ id: 'i1', price: 3, serviceType: 'STUDIO' }),
      pkg({ id: 'o2', price: 9, serviceType: 'OUTDOOR' }),
      pkg({ id: 'i2', price: 8, serviceType: 'STUDIO' }),
    ];
    const { indoor, outdoor } = splitBySession(all);
    expect([indoor.length, outdoor.length]).toEqual([2, 2]);
    expect(filterBySession(all, 'STUDIO').map((p) => p.id)).toEqual(['i2', 'i1']);
    expect(filterBySession(all, 'OUTDOOR').map((p) => p.id)).toEqual(['o2', 'o1']);
    expect(filterBySession(all, 'ALL').map((p) => p.id)).toEqual(['i2', 'i1', 'o2', 'o1']);
  });

  it('badges the top tier by price rank, not by name: a tie or a lone package gets none', () => {
    const ranked = [pkg({ id: 'a', name: 'Anything', price: 900 }), pkg({ id: 'b', name: 'Diamond', price: 100 })];
    expect([...topTierIds(ranked)]).toEqual(['a']);
    const tie = [pkg({ id: 'a', name: 'Diamond', price: 100000, serviceType: 'STUDIO' }), pkg({ id: 'b', name: 'Gold', price: 100000, serviceType: 'STUDIO' })];
    expect(topTierIds(tie).size).toBe(0);
    expect(topTierIds([pkg({ id: 'solo', name: 'Diamond' })]).size).toBe(0);
  });

  it('shows priced add-ons as priced rows and free-text features as plain rows, with policies left out', () => {
    const rows = cardRows(
      pkg({
        addons: [
          { key: 'extra_hour', name: 'Extra Hour Coverage', price: 25000, currencyCode: 'RWF', enabled: true },
          { key: 'off', name: 'Off', price: 0, enabled: false },
        ],
        features: [
          { featureName: 'Baby Shower Photos.............100K / Per Hour', isIncluded: true },
          { featureName: 'Hidden', isIncluded: false },
        ],
        deliveryPolicy: 'Delivery within 3 days',
        otherPolicies: ['50% deposit'],
      }),
    );
    expect(rows).toEqual([
      { key: 'addon-extra_hour', label: 'Extra Hour Coverage', price: 'RWF 25,000' },
      { key: 'feat-0', label: 'Baby Shower Photos 100K / Per Hour' },
    ]);
    expect(cleanFeatureLabel('Photos……100K')).toBe('Photos 100K');
  });

  it('lists only the stats a package has, so nothing prints a zero', () => {
    expect(statParts(pkg({ durationHours: 2, includedPhotos: 50, includedVideos: 1, deliveryDays: 3 }))).toEqual([
      { key: 'hours', count: 2 },
      { key: 'photos', count: 50 },
      { key: 'videos', count: 1 },
      { key: 'days', count: 3 },
    ]);
    expect(statParts(pkg({}))).toEqual([]);
  });
});

describe('plural forms for photos, videos and delivery days', () => {
  const dicts: Record<string, Record<string, string>> = {
    en: batch2En as never,
    fr: batch2Fr,
    es: batch2Es,
    rw: batch2Rw,
    sw: batch2Sw,
  };
  const say = (lang: string, base: string, n: number) => tp(((k: string, p?: Record<string, number>) => dicts[lang][k].replace('{count}', String(p?.count))) as never, base, n);

  it('reads "1 video", not "1 videos", in every language that distinguishes one from many', () => {
    expect(say('en', 'b2_pkgl_videos', 1)).toBe('1 video');
    expect(say('en', 'b2_pkgl_videos', 3)).toBe('3 videos');
    expect(say('en', 'b2_pkgl_photos', 1)).toBe('1 photo');
    expect(say('en', 'b2_pkgl_days', 1)).toBe('Delivery 1 day');
    expect(say('fr', 'b2_pkgl_videos', 1)).toBe('1 vidéo');
    expect(say('es', 'b2_pkgl_photos', 1)).toBe('1 foto');
    expect(say('rw', 'b2_pkgl_photos', 1)).toBe('ifoto 1');
    expect(say('rw', 'b2_pkgl_photos', 50)).toBe('amafoto 50');
    expect(say('sw', 'b2_pkgl_videos', 1)).toBe('video 1');
  });

  it('has a one and an other form for every plural key in every language', () => {
    for (const d of Object.values(dicts)) {
      for (const base of ['b2_pkgl_photos', 'b2_pkgl_videos', 'b2_pkgl_days', 'b2_pkgl_replaceBody']) {
        expect(typeof d[`${base}_one`]).toBe('string');
        expect(typeof d[`${base}_other`]).toBe('string');
      }
    }
  });
});
