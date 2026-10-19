import type { EventItem } from '@/features/events/types';
import { countByFilter, eventStatus, filterEvents, isPastEvent, sortEvents, visibleSlice } from './clientEventsModel';

const ev = (o: Partial<EventItem>): EventItem => ({ id: 'e', title: 'Shoot', ...o }) as EventItem;
const today = '2026-10-10';

describe('past and upcoming', () => {
  it('compares local calendar days: today is not past, yesterday is', () => {
    expect(isPastEvent({ eventDate: '2026-10-10' }, today)).toBe(false);
    expect(isPastEvent({ eventDate: '2026-10-09' }, today)).toBe(true);
  });
  it('an event with no date is never past', () => {
    expect(isPastEvent({}, today)).toBe(false);
  });
});

describe('filtering and counts', () => {
  const list = [
    ev({ id: 'a', title: 'Wedding', eventDate: '2026-10-20', published: true, location: 'Kigali' }),
    ev({ id: 'b', title: 'Birthday', eventDate: '2026-09-01', photographerName: 'Eric' }),
    ev({ id: 'c', title: 'Undated', published: false }),
  ];
  it('upcoming keeps undated events, past does not', () => {
    expect(filterEvents(list, 'upcoming', '', today).map((e) => e.id)).toEqual(['a', 'c']);
    expect(filterEvents(list, 'past', '', today).map((e) => e.id)).toEqual(['b']);
  });
  it('published is only published', () => {
    expect(filterEvents(list, 'published', '', today).map((e) => e.id)).toEqual(['a']);
  });
  it('search matches title, location and photographer, ignoring case and padding', () => {
    expect(filterEvents(list, 'all', '  KIGALI ', today).map((e) => e.id)).toEqual(['a']);
    expect(filterEvents(list, 'all', 'eric', today).map((e) => e.id)).toEqual(['b']);
    expect(filterEvents(list, 'all', 'zzz', today)).toEqual([]);
  });
  it('counts add up to the whole list', () => {
    expect(countByFilter(list, today)).toEqual({ all: 3, upcoming: 2, published: 1, past: 1 });
  });
});

describe('sorting', () => {
  const list = [
    ev({ id: 'a', title: 'Bravo', createdAt: '2026-01-02T00:00:00Z', eventDate: '2026-12-01' }),
    ev({ id: 'b', title: 'Alpha', createdAt: '2026-03-02T00:00:00Z', eventDate: '2026-11-01' }),
    ev({ id: 'c', title: 'Charlie', eventDate: undefined }),
  ];
  it('orders by created, by date with undated last, and by title', () => {
    expect(sortEvents(list, 'newest').map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(sortEvents(list, 'date_asc').map((e) => e.id)).toEqual(['b', 'a', 'c']);
    expect(sortEvents(list, 'title_asc').map((e) => e.id)).toEqual(['b', 'a', 'c']);
  });
  it('does not mutate its input', () => {
    const copy = [...list];
    sortEvents(list, 'oldest');
    expect(list).toEqual(copy);
  });
});

describe('status words', () => {
  it('an unpublished direct booking says so rather than "upcoming"', () => {
    expect(eventStatus(ev({ published: false }))).toEqual({ label: 'Not published', tone: 'warning' });
  });
  it('a posted hybrid event with no photographer is matching, never published', () => {
    const s = eventStatus(ev({ bookingMode: 'HYBRID', status: 'MATCHING', published: true }));
    expect(s.label).not.toBe('Published');
    expect(s.tone).toBe('info');
  });
  it('terminal states keep their meaning', () => {
    expect(eventStatus(ev({ status: 'COMPLETED' })).label).toBe('Completed');
    expect(eventStatus(ev({ status: 'CANCELLED' })).tone).toBe('error');
    expect(eventStatus(ev({ status: 'ONGOING' })).tone).toBe('success');
  });
});

describe('show more', () => {
  it('reports whether rows remain', () => {
    expect(visibleSlice([1, 2, 3], 2)).toEqual({ rows: [1, 2], hasMore: true });
    expect(visibleSlice([1, 2], 2)).toEqual({ rows: [1, 2], hasMore: false });
  });
});
