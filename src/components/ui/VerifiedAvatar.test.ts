import { VERIFIED_BLUE, badgeSizeFor, ringWidthFor } from './VerifiedAvatar';

/**
 * The avatar must match the web's `.ph-avatar` on the landing's photographers
 * page. These numbers are the web's own, so a drift on either side shows here.
 */
describe('VerifiedAvatar sizing', () => {
  it('uses the web seal colour', () => {
    expect(VERIFIED_BLUE).toBe('#3B82F6');
  });

  it('matches the web ring: 3px at 56, 2px at 40', () => {
    expect(ringWidthFor(56)).toBe(3);
    expect(ringWidthFor(40)).toBe(2);
  });

  it('matches the web seal disc: 22px at 56, 14px at 40', () => {
    expect(badgeSizeFor(56)).toBe(22);
    expect(badgeSizeFor(40)).toBe(14);
  });

  it('scales between the web sizes for the app card', () => {
    expect(badgeSizeFor(48)).toBe(18);
    expect(ringWidthFor(48)).toBe(2);
  });

  it('keeps the ring and seal proportionate on the 90px profile header', () => {
    expect(ringWidthFor(90)).toBe(4);
    expect(badgeSizeFor(90)).toBe(28);
  });
});
