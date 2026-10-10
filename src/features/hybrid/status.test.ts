import { readFileSync } from 'fs';
import path from 'path';
import { isMatchBooked, opportunityFilterFor } from '@/features/hybrid/status';

const src = (p: string) => readFileSync(path.join(__dirname, '../../..', p), 'utf8');

describe('opportunityFilterFor', () => {
  it('opens a notified opportunity on the filter that lists it', () => {
    expect(opportunityFilterFor('INVITED')).toBe('PENDING_RESPONSE');
    expect(opportunityFilterFor('APPROVED')).toBe('APPROVED');
    for (const s of ['SELECTED', 'NOT_SELECTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN', 'NO_LONGER_AVAILABLE']) {
      expect(opportunityFilterFor(s)).toBe('ALL');
    }
  });
});

describe('isMatchBooked', () => {
  it('reads a chosen photographer as booked, not as matching that ended', () => {
    expect(isMatchBooked({ status: 'BOOKED', matchStatus: 'COMPLETED' })).toBe(true);
    expect(isMatchBooked({ status: 'UPCOMING', matchStatus: 'COMPLETED' })).toBe(true);
    expect(isMatchBooked({ status: 'HYBRID_TIMEOUT', matchStatus: 'EXPIRED' })).toBe(false);
    expect(isMatchBooked({ status: 'MATCHING_FAILED', matchStatus: 'FAILED' })).toBe(false);
    expect(isMatchBooked(null)).toBe(false);
  });
});

describe('screens use the shared rules', () => {
  it('the answers screen shows a booked event as booked and can reopen the first payment', () => {
    const screen = src('src/app/(app)/event/candidates.tsx');
    expect(screen).toContain('isMatchBooked(data)');
    expect(screen).toContain('setCheckoutOpen(true)');
  });

  it('a notified opportunity opens the filter that lists it', () => {
    expect(src('src/app/(app)/bookings.tsx')).toContain('setOppFilter(opportunityFilterFor(o.status))');
  });

  it('the call alert sends "View Opportunities" to the opportunities tab', () => {
    expect(src('src/features/hybrid/GlobalOpportunityCallNotifier.tsx')).toContain("'/bookings?tab=opportunities'");
  });
});
