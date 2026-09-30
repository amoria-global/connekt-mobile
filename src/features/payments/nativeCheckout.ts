/**
 * In-app checkout for the JWT-gated payments (a booking's outstanding balance,
 * the archive unlock fee).
 *
 * Same server contract the connekyt.com receiver (complete-payment.tsx) uses,
 * so gateway routing is unchanged:
 *   POST /payments/handoff                      mint a token (no amount sent)
 *   POST /public/payments/handoff/{token}/initiate
 *   GET  /public/payments/xentripay/status/{refid}   (public: see PAYMENTS.md)
 *
 * The amount is derived by the server from the declaration or the archive
 * fee setting. Nothing here ever names a price.
 */
import { api } from '@/api/client';
import { getPublicPaymentStatus } from '@/features/photos/api';
import type { HandoffType } from './webCheckout';

type Raw = Record<string, unknown>;
type Envelope = { action?: number; message?: string; data?: Raw };

export type HandoffRef = { type: HandoffType; declarationId?: string; eventId?: string };

export type InitiatedHandoff = { refid: string; paymentUrl?: string };

/** Mint a short-lived handoff token. Throws { status, message } on refusal. */
export async function mintHandoffToken(ref: HandoffRef): Promise<string> {
  const res = await api.post<Envelope>('/payments/handoff', {
    type: ref.type,
    declarationId: ref.declarationId,
    eventId: ref.eventId,
  });
  const token = res?.data?.token;
  if (res?.action !== 1 || typeof token !== 'string' || !token) {
    throw { status: 400, message: res?.message || 'Could not prepare the payment.' };
  }
  return token;
}

/**
 * Start the charge. Card sends no phone; mobile money sends the E.164 digits and
 * the provider id. Deliberately no country or redirect url: the web receiver
 * sends neither and the gateway route must not change.
 */
export async function initiateHandoffPayment(
  token: string,
  input: { card: true } | { card: false; phone: string; telecomProvider: string },
): Promise<InitiatedHandoff> {
  const body = input.card
    ? { paymentMethod: 'CARD' }
    : { paymentMethod: 'MOBILE_MONEY', phone: input.phone, telecomProvider: input.telecomProvider };
  const res = await api.post<Envelope>(`/public/payments/handoff/${encodeURIComponent(token)}/initiate`, body, {
    skipAuth: true,
  });
  const refid = res?.data?.refid;
  if (res?.action !== 1 || typeof refid !== 'string' || !refid) {
    throw { status: 400, message: res?.message || 'Could not start the payment.' };
  }
  const url = res.data?.paymentUrl;
  return { refid, paymentUrl: typeof url === 'string' && url ? url : undefined };
}

export type PollOutcome = 'success' | 'failed' | 'unknown';

export const POLL_INTERVAL_MS = 2000;
export const POLL_MAX_ATTEMPTS = 150;
/** Card sessions report FAILED before the buyer types a card number. */
export const CARD_FAILED_GRACE_MS = 180_000;

/**
 * Decide what one status read means. `failed` during a card grace window is
 * still `pending`. Pure so the rule is pinned by a test.
 */
export function interpretStatus(
  status: 'success' | 'failed' | 'pending',
  elapsedMs: number,
  card: boolean,
): 'success' | 'failed' | 'pending' {
  if (status === 'failed' && card && elapsedMs < CARD_FAILED_GRACE_MS) return 'pending';
  return status;
}

export type StatusRead = () => Promise<'success' | 'failed' | 'pending'>;

/**
 * Poll `read` until a terminal state. Resolves `unknown` (never `failed`) when
 * the budget runs out or reads keep erroring: the charge may have landed, so
 * the caller must NOT offer a retry, only tell the buyer to check their phone
 * or their payments. Returns a cancel function alongside the promise.
 *
 * Shared by every in-app checkout so the rule lives in one place. Each screen
 * supplies its own status read (the public xentripay endpoint, or the
 * anonymous-viewer one that also unlocks access on success).
 */
export function pollStatus(
  read: StatusRead,
  card: boolean,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): { done: Promise<PollOutcome>; cancel: () => void } {
  let cancelled = false;
  const done = (async (): Promise<PollOutcome> => {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      if (cancelled) return 'unknown';
      await sleep(POLL_INTERVAL_MS);
      if (cancelled) return 'unknown';
      try {
        const s = interpretStatus(await read(), (i + 1) * POLL_INTERVAL_MS, card);
        if (s !== 'pending') return s;
      } catch {
        /* a failed read is not a failed payment: keep polling */
      }
    }
    return 'unknown';
  })();
  return { done, cancel: () => { cancelled = true; } };
}

export function pollHandoff(
  refid: string,
  card: boolean,
  sleep?: (ms: number) => Promise<void>,
): { done: Promise<PollOutcome>; cancel: () => void } {
  return pollStatus(() => getPublicPaymentStatus(refid), card, sleep);
}
