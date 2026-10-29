import { msToCountdown } from './EventCountdown';

describe('msToCountdown', () => {
  it('splits a span into days, hours, minutes and seconds', () => {
    expect(msToCountdown(((31 * 24 + 12) * 3600 + 55 * 60 + 7) * 1000)).toEqual({ days: 31, hours: 12, minutes: 55, seconds: 7 });
  });
  it('never goes negative', () => {
    expect(msToCountdown(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});
