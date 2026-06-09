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
};
