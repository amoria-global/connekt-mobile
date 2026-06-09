/**
 * Photographer bookings (/api/remote/bookings).
 * A booking is a request from a client to a photographer for an event.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Booking = {
  id: ID;
  eventTitle: string;
  clientName?: string;
  status?: string;
  proposedPrice?: number;
  currency?: string;
  eventDate?: string;
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
    eventTitle: str(event.title) ?? str(r.eventTitle) ?? str(r.title) ?? 'Booking request',
    clientName,
    status: str(r.status),
    proposedPrice: num(r.proposedPrice) ?? num(r.price),
    currency: str(r.currency) ?? str(r.currencyCode),
    eventDate: str(event.eventDate) ?? str(r.eventDate),
  };
}

export async function listBookings(): Promise<Booking[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/bookings');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapBooking).filter((b) => b.id);
}

export async function acceptBooking(id: string): Promise<void> {
  await api.post(`/bookings/${encodeURIComponent(id)}/accept`);
}

export async function rejectBooking(id: string, reason: string): Promise<void> {
  await api.post(`/bookings/${encodeURIComponent(id)}/reject`, { reason });
}
