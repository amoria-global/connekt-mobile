/**
 * Which new notifications alert inside the open app, and how.
 *
 * System push notifications always show their banner, sound, and lock-screen
 * alert (`showSystemBannerInForeground` returns `true`) so Android never marks
 * notifications silent (`setSilent(true)`) or downgrades their priority when
 * `.MainActivity` has `android:showWhenLocked="true"`.
 *
 * In addition, `InAppNotificationWatcher` polls the notifications section and
 * alerts with `'ring'` for new incoming offers (`OPPORTUNITY`, `HYBRID_OPPORTUNITY`)
 * and booking requests, and `'chime'` for booking/payment updates.
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

/** Types for incoming shoot offers that ring and wake the lock screen. */
export const OPPORTUNITY_TYPES = new Set(['OPPORTUNITY', 'HYBRID_OPPORTUNITY']);

/** Types that chime in-app and post to booking_updates. */
export const WATCHED_TYPES = new Set(['BOOKING', 'PAYMENT', 'HYBRID_UPDATE']);

export function inAppAlertKind(n: AlertCandidate): InAppAlertKind | null {
  const type = (n.rawType ?? '').toUpperCase();
  if (OPPORTUNITY_TYPES.has(type)) return 'ring';
  if (RINGING_TITLES.has(n.title ?? '')) return 'ring';
  if (WATCHED_TYPES.has(type)) return 'chime';
  return null;
}

/** Unread notifications not in the previous poll; nothing on the first poll. */
export function freshUnread<T extends AlertCandidate>(seen: Set<string> | null, items: T[]): T[] {
  if (seen === null) return [];
  return items.filter((n) => !n.read && !seen.has(n.id));
}

/**
 * Always allow the OS notification banner and sound to present so Android
 * never sets `setSilent(true)` or downgrades priority to `PRIORITY_DEFAULT`,
 * including when `MainActivity` is resumed over the lock screen (`showWhenLocked`).
 */
export function showSystemBannerInForeground(_data?: Record<string, unknown> | undefined): boolean {
  return true;
}
