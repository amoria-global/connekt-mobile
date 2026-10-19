/**
 * Photobooks (customer view).
 * - List:   GET /api/remote/customer/events/photobooks
 * - Detail: GET /api/remote/customer/events/photobooks/{id}
 * Response uses PhotobookResponseDTO (name, status, coverImage, mediaItems[]…).
 */
import { api, requireOk } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Photobook = {
  id: ID;
  name: string;
  description?: string;
  coverImage?: string;
  status?: string;
  photographerName?: string;
  mediaCount?: number;
  createdAt?: string;
};

export type PhotobookPhoto = { id: ID; url?: string; caption?: string };

export type PhotobookDetail = Photobook & {
  photos: PhotobookPhoto[];
  freePhotosLimit?: number;
  extraPhotosCount?: number;
  extraPhotosAmount?: number;
  paymentRequired?: boolean;
  /**
   * Set when extra photos exist that need to be paid for. Web parity:
   * the "Pay for extras" CTA routes to /payments/{paymentDeclarationId}.
   * Without this, the mobile pay banner had no tap target — it was
   * decorative and the customer had no way to actually pay.
   */
  paymentDeclarationId?: string;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

function mapPhotobook(r: Raw): Photobook {
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? 'Photobook',
    description: str(r.description),
    coverImage: str(r.coverImage),
    status: str(r.status),
    photographerName: str(r.photographerName) ?? str(r.senderName),
    mediaCount: num(r.mediaCount),
    createdAt: str(r.createdAt),
  };
}

/** A Spring Page (`data.content`) or a plain array, like the web's `result.data.content || result.data`. */
function rows(data: unknown): Raw[] {
  if (Array.isArray(data)) return data as Raw[];
  const c = (data as { content?: unknown } | null | undefined)?.content;
  return Array.isArray(c) ? (c as Raw[]) : [];
}

export async function listPhotobooks(): Promise<Photobook[]> {
  // getOk: an HTTP 200 carrying action 0 is a failure, not an empty shelf.
  const res = await api.getOk<ApiEnvelope<unknown>>('/customer/events/photobooks');
  return rows(res?.data).map(mapPhotobook).filter((p) => p.id);
}

/**
 * Photobooks clients (or coordinators) sent TO this photographer to edit and return. Web parity:
 * GET /photographer/photobooks, the "received photobooks" list. The customer endpoint above lists the books the
 * signed-in user owns as a customer, which is a different set, so a photographer saw none of these on mobile.
 */
export async function listReceivedPhotobooks(): Promise<Photobook[]> {
  const res = await api.getOk<ApiEnvelope<unknown>>('/photographer/photobooks');
  return rows(res?.data).map(mapPhotobook).filter((p) => p.id);
}

export async function getPhotobook(id: string, received = false): Promise<PhotobookDetail> {
  const base = received ? '/photographer/photobooks' : '/customer/events/photobooks';
  const res = await api.getOk<ApiEnvelope<Raw>>(`${base}/${encodeURIComponent(id)}`);
  const d = (res?.data ?? {}) as Raw;
  const media = Array.isArray(d.mediaItems) ? (d.mediaItems as Raw[]) : [];
  return {
    ...mapPhotobook(d),
    freePhotosLimit: num(d.freePhotosLimit),
    extraPhotosCount: num(d.extraPhotosCount),
    extraPhotosAmount: num(d.extraPhotosAmount),
    paymentRequired: d.paymentRequired === true,
    paymentDeclarationId: str(d.paymentDeclarationId),
    photos: media
      .map((m) => ({ id: String(m.id ?? ''), url: str(m.fileUrl) ?? str(m.url), caption: str(m.caption) }))
      .filter((p) => p.id),
  };
}

/** Send an edited received photobook back to its client (web: POST /photographer/photobooks/{id}/resubmit). */
export async function resubmitPhotobook(id: string): Promise<void> {
  requireOk(await api.post(`/photographer/photobooks/${encodeURIComponent(id)}/resubmit`));
}

/** Remove a received photobook from this photographer's list (web: DELETE /photographer/photobooks/{id}, a dismissal). */
export async function dismissReceivedPhotobook(id: string): Promise<void> {
  requireOk(await api.delete(`/photographer/photobooks/${encodeURIComponent(id)}`));
}

// ────── Photobook authoring (Photographer / Coordinator) ────────────────

export type CreatePhotobookInput = {
  name: string;
  description?: string;
  mediaIds: string[];
  layout?: string;
  coverImage?: string;
  eventId?: string;
};

/**
 * Web parity: POST /customer/events/photobook (also aliased at
 * /events/photobook). Body shape:
 *   { name, description, mediaIds: UUID[], layout, coverImage, eventId? }
 */
export async function createPhotobook(input: CreatePhotobookInput): Promise<Photobook> {
  const body: Record<string, unknown> = {
    name: input.name.trim(),
    mediaIds: input.mediaIds,
  };
  if (input.description?.trim()) body.description = input.description.trim();
  if (input.layout) body.layout = input.layout;
  if (input.coverImage) body.coverImage = input.coverImage;
  if (input.eventId) body.eventId = input.eventId;

  const res = await api.post<ApiEnvelope<Raw>>('/customer/events/photobook', body);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not create the photobook.' };
  }
  return mapPhotobook((res?.data ?? {}) as Raw);
}

/** Send the photobook to the client (web parity: /photobook/{id}/send). */
export async function sendPhotobookToClient(id: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(
    `/customer/events/photobook/${encodeURIComponent(id)}/send`,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send the photobook.' };
  }
}
