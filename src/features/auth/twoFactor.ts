/**
 * Second sign-in step. The contract is the backend's docs/TWO_FACTOR.md.
 *
 * The server owns every decision: whether a code is right, how many tries are left,
 * and when the next code may be asked for. This file only carries the answers to the
 * screen, so nothing here validates a code.
 */
import { api } from '@/api/client';
import type { ApiError } from '@/types';

export type TwoFactorMethod = 'TOTP' | 'EMAIL';

export type TwoFactorChallenge = {
  /** Signed id; every verify call sends it. */
  challengeId: string;
  /** Kept only so the screen can still reach an old backend. */
  customerId: string;
  methods: TwoFactorMethod[];
  defaultMethod: TwoFactorMethod;
  maskedEmail?: string;
  expiresAt?: string;
};

export type NeedsTotpError = ApiError & { needsTotp: true; customerId: string; challenge: TwoFactorChallenge };

type ChallengeBody = {
  customerId?: string;
  challengeId?: string;
  challengeExpiresAt?: string;
  twoFactorMethods?: string[];
  twoFactorDefaultMethod?: string;
  maskedEmail?: string;
};

function asMethod(m: unknown): TwoFactorMethod | null {
  return m === 'TOTP' || m === 'EMAIL' ? m : null;
}

/** Reads the challenge fields off an action 2 login answer. Old backends send only `customerId`. */
export function challengeFrom(res: ChallengeBody): TwoFactorChallenge {
  const methods = (res.twoFactorMethods ?? []).map(asMethod).filter((m): m is TwoFactorMethod => m !== null);
  const list: TwoFactorMethod[] = methods.length ? methods : ['TOTP'];
  const fallback = asMethod(res.twoFactorDefaultMethod);
  return {
    challengeId: res.challengeId ?? '',
    customerId: res.customerId ?? '',
    methods: list,
    defaultMethod: fallback && list.includes(fallback) ? fallback : list[0],
    maskedEmail: res.maskedEmail,
    expiresAt: res.challengeExpiresAt,
  };
}

/** The error login throws when the account needs a second factor. */
export function needsTotpError(res: ChallengeBody & { message?: string }): NeedsTotpError {
  const challenge = challengeFrom(res);
  return {
    status: 403,
    message: res.message || 'Two-factor authentication is required.',
    needsTotp: true,
    customerId: challenge.customerId,
    challenge,
  };
}

/** Route params for the verify screen. Strings only, so expo-router can carry them. */
export function challengeParams(c: TwoFactorChallenge): Record<string, string> {
  return {
    customerId: c.customerId,
    challengeId: c.challengeId,
    methods: c.methods.join(','),
    defaultMethod: c.defaultMethod,
    maskedEmail: c.maskedEmail ?? '',
    expiresAt: c.expiresAt ?? '',
  };
}

export function challengeFromParams(p: Record<string, string | string[] | undefined>): TwoFactorChallenge {
  const one = (k: string) => (Array.isArray(p[k]) ? p[k]![0] : (p[k] as string | undefined)) ?? '';
  return challengeFrom({
    customerId: one('customerId'),
    challengeId: one('challengeId'),
    twoFactorMethods: one('methods') ? one('methods').split(',') : [],
    twoFactorDefaultMethod: one('defaultMethod'),
    maskedEmail: one('maskedEmail') || undefined,
    challengeExpiresAt: one('expiresAt') || undefined,
  });
}

export type CodeErrorCode =
  | 'WRONG_CODE'
  | 'CODE_ALREADY_USED'
  | 'LOCKED'
  | 'RATE_LIMITED'
  | 'EXPIRED'
  | 'SESSION_EXPIRED'
  | 'RESEND_TOO_SOON'
  | 'UNKNOWN';

/** A refused code check or send, with the server's numbers. */
export type CodeError = ApiError & {
  codeError: true;
  errorCode: CodeErrorCode;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  expiresAt?: string;
};

export function isCodeError(err: unknown): err is CodeError {
  return typeof err === 'object' && err !== null && (err as { codeError?: unknown }).codeError === true;
}

type Refusal = {
  message?: string;
  errorCode?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  expiresAt?: string;
};

const KNOWN: CodeErrorCode[] = [
  'WRONG_CODE', 'CODE_ALREADY_USED', 'LOCKED', 'RATE_LIMITED', 'EXPIRED', 'SESSION_EXPIRED', 'RESEND_TOO_SOON',
];

export function codeErrorFrom(res: Refusal, fallback: string): CodeError {
  const code = KNOWN.find((k) => k === res.errorCode) ?? 'UNKNOWN';
  return {
    status: 400,
    message: res.message || fallback,
    codeError: true,
    errorCode: code,
    attemptsLeft: typeof res.attemptsLeft === 'number' ? res.attemptsLeft : undefined,
    retryAfterSeconds: typeof res.retryAfterSeconds === 'number' ? res.retryAfterSeconds : undefined,
    expiresAt: res.expiresAt,
  };
}

/** What a send answers: the server's clock and when the next send is allowed. */
export type CodeSent = {
  maskedEmail?: string;
  expiresAt: string;
  resendAvailableAt: string;
  serverTime: string;
};

type SendBody = Refusal & { action?: number; data?: Partial<CodeSent> };

export function codeSentFrom(res: SendBody, fallback: string): CodeSent {
  const d = res.data;
  if (res.action !== 1 || !d?.expiresAt || !d.resendAvailableAt || !d.serverTime) {
    throw codeErrorFrom(res, fallback);
  }
  return { maskedEmail: d.maskedEmail, expiresAt: d.expiresAt, resendAvailableAt: d.resendAvailableAt, serverTime: d.serverTime };
}

/**
 * Seconds from now until `target`, measured on the server's clock: the gap between the
 * device clock and `serverTime` is removed, so a phone with the wrong time still counts right.
 */
export function secondsUntil(target: string, serverTime: string, receivedAtMs: number, nowMs = Date.now()): number {
  const skew = Date.parse(serverTime) - receivedAtMs;
  const serverNow = nowMs + (Number.isFinite(skew) ? skew : 0);
  const left = Math.ceil((Date.parse(target) - serverNow) / 1000);
  return Number.isFinite(left) ? Math.max(0, left) : 0;
}

/** 90 -> "1:30", 5 -> "0:05". */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Asks the server to email a sign-in code. */
export async function sendEmailCode(challengeId: string): Promise<CodeSent> {
  const res = await api.post<SendBody>('/auth/2fa/email/send', { challengeId }, { skipAuth: true });
  return codeSentFrom(res, 'We could not send a code. Try again.');
}
