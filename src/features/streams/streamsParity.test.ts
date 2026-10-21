import { eventTypesOf, filterByType, messageTotal, searchStreams, streamTotals, unviewedCount, videoTotal } from './streamsModel';
import { mapStream, streamImageUrl } from './api';
import type { Stream } from './api';

const s = (o: Partial<Stream> & { id: string }): Stream => ({
  title: 'Untitled',
  isLive: false,
  phase: 'ended',
  ...o,
});

describe('search and type filter (web streams.tsx)', () => {
  const list = [
    s({ id: '1', title: 'Yubire Wedding', eventType: 'Wedding' }),
    s({ id: '2', title: 'Amina Party', eventType: 'Birthday' }),
    s({ id: '3', title: 'Launch', eventType: undefined }),
  ];
  it('matches the title or the event type, ignoring case and surrounding space', () => {
    expect(searchStreams(list, ' WEDD ').map((x) => x.id)).toEqual(['1']);
    expect(searchStreams(list, 'birth').map((x) => x.id)).toEqual(['2']);
    expect(searchStreams(list, '').length).toBe(3);
    expect(searchStreams(list, 'zzz')).toEqual([]);
  });
  it('filters by an exact type, and all keeps everything', () => {
    expect(filterByType(list, 'wedding').map((x) => x.id)).toEqual(['1']);
    expect(filterByType(list, 'all').length).toBe(3);
  });
  it('builds its chips from the types present, so no category is hidden (the web hard-codes four)', () => {
    expect(eventTypesOf([...list, s({ id: '4', eventType: 'Concert' }), s({ id: '5', eventType: 'wedding' })])).toEqual(['Birthday', 'Concert', 'Wedding']);
  });
});

describe('totals', () => {
  it('trusts a feed total only when it is above zero, else the chat history (web: totalMessages || messages.length)', () => {
    expect(messageTotal(s({ id: '1', messageCount: 12 }), { messages: 3, videos: 0 })).toBe(12);
    expect(messageTotal(s({ id: '1', messageCount: 0 }), { messages: 3, videos: 0 })).toBe(3);
    expect(videoTotal(s({ id: '1', videoCount: 0 }), { messages: 0, videos: 2 })).toBe(2);
    expect(messageTotal(s({ id: '1' }), undefined)).toBeUndefined();
  });
  it('does not show a partial sum as a total while histories are still loading', () => {
    const list = [s({ id: '1', viewerCount: 5 }), s({ id: '2', viewerCount: 7 })];
    expect(streamTotals(list, { '1': { messages: 2, videos: 1 } })).toMatchObject({ streams: 2, viewers: 12, messages: undefined, videos: undefined });
    expect(streamTotals(list, { '1': { messages: 2, videos: 1 }, '2': { messages: 0, videos: 0 } })).toMatchObject({ messages: 2, videos: 1 });
  });
  it('counts unopened videos', () => {
    expect(unviewedCount(['a', 'b', 'c'], new Set(['b']))).toBe(2);
  });
});

describe('image urls (the client feed points covers at a folder that does not hold them)', () => {
  it('rewrites /event/media/ to /event/photos/, as the web does', () => {
    expect(streamImageUrl('https://backend.connekyt.com/uploads/event/media/a.jpg')).toBe('https://backend.connekyt.com/uploads/event/photos/a.jpg');
  });
  it('reads a bare file name as a profile photo and drops null', () => {
    expect(streamImageUrl('me.jpg')).toMatch(/\/uploads\/profile\/photos\/me\.jpg$/);
    expect(streamImageUrl('null')).toBeUndefined();
    expect(streamImageUrl(undefined)).toBeUndefined();
  });
  it('mapStream carries the fixed cover and the photographer picture from a client feed row', () => {
    const m = mapStream({
      id: 'st1', eventId: 'ev1', streamTitle: 'Gala', coverImage: 'https://backend.connekyt.com/uploads/event/media/c.jpg',
      photographerImage: 'https://backend.connekyt.com/uploads/profile/photos/p.jpg', totalVideoMessages: 0, totalMessages: 4,
    });
    expect(m.thumbnail).toBe('https://backend.connekyt.com/uploads/event/photos/c.jpg');
    expect(m.photographerImage).toContain('/p.jpg');
    expect(m.videoCount).toBe(0);
    expect(m.messageCount).toBe(4);
  });
});
