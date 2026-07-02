/**
 * Geo payment status — mobile port of knockout/app/hooks/useGeoPaymentStatus.
 *
 * Calls the public backend endpoint that decides whether payments are
 * allowed from the caller's IP, and whether a whole category (mobile
 * money / cards) is disabled for that region. Drives the "blocking
 * lines" in the checkout sheet: a hard block hides the pay button, a
 * category disable dims the affected method tiles. Fails OPEN on any
 * error so a flaky geo check never traps a legitimate buyer.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export type GeoPaymentStatus = {
  allowed: boolean;
  blocked: boolean;
  disableMobileMoney: boolean;
  disableCards: boolean;
  country?: string;
  countryCode?: string;
  message?: string;
};

const OPEN: GeoPaymentStatus = {
  allowed: true,
  blocked: false,
  disableMobileMoney: false,
  disableCards: false,
};

export async function getGeoPaymentStatus(): Promise<GeoPaymentStatus> {
  try {
    const res = await api.get<ApiEnvelope<Record<string, unknown>>>('/geo/payment-status', {
      skipAuth: true,
    });
    const d = (res?.data ?? {}) as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
    return {
      allowed: d.allowed !== false,
      blocked: d.blocked === true,
      disableMobileMoney: d.disableMobileMoney === true,
      disableCards: d.disableCards === true,
      country: s(d.country),
      countryCode: s(d.countryCode),
      message: s(d.message),
    };
  } catch {
    return OPEN;
  }
}
