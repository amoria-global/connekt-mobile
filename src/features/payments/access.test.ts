import { canUsePaymentsScreen } from './access';

describe('canUsePaymentsScreen', () => {
  it('keeps photographers off the pay-side Payments screen, since they only receive payments', () => {
    expect(canUsePaymentsScreen('Photographer')).toBe(false);
  });

  it('leaves the other roles their access', () => {
    expect(canUsePaymentsScreen('Client')).toBe(true);
    expect(canUsePaymentsScreen('Coordinator')).toBe(true);
    expect(canUsePaymentsScreen('Viewer')).toBe(true);
    expect(canUsePaymentsScreen(undefined)).toBe(true);
  });
});
