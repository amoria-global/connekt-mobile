/**
 * Wallet endpoint (/api/remote/wallet/me).
 * The backend keeps money in several "pots"; we surface the total plus a
 * breakdown of the non-empty pots.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export type WalletPot = { key: string; label: string; amount: number };

export type Wallet = {
  total: number;
  currency: string;
  pots: WalletPot[];
};

type RawWallet = Record<string, unknown>;

function num(v: unknown): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

/** Known balance fields → friendly labels. */
const POT_LABELS: Record<string, string> = {
  balanceAvailable: 'Available',
  balanceBooking: 'Bookings',
  balanceTips: 'Tips',
  balanceDonations: 'Donations',
  balanceBonuses: 'Bonuses',
  balanceGifts: 'Gifts',
  balanceStreamFees: 'Streaming',
  balanceAdRevenue: 'Ad revenue',
  balancePhotoPurchase: 'Photo purchases',
  pendingAmount: 'Pending',
  heldForDelivery: 'Held for delivery',
};

export async function getWallet(): Promise<Wallet> {
  const res = await api.get<ApiEnvelope<RawWallet>>('/wallet/me');
  const d = (res?.data ?? {}) as RawWallet;

  const pots: WalletPot[] = Object.entries(POT_LABELS)
    .map(([key, label]) => ({ key, label, amount: num(d[key]) }))
    .filter((p) => p.amount !== 0);

  // Backend keeps `balanceAvailable` as the user-spendable total. Fall
  // back to summing the non-empty pots, then to `totalBalance` (legacy
  // shape). Showing 0 is fine when nothing has happened yet.
  const total =
    num(d.balanceAvailable) ||
    num(d.totalBalance) ||
    pots.reduce((sum, p) => sum + p.amount, 0);

  // Wallet endpoint never returns a top-level currency — every pot is
  // stored in USD by backend convention (see WalletService). Defaulting
  // to USD here means the wallet screen reads "USD 0" instead of bare
  // "0" with no symbol at all.
  const currency =
    (typeof d.currency === 'string' && d.currency) ||
    (typeof d.currencyCode === 'string' && d.currencyCode) ||
    'USD';

  return { total, currency, pots };
}

// --- Wallet movements (transaction history) ------------------------------

export type Movement = {
  id: string;
  category?: string;
  direction: 'in' | 'out';
  amount: number;
  currency?: string;
  description?: string;
  createdAt?: string;
};

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

/** Unwraps a Spring Page (`data.content`) or a plain array. */
function pageContent(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const c = (data as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as Record<string, unknown>[]) : [];
}

export async function listWalletMovements(): Promise<Movement[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/wallet/me/movements?page=0&size=50');
  return pageContent(res?.data).map((r) => {
    const dir = (str(r.direction) ?? '').toLowerCase();
    return {
      id: String(r.id ?? ''),
      category: str(r.category) ?? str(r.sourceType),
      direction: /credit|in|deposit/.test(dir) ? 'in' : 'out',
      amount: num(r.originalAmount) || num(r.amountUsd),
      currency: str(r.originalCurrency),
      description: str(r.description),
      createdAt: str(r.createdAt),
    } satisfies Movement;
  }).filter((m) => m.id);
}

// --- Payroll report (photographer) ---------------------------------------

export type PayrollEntry = {
  id: string;
  date?: string;
  description?: string;
  type?: string;
  amount: number;
  status?: string;
};

export type PayrollReport = {
  total: number;
  paid: number;
  pending: number;
  currency?: string;
  entries: PayrollEntry[];
};

/** Photographer earnings summary (web parity: GET /photographer/payroll-report). */
export async function getPayrollReport(): Promise<PayrollReport> {
  const res = await api.get<ApiEnvelope<Record<string, unknown>>>('/photographer/payroll-report');
  const d = (res?.data ?? {}) as Record<string, unknown>;
  const txs = Array.isArray(d.transactions) ? (d.transactions as Record<string, unknown>[]) : [];
  return {
    total: num(d.total),
    paid: num(d.paid),
    pending: num(d.pending),
    currency: str(d.currency) ?? str(d.currencyCode),
    entries: txs
      .map((t) => ({
        id: String(t.id ?? ''),
        date: str(t.date) ?? str(t.createdAt),
        description: str(t.description) ?? str(t.eventTitle),
        type: str(t.type),
        amount: num(t.amount) || num(t.amountInUsd),
        status: str(t.status),
      }))
      .filter((e) => e.id),
  };
}
