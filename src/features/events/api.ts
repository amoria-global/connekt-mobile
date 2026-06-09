/**
 * Events endpoints (/api/remote/customer/events).
 *
 * The exact field names from the backend can vary, so we map defensively:
 * unknown fields are simply ignored and the UI shows what it has.
 */
import { api } from '@/api/client';
import type { PickedImage } from '@/services/imagePicker';
import type { ApiError, ApiEnvelope } from '@/types';
import type { CreateEventInput, EventItem } from './types';

type RawEvent = Record<string, unknown>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Backend expects "HH:mm:ss"; the picker gives us "HH:mm". */
function toApiTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return `${String(h || 0).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}:00`;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function mapEvent(r: RawEvent): EventItem {
  const photographer = (r.photographer ?? {}) as RawEvent;
  const photographerName =
    [str(photographer.firstName), str(photographer.lastName)].filter(Boolean).join(' ') ||
    str(photographer.name);

  return {
    id: String(r.id ?? r.slug ?? r.eventId ?? ''),
    title: str(r.title) ?? str(r.name) ?? 'Untitled event',
    eventDate: str(r.eventDate) ?? str(r.startTime) ?? str(r.date),
    location: str(r.location) ?? str(r.venue),
    status: str(r.status) ?? str(r.completionStatus),
    category: str(r.category),
    photographerName,
    coverImage: str(r.coverImage) ?? str(r.thumbnail) ?? str(r.coverPhoto),
    description: str(r.description),
    startTime: str(r.startTime),
    endTime: str(r.endTime),
  };
}

export async function listEvents(): Promise<EventItem[]> {
  const res = await api.get<ApiEnvelope<RawEvent[]>>('/customer/events');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapEvent).filter((e) => e.id);
}

export async function listCoordinatorEvents(): Promise<EventItem[]> {
  const res = await api.get<ApiEnvelope<RawEvent[]>>('/coordinator/events');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapEvent).filter((e) => e.id);
}

export async function getEvent(id: string): Promise<EventItem> {
  const res = await api.get<ApiEnvelope<RawEvent>>(`/customer/events/${encodeURIComponent(id)}`);
  return mapEvent((res?.data ?? {}) as RawEvent);
}

// --- Public (no login required) ------------------------------------------

function unwrapList(data: unknown): RawEvent[] {
  if (Array.isArray(data)) return data as RawEvent[];
  const c = (data as { content?: unknown })?.content;
  return Array.isArray(c) ? (c as RawEvent[]) : [];
}

export async function listPublicEvents(): Promise<EventItem[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/public/events/list', { skipAuth: true });
  return unwrapList(res?.data).map(mapEvent).filter((e) => e.id);
}

export async function getPublicEvent(id: string): Promise<EventItem> {
  const res = await api.get<ApiEnvelope<RawEvent>>(`/public/events/${encodeURIComponent(id)}`, {
    skipAuth: true,
  });
  return mapEvent((res?.data ?? {}) as RawEvent);
}

/**
 * Creates an event (and booking, when photographer context is supplied).
 *
 * Mirrors the web dashboard exactly: posts to `/customer/events/book` with the
 * same payload shape (`eventType`, `startTime`/`endTime`, `eventVisibility`,
 * `eventTags`, `priceCurrency`, `maxGuests`, …). Photographer/package IDs are
 * only sent when they are valid UUIDs, to avoid backend "id must not be null".
 */
export async function createEvent(input: CreateEventInput): Promise<EventItem> {
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description ?? '',
    eventType: input.category,
    startTime: toApiTime(input.startTime),
    endTime: toApiTime(input.endTime || input.startTime),
    eventDate: input.eventDate,
    location: input.location ?? '',
    eventOrganizer: input.organizer || 'Organizer',
    eventVisibility: input.eventVisibility || 'PUBLIC',
    eventTags: input.tags && input.tags.length ? input.tags.join(',') : input.category,
    price: input.price ?? 0,
    priceCurrency: input.currency || 'RWF',
    maxGuests: input.maxGuests ?? 0,
    notes: '',
  };

  if (input.photographerId && UUID_RE.test(input.photographerId)) {
    payload.photographerId = input.photographerId;
  }
  if (input.packageId && UUID_RE.test(input.packageId)) {
    payload.packageId = input.packageId;
  }
  if (payload.photographerId && payload.packageId) {
    payload.escrowPercentage = input.escrowPercentage ?? 50;
  }

  const res = await api.post<ApiEnvelope<RawEvent>>('/customer/events/book', payload);
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Could not create the event. Please try again.',
    } satisfies ApiError;
  }
  // Response can be { data: { event, booking } } or { data: { ...event } }.
  const d = (res?.data ?? {}) as RawEvent;
  const ev = (d.event ?? d) as RawEvent;
  return mapEvent(ev);
}

/** Uploads the event cover image (same as web: POST .../{id}/photo, field "file"). */
export async function uploadEventPhoto(eventId: string, image: PickedImage): Promise<void> {
  const form = new FormData();
  form.append('file', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
  await api.post(`/customer/events/${encodeURIComponent(eventId)}/photo`, form);
}

/** Event categories for the picker (public, no auth). */
export async function listEventCategories(): Promise<string[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/public/events/categories', { skipAuth: true });
  const data = res?.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((c) => (typeof c === 'string' ? c : str((c as RawEvent)?.name) ?? str((c as RawEvent)?.category)))
    .filter((c): c is string => !!c);
}
