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
  /** Id of the entity this notification is about (event, payment, album…). */
  referenceId?: string;
  /** Backend-provided web link (fallback context). */
  link?: string;
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
    referenceId: str(r.referenceId),
    link: str(r.link),
  };
}

function pageContent(data: unknown): Raw[] {
  // Backend wraps notifications in a Spring Page object:
  //   { content: [...], pageable: {...}, totalElements, ... }
  // Older / alternate endpoints sometimes return a flat array directly,
  // so accept both shapes.
  if (Array.isArray(data)) return data as Raw[];
  const c = (data as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as Raw[]) : [];
}

export async function listNotifications(role: NotificationsRole | boolean): Promise<AppNotification[]> {
  const res = await api.get<ApiEnvelope<unknown>>(base(role));
  return pageContent(res?.data).map(mapNotification).filter((n) => n.id);
}

export async function markRead(role: NotificationsRole | boolean, id: string): Promise<void> {
  await api.post(`${base(role)}/${encodeURIComponent(id)}/mark-read`);
}

export async function markAllRead(role: NotificationsRole | boolean): Promise<void> {
  await api.post(`${base(role)}/mark-all-read`);
}

/**
 * Register this device's Expo push token with the backend so it can push
 * event notifications to the system tray.
 *
 * Backend: NotificationController#registerPushToken stores { token, platform }
 * against the signed-in user; ExpoPushService then fires an Expo push
 * (https://exp.host/--/api/v2/push/send) from NotificationService whenever a
 * notification is created (booking / event / album / payment). Best-effort —
 * a failure here never blocks the app.
 */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  try {
    await api.post('/customer/notifications/push-token', { token, platform });
  } catch {
    /* non-fatal */
  }
}
