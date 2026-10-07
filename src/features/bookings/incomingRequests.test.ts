import type { EventItem } from '@/features/events/types';
import { onShowIncomingRequest, pendingRequests, showIncomingRequest } from './incomingRequests';

const ev = (id: string, over: Partial<EventItem> = {}): EventItem => ({
  id,
  title: id,
  bookingStatus: 'PENDING',
  eventDate: '2026-11-01',
  createdAt: '2026-10-01T10:00:00Z',
  ...over,
});

describe('pending booking requests', () => {
  const today = '2026-10-07';

  it('keeps only pending, upcoming, not-dismissed requests, newest first', () => {
    const list = pendingRequests(
      [
        ev('old', { createdAt: '2026-10-01T09:00:00Z' }),
        ev('new', { createdAt: '2026-10-07T09:00:00Z' }),
        ev('accepted', { bookingStatus: 'ACCEPTED' }),
        ev('past', { eventDate: '2026-10-01' }),
        ev('later'),
      ],
      today,
      new Set(['later']),
    );
    expect(list.map((e) => e.id)).toEqual(['new', 'old']);
  });

  it('keeps a request with no date', () => {
    expect(pendingRequests([ev('x', { eventDate: undefined })], today, new Set())).toHaveLength(1);
  });
});

describe('showIncomingRequest', () => {
  it('waits for the screen when nothing is listening yet, then delivers once', () => {
    showIncomingRequest('e1');
    const got: string[] = [];
    const off = onShowIncomingRequest((id) => got.push(id));
    showIncomingRequest('e2');
    off();
    expect(got).toEqual(['e1', 'e2']);
  });
});
