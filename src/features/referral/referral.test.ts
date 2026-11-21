import { REFERRAL_I18N } from './referralI18n';
import { fill, parseReferralCode, problemKey, referralLink, referralStrings } from './referral';

jest.mock('@/api/client', () => ({ api: {}, requireOk: (x: unknown) => x }));
jest.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'en' }) }));

describe('parseReferralCode', () => {
  it('takes a bare code or a full link', () => {
    expect(parseReferralCode(' abcd2345 ')).toBe('ABCD2345');
    expect(parseReferralCode('https://connekyt.com/join?ref=ABCD2345&x=1')).toBe('ABCD2345');
  });
  it('rejects look-alike characters and wrong lengths', () => {
    expect(parseReferralCode('ABCD0OI1')).toBeNull();
    expect(parseReferralCode('ABC')).toBeNull();
    expect(parseReferralCode(null)).toBeNull();
  });
});

describe('links and problems', () => {
  it('builds the join link and fills templates', () => {
    expect(referralLink('ABCD2345')).toBe('https://connekyt.com/join?ref=ABCD2345');
    expect(fill('{n} of 10', { n: 3 })).toBe('3 of 10');
  });
  it('maps server problems to field messages', () => {
    expect(problemKey('LIMIT_REACHED')).toBe('limit');
    expect(problemKey('SELF')).toBe('self');
    expect(problemKey(undefined)).toBe('invalid');
  });
});

describe('strings', () => {
  const flat = (o: unknown, p = ''): string[] =>
    typeof o === 'string' ? [p] : Array.isArray(o) ? o.flatMap((v, i) => flat(v, `${p}[${i}]`)) : Object.entries(o as object).flatMap(([k, v]) => flat(v, p ? `${p}.${k}` : k));
  it('has every key in all five languages', () => {
    const en = flat(REFERRAL_I18N.en).sort();
    for (const l of ['sw', 'rw', 'fr', 'es']) expect(flat(REFERRAL_I18N[l]).sort()).toEqual(en);
  });
  it('keeps the placeholders the screens fill', () => {
    for (const l of Object.keys(REFERRAL_I18N)) {
      const u = REFERRAL_I18N[l].ui;
      expect(u.referredBy).toContain('{name}');
      expect(u.shareMessage).toContain('{code}');
      expect(REFERRAL_I18N[l].field.applied).toContain('{name}');
    }
  });
  it('falls back to English for an unknown language', () => {
    expect(referralStrings('zz').ui.menuReferral).toBe('Share referral link or code');
  });
  it('uses no em or en dashes in any language', () => {
    expect(JSON.stringify(REFERRAL_I18N)).not.toMatch(/[–—]/);
  });
});
