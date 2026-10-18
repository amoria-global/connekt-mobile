import { clientStats, kycLabel } from './clientStats';

describe('clientStats', () => {
  it('a missing count is a dash, a real zero stays a zero', () => {
    expect(clientStats({})).toEqual([
      { label: 'Events', value: '—' },
      { label: 'Reviews', value: '—' },
      { label: 'Identity', value: '—' },
    ]);
    expect(clientStats({ completedEvents: 0, reviewsCount: 0 })[0].value).toBe('0');
    expect(clientStats({ completedEvents: 4, reviewsCount: 2 }).map((s) => s.value).slice(0, 2)).toEqual(['4', '2']);
  });
  it('no user is all dashes, never "Active"', () => {
    const s = clientStats(null);
    expect(s.every((x) => x.value === '—')).toBe(true);
  });
});

describe('kycLabel', () => {
  it.each([
    ['APPROVED', 'Verified'],
    ['VERIFIED', 'Verified'],
    ['PENDING', 'In review'],
    ['UNDER_REVIEW', 'In review'],
    ['REJECTED', 'Needs attention'],
    ['NOT_VERIFIED', 'Not verified'],
    ['UNVERIFIED', 'Not verified'],
    ['', '—'],
    [undefined, '—'],
  ])('%s reads %s', (input, out) => {
    expect(kycLabel(input as string | undefined)).toBe(out);
  });
  it('an unknown word is shown plainly rather than guessed', () => {
    expect(kycLabel('SUSPENDED_FOR_AUDIT')).toBe('Suspended for audit');
  });
});
