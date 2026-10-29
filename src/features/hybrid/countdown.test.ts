import { timeLeft } from './countdown';

const NOW = Date.parse('2026-10-29T10:00:00Z');
const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();

describe('timeLeft', () => {
  it('reads Days:Hours:Minutes:Seconds with every part two digits', () => {
    const left = timeLeft(at(((1 * 24 + 12) * 3600 + 55 * 60 + 7) * 1000), NOW);
    expect(left).toMatchObject({ done: false, days: 1, hours: 12, minutes: 55, seconds: 7, label: '01:12:55:07' });
  });

  it('shows the two hour offer window as 00:02:00:00 and counts down from there', () => {
    expect(timeLeft(at(2 * 3600 * 1000), NOW)?.label).toBe('00:02:00:00');
    expect(timeLeft(at(2 * 3600 * 1000), NOW + 1000)?.label).toBe('00:01:59:59');
    expect(timeLeft(at(47 * 1000), NOW)?.label).toBe('00:00:00:47');
  });

  it('is done at and after the deadline, and never shows a negative time', () => {
    expect(timeLeft(at(0), NOW)).toMatchObject({ done: true, ms: 0, label: '00:00:00:00' });
    expect(timeLeft(at(-5000), NOW)).toMatchObject({ done: true, label: '00:00:00:00' });
  });

  it('is null when there is no usable deadline', () => {
    expect(timeLeft(undefined, NOW)).toBeNull();
    expect(timeLeft(null, NOW)).toBeNull();
    expect(timeLeft('', NOW)).toBeNull();
    expect(timeLeft('not a date', NOW)).toBeNull();
  });

  it('accepts a timestamp or a Date as well as an ISO string', () => {
    expect(timeLeft(NOW + 90_000, NOW)?.label).toBe('00:00:01:30');
    expect(timeLeft(new Date(NOW + 90_000), NOW)?.label).toBe('00:00:01:30');
  });
});
