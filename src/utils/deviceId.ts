/**
 * Stable, opaque per-install device id used by the anonymous-viewer flow.
 *
 * Stored in SecureStore so it survives app restarts but is wiped when the
 * user reinstalls. It is NOT a hardware identifier — the backend just needs
 * a stable handle to enforce one-device-per-paid-viewer.
 */
import * as Crypto from 'expo-crypto';
import { storage } from '@/services/storage';

const KEY = 'anonymous.deviceId';

export async function getDeviceId(): Promise<string> {
  const existing = await storage.get(KEY);
  if (existing) return existing;
  const fresh = Crypto.randomUUID();
  await storage.set(KEY, fresh);
  return fresh;
}
