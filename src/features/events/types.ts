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
  photographerName?: string;
  coverImage?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  published?: boolean;
};

/**
 * Public event payload returned by `/public/events/list` and
 * `/public/events/{id}`. Carries the fields the web join/payment/live-stream
 * flows depend on (price, stream fee + currency, hasLiveStream, organizer,
 * photographer). Used by the public (guest) flows in (public)/events/*.
 */
export type PublicEvent = {
  id: ID;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  eventDate?: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  organizer?: string;
  coverImage?: string;
  status?: string;
  streamStatus?: string;
  hasLiveStream: boolean;
  hasInviteCode: boolean;
  photographerName?: string;
  photographerImage?: string;
  photographerId?: string;
  /** Stream entry fee — 0 when the event is free. */
  streamFee: number;
  streamFeeCurrencyCode: string;
  streamFeeCurrencySymbol?: string;
  /** Package booking price (separate from streamFee). */
  packageName?: string;
  packagePrice?: number;
  packageCurrencyCode?: string;
  maxGuests?: number;
};
