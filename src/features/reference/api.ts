/**
 * Public reference data (no auth). All endpoints here are VERIFIED against
 * the live backend (2026-06): https://backend.connekyt.com/api/remote
 *
 * - /public/currencies              → { action, data: Currency[] }
 * - /public/payments/country        → { action, data: { country, supported } }
 * - /public/payments/options?country=RW → { action, data: { supportsCard, operators[] } }
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Currency = {
  id: ID;
  code: string;
  name: string;
  symbol?: string;
};

export type PaymentOperator = {
  id: string;
  name: string;
  type: string; // e.g. MOBILE_MONEY
};

export type PaymentOptions = {
  country: string;
  supportsCard: boolean;
  operators: PaymentOperator[];
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

export async function listCurrencies(): Promise<Currency[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/public/currencies', { skipAuth: true });
  const data = Array.isArray(res?.data) ? res.data : [];
  return data
    .map((r) => ({
      id: String(r.id ?? ''),
      code: str(r.code) ?? str(r.abbreviation) ?? '',
      name: str(r.name) ?? '',
      symbol: str(r.symbol),
    }))
    .filter((c) => c.id && c.code);
}

export async function detectPaymentCountry(): Promise<string | undefined> {
  const res = await api.get<ApiEnvelope<Raw>>('/public/payments/country', { skipAuth: true });
  return str((res?.data ?? {}).country);
}

export async function getPaymentOptions(country: string): Promise<PaymentOptions> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/public/payments/options?country=${encodeURIComponent(country)}`,
    { skipAuth: true },
  );
  const d = (res?.data ?? {}) as Raw;
  const operators = Array.isArray(d.operators) ? (d.operators as Raw[]) : [];
  return {
    country: str(d.country) ?? country,
    supportsCard: d.supportsCard === true,
    operators: operators
      .map((o) => ({ id: String(o.id ?? ''), name: str(o.name) ?? '', type: str(o.type) ?? '' }))
      .filter((o) => o.id),
  };
}
