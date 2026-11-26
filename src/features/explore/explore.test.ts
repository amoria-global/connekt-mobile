import { mapItem, type ExploreItem } from './api';
import { capabilities, chunk, clock, distribute } from './layout';

function item(id: string, aspectRatio: number): ExploreItem {
  return {
    id, albumId: 'a', mediaType: 'PHOTO', title: id, categoryLabel: null, creatorName: 'c', creatorLogo: null,
    thumbnailUrl: null, previewUrl: null, previewVideoUrl: null, durationSeconds: null, aspectRatio,
    priceAmount: 5, priceCurrency: 'USD', tags: [],
  };
}

describe('masonry layout', () => {
  it('puts each item in the shorter column, so a tall picture leaves no hole beside it', () => {
    const cols = distribute([item('tall', 0.5), item('wide1', 2), item('wide2', 2), item('wide3', 2)], 2, 100);
    expect(cols[0].map(i => i.id)).toEqual(['tall']);
    expect(cols[1].map(i => i.id)).toEqual(['wide1', 'wide2', 'wide3']);
  });

  it('keeps every item exactly once', () => {
    const items = Array.from({ length: 11 }, (_, i) => item(`i${i}`, 0.7 + (i % 4) * 0.3));
    const flat = distribute(items, 2, 160).flat().map(i => i.id).sort();
    expect(flat).toEqual(items.map(i => i.id).sort());
  });

  it('splits the feed into blocks of the asked size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});

describe('what a build may show', () => {
  it('store builds show no price, no buy and no licence, and use the browse-only subtitle', () => {
    const c = capabilities(false);
    expect(c).toMatchObject({ showPrices: false, canBuy: false, showLicence: false, subtitleKey: 'explore_subtitleStore' });
  });

  it('web builds may show prices and buy', () => {
    expect(capabilities(true)).toMatchObject({ showPrices: true, canBuy: true, subtitleKey: 'explore_subtitle' });
  });
});

describe('feed mapping', () => {
  it('clamps an extreme aspect ratio and reads the preview clip, never a full one', () => {
    const m = mapItem({
      id: 'x', mediaType: 'VIDEO', width: 100, height: 1000, title: 'T', creator: { name: 'C' },
      thumbnailUrl: 'https://e.test/p.jpg', previewVideoUrl: 'https://e.test/m3u8', price: { amount: 3, currency: 'USD' }, tags: ['a'],
    });
    expect(m.aspectRatio).toBe(0.5);
    expect(m.mediaType).toBe('VIDEO');
    expect(m.previewVideoUrl).toBe('https://e.test/m3u8');
    expect(Object.keys(m)).not.toContain('streamUid');
  });
});

describe('clock', () => {
  it('formats a duration as m:ss', () => {
    expect(clock(100)).toBe('1:40');
    expect(clock(30)).toBe('0:30');
    expect(clock(null)).toBe('');
  });
});

describe('store build wording', () => {
  // Strings a store-build viewer can see. None may name a price, a purchase action or somewhere else to buy:
  // naming the alternative is the steering the stores forbid. "I already bought this" only refers to the past.
  const { exploreEn } = require('@/i18n/explore') as { exploreEn: Record<string, string> };
  const visibleInStore = [
    'explore_title', 'explore_subtitleStore', 'explore_searchPlaceholder', 'explore_all', 'explore_photos', 'explore_clips',
    'explore_emptyTitle', 'explore_emptyBody', 'explore_errorTitle', 'explore_errorBody', 'explore_offlineTitle', 'explore_offlineBody',
    'explore_previewEnds', 'explore_save', 'explore_saved', 'explore_share', 'explore_alreadyBought', 'explore_codeHint',
    'explore_unlock', 'explore_codeInvalid', 'explore_recoverTitle', 'explore_recoverBody', 'explore_sendLink', 'explore_recoverSent',
    'explore_library', 'explore_libraryEmpty', 'explore_saveToPhone', 'explore_saved2', 'explore_sortNewest', 'explore_sortPopular',
  ];
  it.each(visibleInStore)('%s does not talk about buying, prices or other places', key => {
    const text = exploreEn[key];
    expect(text).toBeTruthy();
    expect(text).not.toMatch(/\b(buy|purchase|price|pay|paid|checkout|cart|website|connekyt\.com|online)\b/i);
  });
});
