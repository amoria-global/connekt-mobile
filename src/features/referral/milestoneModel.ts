/**
 * Pure model behind the Grow your store card, the Milestones screen and the congratulations sheet. The server decides
 * every number (share, next milestone, counts); this only arranges them for display.
 */
import type { ReferralRow, ReferralStats } from './referral';

export const CAP = 40;
export const START_SHARE = 70;

export const TIERS = [
  { from: 0, to: 9, share: 70 },
  { from: 10, to: 19, share: 75 },
  { from: 20, to: 29, share: 80 },
  { from: 30, to: 39, share: 85 },
  { from: 40, to: 40, share: 90 },
] as const;

export type TierState = 'done' | 'current' | 'locked';
export interface TierRow { share: number; from: number; to: number; state: TierState; max: boolean }

/** The five tier rows for a qualified count: done before the current one, locked after it, 90% marked as maximum. */
export function tierRows(qualified: number): TierRow[] {
  const current = TIERS.reduce((idx, t, i) => (qualified >= t.from ? i : idx), 0);
  return TIERS.map((t, i) => ({
    share: t.share,
    from: t.from,
    to: t.to,
    state: i < current ? 'done' : i === current ? 'current' : 'locked',
    max: i === TIERS.length - 1,
  }));
}

type CardInput = Pick<ReferralStats, 'qualifying' | 'sharePercent' | 'nextMilestone' | 'nextSharePercent' | 'maxRate'>;

export interface CardModel {
  share: number;
  qualified: number;
  /** The milestone being worked toward (10, 20, 30, 40). At the maximum it is 40. */
  target: number;
  more: number;
  nextShare: number | null;
  pct: number;
  maxRate: boolean;
  /** Invite button and the Share menu referral item are shown. False at the cap, for good. */
  canInvite: boolean;
}

export function cardModel(s: CardInput): CardModel {
  const target = s.nextMilestone ?? CAP;
  const maxRate = s.maxRate || s.qualifying >= CAP;
  return {
    share: s.sharePercent,
    qualified: s.qualifying,
    target,
    more: Math.max(0, target - s.qualifying),
    nextShare: s.nextSharePercent,
    pct: Math.min(100, Math.round((s.qualifying / target) * 100)),
    maxRate,
    canInvite: !maxRate,
  };
}

/** A sample sale in the photographer's currency, for "That's RWF 500 more on a RWF 10,000 sale". */
const SAMPLE_SALE: Record<string, number> = { RWF: 10000, USD: 10, EUR: 10, KES: 1000, UGX: 30000, TZS: 25000 };
export function sampleSale(currency: string | null | undefined): { amount: number; currency: string } {
  const code = (currency || 'RWF').toUpperCase();
  return SAMPLE_SALE[code] ? { amount: SAMPLE_SALE[code], currency: code } : { amount: 10, currency: 'USD' };
}

/** How much more the next share pays on the sample sale. Null at the maximum. */
export function extraOnSample(share: number, nextShare: number | null, sale: number): number | null {
  if (nextShare == null) return null;
  return Math.round((sale * (nextShare - share)) / 100);
}

export interface RowView {
  tone: 'success' | 'pending' | 'accent' | 'error';
  statusKey: 'statusPending' | 'statusReview' | 'statusQualified' | 'statusRevoked';
  hintKey: 'hintWaitingVerified' | 'hintWaitingFirstSale' | 'hintUnderReview' | 'hintQualified' | 'hintRevoked';
}

/** Status and hint for a referral row. Under review and revoked never say why. */
export function rowView(r: Pick<ReferralRow, 'status' | 'hint'>): RowView {
  if (r.status === 'under_review') return { tone: 'accent', statusKey: 'statusReview', hintKey: 'hintUnderReview' };
  if (r.status === 'revoked') return { tone: 'error', statusKey: 'statusRevoked', hintKey: 'hintRevoked' };
  if (r.status === 'qualified') return { tone: 'success', statusKey: 'statusQualified', hintKey: 'hintQualified' };
  return {
    tone: 'pending',
    statusKey: 'statusPending',
    hintKey: r.hint === 'waiting_first_sale' ? 'hintWaitingFirstSale' : 'hintWaitingVerified',
  };
}

/** Share & invite badge: Earn 70% with no progress, Unlock 75% on the way, Your share at a milestone. Null at the cap. */
export function badgeModel(s: Pick<ReferralStats, 'qualifying' | 'sharePercent' | 'nextSharePercent' | 'maxRate'> | null):
  { key: 'badgeEarn' | 'badgeUnlock' | 'badgeShare'; rate: number } | null {
  if (!s || s.maxRate) return null;
  if (s.qualifying === 0) return { key: 'badgeEarn', rate: START_SHARE };
  if (s.qualifying < 10) return { key: 'badgeUnlock', rate: s.nextSharePercent ?? 75 };
  return { key: 'badgeShare', rate: s.sharePercent };
}

/** The chip on the Share menu referral item: "11/20" toward the next milestone. */
export function chipText(s: Pick<ReferralStats, 'qualifying' | 'nextMilestone'> | null): string | null {
  if (!s) return null;
  return `${s.qualifying}/${s.nextMilestone ?? CAP}`;
}
