/**
 * Which payment methods a buyer may be shown, decided in one place.
 *
 * The backend owns the per-country operator list (PaymentOperatorRegistry,
 * served by /public/payments/options) and detects the country from the
 * caller's IP (/public/payments/country). This module only turns what those
 * return into what a picker may render. It never invents an operator.
 *
 * Rules:
 *  - Cards stay visible in every case. The backend reports card as universal.
 *  - Mobile money is shown only for operators the backend returned for the
 *    country. An unknown country, a country without coverage, or a failed
 *    lookup yields no mobile money, never a Rwanda default.
 */
import type { PaymentOperator, PaymentOptions } from '@/features/reference/api';

export type MobileMoneyState = 'loading' | 'ready' | 'unavailable';

export type PaymentEligibility = {
  /** ISO 3166-1 alpha-2, upper case, or null when it could not be established. */
  country: string | null;
  operators: PaymentOperator[];
  supportsCard: boolean;
  mobileMoney: MobileMoneyState;
};

export function normalizeCountry(value: string | null | undefined): string | null {
  const iso = (value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(iso) ? iso : null;
}

/** Eligibility before anything has been confirmed. Card only. */
export const CARD_ONLY: PaymentEligibility = {
  country: null,
  operators: [],
  supportsCard: true,
  mobileMoney: 'loading',
};

/**
 * @param country  the detected or chosen country, or null when unknown
 * @param options  the backend's answer for that country, or null when the lookup
 *                 failed or the country has no coverage
 * @param pending  true while the lookup is still running
 */
export function resolveEligibility(
  country: string | null | undefined,
  options: PaymentOptions | null,
  pending = false,
): PaymentEligibility {
  const iso = normalizeCountry(country);
  if (pending) return { country: iso, operators: [], supportsCard: true, mobileMoney: 'loading' };
  if (!iso || !options || normalizeCountry(options.country) !== iso) {
    return { country: iso, operators: [], supportsCard: true, mobileMoney: 'unavailable' };
  }
  const operators = options.operators.filter((o) => o.id);
  return {
    country: iso,
    operators,
    // Cards are offered in every market. The backend's answer for a country without
    // mobile money has no supportsCard field at all, so it must not turn cards off.
    supportsCard: true,
    mobileMoney: operators.length > 0 ? 'ready' : 'unavailable',
  };
}

/** Keep only operators a host's endpoint can actually take (e.g. stream tickets: MTN, AIRTEL). */
export function onlyOperators(operators: PaymentOperator[], allowed: readonly string[]): PaymentOperator[] {
  const ok = new Set(allowed.map((a) => a.toUpperCase()));
  return operators.filter((o) => ok.has(o.id.toUpperCase()));
}

/** A selected method id that is no longer on offer must not stay selected. */
export function keepSelection(selectedId: string | null, eligibility: PaymentEligibility): string | null {
  if (!selectedId) return null;
  if (selectedId === 'card') return eligibility.supportsCard ? 'card' : null;
  return eligibility.operators.some((o) => o.id.toLowerCase() === selectedId) ? selectedId : null;
}
