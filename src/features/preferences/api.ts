/**
 * Notification preferences — mirrors the web key/value preferences store.
 * - GET  {base}            → { data: { key: "true"|"false", ... } }
 * - PUT  {base}/{key}      → body { value: "true"|"false" }
 * Base path is role-aware: /customer | /coordinator | /photographer + /preferences.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

export type Prefs = Record<string, string>;

export function preferencesBase(role: { isPhotographer: boolean; isCoordinator: boolean }): string {
  if (role.isPhotographer) return '/photographer/preferences';
  if (role.isCoordinator) return '/coordinator/preferences';
  return '/customer/preferences';
}

/** Toggle keys + labels, matching the web preferences page exactly. */
export const NOTIFICATION_TOGGLES: { key: string; label: string; description: string }[] = [
  { key: 'email_notifications', label: 'Email notifications', description: 'Updates and receipts by email' },
  { key: 'push_notifications', label: 'Push notifications', description: 'Alerts on your device' },
  { key: 'booking_notifications', label: 'Bookings', description: 'New requests and status changes' },
  { key: 'payment_notifications', label: 'Payments', description: 'Payments, payouts, and refunds' },
  { key: 'album_notifications', label: 'Albums & photos', description: 'When new photos are shared with you' },
  { key: 'gift_notifications', label: 'Gifts & tips', description: 'When you receive gifts or tips' },
  { key: 'stream_fee_notifications', label: 'Live streams', description: 'Stream access and fee updates' },
];

export async function getPreferences(base: string): Promise<Prefs> {
  const res = await api.get<ApiEnvelope<Record<string, unknown>>>(base);
  const d = (res?.data ?? {}) as Record<string, unknown>;
  const out: Prefs = {};
  for (const [k, v] of Object.entries(d)) out[k] = String(v);
  return out;
}

export async function setPreference(base: string, key: string, value: boolean): Promise<void> {
  await api.put(`${base}/${encodeURIComponent(key)}`, { value: String(value) });
}
