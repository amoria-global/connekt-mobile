/**
 * The smallest price a form may accept, per currency, read from the backend so the app, the dashboard and the website
 * all quote the same figure. The server judges every price again, so a missing answer here never blocks a form: it
 * only means the field cannot show the minimum yet.
 *
 * - /public/payments/limits?currency=USD → { action, data: { currency, minimum, decimals, wholeNumbersOnly, rateStale } }
 */
import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export type PaymentLimit = {
  currency: string;
  /** Plain decimal text, e.g. "0.08" or "100". */
  minimum: string;
  decimals: number;
  wholeNumbersOnly: boolean;
};

/** Currencies with no minor unit. Used only while the backend has not answered, so typing is already right. */
const ZERO_DECIMAL = new Set(['RWF', 'UGX', 'XAF', 'XOF']);

export function isWholeNumberCurrency(code: string | undefined | null): boolean {
  return !!code && ZERO_DECIMAL.has(code.toUpperCase());
}

export async function getPaymentLimit(currency: string): Promise<PaymentLimit | null> {
  const res = await api.get<ApiEnvelope<Record<string, unknown>>>(
    `/public/payments/limits?currency=${encodeURIComponent(currency)}`,
    { skipAuth: true },
  );
  const d = res?.data;
  if (res?.action !== 1 || !d || typeof d.minimum !== 'string') return null;
  const decimals = typeof d.decimals === 'number' ? d.decimals : isWholeNumberCurrency(currency) ? 0 : 2;
  return { currency: String(d.currency ?? currency), minimum: d.minimum, decimals, wholeNumbersOnly: decimals === 0 };
}

/** The limit for the chosen currency, or null while loading or when the backend cannot say. */
export function usePaymentLimit(currency: string | undefined): PaymentLimit | null {
  const [answer, setAnswer] = useState<{ currency: string; limit: PaymentLimit | null } | null>(null);
  useEffect(() => {
    if (!currency) return;
    let live = true;
    getPaymentLimit(currency)
      .then((limit) => live && setAnswer({ currency, limit }))
      .catch(() => live && setAnswer({ currency, limit: null }));
    return () => {
      live = false;
    };
  }, [currency]);
  // An answer for another currency is stale the moment the picker moves, so it is simply not used.
  return currency && answer?.currency === currency ? answer.limit : null;
}

/** Keeps only what can be typed in this currency: digits, plus one decimal point with at most two places if it has cents. */
export function sanitizePriceInput(text: string, currency: string | undefined, limit?: PaymentLimit | null): string {
  const whole = limit ? limit.wholeNumbersOnly : isWholeNumberCurrency(currency);
  if (whole) return text.replace(/[^0-9]/g, '');
  const cleaned = text.replace(',', '.').replace(/[^0-9.]/g, '');
  const [intPart, ...rest] = cleaned.split('.');
  return rest.length ? `${intPart}.${rest.join('').slice(0, 2)}` : intPart;
}

/** The message to show under the field, or null when the amount is fine (or still empty). */
export function priceError(text: string, currency: string | undefined, limit: PaymentLimit | null): string | null {
  const t = text.trim();
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'Enter a valid price.';
  const amount = Number(t);
  if (!(amount > 0)) return 'Enter a price above zero.';
  if (limit && amount < Number(limit.minimum)) {
    return `The minimum price in ${limit.currency} is ${limit.minimum}. Mobile Money can't process smaller payments.`;
  }
  return null;
}

/** True when the amount can be submitted: well formed, and not under the minimum when the minimum is known. */
export function priceOk(text: string, currency: string | undefined, limit: PaymentLimit | null): boolean {
  return text.trim() !== '' && priceError(text, currency, limit) === null;
}

/** Helper text for under the field. */
export function priceHint(limit: PaymentLimit | null): string | null {
  return limit ? `Minimum ${limit.currency} ${limit.minimum}` : null;
}
