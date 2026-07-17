/**
 * "Connect to TV" — confirms a pairing code scanned from a Smart TV's QR
 * code, and manages the list of previously paired TVs. Backed by
 * amoria-connect's /api/remote/tv/pairing/* and /customer/tv-devices/*.
 */
import { api } from '@/api/client';
import type { ApiError } from '@/types';
import type { TvDevice } from './types';

export async function confirmTvPairing(pairingCode: string, deviceLabel?: string): Promise<void> {
  const res = await api.post<{ action: number; message?: string }>('/tv/pairing/confirm', {
    pairingCode,
    deviceLabel,
  });
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Could not connect to that TV. The code may have expired.',
    } satisfies ApiError;
  }
}

export async function listTvDevices(): Promise<TvDevice[]> {
  const res = await api.get<{ action: number; data?: TvDevice[] }>('/customer/tv-devices');
  return res.data ?? [];
}

export async function removeTvDevice(id: string): Promise<void> {
  await api.delete(`/customer/tv-devices/${id}`);
}
