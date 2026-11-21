import raw from '@/content/referralCopy.json';
import { fillCopy, milestoneCopy } from './referralCopy';

const data = raw as unknown as Record<string, Record<string, string> | string>;
const LANGS = ['en', 'sw', 'rw', 'fr', 'es'];

describe('shared referral copy', () => {
  it('has the same keys in all five languages', () => {
    const en = Object.keys(data.en as object).sort();
    for (const l of LANGS) expect(Object.keys(data[l] as object).sort()).toEqual(en);
  });
  it('keeps the same placeholders in every language', () => {
    const holders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
    const en = data.en as Record<string, string>;
    for (const l of LANGS) {
      const bundle = data[l] as Record<string, string>;
      for (const k of Object.keys(en)) expect([l, k, holders(bundle[k])]).toEqual([l, k, holders(en[k])]);
    }
  });
  it('uses no em or en dashes and no empty text', () => {
    for (const l of LANGS) {
      for (const [k, v] of Object.entries(data[l] as Record<string, string>)) {
        expect([l, k, v.length > 0]).toEqual([l, k, true]);
        expect(v).not.toMatch(/[–—]/);
      }
    }
  });
  it('words the three steps exactly as the explainer says', () => {
    const en = milestoneCopy('en');
    expect(en.step1).toBe('Your friend signs up with your link or code.');
    expect(en.step2).toBe('Their account is verified and they publish their first photo for sale.');
    expect(en.step3).toBe('They make their first real sale or paid job (from a client, at least {min}).');
    expect(en.stepsFooter).toBe('Only then does it count toward your next milestone. Referrals that look suspicious are reviewed first.');
    expect(en.shareLine).toBe('A referral counts after your friend is verified, publishes a photo and makes their first sale.');
    expect(en.fieldHelper).toBe("Your referrer earns more on their photo sales once you're verified and make your first sale.");
  });
  it('falls back to English for an unknown language and fills placeholders', () => {
    expect(milestoneCopy('zz').growTitle).toBe('Grow your store');
    expect(fillCopy(milestoneCopy('en').progress, { n: 11, target: 20 })).toBe('11 of 20 referrals');
    expect(fillCopy(milestoneCopy('en').moreUnlock, { more: 9, rate: 80 })).toBe('9 more to unlock 80%');
  });
});
