import { albumDateText, albumSubtitle, featuredAlbum, photoCountText } from './albumFacts';

describe('album facts', () => {
  it('formats a date or timestamp, and drops anything it cannot read', () => {
    expect(albumDateText('2026-09-30')).toBe('30 Sep 2026');
    expect(albumDateText('2026-01-05T08:00:00')).toBe('5 Jan 2026');
    expect(albumDateText('yesterday')).toBeUndefined();
    expect(albumDateText('2026-13-01')).toBeUndefined();
    expect(albumDateText('')).toBeUndefined();
    expect(albumDateText(undefined)).toBeUndefined();
  });

  it('counts photos with the right plural and says nothing when the API gave no count', () => {
    expect(photoCountText(0)).toBe('0 photos');
    expect(photoCountText(1)).toBe('1 photo');
    expect(photoCountText(240)).toBe('240 photos');
    expect(photoCountText(undefined)).toBeUndefined();
    expect(photoCountText(null)).toBeUndefined();
    expect(photoCountText(NaN)).toBeUndefined();
    expect(photoCountText(30, 'page')).toBe('30 pages');
  });

  it('builds the subtitle from the photographer and date it actually has', () => {
    expect(albumSubtitle({ photographer: 'Jean', date: '2026-09-30' }, true)).toBe('30 Sep 2026 · Jean');
    expect(albumSubtitle({ photographer: 'Jean', date: '2026-09-30' }, false)).toBe('30 Sep 2026');
    expect(albumSubtitle({ receivedDate: '2026-10-02' }, true)).toBe('2 Oct 2026');
    expect(albumSubtitle({ photographer: 'Jean' }, true)).toBe('Jean');
    expect(albumSubtitle({}, true)).toBeUndefined();
  });

  it('features the first unlocked album with a cover, in the order the API gave', () => {
    const list = [{ id: 'a', locked: true, coverPhoto: 'x' }, { id: 'b' }, { id: 'c', coverPhoto: 'y' }, { id: 'd', coverPhoto: 'z' }];
    expect(featuredAlbum(list)?.id).toBe('c');
    const bare = [{ id: 'e', locked: true }];
    expect(featuredAlbum(bare)).toBeUndefined();
  });
});
