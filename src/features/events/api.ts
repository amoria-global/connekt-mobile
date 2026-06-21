/**
 * Events endpoints (/api/remote/customer/events).
 *
 * The exact field names from the backend can vary, so we map defensively:
 * unknown fields are simply ignored and the UI shows what it has.
 */
import { api } from '@/api/client';
import type { PickedImage } from '@/services/imagePicker';
import type { ApiError, ApiEnvelope } from '@/types';
import type { CreateEventInput, EventItem, PublicEvent } from './types';

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

function bool(v: unknown): boolean {
  return v === true || v === 'true' || v === 'PUBLISHED' || v === 'LIVE';
}

/** Builds the shared event payload used by both create (book) and update (PUT). */
function buildEventPayload(input: CreateEventInput): Record<string, unknown> {
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
  return payload;
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
    published: bool(r.published) || bool(r.isPublished) || bool(r.status),
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
 * Map the rich public-events payload (used by the web join + live-stream
 * flows) to a stable shape. Keep nullable everywhere — most public events
 * have at least one field the backend omits.
 */
function mapPublicEvent(r: RawEvent): PublicEvent {
  const cat = (r.eventCategory ?? {}) as RawEvent;
  const photographer = (r.photographer ?? {}) as RawEvent;
  const photographerName =
    str(r.photographerName) ??
    ([str(photographer.firstName), str(photographer.lastName)].filter(Boolean).join(' ') || undefined);
  const tagsCsv = str(r.eventTags);
  const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

  return {
    id: String(r.id ?? ''),
    title: str(r.title) ?? 'Untitled event',
    description: str(r.description),
    category: str(cat.name) ?? str(r.eventType) ?? tagsCsv?.split(',')[0],
    tags: tagsCsv ? tagsCsv.split(',').map((t) => t.trim()).filter(Boolean) : [],
    eventDate: str(r.eventDate),
    startTime: str(r.startTime),
    endTime: str(r.endTime),
    location: str(r.location),
    organizer: str(r.eventOrganizer) ?? str(r.organizer),
    coverImage: str(r.eventPhoto) ?? str(r.coverImage) ?? str(r.thumbnail),
    status: str(r.eventStatus) ?? str(r.status),
    streamStatus: str(r.streamStatus),
    hasLiveStream: r.hasLiveStream === true,
    hasInviteCode: r.hasInviteCode === true,
    photographerName,
    photographerImage: str(r.photographerImage) ?? str((photographer as RawEvent).profilePicture),
    photographerId: str(r.photographerId) ?? str((photographer as RawEvent).id),
    streamFee: num(r.streamFee) ?? num(r.price) ?? 0,
    streamFeeCurrencyCode: str(r.streamFeeCurrencyAbbreviation) ?? str(r.priceCurrency) ?? 'RWF',
    streamFeeCurrencySymbol: str(r.streamFeeCurrencySymbol),
    packageName: str(r.packageName),
    packagePrice: num(r.packagePrice),
    packageCurrencyCode: str(r.packageCurrencyAbbreviation),
    maxGuests: num(r.maxGuests),
  };
}

/** Public events list with the richer shape used by the public guest flow. */
export async function listPublicEventsDetailed(): Promise<PublicEvent[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/public/events/list?page=0&size=100', {
    skipAuth: true,
  });
  return unwrapList(res?.data).map(mapPublicEvent).filter((e) => e.id);
}

/** Single public event for the guest detail screen. */
export async function getPublicEventDetailed(id: string): Promise<PublicEvent> {
  const res = await api.get<ApiEnvelope<RawEvent>>(`/public/events/${encodeURIComponent(id)}`, {
    skipAuth: true,
  });
  return mapPublicEvent((res?.data ?? {}) as RawEvent);
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
  const res = await api.post<ApiEnvelope<RawEvent>>('/customer/events/book', buildEventPayload(input));
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

/** Updates an event (web parity: PUT /customer/events/{id}). */
export async function updateEvent(id: string, input: CreateEventInput): Promise<EventItem> {
  const res = await api.put<ApiEnvelope<RawEvent>>(
    `/customer/events/${encodeURIComponent(id)}`,
    buildEventPayload(input),
  );
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not save your changes.' } satisfies ApiError;
  }
  const d = (res?.data ?? {}) as RawEvent;
  return mapEvent((d.event ?? d) as RawEvent);
}

/** Uploads the event cover image (same as web: POST .../{id}/photo, field "file"). */
export async function uploadEventPhoto(eventId: string, image: PickedImage): Promise<void> {
  const form = new FormData();
  form.append('file', { uri: image.uri, name: image.name, type: image.type } as unknown as Blob);
  await api.post(`/customer/events/${encodeURIComponent(eventId)}/photo`, form);
}

async function action(path: string, fallback: string): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>(path);
  if (res.action !== 1) {
    throw { status: 400, message: res.message || fallback } satisfies ApiError;
  }
}

/** Publishes an event (makes it public/live). */
export function publishEvent(id: string): Promise<void> {
  return action(`/customer/events/${encodeURIComponent(id)}/publish`, 'Could not publish the event.');
}

/** Takes a published event back offline. */
export function unpublishEvent(id: string): Promise<void> {
  return action(`/customer/events/${encodeURIComponent(id)}/unpublish`, 'Could not unpublish the event.');
}

/** Deletes an event. */
export async function deleteEvent(id: string): Promise<void> {
  const res = await api.delete<ApiEnvelope<unknown>>(`/customer/events/${encodeURIComponent(id)}`);
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not delete the event.' } satisfies ApiError;
  }
}

/** Confirms event completion: COMPLETED (satisfied) or REQUIRE_CHANGES. */
export async function confirmCompletion(
  id: string,
  status: 'COMPLETED' | 'REQUIRE_CHANGES',
  comment?: string,
): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>(
    `/customer/events/${encodeURIComponent(id)}/confirm-completion`,
    { status, comment: comment || null },
  );
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not submit your confirmation.' } satisfies ApiError;
  }
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
