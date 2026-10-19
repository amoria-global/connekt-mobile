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
  KNOWN_CURRENCIES,
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
  // A balance that was not reported must fail the load, not become a confirmed zero ("num" turns a missing or
  // malformed amount into 0, which on this screen reads as "you have nothing"). An empty list is a valid answer.
  if (!Array.isArray(res.data)) throw { status: 502, message: 'Could not read your balance.' } satisfies ApiError;
  if (res.data.some((r) => !isReportedAmount(r?.availableBalance))) {
    throw { status: 502, message: 'Could not read your balance.' } satisfies ApiError;
  }
  return res.data.map(mapSource);
}

function isReportedAmount(v: unknown): boolean {
  if (typeof v === 'number') return Number.isFinite(v);
  if (typeof v === 'string') return v.trim() !== '' && Number.isFinite(Number(v));
  return false;
}

const USD_ONLY = FALLBACK_CURRENCIES.filter((c) => c.code === 'USD');

/** RWF and USD with live rates; USD only when the rates cannot be loaded. */
export async function getDisplayCurrencies(): Promise<DisplayCurrency[]> {
  try {
    const res = await api.get<ApiEnvelope<Record<string, { rateToUsd?: unknown; symbol?: unknown }>>>(
      '/public/currencies/rates',
      { skipAuth: true },
    );
    if (res?.action === 1 && res.data) return applyRates(KNOWN_CURRENCIES, res.data);
    return USD_ONLY;
  } catch {
    // Without live rates a local-currency amount would be converted at a
    // stale fixed rate, so offer USD only until rates load.
    return USD_ONLY;
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
    // 408 is our own client timeout, not a refusal: the request may have
    // landed, so it must not read as a wrong code.
    if (err && typeof err === 'object' && 'status' in err && err.status >= 400 && err.status < 500 && err.status !== 401 && err.status !== 408) {
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
