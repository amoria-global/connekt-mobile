/**
 * Maps a notification (from a push payload OR the in-app list) to the exact
 * in-app screen for the entity it's about, matching salo-run behavior.
 */
import type { Href } from 'expo-router';
import { collabRouteFromLink } from '../collab/model';

export type NotificationRouteInput = {
  type?: string;
  referenceId?: string;
  /** Push payloads may carry an explicit eventId; used before referenceId. */
  eventId?: string;
  link?: string;
  deepLink?: string;
};

export function notificationTarget(n: NotificationRouteInput): Href {
  const targetLink = n.deepLink || n.link;

  if (targetLink) {
    // Album collaboration notifications name their screen in the link, and
    // their referenceId is a dedup key rather than an album id.
    const collab = collabRouteFromLink(targetLink);
    if (collab) return collab as Href;

    // Master guide deep link routes:
    if (targetLink === '/opportunities' || targetLink.startsWith('/opportunities')) {
      // "/opportunities/{candidateId}" opens that exact opportunity.
      const one = targetLink.match(/^\/opportunities\/([^/?#]+)/);
      return (one ? `/bookings?tab=opportunities&candidate=${one[1]}` : '/bookings?tab=opportunities') as Href;
    }
    const candidatesMatch = targetLink.match(/^\/events\/([^/]+)\/candidates/);
    if (candidatesMatch) {
      return `/event/candidates?id=${candidatesMatch[1]}` as Href;
    }
    const bookingMatch = targetLink.match(/^\/bookings\/([^/]+)/);
    if (bookingMatch) {
      return `/event/${bookingMatch[1]}` as Href;
    }
    const eventMatch = targetLink.match(/^\/events\/([^/]+)/);
    if (eventMatch) {
      return `/event/${eventMatch[1]}` as Href;
    }
  }

  const type = (n.type ?? '').toUpperCase();
  const ref = n.eventId || n.referenceId;

  if (ref) {
    switch (type) {
      case 'BOOKING':
      case 'EVENT':
      case 'ASSIGNMENT':
        return `/event/${ref}` as Href;
      case 'CANDIDATE':
      case 'CANDIDATES':
      case 'PHOTOGRAPHER_AVAILABLE':
        return `/event/candidates?id=${ref}` as Href;
      case 'OPPORTUNITY':
      case 'HYBRID_OPPORTUNITY':
      case 'HYBRID_UPDATE':
      case 'HYBRID_MATCH':
        return '/bookings?tab=opportunities' as Href;
      case 'PAYMENT':
      case 'GIFT':
      case 'STREAMFEE':
      case 'TIP':
      case 'BONUS':
        return `/payment/${ref}` as Href;
      case 'ALBUM':
      case 'MEDIA':
      case 'GALLERY':
        return `/album/${ref}` as Href;
      case 'PHOTOBOOK':
      case 'PHOTOBOOK_RECEIVED':
        return `/photobook/${ref}` as Href;
      case 'MESSAGE':
      case 'CHAT':
        return `/conversation/${ref}` as Href;
      case 'PHOTOGRAPHER':
        return `/photographer/${ref}` as Href;
      case 'SECURITY':
      case 'SYSTEM':
        return '/profile' as Href;
      default:
        break;
    }
  }

  // Graceful category-level fallbacks when no specific referenceId is provided
  switch (type) {
    case 'ALBUM':
    case 'MEDIA':
    case 'GALLERY':
      return '/gallery' as Href;
    case 'PAYMENT':
    case 'GIFT':
    case 'STREAMFEE':
    case 'TIP':
    case 'BONUS':
      return '/wallet' as Href;
    case 'BOOKING':
    case 'EVENT':
    case 'ASSIGNMENT':
      return '/events' as Href;
    case 'PHOTOGRAPHER':
      return '/photographers' as Href;
    case 'SECURITY':
    case 'SYSTEM':
      return '/profile' as Href;
    case 'MESSAGE':
    case 'CHAT':
      return '/inbox' as Href;
    default:
      return '/notifications' as Href;
  }
}
