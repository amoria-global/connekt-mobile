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
  const res = await api.get<ApiEnvelope<Raw> & Raw>('/donation-tiers', { skipAuth: true });
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

export async function donate(input: {
  amount: number;
  currencyId: string;
  message?: string;
}): Promise<void> {
  const qs = new URLSearchParams({ amount: String(input.amount), currencyId: input.currencyId });
  if (input.message?.trim()) qs.append('message', input.message.trim());
  const res = await api.post<ApiEnvelope<Raw>>(`/donations?${qs.toString()}`, undefined);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not submit your donation.' };
  }
}
