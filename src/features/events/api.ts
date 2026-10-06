/**
 * Events endpoints (/api/remote/customer/events).
 *
 * The exact field names from the backend can vary, so we map defensively:
 * unknown fields are simply ignored and the UI shows what it has.
 */
import { api } from '@/api/client';
import type { PickedImage } from '@/services/imagePicker';
import { appendFile } from '@/utils/upload';
import type { ApiError, ApiEnvelope } from '@/types';
import {
  parseAttendanceMode,
  type CreateEventInput,
  type EventItem,
  type PublicEvent,
  type PublicEventCategory,
  type PublicEventCreator,
  type PublicEventsPage,
  type PublicEventsQuery,
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
    attendanceMode: input.attendanceMode,
    eventOrganizer: input.organizer || 'Organizer',
    eventVisibility: input.eventVisibility || 'PUBLIC',
    eventTags: input.tags && input.tags.length ? input.tags.join(',') : input.category,
    price: input.price ?? 0,
    priceCurrency: input.currency || 'RWF',
    // The live-stream fee drives the viewer paywall and the "Stream entry"
    // label; send it as streamFee, not just price. Currency defaults to RWF
    // server-side when none is given.
    streamFee: input.streamFee ?? 0,
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

  // The booking's client — the photographer's events feed shows this
  // person (+ avatar) on each card, not the photographer. Fall through the
  // shapes the backend can return: flat clientName / nested creator / the
  // organizer string as a last resort.
  const client = (r.client ?? r.creator ?? r.customer ?? {}) as RawEvent;
  const clientName =
    str(r.clientName) ??
    ([str(client.firstName), str(client.lastName)].filter(Boolean).join(' ') || undefined) ??
    str(client.name) ??
    str(r.organizerName);
  const clientAvatar =
    str(r.clientImage) ?? str(r.clientAvatar) ?? str(client.profilePicture) ?? str(client.avatar);

  // Event tags arrive as a comma-separated CSV string; the form holds
  // an array, so split here once.
  const tagsCsv = str(r.eventTags);
  const tags = tagsCsv ? tagsCsv.split(',').map((t) => t.trim()).filter(Boolean) : undefined;

  return {
    id: String(r.id ?? r.slug ?? r.eventId ?? ''),
    title: str(r.title) ?? str(r.name) ?? 'Untitled event',
    eventDate: str(r.eventDate) ?? str(r.startTime) ?? str(r.date),
    location: str(r.location) ?? str(r.venue),
    attendanceMode: parseAttendanceMode(r.attendanceMode),
    status: str(r.eventStatus) ?? str(r.status) ?? str(r.completionStatus),
    category: categoryName,
    categoryId,
    photographerName,
    clientName,
    clientAvatar,
    packageName: str(r.packageName),
    hasLiveStream: r.hasLiveStream === true || r.hasLiveStream === 'true' || r.hasLiveStream === 1,
    // Backend returns the event hero as `eventPhoto` on every events
    // endpoint (/customer/events, /coordinator/events, /public/events).
    // The legacy `coverImage` / `thumbnail` / `coverPhoto` fallbacks
    // never matched, so the events list rendered without images.
    coverImage:
      str(r.eventPhoto) ?? str(r.coverImage) ?? str(r.thumbnail) ?? str(r.coverPhoto),
    description: str(r.description),
    startTime: str(r.startTime),
    endTime: str(r.endTime),
    // Strictly the publication flag. This used to fall back to `status`, so an
    // ONGOING/LIVE event reported itself as published — the detail screen then
    // offered "Unpublish" and gave the owner no way to publish at all.
    published: bool(r.published) || bool(r.isPublished),
    bookingStatus: str(r.bookingStatus),
    streamStatus: str(r.streamStatus),
    createdAt: str(r.createdAt) ?? str(r.bookingDate) ?? str(r.requestedAt) ?? str(r.updatedAt),

    // Edit-form fields (web parity)
    price: num(r.price) ?? num(r.streamFee) ?? num(r.packagePrice),
    currency: str(r.priceCurrency) ?? str(r.streamFeeCurrencyAbbreviation) ?? str(r.packageCurrencyAbbreviation),
    maxGuests: num(r.maxGuests),
    guestCount: num(r.guestCount) ?? num(r.confirmedGuests),
    organizer: str(r.eventOrganizer) ?? str(r.organizer),
    tags,
    eventVisibility: str(r.eventVisibility),
    completionStatus: str(r.completionStatus),
    albumDelivered: r.albumDelivered === true,
    notes: str(r.notes),
  };
}

/** Newest-created first — the order every dashboard list is shown in. */
function sortByCreatedDesc(items: EventItem[]): EventItem[] {
  return [...items].sort((a, b) => {
    const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
    const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
    return (Number.isNaN(tb) ? 0 : tb) - (Number.isNaN(ta) ? 0 : ta);
  });
}

/**
 * Walk EVERY page of a Spring-Page endpoint and return all rows. The mobile
 * dashboards render a single scrollable list, so fetching only page 0 (backend
 * default size 10) silently dropped every event past the tenth. We page through
 * with a big page size and stop at `totalPages` (or a short page).
 */
async function fetchAllEventPages(
  path: string,
  extraQs: Record<string, string> = {},
): Promise<RawEvent[]> {
  const size = 100;
  const all: RawEvent[] = [];
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ page: String(page), size: String(size), ...extraQs });
    const res = await api.get<ApiEnvelope<unknown>>(`${path}?${qs.toString()}`);
    const rows = unwrapList(res?.data);
    all.push(...rows);
    const totalPages = (res?.data as { totalPages?: unknown } | undefined)?.totalPages;
    if (typeof totalPages === 'number') {
      if (page + 1 >= totalPages) break;
    } else if (rows.length < size) {
      break;
    }
  }
  return all;
}

export async function listEvents(): Promise<EventItem[]> {
  // Backend wraps the list in a Spring Page object. Fetch every page and sort
  // newest-created first (the customer endpoint defaults to eventDate order).
  const rows = await fetchAllEventPages('/customer/events', {
    sortColumn: 'createdAt',
    sortDirection: 'desc',
  });
  return sortByCreatedDesc(rows.map(mapEvent).filter((e) => e.id));
}

export async function listCoordinatorEvents(): Promise<EventItem[]> {
  const rows = await fetchAllEventPages('/coordinator/events', {
    sortColumn: 'createdAt',
    sortDirection: 'desc',
  });
  return sortByCreatedDesc(rows.map(mapEvent).filter((e) => e.id));
}

/**
 * Assigned-to-me feed for a Photographer. Web parity:
 * GET /photographer/events returns the union of bookings + manual
 * assignments, deduplicated by event id. Each row may carry a
 * `bookingStatus` so the UI can flip between Accept/Decline and the
 * post-acceptance actions.
 */
export async function listPhotographerEvents(): Promise<EventItem[]> {
  // The photographer endpoint returns the full list (no pagination) but in
  // booking/insertion order — sort newest-created first for parity with the
  // other dashboards.
  const res = await api.get<ApiEnvelope<unknown>>('/photographer/events');
  return sortByCreatedDesc(unwrapList(res?.data).map(mapEvent).filter((e) => e.id));
}

export async function getEvent(id: string, asCoordinator = false): Promise<EventItem> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  try {
    const res = await api.get<ApiEnvelope<RawEvent>>(`${base}/${encodeURIComponent(id)}`);
    return mapEvent((res?.data ?? {}) as RawEvent);
  } catch (err) {
    if (asCoordinator) {
      const fallbackRes = await api.get<ApiEnvelope<RawEvent>>(`/customer/events/${encodeURIComponent(id)}`);
      return mapEvent((fallbackRes?.data ?? {}) as RawEvent);
    }
    throw err;
  }
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
    attendanceMode: parseAttendanceMode(r.attendanceMode),
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
    hasLiveStream: r.hasLiveStream === true || r.hasLiveStream === 'true' || r.hasLiveStream === 1,
    streamType: (str(r.streamType) as PublicEvent['streamType']) ?? null,
    groupDiscountPercentage: num(r.groupDiscountPercentage) ?? null,
    hasInviteCode: r.hasInviteCode === true,
    liveInputId: str(r.liveInputId) ?? null,
    hlsManifestUrl: str(r.hlsManifestUrl) ?? null,
    whepUrl: str(r.whepUrl) ?? null,
    // Stream lifecycle endpoints expose this as `connectionStatus`, while
    // public list rows may call it `streamStatus`. Keep one normalized field
    // so the Events explorer can reliably identify a connected broadcast.
    streamStatus: str(r.streamStatus) ?? str(r.connectionStatus) ?? str(r.status) ?? null,
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
export async function createEvent(input: CreateEventInput, asCoordinator = false): Promise<EventItem> {
  const base = asCoordinator ? '/coordinator/events/book' : '/customer/events/book';
  const res = await api.post<ApiEnvelope<RawEvent>>(base, buildEventPayload(input));
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

/** Updates an event (web parity: PUT /coordinator/events/{id} or /customer/events/{id}). */
export async function updateEvent(id: string, input: CreateEventInput, asCoordinator = false): Promise<EventItem> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  const res = await api.put<ApiEnvelope<RawEvent>>(
    `${base}/${encodeURIComponent(id)}`,
    buildEventPayload(input),
  );
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not save your changes.' } satisfies ApiError;
  }
  const d = (res?.data ?? {}) as RawEvent;
  return mapEvent((d.event ?? d) as RawEvent);
}

/**
 * Uploads the event cover image (same as web: POST .../{id}/photo, field "file").
 *
 * The endpoint answers 200 with `action: 0` when it refuses the file, so the
 * envelope has to be checked — not doing so meant a rejected cover looked like
 * success, and the event stayed unpublishable (and therefore invisible on the
 * public site) with nothing shown to the user.
 */
export async function uploadEventPhoto(eventId: string, image: PickedImage, asCoordinator = false): Promise<void> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  const form = new FormData();
  await appendFile(form, 'file', image);
  const res = await api.post<ApiEnvelope<unknown>>(
    `${base}/${encodeURIComponent(eventId)}/photo`,
    form,
  );
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'The cover photo could not be uploaded.',
    } satisfies ApiError;
  }
}

async function action(path: string, fallback: string): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>(path);
  if (res.action !== 1) {
    throw { status: 400, message: res.message || fallback } satisfies ApiError;
  }
}

/** Publishes an event (makes it public/live). */
export function publishEvent(id: string, asCoordinator = false): Promise<void> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  return action(`${base}/${encodeURIComponent(id)}/publish`, 'Could not publish the event.');
}

/** Takes a published event back offline. */
export function unpublishEvent(id: string, asCoordinator = false): Promise<void> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  return action(`${base}/${encodeURIComponent(id)}/unpublish`, 'Could not unpublish the event.');
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
export async function deleteEvent(id: string, asCoordinator = false): Promise<void> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  const res = await api.delete<ApiEnvelope<unknown>>(`${base}/${encodeURIComponent(id)}`);
  if (res.action !== 1) {
    throw { status: 400, message: res.message || 'Could not delete the event.' } satisfies ApiError;
  }
}

/** Confirms event completion: COMPLETED (satisfied) or REQUIRE_CHANGES. */
export async function confirmCompletion(
  id: string,
  status: 'COMPLETED' | 'REQUIRE_CHANGES',
  comment?: string,
  asCoordinator = false,
): Promise<void> {
  const base = asCoordinator ? '/coordinator/events' : '/customer/events';
  const res = await api.post<ApiEnvelope<unknown>>(
    `${base}/${encodeURIComponent(id)}/confirm-completion`,
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
