import type { ID } from '@/types';

export type EventStatus = string;

/** Payload for creating an event / booking a photographer. */
export type CreateEventInput = {
  title: string;
  description?: string;
  /** Maps to the backend `eventType`. */
  category: string;
  eventDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm (defaults to startTime)
  location?: string;
  price?: number;
  currency?: string;
  maxGuests?: number;
  eventVisibility?: string;
  organizer?: string;
  tags?: string[];
  /** Optional booking context when created from a photographer's package. */
  photographerId?: string;
  packageId?: string;
  escrowPercentage?: number;
};

/** Normalized event item used by the UI. */
export type EventItem = {
  id: ID;
  title: string;
  eventDate?: string;
  location?: string;
  status?: EventStatus;
  category?: string;
  /** Category id when available (lets edit forms pre-select the row). */
  categoryId?: string;
  photographerName?: string;
  coverImage?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  published?: boolean;
  /**
   * Booking lifecycle: PENDING | ACCEPTED | DECLINED | CANCELLED.
   * Surfaced so the photographer-facing event-detail page can show
   * Accept / Decline CTAs only while the booking is PENDING.
   */
  bookingStatus?: string;

  // ──────── Edit-form fields (web parity) ────────
  // Without these, opening the edit modal cleared half the form and
  // forced the user to retype everything. Now the mapper carries the
  // full payload through so the form can prefill every "more settings"
  // field the create modal exposes.
  price?: number;
  currency?: string;
  maxGuests?: number;
  organizer?: string;
  tags?: string[];
  eventVisibility?: string;
  notes?: string;
};

/**
 * Public event payload returned by `/public/events/list` and
 * `/public/events/{id}`. Field names mirror the web `PublicEvent` (kept
 * verbatim — `eventStatus`, `streamStatus`, `eventPhoto`, `eventOrganizer`,
 * `streamFeeCurrencyAbbreviation`) so the web's status rules port over
 * unchanged. Used by the public (guest) flows in (public)/events/*.
 */
export type PublicEventCreator = {
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  customerType?: string;
};

export type PublicEventCategory = {
  id?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
};

export type PublicEvent = {
  id: ID;
  title: string;
  description?: string;
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  eventOrganizer?: string;
  eventTags?: string;
  eventPhoto?: string;
  eventCategory?: PublicEventCategory | null;
  /** Booking price (used as a fallback when streamFee is 0). */
  price?: number;
  /** UPCOMING | ONGOING | COMPLETED | AWAITING_REVIEW | … */
  eventStatus?: string;
  completionStatus?: string;
  bookingStatus?: string;
  maxGuests?: number;
  creator?: PublicEventCreator;
  notes?: string;
  /** Stream entry fee — 0 when the event is free. */
  streamFee?: number | null;
  streamFeeCurrencySymbol?: string | null;
  streamFeeCurrencyAbbreviation?: string | null;
  hasLiveStream?: boolean | null;
  streamType?: 'entry_fee' | 'invite_token' | null;
  groupDiscountPercentage?: number | null;
  hasInviteCode?: boolean | null;
  liveInputId?: string | null;
  hlsManifestUrl?: string | null;
  whepUrl?: string | null;
  /** "live" | "ended" | null — null = stream never started. */
  streamStatus?: string | null;
  hasPurchasedAccess?: boolean;
  eventPriceId?: string | null;
  /** Mapped from the backend's `photographer` nested object. */
  photographerName?: string;
  photographerImage?: string;
  photographerId?: string;
  packageName?: string;
  packagePrice?: number;
  packageCurrencyAbbreviation?: string;
};

/** Backend tab → server-side `status` filter (web parity). */
export type PublicEventsTab = 'all' | 'live' | 'upcoming' | 'completed';
export const TAB_TO_STATUS: Record<PublicEventsTab, string | undefined> = {
  all: undefined,
  live: 'ONGOING',
  upcoming: 'PUBLISHED',
  completed: 'COMPLETED',
};

/** Filter query for listPublicEventsDetailed (web parity). */
export type PublicEventsQuery = {
  page?: number;
  size?: number;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  category?: string;
  location?: string;
  status?: string;
  dateRange?: 'today' | 'tomorrow' | 'this-week' | 'this-month' | 'next-month' | string;
  search?: string;
};

export type PublicEventsPage = {
  content: PublicEvent[];
  totalPages: number;
  totalElements: number;
  number: number;
  size: number;
  first: boolean;
  last: boolean;
};

// ────── Web-parity status helpers ──────
//
// Mirror knockout/app/pages/events/events.tsx:373-379 exactly so a guest
// sees the same tab counts and badges as the website.

/**
 * `isEventLive` — true only when the backend says the event is ONGOING,
 * the stream hasn't ended, AND either `hasLiveStream === true` or the
 * caller has verified the Cloudflare connection is `live`. The
 * verified-id set is passed in (web fetches it via `getStreamVideo`);
 * mobile guests can't call that auth-required endpoint so they pass
 * an empty set and fall back to the `hasLiveStream` flag.
 */
export function isEventLive(event: PublicEvent, liveStreamIds?: Set<string>): boolean {
  if ((event.eventStatus || '').toUpperCase() !== 'ONGOING') return false;
  if (event.streamStatus === 'ended') return false;
  if (event.hasLiveStream === true) return true;
  return liveStreamIds?.has(event.id) ?? false;
}

export function isEventEnded(event: PublicEvent): boolean {
  return (event.eventStatus || '').toUpperCase() === 'COMPLETED' || event.streamStatus === 'ended';
}
