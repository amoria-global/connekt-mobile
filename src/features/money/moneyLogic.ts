/**
 * The pure rules behind MoneyInput: what is typed, which currencies are suggested, and the "about" conversion under
 * the field. No React and no network here, so every rule is pinned by a plain test.
 */
import { isWholeNumberCurrency } from '@/features/payments/paymentLimits';

export type Usage = { last?: string; counts: Record<string, number> };

export const EMPTY_USAGE: Usage = { counts: {} };

/** Remembers a pick: it becomes the last used, and its count decides the quick-pick row. */
export function recordUse(usage: Usage, code: string): Usage {
  const c = code.toUpperCase();
  return { last: c, counts: { ...usage.counts, [c]: (usage.counts[c] ?? 0) + 1 } };
}

export function parseUsage(text: string | null): Usage {
  if (!text) return EMPTY_USAGE;
  try {
    const v = JSON.parse(text) as Usage;
    const counts: Record<string, number> = {};
    for (const [k, n] of Object.entries(v?.counts ?? {})) if (typeof n === 'number' && n > 0) counts[k.toUpperCase()] = n;
    return { last: typeof v?.last === 'string' ? v.last.toUpperCase() : undefined, counts };
  } catch {
    return EMPTY_USAGE;
  }
}

const unique = (codes: (string | undefined)[], available: Set<string>) =>
  codes.filter((c, i): c is string => !!c && available.has(c) && codes.indexOf(c) === i);

const byUse = (usage: Usage) =>
  Object.entries(usage.counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code]) => code);

/** The default: the last one used, else the account's own currency, else RWF, else the first the server lists. */
export function defaultCurrencyCode(all: string[], usage: Usage, accountCode?: string): string | undefined {
  const have = new Set(all);
  return unique([usage.last, accountCode?.toUpperCase(), 'RWF', all[0]], have)[0];
}

/** The picker's "Suggested" section: last used, the account currency, then the most used. At most three. */
export function suggestedCodes(all: string[], usage: Usage, accountCode?: string): string[] {
  return unique([usage.last, accountCode?.toUpperCase(), ...byUse(usage)], new Set(all)).slice(0, 3);
}

/** The "Quick pick" row: the three most used, topped up with the suggestions while there is little history. */
export function quickPickCodes(all: string[], usage: Usage, accountCode?: string, selected?: string): string[] {
  const have = new Set(all);
  const picks = unique([...byUse(usage), usage.last, accountCode?.toUpperCase(), selected], have).slice(0, 3);
  return selected && !picks.includes(selected) && have.has(selected) ? [...picks.slice(0, 2), selected] : picks;
}

export type PickerCurrency = { id: string; code: string; name: string };

/** Search by code, name or country. `countryName` is optional so the logic stays testable without Intl. */
export function filterCurrencies<T extends PickerCurrency>(
  list: T[],
  query: string,
  countryName?: (code: string) => string | undefined,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return list;
  return list.filter(
    (c) =>
      c.code.toLowerCase().includes(q) ||
      c.name.toLowerCase().includes(q) ||
      (countryName?.(c.code)?.toLowerCase().includes(q) ?? false),
  );
}

export const sortAtoZ = <T extends PickerCurrency>(list: T[]): T[] => [...list].sort((a, b) => a.code.localeCompare(b.code));

// ─── Typing ──────────────────────────────────────────────────────────────────────────────

/** What the user typed or pasted, reduced to digits and at most one point with two places. Safe for "1,234.50". */
export function rawFromInput(text: string, code: string | undefined, wholeOnly = isWholeNumberCurrency(code)): string {
  let t = text.replace(/[\s ]/g, '');
  if (wholeOnly) return t.replace(/[^0-9]/g, '');
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  if (lastComma > -1 && lastDot > -1) {
    // Both present: whichever comes last is the decimal point, the other groups thousands.
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma > -1) {
    // A lone comma is a decimal point only when one or two digits follow it ("4,5"), else it groups thousands.
    t = /^\d*,\d{1,2}$/.test(t) ? t.replace(',', '.') : t.replace(/,/g, '');
  }
  t = t.replace(/[^0-9.]/g, '');
  const [int = '', ...rest] = t.split('.');
  return rest.length ? `${int}.${rest.join('').slice(0, 2)}` : int;
}

/** The raw amount with thousands separators for display: "1234567.5" becomes "1,234,567.5". */
export function displayAmount(raw: string): string {
  if (!raw) return '';
  const [int, frac] = raw.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac === undefined ? grouped : `${grouped}.${frac}`;
}

// ─── Conversion ──────────────────────────────────────────────────────────────────────────

export type Rates = Record<string, { rateToUsd: number } | undefined>;

/** `amount` in `from` expressed in `to`, or null when either currency has no rate. Rates are units per 1 USD. */
export function convertAmount(amount: number, from: string, to: string, rates: Rates): number | null {
  if (!Number.isFinite(amount)) return null;
  const rate = (c: string) => (c === 'USD' ? 1 : rates[c]?.rateToUsd);
  const rf = rate(from);
  const rt = rate(to);
  if (!rf || !rt || !(rf > 0) || !(rt > 0)) return null;
  return (amount / rf) * rt;
}

/** "RWF 5,914", whole for a zero-decimal currency, two places otherwise. */
export function formatMoney(amount: number, code: string): string {
  const whole = isWholeNumberCurrency(code);
  const digits = whole ? 0 : 2;
  return `${code} ${amount.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** The right-hand helper: "≈ RWF 5,914", or null when there is nothing to convert or no rate. */
export function approxLabel(raw: string, from: string | undefined, to: string | undefined, rates: Rates): string | null {
  if (!raw || !from || !to || from === to) return null;
  const n = Number(raw);
  if (!(n > 0)) return null;
  const out = convertAmount(n, from, to, rates);
  return out === null ? null : `≈ ${formatMoney(out, to)}`;
}

/** The left-hand helper: "Minimum USD 0.07", with "whole numbers only" where the currency has no cents. */
export function minimumLabel(limit: { currency: string; minimum: string; wholeNumbersOnly: boolean } | null): string | null {
  if (!limit) return null;
  return `Minimum ${limit.currency} ${displayAmount(limit.minimum)}${limit.wholeNumbersOnly ? ' · whole numbers only' : ''}`;
}
