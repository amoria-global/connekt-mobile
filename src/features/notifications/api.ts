/**
 * Notifications. Photographers and customers use different base paths.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type AppNotification = {
  id: ID;
  title: string;
  body?: string;
  read: boolean;
  createdAt?: string;
  type?: string;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export type NotificationsRole = 'Client' | 'Photographer' | 'Coordinator' | 'Viewer';

function base(role: NotificationsRole | boolean): string {
  // Backward-compat: legacy callers pass `role: NotificationsRole | boolean`.
  if (typeof role === 'boolean') return role ? '/photographer/notifications' : '/customer/notifications';
  if (role === 'Photographer') return '/photographer/notifications';
  if (role === 'Coordinator') return '/coordinator/notifications';
  return '/customer/notifications';
}

function mapNotification(r: Raw): AppNotification {
  return {
    id: String(r.id ?? r.notificationId ?? ''),
    title: str(r.title) ?? str(r.subject) ?? 'Notification',
    body: str(r.body) ?? str(r.message),
    read: !!r.readAt || r.read === true || r.isRead === true,
    createdAt: str(r.createdAt) ?? str(r.timestamp),
    type: str(r.type),
  };
}

export async function listNotifications(role: NotificationsRole | boolean): Promise<AppNotification[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(base(role));
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapNotification).filter((n) => n.id);
}

export async function markRead(role: NotificationsRole | boolean, id: string): Promise<void> {
  await api.post(`${base(role)}/${encodeURIComponent(id)}/mark-read`);
}

export async function markAllRead(role: NotificationsRole | boolean): Promise<void> {
  await api.post(`${base(role)}/mark-all-read`);
}
