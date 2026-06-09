/**
 * Two-factor authentication (authenticator app / TOTP).
 * /api/remote/customer/totp — status, setup (QR + secret), enable, disable.
 */
import { api } from '@/api/client';
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
