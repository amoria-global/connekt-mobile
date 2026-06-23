/**
 * Donations — mirrors the web.
 * - GET  /donation-tiers  (public)         → preset amounts
 * - GET  /donations       (auth, paged)    → my donation history
 * - POST /donations?amount=&currencyId=&message=  → record a donation
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type DonationTier = { amount: number; currency?: string };

export type Donation = {
  id: ID;
  amount?: number;
  currency?: string;
  message?: string;
  createdAt?: string;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

function pageContent(data: unknown): Raw[] {
  if (Array.isArray(data)) return data as Raw[];
  const c = (data as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as Raw[]) : [];
}

export async function getDonationTiers(): Promise<DonationTier[]> {
  // Web parity: PublicRemoteController@GetMapping("/donation-tiers")
  // lives under @RequestMapping("/api/remote/public"), so the real
  // path is /public/donation-tiers. The previous /donation-tiers
  // call 404'd which made the donation screen crash on load.
  const res = await api.get<ApiEnvelope<Raw> & Raw>('/public/donation-tiers', {
    skipAuth: true,
  });
  const d = (res?.data ?? res ?? {}) as Raw;
  const tiers = Array.isArray(d.tiers) ? (d.tiers as Raw[]) : [];
  return tiers
    .map((t) => ({ amount: num(t.amount) ?? 0, currency: str(t.currency) }))
    .filter((t) => t.amount > 0);
}

export async function listDonations(): Promise<Donation[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/donations?page=0&size=20');
  return pageContent(res?.data)
    .map((r) => ({
      id: String(r.id ?? ''),
      amount: num(r.amount),
      currency: str(r.currencyCode) ?? str(r.currency) ?? str(r.currencySymbol),
      message: str(r.message),
      createdAt: str(r.createdAt) ?? str(r.date),
    }))
    .filter((d) => d.id);
}

/**
 * Step 1 of the authenticated donation flow: record the donation row.
 * Returns the donation id which is used by `initiateAuthenticatedDonationPayment`
 * to actually take payment. The previous `Promise<void>` shape hid that
 * step 2 was missing — the screen showed "Thank you!" while never
 * charging anything.
 */
export type DonationCreated = {
  id: ID;
  amount?: number;
  status?: string;
};

export async function donate(input: {
  amount: number;
  currencyId: string;
  message?: string;
  paymentMethod?: 'MOBILE_MONEY' | 'CARD';
  eventId?: string;
}): Promise<DonationCreated> {
  const qs = new URLSearchParams({ amount: String(input.amount), currencyId: input.currencyId });
  if (input.message?.trim()) qs.append('message', input.message.trim());
  if (input.paymentMethod) qs.append('paymentMethod', input.paymentMethod);
  if (input.eventId) qs.append('eventId', input.eventId);
  const res = await api.post<ApiEnvelope<Raw>>(`/donations?${qs.toString()}`, undefined);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not submit your donation.' };
  }
  const d = (res?.data ?? {}) as Raw;
  return { id: String(d.id ?? ''), amount: num(d.amount), status: str(d.status) };
}

/**
 * Public donation creation (no auth, web parity:
 * POST /public/donations?amount=&currencyId=&donorName=&donorEmail=&message=&paymentMethod=&eventId=).
 * Returns the donation row used by `initiateXentriPayDonation` to take payment.
 */
export type PublicDonationInput = {
  amount: number;
  currencyId?: string;
  donorName?: string;
  donorEmail?: string;
  message?: string;
  paymentMethod?: string;
  eventId?: string;
};

export type PublicDonationCreated = {
  id: ID;
  amount?: number;
  status?: string;
};

export async function createPublicDonation(
  input: PublicDonationInput,
): Promise<PublicDonationCreated> {
  const qs = new URLSearchParams({ amount: String(input.amount) });
  if (input.currencyId) qs.set('currencyId', input.currencyId);
  if (input.donorName?.trim()) qs.set('donorName', input.donorName.trim());
  if (input.donorEmail?.trim()) qs.set('donorEmail', input.donorEmail.trim());
  if (input.message?.trim()) qs.set('message', input.message.trim());
  if (input.paymentMethod) qs.set('paymentMethod', input.paymentMethod);
  if (input.eventId) qs.set('eventId', input.eventId);

  const res = await api.post<ApiEnvelope<Raw>>(
    `/public/donations?${qs.toString()}`,
    undefined,
    { skipAuth: true },
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not submit your donation.' };
  }
  const d = (res?.data ?? {}) as Raw;
  return { id: String(d.id ?? ''), amount: num(d.amount), status: str(d.status) };
}
