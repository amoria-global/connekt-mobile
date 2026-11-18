import { REFERRAL_I18N } from './referralI18n';
import { fill, parseReferralCode, problemKey, progressParts, referralLink, referralStrings } from './referral';

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

describe('progress and links', () => {
  const base = { cap: 20 };
  it('counts toward the first discount, then shows the fee, then completes', () => {
    expect(progressParts({ ...base, qualifying: 3, feePercent: null, complete: false })).toMatchObject({ kind: 'unlock', n: 3, pct: 15 });
    expect(progressParts({ ...base, qualifying: 7, feePercent: 23, complete: false })).toMatchObject({ kind: 'fee', fee: 23, pct: 35 });
    expect(progressParts({ ...base, qualifying: 20, feePercent: 10, complete: true })).toMatchObject({ kind: 'complete', fee: 10, pct: 100 });
  });
  it('builds the join link and fills templates', () => {
    expect(referralLink('ABCD2345')).toBe('https://connekyt.com/join?ref=ABCD2345');
    expect(fill('{n} of 5 to unlock 25%', { n: 3 })).toBe('3 of 5 to unlock 25%');
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
      expect(u.progressToUnlock).toContain('{n}');
      expect(u.yourFee).toContain('{fee}');
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
