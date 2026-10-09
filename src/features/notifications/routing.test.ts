import { notificationTarget } from './routing';

describe('Post My Event notification routing', () => {
  it('opens the exact opportunity from its link', () => {
    expect(notificationTarget({ type: 'OPPORTUNITY', link: '/opportunities/abc-123' })).toBe(
      '/bookings?tab=opportunities&candidate=abc-123',
    );
  });

  it('opens the opportunities list for the bare link', () => {
    expect(notificationTarget({ type: 'OPPORTUNITY', link: '/opportunities' })).toBe('/bookings?tab=opportunities');
  });

  it('sends outcome updates to opportunities too', () => {
    expect(notificationTarget({ type: 'HYBRID_UPDATE', referenceId: 'x' })).toBe('/bookings?tab=opportunities');
  });

  it("opens a client's answers screen from the candidates link", () => {
    expect(notificationTarget({ type: 'BOOKING', link: '/events/ev1/candidates' })).toBe('/event/candidates?id=ev1');
  });
});
