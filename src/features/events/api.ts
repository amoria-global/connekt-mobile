/**
 * Events endpoints (/api/remote/customer/events).
 *
 * The exact field names from the backend can vary, so we map defensively:
 * unknown fields are simply ignored and the UI shows what it has.
 */
import { api } from '@/api/client';
import type { PickedImage } from '@/services/imagePicker';
import type { ApiError, ApiEnvelope } from '@/types';
import type {
  CreateEventInput,
  EventItem,
  PublicEvent,
  PublicEventCategory,
  PublicEventCreator,
  PublicEventsPage,
  PublicEventsQuery,
} from './types';

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
  const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

  // The backend nests the category as `{ id, name, … }` on detail
  // responses (eventCategory) but sometimes returns just the name as
  // `category` on list rows. Accept both shapes so the edit form can
  // pre-select the right row.
  const cat = (r.eventCategory ?? {}) as RawEvent;
  const categoryName = str(cat.name) ?? str(r.category) ?? str(r.eventType);
  const categoryId = str(cat.id);

  // Event tags arrive as a comma-separated CSV string; the form holds
  // an array, so split here once.
  const tagsCsv = str(r.eventTags);
  const tags = tagsCsv ? tagsCsv.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

  return {
    id: String(r.id ?? r.slug ?? r.eventId ?? ''),
    title: str(r.title) ?? str(r.name) ?? 'Untitled event',
    eventDate: str(r.eventDate) ?? str(r.startTime) ?? str(r.date),
    location: str(r.location) ?? str(r.venue),
    status: str(r.eventStatus) ?? str(r.status) ?? str(r.completionStatus),
    category: categoryName,
    categoryId,
    photographerName,
    // Backend returns the event hero as `eventPhoto` on every events
    // endpoint (/customer/events, /coordinator/events, /public/events).
    // The legacy `coverImage` / `thumbnail` / `coverPhoto` fallbacks
    // never matched, so the events list rendered without images.
    coverImage:
      str(r.eventPhoto) ?? str(r.coverImage) ?? str(r.thumbnail) ?? str(r.coverPhoto),
    description: str(r.description),
    startTime: str(r.startTime),
    endTime: str(r.endTime),
    published: bool(r.published) || bool(r.isPublished) || bool(r.status),
    bookingStatus: str(r.bookingStatus),

    // Edit-form fields (web parity)
    price: num(r.price) ?? num(r.streamFee),
    currency: str(r.priceCurrency) ?? str(r.streamFeeCurrencyAbbreviation),
    maxGuests: num(r.maxGuests),
    organizer: str(r.eventOrganizer) ?? str(r.organizer),
    tags,
    eventVisibility: str(r.eventVisibility),
    notes: str(r.notes),
  };
}

export async function listEvents(): Promise<EventItem[]> {
  // Backend wraps the list in a Spring Page object
  // ({ content: [...], pageable: {...} }). `unwrapList` already handles
  // both the page-envelope and a bare array shape — using it here fixes
  // the empty-list bug where `Array.isArray(res.data)` was always false.
  const res = await api.get<ApiEnvelope<unknown>>('/customer/events');
  return unwrapList(res?.data).map(mapEvent).filter((e) => e.id);
}

export async function listCoordinatorEvents(): Promise<EventItem[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/coordinator/events');
  return unwrapList(res?.data).map(mapEvent).filter((e) => e.id);
}

/**
 * Assigned-to-me feed for a Photographer. Web parity:
 * GET /photographer/events returns the union of bookings + manual
 * assignments, deduplicated by event id. Each row may carry a
 * `bookingStatus` so the UI can flip between Accept/Decline and the
 * post-acceptance actions.
 */
export async function listPhotographerEvents(): Promise<EventItem[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/photographer/events');
  return unwrapList(res?.data).map(mapEvent).filter((e) => e.id);
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
 * flows) to a stable shape. Field names are preserved verbatim from the
 * backend response so the web's status rules (knockout events.tsx)
 * carry over unchanged.
 */
function mapPublicEvent(r: RawEvent): PublicEvent {
  const cat = (r.eventCategory ?? {}) as RawEvent;
  const photographer = (r.photographer ?? {}) as RawEvent;
  const creator = (r.creator ?? {}) as RawEvent;
  const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);
  const photographerName =
    str(r.photographerName) ??
    ([str(photographer.firstName), str(photographer.lastName)].filter(Boolean).join(' ') ||
      undefined);

  const category: PublicEventCategory | null = cat && (str(cat.id) || str(cat.name))
    ? {
        id: str(cat.id),
        name: str(cat.name),
        description: str(cat.description),
        isActive: cat.isActive === true,
      }
    : null;

  const creatorObj: PublicEventCreator | undefined = creator && Object.keys(creator).length
    ? {
        firstName: str(creator.firstName),
        lastName: str(creator.lastName),
        profilePicture: str(creator.profilePicture),
        customerType: str(creator.customerType),
      }
    : undefined;

  return {
    id: String(r.id ?? ''),
    title: str(r.title) ?? 'Untitled event',
    description: str(r.description),
    eventDate: str(r.eventDate),
    startTime: str(r.startTime),
    endTime: str(r.endTime),
    location: str(r.location),
    eventOrganizer: str(r.eventOrganizer),
    eventTags: str(r.eventTags),
    eventPhoto: str(r.eventPhoto),
    eventCategory: category,
    price: num(r.price),
    eventStatus: str(r.eventStatus),
    completionStatus: str(r.completionStatus),
    bookingStatus: str(r.bookingStatus),
    maxGuests: num(r.maxGuests),
    creator: creatorObj,
    notes: str(r.notes),
    streamFee: num(r.streamFee),
    streamFeeCurrencySymbol: str(r.streamFeeCurrencySymbol),
    streamFeeCurrencyAbbreviation: str(r.streamFeeCurrencyAbbreviation),
    hasLiveStream: r.hasLiveStream === true,
    streamType: (str(r.streamType) as PublicEvent['streamType']) ?? null,
    groupDiscountPercentage: num(r.groupDiscountPercentage) ?? null,
    hasInviteCode: r.hasInviteCode === true,
    liveInputId: str(r.liveInputId) ?? null,
    hlsManifestUrl: str(r.hlsManifestUrl) ?? null,
    whepUrl: str(r.whepUrl) ?? null,
    streamStatus: str(r.streamStatus) ?? null,
    hasPurchasedAccess: r.hasPurchasedAccess === true,
    eventPriceId: str(r.eventPriceId) ?? null,
    photographerName,
    photographerImage: str(r.photographerImage) ?? str(photographer.profilePicture),
    photographerId: str(r.photographerId) ?? str(photographer.id),
    packageName: str(r.packageName),
    packagePrice: num(r.packagePrice),
    packageCurrencyAbbreviation: str(r.packageCurrencyAbbreviation),
  };
}

/**
 * Public events list with the richer shape used by the public guest flow.
 * Mirrors knockout/lib/APIs/public/get-events/route.ts `getPublicEvents`
 * 1:1 (same query params, same sort defaults, same envelope unwrap).
 */
export async function listPublicEventsDetailed(
  params: PublicEventsQuery = {},
): Promise<PublicEventsPage> {
  const qs = new URLSearchParams();
  qs.set('page', String(params.page ?? 0));
  qs.set('size', String(params.size ?? 12));
  qs.set('sortColumn', params.sortColumn ?? 'eventDate');
  qs.set('sortDirection', params.sortDirection ?? 'asc');
  if (params.category) qs.set('category', params.category);
  if (params.location) qs.set('location', params.location);
  if (params.status) qs.set('status', params.status);
  if (params.dateRange) qs.set('dateRange', params.dateRange);
  if (params.search) qs.set('search', params.search);

  const res = await api.get<ApiEnvelope<Record<string, unknown>>>(
    `/public/events/list?${qs.toString()}`,
    { skipAuth: true },
  );
  const d = (res?.data ?? {}) as Record<string, unknown>;
  const content = Array.isArray(d.content) ? (d.content as RawEvent[]) : [];
  return {
    content: content.map(mapPublicEvent).filter((e) => e.id),
    totalPages: typeof d.totalPages === 'number' ? d.totalPages : 0,
    totalElements: typeof d.totalElements === 'number' ? d.totalElements : 0,
    number: typeof d.number === 'number' ? d.number : 0,
    size: typeof d.size === 'number' ? d.size : 12,
    first: d.first === true,
    last: d.last === true,
  };
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

/**
 * Pauses an in-flight event. The Customer endpoint is aliased at both
 * /api/remote/customer/events/{id}/pause and /api/remote/events/{id}/pause;
 * Coordinator-owned events route through /coordinator/events/{id}/pause
 * because eventService.pauseEvent checks ownership.
 */
export function pauseEvent(id: string, asCoordinator = false): Promise<void> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  return action(`${base}/${encodeURIComponent(id)}/pause`, 'Could not pause the event.');
}

/** Resumes a previously-paused event. */
export function resumeEvent(id: string, asCoordinator = false): Promise<void> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  return action(`${base}/${encodeURIComponent(id)}/resume`, 'Could not resume the event.');
}

/**
 * Photographer-side accept / decline of an event booking. Web parity:
 *   POST /photographer/events/{eventId}/accept
 *   POST /photographer/events/{eventId}/decline   body { reason }
 *
 * Mirrors the bookings screen's per-booking accept/reject but works
 * with the event id directly so the photographer can accept from the
 * event detail page without round-tripping to bookings.
 */
export async function acceptEventBooking(eventId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>(
    `/photographer/events/${encodeURIComponent(eventId)}/accept`,
  );
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not accept the booking.' } satisfies ApiError;
  }
}

export async function declineEventBooking(eventId: string, reason?: string): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>(
    `/photographer/events/${encodeURIComponent(eventId)}/decline`,
    { reason: reason?.trim() || 'No reason provided' },
  );
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not decline the booking.' } satisfies ApiError;
  }
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

/**
 * Photographer-side completion flag. The photographer marks the event
 * as "shoot complete" with optional notes; the client then confirms via
 * confirmCompletion() above. Two-step model lets the client request
 * changes before escrow is released.
 *
 * Web parity: PhotographerRemoteController.markEventCompleted →
 * POST /photographer/events/{eventId}/mark-completed?notes=
 */
export async function markEventCompletedByPhotographer(
  eventId: string,
  notes?: string,
): Promise<void> {
  const qs = notes?.trim() ? `?notes=${encodeURIComponent(notes.trim())}` : '';
  const res = await api.post<ApiEnvelope<unknown>>(
    `/photographer/events/${encodeURIComponent(eventId)}/mark-completed${qs}`,
  );
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Could not mark the event as completed.',
    } satisfies ApiError;
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

// ────── Stream lifecycle (Photographer / owner) ─────────────────────────
//
// Mirrors EventRemoteController:
//   POST /customer/events/{eventId}/stream/start  → boot stream, return
//                                                   WHIP URL + token
//   POST /customer/events/{eventId}/stream/reset  → rotate WHIP URL
//   GET  /customer/events/{eventId}/stream/status → live status snapshot
//
// The Photographer points OBS at the returned WHIP URL, then the event
// goes live for viewers. Mobile surfaces the URL and a "Copy" affordance
// so the user can paste it into OBS on a laptop.

export type StreamSetup = {
  whipUrl?: string;
  hlsManifestUrl?: string;
  liveInputId?: string;
  token?: string;
  status?: string;
};

function mapStreamSetup(d: RawEvent): StreamSetup {
  return {
    whipUrl: str(d.whipUrl),
    hlsManifestUrl: str(d.hlsManifestUrl),
    liveInputId: str(d.liveInputId),
    token: str(d.token),
    status: str(d.status) ?? str(d.streamStatus) ?? str(d.connectionStatus),
  };
}

export async function startEventStream(eventId: string): Promise<StreamSetup> {
  const res = await api.post<ApiEnvelope<RawEvent>>(
    `/customer/events/${encodeURIComponent(eventId)}/stream/start`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not start the stream.' };
  }
  return mapStreamSetup((res?.data ?? {}) as RawEvent);
}

export async function resetEventStream(eventId: string): Promise<StreamSetup> {
  const res = await api.post<ApiEnvelope<RawEvent>>(
    `/customer/events/${encodeURIComponent(eventId)}/stream/reset`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not reset the stream.' };
  }
  return mapStreamSetup((res?.data ?? {}) as RawEvent);
}

export async function getEventStreamStatus(eventId: string): Promise<StreamSetup> {
  const res = await api.get<ApiEnvelope<RawEvent>>(
    `/customer/events/${encodeURIComponent(eventId)}/stream/status`,
  );
  return mapStreamSetup((res?.data ?? {}) as RawEvent);
}
