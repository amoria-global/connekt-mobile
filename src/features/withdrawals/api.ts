/**
 * Withdrawals (/api/remote/withdrawals) and saved payout methods
 * (/api/remote/photographer/withdrawal-methods).
 */
import { api } from '@/api/client';
import type { ApiError, ApiEnvelope, ID } from '@/types';

export type Withdrawal = {
  id: ID;
  amount?: number;
  currency?: string;
  status?: string;
  requestedAt?: string;
};

export type WithdrawalMethod = {
  id: ID;
  name: string;
  accountNumber?: string;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

function mapWithdrawal(r: Raw): Withdrawal {
  return {
    id: String(r.id ?? ''),
    amount: num(r.amount),
    currency: str(r.currency) ?? str(r.currencyCode),
    status: str(r.status),
    requestedAt: str(r.requestDate) ?? str(r.createdAt) ?? str(r.requestedAt),
  };
}

function mapMethod(r: Raw): WithdrawalMethod {
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? str(r.bankName) ?? 'Account',
    accountNumber: str(r.accountNumber),
  };
}

export async function listWithdrawals(): Promise<Withdrawal[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/withdrawals');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapWithdrawal).filter((w) => w.id);
}

export async function listWithdrawalMethods(): Promise<WithdrawalMethod[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/photographer/withdrawal-methods');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapMethod).filter((m) => m.id);
}

export async function requestWithdrawal(input: {
  amount: number;
  withdrawalMethodId: string;
}): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>('/withdrawals', input);
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Could not request the withdrawal.',
    } satisfies ApiError;
  }
}
