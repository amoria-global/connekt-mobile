import { referralStrings } from './referral';
import { milestoneCopy } from './referralCopy';

jest.mock('@/api/client', () => ({ api: {}, requireOk: (x: unknown) => x }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'en' }) }));

describe('card and menu strings', () => {
  it('exist in all five languages', () => {
    for (const l of ['en', 'sw', 'rw', 'fr', 'es']) {
      const u = referralStrings(l).ui;
      for (const k of ['cardTitle', 'chipAlbum', 'chipProfile', 'chipReferral', 'subAlbum', 'menuReferral'] as const) expect(u[k].length).toBeGreaterThan(0);
      const m = milestoneCopy(l);
      expect(m.badgeEarn).toContain('70');
      expect(m.badgeUnlock).toContain('{rate}');
      expect(m.badgeShare).toContain('{rate}');
    }
    expect(referralStrings('en').ui.cardTitle).toBe('Share & invite');
  });
});
