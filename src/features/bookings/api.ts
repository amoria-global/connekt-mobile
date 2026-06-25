/**
 * Photographer bookings (/api/remote/bookings).
 * A booking is a request from a client to a photographer for an event.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Booking = {
  id: ID;
  /**
   * The underlying event id — surfaced so dashboard preview rows and
   * the bookings list can deep-link to /event/{eventId} rather than
   * just dumping the user on the bookings tab.
   */
  eventId?: string;
  eventTitle: string;
  clientName?: string;
  status?: string;
  proposedPrice?: number;
  currency?: string;
  eventDate?: string;
  createdAt?: string;
};

type Raw = Record<string, unknown>;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined;
}

function mapBooking(r: Raw): Booking {
  const event = (r.event ?? {}) as Raw;
  const client = (r.client ?? r.customer ?? {}) as Raw;
  const clientName =
    [str(client.firstName), str(client.lastName)].filter(Boolean).join(' ') || str(client.name);
  return {
    id: String(r.id ?? r.bookingId ?? ''),
    eventId: str(event.id) ?? str(r.eventId),
    eventTitle: str(event.title) ?? str(r.eventTitle) ?? str(r.title) ?? 'Booking request',
    clientName,
    status: str(r.status),
    proposedPrice: num(r.proposedPrice) ?? num(r.price),
    currency: str(r.currency) ?? str(r.currencyCode),
    eventDate: str(event.eventDate) ?? str(r.eventDate),
    createdAt: str(r.createdAt) ?? str(r.requestedAt) ?? str(r.updatedAt),
  };
}

export async function listBookings(): Promise<Booking[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/bookings');
  const data = Array.isArray(res?.data) ? res.data : [];
  // Newest first: backend returns insertion-order so the photographer
  // had to scroll past stale requests to see fresh ones. Sort by
  // createdAt desc; rows with no createdAt fall back to eventDate desc;
  // last-resort original order if neither is set.
  return data
    .map(mapBooking)
    .filter((b) => b.id)
    .sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : NaN;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : NaN;
      if (!Number.isNaN(at) && !Number.isNaN(bt)) return bt - at;
      if (!Number.isNaN(bt)) return 1;
      if (!Number.isNaN(at)) return -1;
      const ae = a.eventDate ? new Date(a.eventDate).getTime() : 0;
      const be = b.eventDate ? new Date(b.eventDate).getTime() : 0;
      return be - ae;
    });
}

export async function acceptBooking(id: string): Promise<void> {
  await api.post(`/bookings/${encodeURIComponent(id)}/accept`);
}

export async function rejectBooking(id: string, reason: string): Promise<void> {
  await api.post(`/bookings/${encodeURIComponent(id)}/reject`, { reason });
}
