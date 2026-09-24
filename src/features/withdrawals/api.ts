/**
 * Withdrawals: sources, initiate, verify, resend. See ./model for the
 * contract and why the client never calls the payout endpoint.
 */
import { api } from '@/api/client';
import type { Role } from '@/features/auth/role';
import type { ApiEnvelope, ApiError } from '@/types';
import {
  applyRates,
  FALLBACK_CURRENCIES,
  mapSource,
  readInitiate,
  readVerify,
  withdrawNamespace,
  type DisplayCurrency,
  type InitiateOutcome,
  type VerifyOutcome,
  type WithdrawSource,
} from './model';

type Raw = Record<string, unknown>;

export async function listWithdrawableSources(role: Role | undefined): Promise<WithdrawSource[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(`/${withdrawNamespace(role)}/withdrawable-sources`);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not load your balance.' } satisfies ApiError;
  }
  return (Array.isArray(res.data) ? res.data : []).map(mapSource);
}

/** RWF and USD with live rates; falls back to the web's fixed rates. */
export async function getDisplayCurrencies(): Promise<DisplayCurrency[]> {
  try {
    const res = await api.get<ApiEnvelope<Record<string, { rateToUsd?: unknown; symbol?: unknown }>>>(
      '/public/currencies/rates',
      { skipAuth: true },
    );
    return applyRates(FALLBACK_CURRENCIES, res?.action === 1 ? res.data : null);
  } catch {
    return FALLBACK_CURRENCIES;
  }
}

/**
 * The backend answers business refusals (KYC, balance, wallet suspended) with
 * action 0, sometimes on a 4xx. Both reach readInitiate/readVerify, so the
 * user sees the backend's own message either way.
 */
async function postEnvelope(path: string, body: unknown): Promise<Raw> {
  try {
    return await api.post<Raw>(path, body);
  } catch (e) {
    const err = e as ApiError;
    if (err && typeof err === 'object' && 'status' in err && err.status >= 400 && err.status < 500 && err.status !== 401) {
      return { action: 0, ...err.body, message: err.message };
    }
    throw e;
  }
}

export async function initiateWithdrawal(
  role: Role | undefined,
  input: {
    /** USD. */
    amount: number;
    withdrawalMethodId: string;
    /** USD. */
    donationAmount: number;
    source: WithdrawSource;
  },
): Promise<InitiateOutcome> {
  const res = await postEnvelope(`/${withdrawNamespace(role)}/withdraw/initiate`, {
    amount: input.amount,
    withdrawalMethodId: input.withdrawalMethodId,
    donationAmount: input.donationAmount,
    isGiftWithdrawal: input.source.isGiftWithdrawal,
    source: input.source.source.toUpperCase(),
  });
  return readInitiate(res);
}

export async function verifyWithdrawal(
  role: Role | undefined,
  input: { verificationId: string; otp?: string; selfie?: string },
): Promise<VerifyOutcome> {
  const res = await postEnvelope(`/${withdrawNamespace(role)}/withdraw/verify`, input);
  return readVerify(res);
}

/** Returns the new masked destination, when the backend sends one. */
export async function resendWithdrawalOtp(role: Role | undefined, verificationId: string): Promise<string | undefined> {
  const res = await postEnvelope(`/${withdrawNamespace(role)}/withdraw/resend-otp`, { verificationId });
  if (res?.action !== 1) {
    throw { status: 400, message: (res?.message as string) || 'Could not resend the code.' } satisfies ApiError;
  }
  const d = res.data as Raw | undefined;
  return typeof d?.maskedDestination === 'string' ? d.maskedDestination : undefined;
}
