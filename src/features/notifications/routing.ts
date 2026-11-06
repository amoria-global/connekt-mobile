/**
 * Maps a notification (from a push payload, deep link, Universal Link, or the
 * in-app list) to the exact in-app screen for the entity it is about.
 */
import type { Href } from 'expo-router';
import { collabRouteFromLink } from '../collab/model';

export type NotificationRouteInput = {
  type?: string;
  candidateId?: string;
  referenceId?: string;
  /** Push payloads may carry an explicit eventId; used before referenceId. */
  eventId?: string;
  link?: string;
  deepLink?: string;
  url?: string;
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Normalizes a full URL (https://..., connekt://...) or relative path into a
 * leading-slash path + query string (e.g. "/offers/123" or "/bookings?tab=opportunities").
 */
export function normalizeNotificationLink(raw?: string): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Custom scheme: connekt://offers/123 or connekt:///offers/123
  const schemeMatch = trimmed.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/(.*)$/);
  if (schemeMatch && !/^https?:\/\//i.test(trimmed)) {
    const rest = schemeMatch[1].replace(/^\/+/, '');
    return rest ? `/${rest}` : '/';
  }

  try {
    const parsed = new URL(trimmed);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

export function notificationTarget(n: NotificationRouteInput): Href {
  const rawLink = n.deepLink || n.link || n.url;
  const targetLink = normalizeNotificationLink(rawLink);

  if (targetLink) {
    // Album collaboration notifications name their screen in the link, and
    // their referenceId is a dedup key rather than an album id.
    const collab = collabRouteFromLink(targetLink);
    if (collab) return collab as Href;

    if (targetLink.startsWith('/bookings?')) {
      return targetLink as Href;
    }

    // Offers, opportunities, and jobs routes:
    //   /opportunities/{id}, /offers/{id}, /jobs/{id}, /user/photographer/opportunities/{id}
    const offerMatch = targetLink.match(
      /^\/(?:user\/photographer\/)?(?:opportunities|offers|jobs)(?:\/([^/?#]+))?(?:[/?#]|$)/,
    );
    if (offerMatch) {
      const id = offerMatch[1];
      return (
        id && SAFE_ID.test(id)
          ? `/bookings?tab=opportunities&candidate=${encodeURIComponent(id)}`
          : '/bookings?tab=opportunities'
      ) as Href;
    }

    const candidatesMatch = targetLink.match(/^\/events\/([^/?#]+)\/candidates/);
    if (candidatesMatch && SAFE_ID.test(candidatesMatch[1])) {
      return `/event/candidates?id=${candidatesMatch[1]}` as Href;
    }

    const bookingMatch = targetLink.match(/^\/bookings\/([^/?#]+)/);
    if (bookingMatch && SAFE_ID.test(bookingMatch[1])) {
      return `/event/${bookingMatch[1]}` as Href;
    }

    const eventMatch = targetLink.match(/^\/events\/([^/?#]+)/);
    if (eventMatch && SAFE_ID.test(eventMatch[1])) {
      return `/event/${eventMatch[1]}` as Href;
    }
  }

  const type = (n.type ?? '').toUpperCase();
  const candidateId = n.candidateId && SAFE_ID.test(n.candidateId) ? n.candidateId : undefined;
  const ref = n.eventId || n.referenceId;

  if (candidateId && (type === 'OPPORTUNITY' || type === 'HYBRID_OPPORTUNITY' || type === 'OFFER')) {
    return `/bookings?tab=opportunities&candidate=${encodeURIComponent(candidateId)}` as Href;
  }

  if (ref) {
    switch (type) {
      case 'BOOKING':
      case 'EVENT':
      case 'ASSIGNMENT':
        return `/event/${ref}` as Href;
      // "Your stream is still live. End it?": the stream controls, where End stream is one tap.
      case 'STREAM_REMINDER':
        return (SAFE_ID.test(ref) ? `/stream/control/${ref}` : '/events') as Href;
      case 'CANDIDATE':
      case 'CANDIDATES':
      case 'PHOTOGRAPHER_AVAILABLE':
        return `/event/candidates?id=${ref}` as Href;
      case 'OPPORTUNITY':
      case 'HYBRID_OPPORTUNITY':
      case 'OFFER':
        return (
          SAFE_ID.test(ref)
            ? `/bookings?tab=opportunities&candidate=${encodeURIComponent(ref)}`
            : '/bookings?tab=opportunities'
        ) as Href;
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
    case 'OPPORTUNITY':
    case 'HYBRID_OPPORTUNITY':
    case 'HYBRID_UPDATE':
    case 'HYBRID_MATCH':
      return '/bookings?tab=opportunities' as Href;
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

let lastNavTarget: string | null = null;
let lastNavAt = 0;
const NAV_DEDUP_WINDOW_MS = 1500;

/**
 * Prevents duplicate navigation when multiple notification/deep-link listeners
 * fire for the same user tap within a short window.
 */
export function shouldNavigateToTarget(target: string, now = Date.now()): boolean {
  if (!target) return false;
  if (lastNavTarget === target && now - lastNavAt < NAV_DEDUP_WINDOW_MS) {
    return false;
  }
  lastNavTarget = target;
  lastNavAt = now;
  return true;
}

export function resetNavigationDedup(): void {
  lastNavTarget = null;
  lastNavAt = 0;
}
