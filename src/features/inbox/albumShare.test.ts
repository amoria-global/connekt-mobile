import {
  albumSharePreview,
  badgeFor,
  buildTimeline,
  dayLabel,
  filterAlbums,
  mapShareable,
  toggleSelection,
  type ShareableAlbum,
} from './albumShare';

const same = (u?: string | null) => u ?? undefined;
const words = { today: 'Today', yesterday: 'Yesterday' };

function album(over: Partial<ShareableAlbum> = {}): ShareableAlbum {
  return { id: 'a1', title: 'Wedding', photoCount: 10, badge: 'FREE', tab: 'project', ...over };
}

describe('mapShareable', () => {
  it('maps the badge from price and access code, never the internal type', () => {
    expect(badgeFor({ pricePerImage: 5000 })).toBe('PAID');
    expect(badgeFor({ freeAlbum: true, pricePerImage: 0 })).toBe('PRIVATE');
    expect(badgeFor({ pricePerImage: 0 })).toBe('FREE');
    expect(badgeFor({})).toBe('FREE');
  });

  it('splits project and personal by event', () => {
    expect(mapShareable({ id: 'x', title: 'A', imageCount: 3, eventId: 'e1' }, same)?.tab).toBe('project');
    expect(mapShareable({ id: 'x', title: 'A', imageCount: 3 }, same)?.tab).toBe('personal');
  });

  it('disables archived and empty albums with a reason, archived first', () => {
    expect(mapShareable({ id: 'x', imageCount: 3, isLocked: true }, same)?.disabledReason).toBe('archived');
    expect(mapShareable({ id: 'x', imageCount: 0 }, same)?.disabledReason).toBe('empty');
    expect(mapShareable({ id: 'x', imageCount: 0, isLocked: true }, same)?.disabledReason).toBe('archived');
    expect(mapShareable({ id: 'x', imageCount: 4 }, same)?.disabledReason).toBeUndefined();
  });

  it('leaves content-library albums and id-less rows out', () => {
    expect(mapShareable({ id: 'x', imageCount: 3, contentApprovalStatus: 'APPROVED' }, same)).toBeNull();
    expect(mapShareable({ imageCount: 3 }, same)).toBeNull();
  });
});

describe('filterAlbums', () => {
  const list = [album({ id: '1', title: 'Kigali Gala' }), album({ id: '2', title: 'Gala 2', tab: 'personal' })];
  it('filters by tab and a case-insensitive search', () => {
    expect(filterAlbums(list, 'project', '').map((a) => a.id)).toEqual(['1']);
    expect(filterAlbums(list, 'personal', 'GALA').map((a) => a.id)).toEqual(['2']);
    expect(filterAlbums(list, 'project', 'zzz')).toEqual([]);
  });
});

describe('toggleSelection', () => {
  it('adds, removes, and stops at five', () => {
    let sel: string[] = [];
    for (const id of ['1', '2', '3', '4', '5']) sel = toggleSelection(sel, album({ id })).next;
    expect(sel).toHaveLength(5);
    const over = toggleSelection(sel, album({ id: '6' }));
    expect(over.next).toHaveLength(5);
    expect(over.limited).toBe(true);
    expect(toggleSelection(sel, album({ id: '3' })).next).not.toContain('3');
  });
  it('never selects a disabled album', () => {
    const r = toggleSelection([], album({ disabledReason: 'archived' }));
    expect(r.next).toEqual([]);
    expect(r.limited).toBe(false);
  });
});

describe('date separators', () => {
  const now = new Date(2026, 10, 10, 12, 0);
  it('labels today, yesterday, then a short date', () => {
    expect(dayLabel(new Date(2026, 10, 10, 1), now, words, 'en-GB')).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 9, 23), now, words, 'en-GB')).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 10, 3, 9), now, words, 'en-GB')).toBe('Tue 3 Nov');
  });
  it('puts one separator before the first message of each day', () => {
    const msgs = [
      { id: 1, timestamp: new Date(2026, 10, 9, 10).toISOString() },
      { id: 2, timestamp: new Date(2026, 10, 9, 11).toISOString() },
      { id: 3, timestamp: new Date(2026, 10, 10, 8).toISOString() },
    ];
    const kinds = buildTimeline(msgs, now, words, 'en-GB').map((i) => (i.kind === 'date' ? i.label : 'm'));
    expect(kinds).toEqual(['Yesterday', 'm', 'm', 'Today', 'm']);
  });
  it('a message with no timestamp gets no separator and breaks nothing', () => {
    const items = buildTimeline([{ id: 1 }, { id: 2, timestamp: new Date(2026, 10, 10).toISOString() }], now, words);
    expect(items.map((i) => i.kind)).toEqual(['message', 'date', 'message']);
  });
});

describe('albumSharePreview', () => {
  const fmt = { one: (t: string) => `📷 Shared an album: ${t}`, many: (n: number) => `📷 Shared ${n} albums` };
  it('reads the title from the fallback text', () => {
    expect(albumSharePreview('album_share', 'Shared an album: Kigali Gala (https://connekyt.com/x)', fmt)).toBe(
      '📷 Shared an album: Kigali Gala',
    );
    expect(albumSharePreview('album_share', 'Shared 2 albums: A (https://c/x), B (https://c/y)', fmt)).toBe(
      '📷 Shared 2 albums',
    );
  });
  it('ignores every other message', () => {
    expect(albumSharePreview('text', 'Shared an album: x', fmt)).toBeUndefined();
    expect(albumSharePreview(undefined, undefined, fmt)).toBeUndefined();
  });
});
