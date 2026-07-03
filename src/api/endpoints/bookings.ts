import { api } from '../client';
import type { ApiEnvelope } from '@/types';

/**
 * Booking a photographer creates an Event + a PENDING Booking and a first
 * payment declaration in one call. This mirrors the web BookingWizard, which
 * posts to `POST /api/remote/events/book` (EventRemoteController.bookPhotographer)
 * with an EventBookingRequestDTO — NOT a bespoke `/bookings` route (that never
 * existed on the backend, which is why the sheet used to fake success).
 *
 * Date/time formats the backend parses:
 *   eventDate → LocalDate  "YYYY-MM-DD"
 *   start/end → LocalTime  "HH:mm:ss"
 */
export type CreateBookingPayload = {
  /** Event title (the sheet's "Event name"). */
  title: string;
  eventDate: string; // YYYY-MM-DD
  startTime?: string; // HH:mm:ss
  endTime?: string; // HH:mm:ss
  location?: string;
  maxGuests?: number;
  notes?: string;
  photographerId: string;
  packageId: string;
  /** "OUTDOOR" (client's venue) or "STUDIO" (photographer's studio). */
  serviceType: 'OUTDOOR' | 'STUDIO';
  /** Deposit mode: 50, 70, or 100 (validated server-side). */
  escrowPercentage: number;
  eventTags?: string;
  eventType?: string;
};

export type CreateBookingResult = {
  event?: unknown;
  booking?: { id?: string } & Record<string, unknown>;
  declarationId?: string;
  paymentAmount?: number;
  currencyId?: string;
  currencyAbbreviation?: string;
};

export const bookingsApi = {
  /**
   * Submit a photographer booking request. Resolves with the created
   * event/booking + the first-milestone payment declaration; rejects with an
   * ApiError carrying the backend message (e.g. date-unavailable, package
   * mismatch) so the caller can show it instead of silently succeeding.
   */
  create: (payload: CreateBookingPayload) =>
    api.post<ApiEnvelope<CreateBookingResult>>('/events/book', payload),
};
