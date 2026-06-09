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

function base(isPhotographer: boolean): string {
  return isPhotographer ? '/photographer/notifications' : '/customer/notifications';
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

export async function listNotifications(isPhotographer: boolean): Promise<AppNotification[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(base(isPhotographer));
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapNotification).filter((n) => n.id);
}

export async function markRead(isPhotographer: boolean, id: string): Promise<void> {
  await api.post(`${base(isPhotographer)}/${encodeURIComponent(id)}/mark-read`);
}

export async function markAllRead(isPhotographer: boolean): Promise<void> {
  await api.post(`${base(isPhotographer)}/mark-all-read`);
}
