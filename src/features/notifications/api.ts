/**
 * Notifications API — Mirrors salo-run notification features and Spring Boot backend endpoints.
 * Supports roles: Client/Customer, Photographer, Coordinator.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type NotificationType =
  | 'album'
  | 'gift'
  | 'payment'
  | 'streamfee'
  | 'security'
  | 'booking'
  | 'event'
  | 'photographer'
  | 'photobook'
  | 'review'
  | 'tip'
  | 'bonus'
  | 'message';

export type AppNotification = {
  id: ID;
  title: string;
  body?: string;
  message: string;
  read: boolean;
  createdAt?: string;
  type: NotificationType;
  rawType?: string;
  /** Id of the entity this notification is about (event, payment, album…). */
  referenceId?: string;
  /** Backend-provided web link (fallback context). */
  link?: string;
  amount?: number;
  avatar?: string;
  albumPreview?: string;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const parsed = parseFloat(v);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return undefined;
}

export type NotificationsRole =
  | 'Client'
  | 'Photographer'
  | 'Coordinator'
  | 'Viewer'
  | 'User'
  | 'photographer'
  | 'coordinator'
  | 'event-coordinator'
  | 'client'
  | 'user'
  | (string & {});

/**
 * Maps backend uppercase notification types to typed categories, matching salo-run.
 */
export function mapBackendType(backendType?: string, role?: string): NotificationType {
  const normRole = (role ?? '').toLowerCase();
  switch (backendType?.toUpperCase()) {
    case 'MEDIA':
    case 'ALBUM':
    case 'GALLERY':
      return 'album';
    case 'PAYMENT':
      return normRole.includes('coordinator')
        ? 'streamfee'
        : normRole.includes('photographer')
          ? 'payment'
          : 'gift';
    case 'TIP':
      return 'tip';
    case 'BONUS':
      return 'bonus';
    case 'BOOKING':
    case 'EVENT':
    case 'ASSIGNMENT':
      return 'booking';
    case 'SYSTEM':
    case 'SECURITY':
      return 'security';
    case 'PHOTOBOOK':
    case 'PHOTOBOOK_RECEIVED':
      return 'photobook';
    case 'REVIEW':
      return 'review';
    case 'PHOTOGRAPHER':
      return 'photographer';
    case 'MESSAGE':
    case 'CHAT':
      return 'message';
    default:
      return 'booking';
  }
}

/**
 * Returns base endpoint for role.
 */
export function notificationBase(role: NotificationsRole | boolean | undefined): string {
  if (typeof role === 'boolean') return role ? '/photographer/notifications' : '/customer/notifications';
  const norm = (role ?? '').toLowerCase();
  if (norm.includes('photographer')) return '/photographer/notifications';
  if (norm.includes('coordinator')) return '/coordinator/notifications';
  return '/customer/notifications';
}

function mapNotification(r: Raw, role?: string): AppNotification {
  const rawType = str(r.type);
  const msg = str(r.message) ?? str(r.body) ?? '';
  return {
    id: String(r.id ?? r.notificationId ?? ''),
    title: str(r.title) ?? str(r.subject) ?? 'Notification',
    message: msg,
    body: msg,
    read: !!r.readAt || r.read === true || r.isRead === true,
    createdAt: str(r.createdAt) ?? str(r.timestamp),
    rawType,
    type: mapBackendType(rawType, role),
    referenceId: str(r.referenceId),
    link: str(r.link),
    amount: num(r.amount),
    avatar: str(r.avatar) ?? str(r.senderAvatar),
    albumPreview: str(r.albumPreview) ?? str(r.coverUrl) ?? str(r.previewUrl),
  };
}

function pageContent(data: unknown): Raw[] {
  if (Array.isArray(data)) return data as Raw[];
  const c = (data as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as Raw[]) : [];
}

/**
 * Fetch notifications list (supports Spring Page and raw array responses).
 */
export async function listNotifications(
  role: NotificationsRole | boolean | undefined,
  page = 0,
  size = 50,
): Promise<AppNotification[]> {
  const roleStr = typeof role === 'string' ? role : role ? 'Photographer' : 'Client';
  const res = await api.get<ApiEnvelope<unknown>>(`${notificationBase(role)}?page=${page}&size=${size}`);
  const items = pageContent(res?.data)
    .map((raw) => mapNotification(raw, roleStr))
    .filter((n) => n.id);

  // Newest first
  items.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return items;
}

/**
 * Mark a single notification as read (PATCH /notifications/{id}/read).
 */
export async function markRead(role: NotificationsRole | boolean | undefined, id: string): Promise<void> {
  const b = notificationBase(role);
  try {
    await api.patch(`${b}/${encodeURIComponent(id)}/read`);
  } catch {
    await api.post(`${b}/${encodeURIComponent(id)}/mark-read`);
  }
}

/**
 * Mark all notifications as read (PATCH /notifications/read-all).
 */
export async function markAllRead(role: NotificationsRole | boolean | undefined): Promise<void> {
  const b = notificationBase(role);
  try {
    await api.patch(`${b}/read-all`);
  } catch {
    await api.post(`${b}/mark-all-read`);
  }
}

/**
 * Delete a single notification (DELETE /notifications/{id}).
 */
export async function deleteNotification(
  role: NotificationsRole | boolean | undefined,
  id: string,
): Promise<void> {
  await api.delete(`${notificationBase(role)}/${encodeURIComponent(id)}`);
}

/**
 * Delete all read notifications (DELETE /notifications/delete-read).
 */
export async function deleteReadNotifications(
  role: NotificationsRole | boolean | undefined,
): Promise<void> {
  await api.delete(`${notificationBase(role)}/delete-read`);
}

/**
 * Delete all notifications (DELETE /notifications/all).
 */
export async function deleteAllNotifications(
  role: NotificationsRole | boolean | undefined,
): Promise<void> {
  await api.delete(`${notificationBase(role)}/all`);
}

/**
 * Get count of unread notifications.
 */
export async function getUnreadCount(
  role: NotificationsRole | boolean | undefined,
): Promise<number> {
  try {
    const res = await api.get<ApiEnvelope<number>>(`${notificationBase(role)}/unread-count`);
    if (typeof res?.data === 'number') return res.data;
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Register this device's Expo push token with the backend.
 */
export async function registerPushToken(token: string, platform: string): Promise<void> {
  try {
    await api.post('/customer/notifications/push-token', { token, platform });
  } catch {
    /* non-fatal */
  }
}
