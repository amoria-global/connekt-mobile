/**
 * Two-factor authentication (authenticator app / TOTP).
 * /api/remote/customer/totp — status, setup (QR + secret), enable, disable.
 */
import { api } from '@/api/client';
import { codeErrorFrom, codeSentFrom, type CodeSent } from '@/features/auth/twoFactor';
import type { ApiError } from '@/types';

export type TotpStatus = { enabled: boolean; required: boolean };
export type TotpSetup = { qrCode?: string; secret?: string };

export async function getTotpStatus(): Promise<TotpStatus> {
  const res = await api.get<{ twoFactorEnabled?: boolean; twoFactorRequired?: boolean }>(
    '/customer/totp/status',
  );
  return { enabled: res?.twoFactorEnabled === true, required: res?.twoFactorRequired === true };
}

export async function setupTotp(): Promise<TotpSetup> {
  const res = await api.post<{ qrCode?: string; secret?: string }>('/customer/totp/setup', undefined);
  return { qrCode: res?.qrCode, secret: res?.secret };
}

export async function enableTotp(code: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>('/customer/totp/enable', { code });
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'That code is invalid. Try again.' } satisfies ApiError;
  }
}

export async function disableTotp(code: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>('/customer/totp/disable', { code });
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not disable two-factor.' } satisfies ApiError;
  }
}

/** Which second factors the account has. `enabled` is true when ANY method is on. */
export type TwoFactorStatus = {
  enabled: boolean;
  required: boolean;
  totpEnabled: boolean;
  emailEnabled: boolean;
  emailVerified: boolean;
  maskedEmail?: string;
};

type StatusBody = {
  twoFactorEnabled?: boolean;
  twoFactorRequired?: boolean;
  totpEnabled?: boolean;
  emailEnabled?: boolean;
  emailVerified?: boolean;
  maskedEmail?: string;
};

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const res = await api.get<StatusBody>('/customer/2fa/status');
  return {
    enabled: res?.twoFactorEnabled === true,
    required: res?.twoFactorRequired === true,
    totpEnabled: res?.totpEnabled === true,
    emailEnabled: res?.emailEnabled === true,
    emailVerified: res?.emailVerified === true,
    maskedEmail: res?.maskedEmail,
  };
}

/** Emails a code to set the email method up or take it off. The server owns the timer and the limits. */
export async function sendEmailMethodCode(purpose: 'ENABLE' | 'DISABLE'): Promise<CodeSent> {
  const res = await api.post<Parameters<typeof codeSentFrom>[0]>('/customer/2fa/email/send', { purpose });
  return codeSentFrom(res, 'We could not send a code. Try again.');
}

async function emailMethod(path: 'enable' | 'disable', code: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>(`/customer/2fa/email/${path}`, { code });
  if (res?.action !== 1) throw codeErrorFrom(res ?? {}, 'That code is invalid. Try again.');
}

export const enableEmailMethod = (code: string) => emailMethod('enable', code);
export const disableEmailMethod = (code: string) => emailMethod('disable', code);

/** The same refusal shape for the authenticator calls, so one screen handles both. */
export async function enableTotpChecked(code: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>('/customer/totp/enable', { code });
  if (res?.action !== 1) throw codeErrorFrom(res ?? {}, 'That code is invalid. Try again.');
}

export async function disableTotpChecked(code: string): Promise<void> {
  const res = await api.post<{ action?: number; message?: string }>('/customer/totp/disable', { code });
  if (res?.action !== 1) throw codeErrorFrom(res ?? {}, 'Could not turn off two-factor.');
}

/** "ABCDEFGHIJKLMNOP" -> "ABCD EFGH IJKL MNOP", so the key is easy to read and type. */
export function groupKey(secret: string): string {
  return secret.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();
}
