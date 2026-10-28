import { bucketOf, hostedCaption } from './hostFlow';
import { publishActionFor, unpublishCopy } from './publishFlow';

const at = (iso: string) => Date.parse(iso);
const base = { eventDate: '2026-10-27', startTime: '18:00', endTime: '22:00', eventStatus: 'PUBLISHED' };

describe('publishActionFor', () => {
  it('offers Unpublish for a published upcoming event and Republish for an unpublished one', () => {
    expect(publishActionFor(true, 'UPCOMING')).toEqual({ kind: 'unpublish' });
    expect(publishActionFor(false, 'UPCOMING')).toEqual({ kind: 'republish' });
  });
  it('never unpublishes a live event: end the stream first', () => {
    expect(publishActionFor(true, 'LIVE')).toEqual({ kind: 'blocked', reason: 'End the stream first' });
    expect(publishActionFor(false, 'LIVE').kind).toBe('blocked');
  });
  it('offers an ended event the same two actions, and nothing when the server cannot', () => {
    expect(publishActionFor(true, 'ENDED')).toEqual({ kind: 'unpublish' });
    expect(publishActionFor(false, 'ENDED')).toEqual({ kind: 'republish' });
    expect(publishActionFor(true, 'ENDED', false)).toEqual({ kind: 'none' });
    expect(publishActionFor(false, 'ENDED', false)).toEqual({ kind: 'none' });
  });
});

describe('unpublishCopy', () => {
  it('says what is hidden and what is kept', () => {
    const c = unpublishCopy();
    expect(c.body).toContain('hidden from Explore');
    expect(c.body).toContain('public link will stop working');
    expect(c.body).toContain('photos, wishes and data are kept');
    expect(c.warning).toBeUndefined();
  });
  it('warns with the number of bookings and tickets', () => {
    expect(unpublishCopy({ bookings: 2, ticketsSold: 1 }).warning).toContain('2 bookings and 1 ticket sold');
    expect(unpublishCopy({ ticketsSold: 5 }).warning).toContain('5 tickets sold');
  });
});

describe('hosted tabs and the Home caption agree', () => {
  const ended = { ...base, streamStatus: 'ended' };
  const upcoming = { ...base, eventDate: '2099-01-01' };
  const live = { ...base, streamStatus: 'connected' };
  const now = at('2026-10-27T12:00:00+02:00');
  it('puts an event that ended today under ended, not upcoming', () => {
    expect(bucketOf(ended, now)).toBe('ended');
    expect(bucketOf(upcoming, now)).toBe('upcoming');
    expect(bucketOf(live, now)).toBe('live');
  });
  it('counts the same buckets', () => {
    expect(hostedCaption([ended, upcoming, live])).toMatch(/^1 upcoming · 1 live$/);
    expect(hostedCaption(undefined)).toBe('Upcoming, live and ended');
  });
});
