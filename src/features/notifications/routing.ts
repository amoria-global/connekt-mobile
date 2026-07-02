/**
 * Maps a notification (from a push payload OR the in-app list) to the exact
 * in-app screen for the entity it's about — so "New booking" opens that
 * event, "Payment completed" opens that payment, "Album delivered" opens
 * that album, etc. Falls back to the Notifications list when there's no
 * specific target.
 *
 * The backend sets `type` + `referenceId` on every notification
 * (NotificationService): BOOKING/EVENT → event id, PAYMENT → declaration
 * id, ALBUM/MEDIA → album id, PHOTOBOOK → photobook id, MESSAGE → thread id.
 */
import type { Href } from 'expo-router';

export type NotificationRouteInput = {
  type?: string;
  referenceId?: string;
  /** Push payloads may carry an explicit eventId; used before referenceId. */
  eventId?: string;
};

export function notificationTarget(n: NotificationRouteInput): Href {
  const type = (n.type ?? '').toUpperCase();
  const ref = n.eventId || n.referenceId;

  if (ref) {
    switch (type) {
      case 'BOOKING':
      case 'EVENT':
        return `/event/${ref}` as Href;
      case 'PAYMENT':
        return `/payment/${ref}` as Href;
      case 'ALBUM':
      case 'MEDIA':
        return `/album/${ref}` as Href;
      case 'PHOTOBOOK':
        return `/photobook/${ref}` as Href;
      case 'MESSAGE':
      case 'CHAT':
        return `/conversation/${ref}` as Href;
      default:
        break;
    }
  }
  return '/notifications' as Href;
}
