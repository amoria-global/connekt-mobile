import { clientStats, coordinatorStats, kycLabel, photographerStats } from './clientStats';

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

describe('coordinatorStats', () => {
  it('shows a dash for a missing count or rating, never 0, 5.0 or a fixed "Active"', () => {
    const s = coordinatorStats({});
    expect(s).toEqual([
      { label: 'Events', value: '—' },
      { label: 'Rating', value: '—' },
      { label: 'Identity', value: '—' },
    ]);
    expect(JSON.stringify(coordinatorStats(null))).not.toMatch(/Active|5\.0/);
  });

  it('shows the figures the account really has', () => {
    const s = coordinatorStats({ completedEvents: 12, rating: 4.26, kycStatus: 'APPROVED' });
    expect(s).toEqual([
      { label: 'Events', value: '12' },
      { label: 'Rating', value: '4.3' },
      { label: 'Identity', value: 'Verified' },
    ]);
  });

  it('keeps a real zero as 0', () => {
    expect(coordinatorStats({ completedEvents: 0 })[0].value).toBe('0');
  });
});

describe('photographerStats', () => {
  it('has no default 5.0, no zero counts and no invented acceptance for an account with no figures', () => {
    expect(photographerStats({})).toEqual([
      { label: 'Jobs', value: '—' },
      { label: 'Reviews', value: '—' },
      { label: 'Rating', value: '—' },
      { label: 'Acceptance', value: '—' },
    ]);
  });
  it('shows real figures and keeps a real zero', () => {
    const s = photographerStats({ completedEvents: 0, reviewsCount: 8, rating: 4.26, acceptanceRate: 90 });
    expect(s.map((x) => x.value)).toEqual(['0', '8', '4.3', '90%']);
  });
  it('a rating of 0 with no reviews behind it is not shown as a rating', () => {
    expect(photographerStats({ rating: 0, reviewsCount: 0 })[2].value).toBe('—');
  });
});
