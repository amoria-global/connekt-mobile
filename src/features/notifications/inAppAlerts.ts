/**
 * Which new notifications alert inside the open app, and how.
 *
 * With the app open, the phone's own banner for booking and payment pushes
 * is suppressed (push.ts) and InAppNotificationWatcher shows its own banner
 * and sound instead, so the alert also works when no push arrives (no push
 * credentials, Expo Go, push turned off). Opportunities and direct booking
 * requests are left to their full-screen alerts, which ring by themselves.
 */

export type InAppAlertKind = 'ring' | 'chime';

export type AlertCandidate = {
  id: string;
  rawType?: string;
  title?: string;
  read?: boolean;
};

/** Titles that ring; mirrors NotificationService.RINGING_TITLES on the backend. */
const RINGING_TITLES = new Set(['New Booking Request']);

/** Types the opportunity alert handles; the watcher stays out of their way. */
const OPPORTUNITY_TYPES = new Set(['OPPORTUNITY', 'HYBRID_OPPORTUNITY']);

/** Types whose foreground push banner the watcher replaces. */
export const WATCHED_TYPES = new Set(['BOOKING', 'PAYMENT']);

export function inAppAlertKind(n: AlertCandidate): InAppAlertKind | null {
  const type = (n.rawType ?? '').toUpperCase();
  if (OPPORTUNITY_TYPES.has(type)) return null;
  // Booking requests get the full-screen incoming request, which rings itself.
  if (RINGING_TITLES.has(n.title ?? '')) return null;
  if (WATCHED_TYPES.has(type)) return 'chime';
  return null;
}

/** Unread notifications not in the previous poll; nothing on the first poll. */
export function freshUnread<T extends AlertCandidate>(seen: Set<string> | null, items: T[]): T[] {
  if (seen === null) return [];
  return items.filter((n) => !n.read && !seen.has(n.id));
}

/** Should the phone's own banner show for this push while the app is open? */
export function showSystemBannerInForeground(data: Record<string, unknown> | undefined): boolean {
  const type = typeof data?.type === 'string' ? data.type.toUpperCase() : '';
  return !WATCHED_TYPES.has(type);
}
