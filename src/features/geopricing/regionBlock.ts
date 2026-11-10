/**
 * When the server keeps a place out of an event, it says so three ways, and the apps treat them as one:
 *   - the price lookup answers { blocked: true, blockedCode, blockedMessage, retry }
 *   - the event card carries { regionBlocked, regionBlockedCode, regionBlockedMessage, regionRetry }
 *   - a purchase, gift, tip or donation is refused with HTTP 403 { errorCode, message, retry }
 *
 * REGION_BLOCKED means this place is kept out. LOCATION_UNKNOWN means the server could not tell where the viewer is
 * on an event that blocks places, so it fails closed; that one can succeed on a retry.
 */
import type { ApiError } from '@/types';

export const REGION_BLOCKED = 'REGION_BLOCKED';
export const LOCATION_UNKNOWN = 'LOCATION_UNKNOWN';

export const BLOCKED_COPY = "This stream isn't available in your region.";
export const UNKNOWN_COPY = "We couldn't confirm your location. Please try again.";

export type RegionBlock = {
  /** True when the place could not be confirmed, so Retry is worth offering. */
  unknown: boolean;
  message: string;
};

const asRecord = (v: unknown): Record<string, unknown> | null => (v && typeof v === 'object' ? (v as Record<string, unknown>) : null);

function make(code: unknown, message: unknown, retry: unknown): RegionBlock | null {
  if (code !== REGION_BLOCKED && code !== LOCATION_UNKNOWN) return null;
  const unknown = code === LOCATION_UNKNOWN || retry === true;
  const text = typeof message === 'string' && message.trim() ? message.trim() : unknown ? UNKNOWN_COPY : BLOCKED_COPY;
  return { unknown, message: text };
}

/** A refused purchase, gift, tip or donation: the 403 the server answers with. Null for any other error. */
export function regionBlockFromError(err: unknown): RegionBlock | null {
  const e = asRecord(err);
  if (!e || e.status !== 403) return null;
  const body = asRecord(e.body);
  return make(body?.errorCode, body?.message ?? e.message, body?.retry);
}

/** The price lookup's answer for a place. Null when the place is allowed. */
export function regionBlockFromPrice(price: unknown): RegionBlock | null {
  const p = asRecord(price);
  if (!p || p.blocked !== true) return null;
  return make(p.blockedCode, p.blockedMessage, p.retry) ?? { unknown: false, message: BLOCKED_COPY };
}

/** The event card's flags. Null when the viewer may see the event. */
export function regionBlockFromEvent(raw: unknown): RegionBlock | null {
  const r = asRecord(raw);
  if (!r || r.regionBlocked !== true) return null;
  return make(r.regionBlockedCode, r.regionBlockedMessage, r.regionRetry) ?? { unknown: false, message: BLOCKED_COPY };
}

export type { ApiError };
