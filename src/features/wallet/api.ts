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

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

const REQUIRED_WALLET_NUMBERS = [
  'balanceAvailable',
  'pendingAmount',
  'heldForDelivery',
  'totalWithdrawn',
  'totalRefunded',
  'clientSpent',
] as const;

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
  const res = await api.getOk<ApiEnvelope<RawWallet>>('/wallet/me');
  // A failed fetch answers HTTP 200 with action:0 and no data.
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'Could not load your wallet. Pull to refresh.',
    } satisfies ApiError;
  }
  const d = res?.data as RawWallet | null | undefined;
  // The backend never leaves these money columns null, so a payload without
  // one is a bad response. Reading it as zero showed a funded or suspended
  // wallet as an empty ACTIVE one.
  if (!d || typeof d !== 'object' || !REQUIRED_WALLET_NUMBERS.every((k) => isFiniteNumber(d[k]))) {
    throw {
      status: 502,
      message: 'Your wallet came back incomplete. Pull to refresh.',
    } satisfies ApiError;
  }

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

export type MovementPage = {
  items: Movement[];
  /** True when the server says (or, for an unpaged reply, suggests) that older rows exist. */
  hasMore: boolean;
};

export async function listWalletMovements(page = 0, size = 50): Promise<Movement[]> {
  return (await listWalletMovementsPage(page, size)).items;
}

/**
 * One page of the ledger. `/wallet/me/movements` returns a Spring Page, so `last: false` is the server's own
 * statement that older movements exist. A reply with no `last` flag falls back to "a full page means maybe more".
 */
export async function listWalletMovementsPage(page = 0, size = 50): Promise<MovementPage> {
  const res = await api.getOk<ApiEnvelope<unknown>>(
    `/wallet/me/movements?page=${page}&size=${size}`,
  );
  const raw = pageContent(res?.data);
  const last = (res?.data as { last?: unknown } | null | undefined)?.last;
  const hasMore = typeof last === 'boolean' ? !last : raw.length >= size;
  // The backend always sends an id, a direction and an amount. A row without one cannot be shown truthfully: it used to
  // become an outgoing "Balance deduction" of an unknown amount, just now. Treat it as a bad response, like an incomplete
  // wallet, rather than dropping or inventing it.
  const complete = raw.every(
    (r) => !!str(r.id) && !!str(r.direction) && [r.amount, r.amountUsd, r.originalAmount].some(isFiniteNumber),
  );
  if (!complete) {
    throw {
      status: 502,
      message: 'Your transaction history came back incomplete. Pull to refresh.',
    } satisfies ApiError;
  }
  const items = raw.map((r) => {
    const dir = (str(r.direction) ?? '').toLowerCase();
    const cat = str(r.category) ?? str(r.sourceType) ?? 'BALANCE';
    // The figure and its currency must come from the same field. The ledger is USD, so `amountUsd` is USD even when
    // the payment itself was in RWF (`originalCurrency`). Pairing amountUsd with originalCurrency labelled 45.50 USD
    // as RWF, and the screens then showed it as $0.04.
    const origAmt = num(r.originalAmount);
    let amt: number;
    let cur: string;
    if (num(r.amount)) {
      amt = num(r.amount);
      cur = str(r.currency) || 'USD';
    } else if (num(r.amountUsd)) {
      amt = num(r.amountUsd);
      cur = 'USD';
    } else {
      amt = origAmt;
      cur = str(r.originalCurrency) || str(r.currency) || 'USD';
    }
    return {
      id: String(r.id ?? ''),
      category: cat,
      direction: /credit|^in$|deposit/.test(dir) ? 'in' : 'out',
      amount: amt,
      originalAmount: origAmt || undefined,
      originalCurrency: str(r.originalCurrency) || str(r.currency) || undefined,
      currency: cur,
      description: str(r.description),
      createdAt: str(r.createdAt),
      sourceType: str(r.sourceType),
      sourceId: str(r.sourceId),
    } satisfies Movement;
  }).filter((m) => m.id);
  return { items, hasMore };
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
  const res = await api.getOk<ApiEnvelope<Record<string, unknown>>>('/photographer/payroll-report');
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
