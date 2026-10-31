import {
  normalizeNotificationLink,
  notificationTarget,
  resetNavigationDedup,
  shouldNavigateToTarget,
} from './routing';

describe('Incoming offer & deep-link notification routing', () => {
  beforeEach(() => {
    resetNavigationDedup();
  });

  it('opens the exact opportunity from its relative link', () => {
    expect(notificationTarget({ type: 'OPPORTUNITY', link: '/opportunities/abc-123' })).toBe(
      '/bookings?tab=opportunities&candidate=abc-123',
    );
  });

  it('opens the exact opportunity from /offers/{id} and /jobs/{id}', () => {
    expect(notificationTarget({ link: '/offers/offer-456' })).toBe(
      '/bookings?tab=opportunities&candidate=offer-456',
    );
    expect(notificationTarget({ link: '/jobs/job-789' })).toBe(
      '/bookings?tab=opportunities&candidate=job-789',
    );
  });

  it('opens the exact destination from full HTTPS Universal / App Links', () => {
    expect(notificationTarget({ link: 'https://connekyt.com/offers/off-101' })).toBe(
      '/bookings?tab=opportunities&candidate=off-101',
    );
    expect(notificationTarget({ link: 'https://dashboard.connekyt.com/opportunities/opp-202' })).toBe(
      '/bookings?tab=opportunities&candidate=opp-202',
    );
    expect(notificationTarget({ link: 'https://yourdomain.com/bookings/bk-303' })).toBe(
      '/event/bk-303',
    );
    expect(notificationTarget({ link: 'https://yourdomain.com/jobs/job-404' })).toBe(
      '/bookings?tab=opportunities&candidate=job-404',
    );
  });

  it('normalizes custom scheme URLs and full web URLs to clean paths', () => {
    expect(normalizeNotificationLink('https://connekyt.com/offers/abc?ref=push')).toBe(
      '/offers/abc?ref=push',
    );
    expect(normalizeNotificationLink('connekt://opportunities/xyz')).toBe('/opportunities/xyz');
    expect(normalizeNotificationLink('/bookings/123')).toBe('/bookings/123');
  });

  it('opens the opportunities list for the bare link', () => {
    expect(notificationTarget({ type: 'OPPORTUNITY', link: '/opportunities' })).toBe(
      '/bookings?tab=opportunities',
    );
  });

  it('routes OPPORTUNITY by candidateId or referenceId when link is omitted', () => {
    expect(notificationTarget({ type: 'OPPORTUNITY', candidateId: 'cand-55' })).toBe(
      '/bookings?tab=opportunities&candidate=cand-55',
    );
    expect(notificationTarget({ type: 'OFFER', referenceId: 'ref-66' })).toBe(
      '/bookings?tab=opportunities&candidate=ref-66',
    );
  });

  it('sends outcome updates to opportunities too', () => {
    expect(notificationTarget({ type: 'HYBRID_UPDATE', referenceId: 'x' })).toBe(
      '/bookings?tab=opportunities',
    );
  });

  it("opens a client's answers screen from the candidates link", () => {
    expect(notificationTarget({ type: 'BOOKING', link: '/events/ev1/candidates' })).toBe(
      '/event/candidates?id=ev1',
    );
  });

  it('prevents duplicate navigation within the deduplication window', () => {
    const target = '/bookings?tab=opportunities&candidate=abc-123';
    expect(shouldNavigateToTarget(target, 1000)).toBe(true);
    expect(shouldNavigateToTarget(target, 1500)).toBe(false);
    expect(shouldNavigateToTarget('/event/other', 1500)).toBe(true);
    expect(shouldNavigateToTarget(target, 3000)).toBe(true);
  });
});
