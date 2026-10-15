import { isEventEnded, isEventLive, type PublicEvent } from '@/features/events/types';

const ev = (over: Partial<PublicEvent>): PublicEvent => ({ id: 'e1', title: 'Event', ...over }) as PublicEvent;

describe('isEventLive', () => {
  it('never calls a completed event live, even when its stream input still reports connected', () => {
    // Shape of the April rows the Ended tab showed as LIVE on 2026-10-10.
    const stale = ev({ eventStatus: 'COMPLETED', streamStatus: 'connected', hasLiveStream: true });
    expect(isEventLive(stale)).toBe(false);
    expect(isEventEnded(stale)).toBe(true);
  });

  it('never calls a cancelled event live', () => {
    expect(isEventLive(ev({ eventStatus: 'CANCELLED', streamStatus: 'live' }))).toBe(false);
    expect(isEventLive(ev({ eventStatus: 'CANCELED', streamStatus: 'live' }))).toBe(false);
  });

  it('keeps trusting a live stream on a PUBLISHED row (the backend lags the stream)', () => {
    expect(isEventLive(ev({ eventStatus: 'PUBLISHED', streamStatus: 'connected' }))).toBe(true);
  });

  it('keeps ONGOING events with a stream live, and ended streams not live', () => {
    expect(isEventLive(ev({ eventStatus: 'ONGOING', hasLiveStream: true }))).toBe(true);
    expect(isEventLive(ev({ eventStatus: 'ONGOING', streamStatus: 'ended', hasLiveStream: true }))).toBe(false);
  });
});
