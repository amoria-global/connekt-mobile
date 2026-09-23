/**
 * Saved payment accounts (withdrawal methods). See ./model for the contract.
 */
import { api } from '@/api/client';
import type { Role } from '@/features/auth/role';
import type { ApiEnvelope, ApiError } from '@/types';
import { mapAccount, withdrawalMethodsPath, type MethodType, type PaymentAccount } from './model';

type Raw = Record<string, unknown>;

/** HTTP 200 with action 0 is a failure; turn it into a thrown ApiError. */
function ensureOk<T>(res: ApiEnvelope<T>, fallback: string): ApiEnvelope<T> {
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || fallback } satisfies ApiError;
  }
  return res;
}

export async function listPaymentAccounts(role: Role | undefined): Promise<PaymentAccount[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(withdrawalMethodsPath(role));
  ensureOk(res, 'Could not load your payment accounts.');
  const data = Array.isArray(res.data) ? res.data : [];
  return data.map(mapAccount).filter((a) => a.id);
}

export type NewAccount = {
  methodType: MethodType;
  accountName: string;
  accountNumber: string;
  bankName: string;
  isDefault: boolean;
  /** ISO-2 of the phone's country; the backend routes non-RW payouts to PawaPay. */
  country: string;
};

export async function addPaymentAccount(role: Role | undefined, input: NewAccount): Promise<PaymentAccount> {
  const q = new URLSearchParams({
    methodType: input.methodType,
    accountName: input.accountName,
    accountNumber: input.accountNumber,
    bankName: input.bankName,
    isDefault: String(input.isDefault),
    country: input.country,
  });
  const res = await api.post<ApiEnvelope<Raw>>(`${withdrawalMethodsPath(role)}?${q.toString()}`);
  ensureOk(res, 'Could not save this account.');
  return mapAccount(res.data ?? {});
}

export async function setDefaultPaymentAccount(role: Role | undefined, a: PaymentAccount): Promise<void> {
  const q = new URLSearchParams({
    methodType: a.methodType,
    accountName: a.accountName || a.label,
    accountNumber: a.accountNumber,
    bankName: a.bankName,
    isDefault: 'true',
  });
  const res = await api.put<ApiEnvelope<Raw>>(`${withdrawalMethodsPath(role)}/${a.id}?${q.toString()}`);
  ensureOk(res, 'Could not make this your default account.');
}

export async function deletePaymentAccount(role: Role | undefined, id: string): Promise<void> {
  const res = await api.delete<ApiEnvelope<unknown>>(`${withdrawalMethodsPath(role)}/${id}`);
  ensureOk(res, 'Could not remove this account.');
}

/**
 * Look a mobile money number up with XentriPay. Returns the name the network
 * has on file ('' when it has none). Throws with the backend's message when
 * the lookup itself fails.
 *
 * `valid: false` only means XentriPay returned no name (the backend's
 * ValidateAccountResponseDTO.isValid is "registeredName is non-blank"). The web
 * still saves then, under the typed name, which is what lets non-RW numbers
 * that pay out through PawaPay be added, so this does not reject it either.
 */
export async function validateMobileAccount(accountNumber: string, bankId: string): Promise<string> {
  const q = new URLSearchParams({ accountNumber, bankId });
  const res = await api.post<ApiEnvelope<{ registeredName?: string; valid?: boolean }>>(
    `/withdrawals/xentripay/validate-account-details?${q.toString()}`,
  );
  if (res?.action !== 1 || !res.data) {
    throw {
      status: 400,
      message: res?.message || 'We could not verify this number. Check it and try again.',
    } satisfies ApiError;
  }
  return res.data.registeredName ?? '';
}

export type Bank = { id: string; name: string };

export async function listBanks(): Promise<Bank[]> {
  const res = await api.get<ApiEnvelope<{ banks?: Bank[] }>>('/withdrawals/xentripay/providers');
  ensureOk(res, 'Could not load the list of banks.');
  return Array.isArray(res.data?.banks) ? res.data.banks : [];
}
