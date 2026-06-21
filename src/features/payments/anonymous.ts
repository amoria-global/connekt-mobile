/**
 * Public (anonymous-viewer) payment helpers for the guest events flow.
 *
 * The web client uses:
 *   POST /public/anonymous-viewer/{eventId}/initiate-payment
 *   POST /public/payments/xentripay/initiate-donation
 *   GET  /public/payments/xentripay/status/{refid}
 *
 * The mobile app mirrors them here so guests can pay a stream entry fee or
 * donate without logging in. Card payments hand off to a hosted gateway URL
 * (opened in expo-web-browser); mobile-money payments are initiated server
 * side and resolved via status polling.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

export type InitiateResult = {
  refid: string;
  paymentUrl?: string;
  status?: string;
  message?: string;
};

function unwrapInitiate(res: ApiEnvelope<Raw> & Raw): InitiateResult {
  const d = (res?.data ?? res ?? {}) as Raw;
  return {
    refid: str(d.refid) ?? str(d.reference) ?? str(d.tid) ?? '',
    paymentUrl: str(d.paymentUrl) ?? str(d.redirectUrl) ?? str(d.url) ?? str(d.checkoutUrl),
    status: str(d.status),
    message: str(d.message) ?? str(res?.message),
  };
}

export type AnonymousStreamPayInput = {
  eventId: string;
  viewerId: string;
  amount: number;
  currencyId: string;
  donationAmount?: number;
  viewerCount?: number;
  phone?: string;
  telecomProvider?: 'MTN' | 'AIRTEL' | string;
  paymentMethod: 'MOBILE_MONEY' | 'CARD';
  redirectUrl?: string;
  country?: string;
};

/** Streaming payment for an anonymous viewer (web parity). */
export async function initiateAnonymousStreamingPayment(
  input: AnonymousStreamPayInput,
): Promise<InitiateResult> {
  const { eventId, ...body } = input;
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    `/public/anonymous-viewer/${encodeURIComponent(eventId)}/initiate-payment`,
    body,
    { skipAuth: true },
  );
  return unwrapInitiate(res);
}

export type AnonymousDonationInput = {
  donationId: string;
  phone?: string;
  telecomProvider?: 'MTN' | 'AIRTEL' | string;
  paymentMethod?: 'MOBILE_MONEY' | 'CARD';
  redirectUrl?: string;
  country?: string;
};

/** Pay an already-created public donation. */
export async function initiateXentriPayDonation(
  input: AnonymousDonationInput,
): Promise<InitiateResult> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    '/public/payments/xentripay/initiate-donation',
    input,
    { skipAuth: true },
  );
  return unwrapInitiate(res);
}

export type PublicPaymentStatus = 'success' | 'pending' | 'failed';

export async function getPublicPaymentStatus(refid: string): Promise<PublicPaymentStatus> {
  const res = await api.get<ApiEnvelope<Raw> & Raw>(
    `/public/payments/xentripay/status/${encodeURIComponent(refid)}`,
    { skipAuth: true },
  );
  const d = (res?.data ?? res ?? {}) as Raw;
  const raw = (str(d.status) ?? str(d.paymentStatus) ?? '').toUpperCase();
  if (/SUCCESS|COMPLETED|PAID|APPROVED/.test(raw)) return 'success';
  if (/FAIL|CANCEL|DECLIN|ERROR/.test(raw)) return 'failed';
  return 'pending';
}

/**
 * Poll public XentriPay status until it settles. Card sessions return FAILED
 * before the user finishes paying; the grace window keeps polling through
 * those early FAILEDs (matches the web `pollXentriPayStatus`).
 */
export async function pollPublicPaymentStatus(
  refid: string,
  options?: { intervalMs?: number; maxAttempts?: number; graceMs?: number },
): Promise<PublicPaymentStatus> {
  const intervalMs = options?.intervalMs ?? 2500;
  const maxAttempts = options?.maxAttempts ?? 60;
  const graceMs = options?.graceMs ?? 0;
  const startedAt = Date.now();

  for (let i = 0; i < maxAttempts; i++) {
    const status = await getPublicPaymentStatus(refid).catch(() => 'pending' as const);
    if (status === 'success') return 'success';
    if (status === 'failed') {
      if (Date.now() - startedAt < graceMs) {
        await new Promise((r) => setTimeout(r, intervalMs));
        continue;
      }
      return 'failed';
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return 'pending';
}

export { num as parseNumeric, str as parseString };
