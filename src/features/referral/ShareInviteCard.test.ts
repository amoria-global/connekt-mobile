import { badgeFor } from './ShareInviteCard';
import { referralStrings } from './referral';

jest.mock('@/api/client', () => ({ api: {}, requireOk: (x: unknown) => x }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'en' }) }));
jest.mock('@/components/ui/StatusChip', () => ({ chipColors: () => ({ fg: 'x', bg: 'y' }) }));
jest.mock('@/components/ui/IconTile', () => ({ IconTile: () => null }));

describe('badgeFor', () => {
  it('says Lower fees from 0 to 4 qualifying referrals', () => {
    for (const n of [0, 1, 4]) expect(badgeFor({ qualifying: n, feePercent: null, complete: false })).toEqual({ kind: 'lower', fee: null });
  });
  it('shows the real current rate from 5 to 19', () => {
    expect(badgeFor({ qualifying: 5, feePercent: 25, complete: false })).toEqual({ kind: 'fee', fee: 25 });
    expect(badgeFor({ qualifying: 7, feePercent: 23, complete: false })).toEqual({ kind: 'fee', fee: 23 });
    expect(badgeFor({ qualifying: 19, feePercent: 11, complete: false })).toEqual({ kind: 'fee', fee: 11 });
  });
  it('has no badge at 20 or while the stats are unknown', () => {
    expect(badgeFor({ qualifying: 20, feePercent: 10, complete: true })).toBeNull();
    expect(badgeFor(null)).toBeNull();
  });
});

describe('card and sheet strings', () => {
  it('exist in all five languages and keep the fee placeholder', () => {
    for (const l of ['en', 'sw', 'rw', 'fr', 'es']) {
      const u = referralStrings(l).ui;
      for (const k of ['cardTitle', 'chipAlbum', 'chipProfile', 'chipReferral', 'badgeLower', 'subAlbum', 'subReferral'] as const) expect(u[k].length).toBeGreaterThan(0);
      expect(u.badgeFee).toContain('{fee}');
    }
    expect(referralStrings('en').ui.cardTitle).toBe('Share & invite');
  });
});
