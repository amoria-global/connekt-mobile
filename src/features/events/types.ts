import type { ID } from '@/types';

export type EventStatus = string;
/** How guests attend: a physical event (ticket consumed outside the app) or stream only. */export type AttendanceMode = 'IN_PERSON' | 'HYBRID' | 'STREAM_ONLY';export function parseAttendanceMode(v: unknown): AttendanceMode | undefined {  const s = typeof v === 'string' ? v.trim().toUpperCase() : '';  return s === 'IN_PERSON' || s === 'HYBRID' || s === 'STREAM_ONLY' ? s : undefined;}

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
  /** Organizer attestation: can guests attend in person at the venue? */
  attendanceMode?: AttendanceMode;
  price?: number;
  /**
   * Live-stream access fee (what viewers pay to watch). Distinct from `price`
   * (a booking budget): the whole streaming system — paywall, pay flow, and the
   * "Stream entry" label — keys off streamFee, so a fee sent only as `price`
   * shows "Free" and never charges anyone.
   */
  streamFee?: number;
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
  attendanceMode?: AttendanceMode;
  status?: EventStatus;
  category?: string;
  /** Category id when available (lets edit forms pre-select the row). */
  categoryId?: string;
  photographerName?: string;
  photographerId?: string;
  /**
   * The booking's client (who the photographer is shooting for). On the
   * photographer feed the card shows this person + avatar, not the
   * photographer. Web parity: photographer/events.tsx card footer.
   */
  clientName?: string;
  clientId?: string;
  clientAvatar?: string;
  /** Booked package label (e.g. "Diamond", "Gold") — shown as a card badge. */
  packageName?: string;
  /** Underlying booking ID if mapped from a booking record. */
  bookingId?: string;
  /** Whether this event carries a live stream (drives the Stream pill + CTA). */
  hasLiveStream?: boolean;
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
  /**
   * Cloudflare stream lifecycle: disconnected | connected | paused | ended.
   * Drives Go Live / Reset / hidden states on the owner panel — once an
   * event's stream is "ended" it can't be restarted (backend rejects).
   */
  streamStatus?: string;
  /**
   * ISO timestamp of when this event row was created. Surfaced as the
   * primary sort key on the events list (newest-first) so a freshly
   * booked event always lands at the top regardless of its event date.
   */
  createdAt?: string;

  // ──────── Edit-form fields (web parity) ────────
  // Without these, opening the edit modal cleared half the form and
  // forced the user to retype everything. Now the mapper carries the
  // full payload through so the form can prefill every "more settings"
  // field the create modal exposes.
  price?: number;
  currency?: string;
  maxGuests?: number;
  /** Current confirmed guest count (shown as "{guestCount} / {maxGuests}"). */
  guestCount?: number;
  organizer?: string;
  tags?: string[];
  eventVisibility?: string;
  /** Client completion state, e.g. NOT_COMPLETED / COMPLETED / REQUIRE_CHANGES. */
  completionStatus?: string;
  /** True once the photographer has delivered the album. Gates completion. */
  albumDelivered?: boolean;
  notes?: string;

  // ──────── Hybrid & Geolocation fields ────────
  latitude?: number;
  longitude?: number;
  city?: string;
  minBudget?: number;
  maxBudget?: number;
  bookingMode?: string;
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
  /** Server-derived: stored organizer claim, else inferred from the venue. */
  attendanceMode?: AttendanceMode;
  eventOrganizer?: string;
  eventTags?: string;
  eventPhoto?: string;
  eventCategory?: PublicEventCategory | null;
  /** Booking price (used as a fallback when streamFee is 0). */
  price?: number;
  /** UPCOMING | ONGOING | COMPLETED | AWAITING_REVIEW | … */
  eventStatus?: string;
  completionStatus?: string;
  /** True once the photographer has delivered the album. Gates completion. */
  albumDelivered?: boolean;
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
 * `isEventLive` — prefers the stream's real lifecycle status when present.
 * For older list responses that do not include it, it falls back to the
 * event's ONGOING state plus its live-stream metadata.
 */
export function isEventLive(event: PublicEvent, liveStreamIds?: Set<string>): boolean {
  const eventStatus = (event.eventStatus || '').toUpperCase();
  const streamStatus = (event.streamStatus || '').toLowerCase();
  if (streamStatus === 'ended') return false;

  // The stream lifecycle is the most reliable signal once broadcasting has
  // started. Some backend rows remain PUBLISHED while the input is already
  // connected, so requiring ONGOING here hid genuine live events.
  if (['live', 'connected', 'active', 'broadcasting', 'streaming'].includes(streamStatus)) {
    return true;
  }

  if (eventStatus !== 'ONGOING') return false;
  if (event.hasLiveStream === true) return true;
  if (event.hlsManifestUrl || event.whepUrl) return true;
  return liveStreamIds?.has(event.id) ?? false;
}

export function isEventEnded(event: PublicEvent): boolean {
  return (event.eventStatus || '').toUpperCase() === 'COMPLETED' ||
    (event.streamStatus || '').toLowerCase() === 'ended';
}
