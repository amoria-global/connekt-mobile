/**
 * Geo-pricing — per-event, per-location stream price.
 *
 * Public: getEffectivePrice(s) returns the price a viewer should see for their
 * location (the backend resolves the country from the request IP). Owner: CRUD
 * for the rules, scoped to the event's creator/photographer.
 *
 * Endpoints:
 *  - GET  /public/events/{id}/effective-price            (skipAuth)
 *  - POST /public/events/effective-prices                (skipAuth, batch)
 *  - GET  /events/{id}/geo-prices                         (owner)
 *  - POST /events/{id}/geo-prices                         (owner, upsert)
 *  - DELETE /events/{id}/geo-prices/{ruleId}             (owner)
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export type EffectivePrice = {
  eventId: string;
  price: number | null;
  currencyId?: string;
  currencyAbbreviation?: string;
  currencySymbol?: string;
  source?: 'COUNTRY' | 'CONTINENT' | 'DEFAULT';
  country?: string;
};

export type GeoScope = 'COUNTRY' | 'CONTINENT';

export type GeoPriceRule = {
  id: string;
  scopeType: GeoScope;
  scopeValue: string;
  price: number;
  currencyId?: string;
  currencyAbbreviation?: string;
  currencySymbol?: string;
};

export type GeoPricingConfig = {
  defaultPrice: number | null;
  defaultCurrencyId?: string;
  defaultCurrencyAbbreviation?: string;
  rules: GeoPriceRule[];
};

type Raw = Record<string, unknown>;
const num = (v: unknown) => (typeof v === 'number' ? v : v != null && !Number.isNaN(Number(v)) ? Number(v) : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

function toEffective(d: Raw, fallbackId: string): EffectivePrice {
  return {
    eventId: str(d.eventId) ?? fallbackId,
    price: num(d.price),
    currencyId: str(d.currencyId),
    currencyAbbreviation: str(d.currencyAbbreviation),
    currencySymbol: str(d.currencySymbol),
    source: str(d.source) as EffectivePrice['source'],
    country: str(d.country),
  };
}

/** Localized effective price for one event (viewer location resolved server-side). */
export async function getEffectivePrice(eventId: string, country?: string): Promise<EffectivePrice> {
  const qs = country ? `?country=${encodeURIComponent(country)}` : '';
  const res = await api.get<ApiEnvelope<Raw>>(
    `/public/events/${encodeURIComponent(eventId)}/effective-price${qs}`,
    { skipAuth: true },
  );
  return toEffective((res?.data ?? {}) as Raw, eventId);
}

/** Batch effective prices for a list grid (landing/listing). */
export async function getEffectivePrices(eventIds: string[], country?: string): Promise<Record<string, EffectivePrice>> {
  if (eventIds.length === 0) return {};
  const res = await api.post<ApiEnvelope<Raw[]>>(
    `/public/events/effective-prices`,
    { eventIds, country },
    { skipAuth: true },
  );
  const list = (res?.data ?? []) as Raw[];
  const out: Record<string, EffectivePrice> = {};
  for (const row of list) {
    const e = toEffective(row, '');
    if (e.eventId) out[e.eventId] = e;
  }
  return out;
}

// ── Owner CRUD ────────────────────────────────────────────────────────────

export async function getGeoPricing(eventId: string): Promise<GeoPricingConfig> {
  const res = await api.get<ApiEnvelope<Raw>>(`/events/${encodeURIComponent(eventId)}/geo-prices`);
  const d = (res?.data ?? {}) as Raw;
  const rules = ((d.rules as Raw[]) ?? []).map(
    (r): GeoPriceRule => ({
      id: String(r.id),
      scopeType: (str(r.scopeType) as GeoScope) ?? 'COUNTRY',
      scopeValue: str(r.scopeValue) ?? '',
      price: num(r.price) ?? 0,
      currencyId: str(r.currencyId),
      currencyAbbreviation: str(r.currencyAbbreviation),
      currencySymbol: str(r.currencySymbol),
    }),
  );
  return {
    defaultPrice: num(d.defaultPrice),
    defaultCurrencyId: str(d.defaultCurrencyId),
    defaultCurrencyAbbreviation: str(d.defaultCurrencyAbbreviation),
    rules,
  };
}

export async function upsertGeoPrice(
  eventId: string,
  input: { scopeType: GeoScope; scopeValue: string; price: number; currencyId?: string },
): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(`/events/${encodeURIComponent(eventId)}/geo-prices`, input);
  if (res?.action !== 1) throw new Error(res?.message || 'Could not save the price.');
}

export async function deleteGeoPrice(eventId: string, ruleId: string): Promise<void> {
  const res = await api.delete<ApiEnvelope<Raw>>(
    `/events/${encodeURIComponent(eventId)}/geo-prices/${encodeURIComponent(ruleId)}`,
  );
  if (res?.action !== 1) throw new Error(res?.message || 'Could not remove the price.');
}
