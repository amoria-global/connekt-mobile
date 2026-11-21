import { fillCopy, type MilestoneCopy } from './referralCopy';
import type { UnlockedMilestone } from './referral';

/** Milestone ladder used by the congratulations text. Kept apart so the sheet and its tests share one table. */
export const FeeCap = 40;
export const FeeRates: Record<number, number> = { 10: 75, 20: 80, 30: 85, 40: 90 };

/** The milestone after a given one, and how many referrals away it is. */
export function nextAfter(milestone: number): { milestone: number; more: number } {
  const next = Math.min(FeeCap, milestone + 10);
  return { milestone: next, more: next - milestone };
}

/** Title and body for an unlocked milestone. At 40 it is the maximum wording. */
export function congratsText(m: MilestoneCopy, u: UnlockedMilestone): { title: string; body: string } {
  if (u.milestone >= FeeCap) return { title: m.congratsMaxTitle, body: m.congratsMaxBody };
  const next = nextAfter(u.milestone);
  return {
    title: fillCopy(m.congratsTitle, { rate: u.sharePercent }),
    body: fillCopy(m.congratsBody, { milestone: u.milestone, more: next.more, next: FeeRates[next.milestone] ?? '' }),
  };
}
