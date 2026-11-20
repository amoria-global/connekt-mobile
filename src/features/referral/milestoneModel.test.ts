import { badgeModel, cardModel, chipText, extraOnSample, rowView, sampleSale, tierRows } from './milestoneModel';
import { congratsText } from './congratsModel';
import { milestoneCopy } from './referralCopy';
import type { ReferralStats } from './referral';

/** What the server sends for a qualified count (share and next milestone are the server's decision). */
function stats(q: number): Pick<ReferralStats, 'qualifying' | 'sharePercent' | 'nextMilestone' | 'nextSharePercent' | 'maxRate' | 'code'> {
  const share = q >= 40 ? 90 : q >= 30 ? 85 : q >= 20 ? 80 : q >= 10 ? 75 : 70;
  const next = q >= 40 ? null : q >= 30 ? 40 : q >= 20 ? 30 : q >= 10 ? 20 : 10;
  const nextShare = next == null ? null : next === 40 ? 90 : next === 30 ? 85 : next === 20 ? 80 : 75;
  return { qualifying: q, sharePercent: share, nextMilestone: next, nextSharePercent: nextShare, maxRate: q >= 40, code: q >= 40 ? null : 'ABCD2345' };
}

describe('tier rows', () => {
  it('marks done, current and locked at every boundary', () => {
    const states = (q: number) => tierRows(q).map((t) => t.state);
    expect(states(0)).toEqual(['current', 'locked', 'locked', 'locked', 'locked']);
    expect(states(9)).toEqual(['current', 'locked', 'locked', 'locked', 'locked']);
    expect(states(10)).toEqual(['done', 'current', 'locked', 'locked', 'locked']);
    expect(states(19)).toEqual(['done', 'current', 'locked', 'locked', 'locked']);
    expect(states(20)).toEqual(['done', 'done', 'current', 'locked', 'locked']);
    expect(states(39)).toEqual(['done', 'done', 'done', 'current', 'locked']);
    expect(states(40)).toEqual(['done', 'done', 'done', 'done', 'current']);
  });
  it('lists 70, 75, 80, 85, 90 and marks only 90 as the maximum', () => {
    const rows = tierRows(0);
    expect(rows.map((t) => t.share)).toEqual([70, 75, 80, 85, 90]);
    expect(rows.filter((t) => t.max).map((t) => t.share)).toEqual([90]);
  });
});

describe('card model', () => {
  it('0 referrals: 70% from the first sale, 10 more to unlock 75%', () => {
    const c = cardModel(stats(0));
    expect(c).toMatchObject({ share: 70, target: 10, more: 10, nextShare: 75, pct: 0, maxRate: false, canInvite: true });
  });
  it('11 referrals: 75%, 9 more unlock 80%, bar at 55%', () => {
    const c = cardModel(stats(11));
    expect(c).toMatchObject({ share: 75, target: 20, more: 9, nextShare: 80, pct: 55, canInvite: true });
  });
  it('39 referrals: 85%, 1 more unlocks 90%', () => {
    expect(cardModel(stats(39))).toMatchObject({ share: 85, target: 40, more: 1, nextShare: 90, pct: 98, maxRate: false });
  });
  it('40 referrals: maximum, no invite, bar full', () => {
    expect(cardModel(stats(40))).toMatchObject({ share: 90, target: 40, more: 0, nextShare: null, pct: 100, maxRate: true, canInvite: false });
  });
});

describe('money example in the photographer currency', () => {
  it('RWF: 500 more on a 10,000 sale going from 75% to 80%', () => {
    const sale = sampleSale('RWF');
    expect(sale).toEqual({ amount: 10000, currency: 'RWF' });
    expect(extraOnSample(75, 80, sale.amount)).toBe(500);
  });
  it('other currencies get a sample in their own scale, unknown ones fall back to USD', () => {
    expect(sampleSale('KES')).toEqual({ amount: 1000, currency: 'KES' });
    expect(sampleSale('XYZ')).toEqual({ amount: 10, currency: 'USD' });
    expect(extraOnSample(70, 75, 10)).toBe(1);
  });
  it('has no example at the maximum', () => {
    expect(extraOnSample(90, null, 10000)).toBeNull();
  });
});

describe('referral rows', () => {
  it('pending shows what is missing', () => {
    expect(rowView({ status: 'pending', hint: 'waiting_verified_published' })).toMatchObject({ statusKey: 'statusPending', hintKey: 'hintWaitingVerified' });
    expect(rowView({ status: 'pending', hint: 'waiting_first_sale' })).toMatchObject({ statusKey: 'statusPending', hintKey: 'hintWaitingFirstSale' });
  });
  it('under review and revoked never reveal a reason', () => {
    expect(rowView({ status: 'under_review', hint: 'under_review' })).toMatchObject({ statusKey: 'statusReview', hintKey: 'hintUnderReview' });
    expect(rowView({ status: 'revoked', hint: 'revoked' })).toMatchObject({ statusKey: 'statusRevoked', hintKey: 'hintRevoked' });
    const en = milestoneCopy('en');
    expect(en.hintUnderReview).toBe("We're checking this referral (usually within 48 h)");
    expect(en.hintUnderReview.toLowerCase()).not.toMatch(/phone|device|payout|email|kyc|same buyer/);
  });
  it('qualified is counted', () => {
    expect(rowView({ status: 'qualified', hint: 'qualified' })).toMatchObject({ statusKey: 'statusQualified', tone: 'success' });
  });
});

describe('Share and invite badge and chip', () => {
  const b = (q: number) => badgeModel(stats(q));
  it('Earn 70% at zero, Unlock 75% before 10, Your share from 10, nothing at 40', () => {
    expect(b(0)).toEqual({ key: 'badgeEarn', rate: 70 });
    expect(b(3)).toEqual({ key: 'badgeUnlock', rate: 75 });
    expect(b(9)).toEqual({ key: 'badgeUnlock', rate: 75 });
    expect(b(10)).toEqual({ key: 'badgeShare', rate: 75 });
    expect(b(39)).toEqual({ key: 'badgeShare', rate: 85 });
    expect(b(40)).toBeNull();
    expect(badgeModel(null)).toBeNull();
  });
  it('chip is n over the next milestone', () => {
    expect(chipText(stats(11))).toBe('11/20');
    expect(chipText(stats(0))).toBe('0/10');
    expect(chipText(stats(40))).toBe('40/40');
    expect(chipText(null)).toBeNull();
  });
});

describe('congratulations text uses the newly unlocked rate', () => {
  const en = milestoneCopy('en');
  it('at 10, 20, 30', () => {
    expect(congratsText(en, { milestone: 10, sharePercent: 75 }).title).toBe('You now earn 75% on every photo you sell');
    expect(congratsText(en, { milestone: 20, sharePercent: 80 }).title).toBe('You now earn 80% on every photo you sell');
    expect(congratsText(en, { milestone: 30, sharePercent: 85 }).body).toContain('10 more referrals unlock 90%');
  });
  it('at 40 it says maximum', () => {
    const t = congratsText(en, { milestone: 40, sharePercent: 90 });
    expect(t.title).toBe('Maximum rate unlocked: you earn 90% on every photo you sell');
    expect(t.body).toContain('maximum rate');
  });
});
