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

export async function getDonationTiers(currency?: string): Promise<DonationTier[]> {
  // Web parity: PublicRemoteController@GetMapping("/donation-tiers")
  // lives under @RequestMapping("/api/remote/public"), so the real
  // path is /public/donation-tiers. Accepts ?currency=USD/KES/RWF.
  const query = currency ? `?currency=${encodeURIComponent(currency)}` : '';
  const res = await api.get<ApiEnvelope<Raw> & Raw>(`/public/donation-tiers${query}`, {
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

export const KNOWN_CURRENCY_UUIDS: Record<string, string> = {
  RWF: '490c5ab1-a150-459e-be6b-d45131a1e13a',
  KES: 'e82f75a7-fe33-4b90-85a1-ae13919e0921',
  UGX: '68e02a65-2e52-4e78-b07d-2c516ec12675',
  TZS: '1f742d3f-f838-49d2-90df-890e0c2af8fe',
  USD: 'b807b880-6b57-4208-bf87-549a1535b2f3',
  EUR: '5070cf4e-9a1f-4b26-9dae-97a6013ad4b0',
  GHS: '8b1dd030-3e2e-4ea2-8052-b283111743a9',
  NGN: 'dd9cb53f-dcd1-4a01-ae17-624925d05fe6',
  ZMW: '8e38f423-174f-4bd1-8c2c-f2d9409433f0',
  MWK: '6bf7bebd-a637-4024-a27e-6c61baff8d5d',
  XOF: 'aa958d33-caf5-4a28-973b-b4923f426de5',
  XAF: '7b3e123a-eeb3-4cad-bd0f-f8e6f6c77ae1',
  CDF: 'dd9c32d0-f7cd-4da8-93d1-9b94190f391c',
  ETB: 'd3825531-935a-46ad-a8d9-959dfc403b6d',
  MZN: 'f0b5d08e-1ff0-49f8-afb3-c3c58ca09d5d',
  SLE: '1df1d289-d74d-4fc5-8058-4569f1e33e3d',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function resolveCurrencyId(currencyIdOrCode?: string): string {
  if (!currencyIdOrCode) return KNOWN_CURRENCY_UUIDS.RWF;
  if (UUID_REGEX.test(currencyIdOrCode)) return currencyIdOrCode;
  const upper = currencyIdOrCode.toUpperCase();
  return KNOWN_CURRENCY_UUIDS[upper] || KNOWN_CURRENCY_UUIDS.RWF;
}

export async function donate(input: {
  amount: number;
  currencyId?: string;
  currencyCode?: string;
  message?: string;
  paymentMethod?: 'MOBILE_MONEY' | 'CARD';
  eventId?: string;
}): Promise<DonationCreated> {
  const effectiveCurrencyId = resolveCurrencyId(input.currencyId || input.currencyCode);
  const code =
    input.currencyCode ||
    (input.currencyId && !UUID_REGEX.test(input.currencyId) ? input.currencyId : undefined);
  const qs = new URLSearchParams({ amount: String(input.amount) });
  if (effectiveCurrencyId) qs.set('currencyId', effectiveCurrencyId);
  if (code) qs.set('currencyCode', code.toUpperCase());
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
 * POST /public/donations?amount=&currencyId=&currencyCode=&donorName=&donorEmail=&message=&paymentMethod=&eventId=).
 * Returns the donation row used by `initiateXentriPayDonation` to take payment.
 */
export type PublicDonationInput = {
  amount: number;
  currencyId?: string;
  currencyCode?: string;
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
  const effectiveCurrencyId = resolveCurrencyId(input.currencyId || input.currencyCode);
  const code =
    input.currencyCode ||
    (input.currencyId && !UUID_REGEX.test(input.currencyId) ? input.currencyId : undefined);
  const qs = new URLSearchParams({ amount: String(input.amount) });
  if (effectiveCurrencyId) qs.set('currencyId', effectiveCurrencyId);
  if (code) qs.set('currencyCode', code.toUpperCase());
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

export type InitiatePublicDonationPayload = {
  donationId: string;
  phone: string;
  paymentMethod: 'MOBILE_MONEY' | 'CARD';
  telecomProvider?: string;
  country?: string;
  redirectUrl?: string;
};

export type InitiatePublicDonationResult = {
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  refid?: string;
  paymentUrl?: string;
  message?: string;
};

/**
 * Initiates Mobile Money or Card payment for a public donation.
 * Web parity: PublicXentriPayController#initiateDonation
 */
export async function initiatePublicDonationPayment(
  payload: InitiatePublicDonationPayload,
): Promise<InitiatePublicDonationResult> {
  const res = await api.post<ApiEnvelope<Raw> & Raw>(
    '/public/payments/xentripay/initiate-donation',
    payload,
    { skipAuth: true },
  );
  const top = (res ?? {}) as Raw;
  const d = (top.data ?? top) as Raw;
  return {
    status: (str(top.status) ?? str(d.status) ?? 'PENDING') as InitiatePublicDonationResult['status'],
    refid: str(top.refid) ?? str(d.refid),
    paymentUrl: str(top.paymentUrl) ?? str(d.paymentUrl) ?? str(d.redirectUrl),
    message: str(top.message) ?? str(d.message),
  };
}
