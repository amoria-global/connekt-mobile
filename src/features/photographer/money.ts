/**
 * Money and period text for the photographer workspace.
 *
 * Three states are kept apart on purpose: a real zero, a value that has not
 * loaded or failed to load (unknown), and a value hidden by the privacy toggle.
 * Showing unknown as zero reads as an empty balance, so unknown renders "N/A".
 */
import { formatPrice } from '@/utils/format';

export const HIDDEN_AMOUNT = '••••';

/** A figure from the API: a number, or null/undefined while unknown. */
export type Known = number | null | undefined;

export const isKnown = (v: Known): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * `currency` is what the amount is denominated in. Without it the amount cannot
 * be labelled honestly, so the figure is treated as unknown rather than guessed
 * to be USD.
 */
export function moneyText(value: Known, currency: string | null | undefined, hidden = false): string {
  if (hidden) return HIDDEN_AMOUNT;
  if (!isKnown(value) || !currency) return 'N/A';
  return formatPrice(value, currency);
}

/** Signed movement, e.g. "+RWF 25,000" / "-RWF 4,000". Direction is also carried by the sign, not colour alone. */
export function signedMoneyText(value: Known, currency: string | null | undefined, hidden = false): string {
  if (hidden) return HIDDEN_AMOUNT;
  if (!isKnown(value) || !currency) return 'N/A';
  const body = formatPrice(Math.abs(value), currency);
  if (value > 0) return `+${body}`;
  if (value < 0) return `-${body}`;
  return body;
}

/** Share of `part` in `whole` as a whole percent, or null when it cannot be computed. */
export function percentOf(part: Known, whole: Known): number | null {
  if (!isKnown(part) || !isKnown(whole) || whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

/** Progress toward a goal, clamped to 0..100. Null when no goal was set. */
export function goalProgress(current: Known, goal: Known): number | null {
  const p = percentOf(current, goal);
  return p == null ? null : Math.min(100, Math.max(0, p));
}
