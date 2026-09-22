/**
 * Wallet endpoint (/api/remote/wallet/me).
 * The backend keeps money in several "pots"; we surface the total plus a
 * breakdown of the non-empty pots.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ApiError } from '@/types';

export type WalletPot = { key: string; label: string; amount: number };

export interface WalletDTO {
  id: string;
  customerId?: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerType?: string;
  balanceAvailable: number;
  balanceBooking: number;
  balanceTips: number;
  balanceBonuses: number;
  balanceGifts: number;
  balanceStreamFees: number;
  balanceDonations: number;
  balanceAdRevenue: number;
  balancePhotoPurchase: number;
  heldForDelivery: number;
  deliveryHeldAmount?: number;
  surveyHeldAmount?: number;
  pendingAmount: number;
  blockedAmount: number;
  totalWithdrawn: number;
  totalRefunded: number;
  clientSpent: number;
  status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED' | string;
  suspensionReason?: string | null;
  suspendedAt?: string | null;
  currency: string;
  pots: WalletPot[];
  total: number;
}

export type Wallet = WalletDTO;

type RawWallet = Record<string, unknown>;

function num(v: unknown): number {
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

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

export async function getWallet(): Promise<WalletDTO> {
  const res = await api.get<ApiEnvelope<RawWallet>>('/wallet/me');
  // A failed fetch answers HTTP 200 with action:0 and no data.
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'Could not load your wallet. Pull to refresh.',
    } satisfies ApiError;
  }
  const d = (res?.data ?? {}) as RawWallet;

  const pots: WalletPot[] = Object.entries(POT_LABELS)
    .map(([key, label]) => ({ key, label, amount: num(d[key]) }))
    .filter((p) => p.amount !== 0);

  const spendable = pots.filter(
    (p) => p.key !== 'pendingAmount' && p.key !== 'heldForDelivery',
  );
  const total =
    typeof d.balanceAvailable === 'number' && !Number.isNaN(d.balanceAvailable)
      ? d.balanceAvailable
      : typeof d.totalBalance === 'number' && !Number.isNaN(d.totalBalance)
        ? d.totalBalance
        : spendable.reduce((sum, p) => sum + p.amount, 0);

  const currency =
    (typeof d.currency === 'string' && d.currency) ||
    (typeof d.currencyCode === 'string' && d.currencyCode) ||
    'USD';

  return {
    id: str(d.id) || 'me',
    customerId: str(d.customerId),
    customerName: str(d.customerName) ?? null,
    customerEmail: str(d.customerEmail) ?? null,
    customerType: str(d.customerType),
    balanceAvailable: num(d.balanceAvailable),
    balanceBooking: num(d.balanceBooking),
    balanceTips: num(d.balanceTips),
    balanceBonuses: num(d.balanceBonuses),
    balanceGifts: num(d.balanceGifts),
    balanceStreamFees: num(d.balanceStreamFees),
    balanceDonations: num(d.balanceDonations),
    balanceAdRevenue: num(d.balanceAdRevenue),
    balancePhotoPurchase: num(d.balancePhotoPurchase),
    heldForDelivery: num(d.heldForDelivery),
    deliveryHeldAmount: num(d.deliveryHeldAmount),
    surveyHeldAmount: num(d.surveyHeldAmount),
    pendingAmount: num(d.pendingAmount),
    blockedAmount: num(d.blockedAmount),
    totalWithdrawn: num(d.totalWithdrawn),
    totalRefunded: num(d.totalRefunded),
    clientSpent: num(d.clientSpent),
    status: (str(d.status) || 'ACTIVE').toUpperCase(),
    suspensionReason: str(d.suspensionReason) ?? null,
    suspendedAt: str(d.suspendedAt) ?? null,
    currency,
    pots,
    total,
  };
}

// --- Wallet movements (transaction history) ------------------------------

export type Movement = {
  id: string;
  category?: string;
  direction: 'in' | 'out';
  amount: number;
  originalAmount?: number;
  originalCurrency?: string;
  currency?: string;
  description?: string;
  createdAt?: string;
  sourceType?: string;
  sourceId?: string;
};

/** Unwraps a Spring Page (`data.content`) or a plain array. */
function pageContent(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const c = (data as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as Record<string, unknown>[]) : [];
}

export async function listWalletMovements(page = 0, size = 50): Promise<Movement[]> {
  const res = await api.get<ApiEnvelope<unknown>>(
    `/wallet/me/movements?page=${page}&size=${size}`,
  );
  return pageContent(res?.data).map((r) => {
    const dir = (str(r.direction) ?? '').toLowerCase();
    const cat = str(r.category) ?? str(r.sourceType) ?? 'BALANCE';
    const amt = num(r.amount) || num(r.amountUsd) || num(r.originalAmount);
    const origAmt = num(r.originalAmount);
    return {
      id: String(r.id ?? ''),
      category: cat,
      direction: /credit|^in$|deposit/.test(dir) ? 'in' : 'out',
      amount: amt,
      originalAmount: origAmt || undefined,
      originalCurrency: str(r.originalCurrency) || str(r.currency) || undefined,
      currency: str(r.currency) || str(r.originalCurrency) || 'USD',
      description: str(r.description),
      createdAt: str(r.createdAt),
      sourceType: str(r.sourceType),
      sourceId: str(r.sourceId),
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
