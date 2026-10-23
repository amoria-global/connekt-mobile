import { bookingTrack, progressView } from './bookingTrack';

const states = (e: Parameters<typeof bookingTrack>[0]) => bookingTrack(e)?.map((s) => `${s.label}:${s.state}`);

describe('bookingTrack', () => {
  it('a new request is only Requested, with Accepted next', () => {
    expect(states({ status: 'PENDING', bookingStatus: 'PENDING' })).toEqual(['Requested:done', 'Accepted:current', 'Event day:todo', 'Completed:todo']);
  });
  it('an accepted booking is Accepted and waits for the event day', () => {
    expect(states({ bookingStatus: 'ACCEPTED', status: 'PUBLISHED' })).toEqual(['Requested:done', 'Accepted:done', 'Event day:current', 'Completed:todo']);
  });
  it('an ongoing event is on its event day and never claims a deposit or an album', () => {
    const t = bookingTrack({ status: 'ONGOING' })!;
    expect(t.map((s) => s.label)).toEqual(['Requested', 'Accepted', 'Event day', 'Completed']);
    expect(t.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current']);
  });
  it('only a completed event is Completed', () => {
    expect(states({ status: 'COMPLETED' })!.every((x) => x.endsWith(':done'))).toBe(true);
    expect(states({ status: 'AWAITING_REVIEW' })![3]).toBe('Completed:current');
  });
  it('cancelled and declined bookings have no track', () => {
    expect(bookingTrack({ status: 'CANCELLED' })).toBeNull();
    expect(bookingTrack({ bookingStatus: 'DECLINED' })).toBeNull();
    expect(bookingTrack(undefined)).toBeNull();
  });
});

describe('progressView', () => {
  const live = { status: 'PUBLISHED', bookingStatus: 'ACCEPTED' };
  it('gives clients and coordinators exactly one progress view: the labelled track', () => {
    expect(progressView(live, false, true)).toBe('track');
  });
  it('gives photographers the plain stepper', () => {
    expect(progressView(live, true, false)).toBe('stepper');
  });
  it('falls back to the stepper for an owner when there is no track, and shows nothing for a cancelled booking', () => {
    expect(progressView(null, false, true)).toBe('stepper');
    expect(progressView({ status: 'CANCELLED' }, false, true)).toBe('none');
    expect(progressView({ status: 'CANCELLED' }, true, false)).toBe('none');
  });
  it('shows nothing to a viewer', () => {
    expect(progressView(live, false, false)).toBe('none');
  });
});
