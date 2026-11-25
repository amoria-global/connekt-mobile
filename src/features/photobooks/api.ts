/**
 * Photobooks.
 * - List:   GET /api/remote/customer/events/photobooks
 * - Detail: GET /api/remote/customer/events/photobooks/{id}
 * - Received (photographer): GET /api/remote/photographer/photobooks
 * - Picker: GET /customer/events/photobook/sources and /sources/{albumId}/photos (only photos the person may add)
 * A book is a photo selection from event, free, purchased or content albums of ONE photographer. The server decides
 * what the viewer may see: originals only for owners and buyers, a watermarked thumbnail (or no url) for the rest.
 */
import { api, requireOk } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';

export type Photobook = {
  id: ID;
  name: string;
  description?: string;
  coverImage?: string;
  status?: string;
  /** Who the book went to ("To Joseph M."). Only set once it was sent. */
  toName?: string;
  /** Who sent it (the photographer's received shelf: "From Aline U."). */
  senderName?: string;
  /** Kept for older callers: the photographer, else the sender. */
  photographerName?: string;
  mediaCount?: number;
  createdAt?: string;
  sentAt?: string;
  editedAt?: string;
  resubmittedAt?: string;
  completedAt?: string;
  changeRequestedAt?: string;
  changeRequestNote?: string;
  /** COMPLETED because the photographer closed it, not because the owner accepted it. */
  closedByPhotographer?: boolean;
  layout?: string;
  eventId?: string;
  sourceType?: string;
  sources?: string[];
  /** Up to three thumbnails for the list mosaic (only ever safe-to-show urls). */
  previews?: string[];
};

export type PhotobookPhoto = {
  id: ID;
  /** The original for owners and buyers, a thumbnail otherwise, or undefined when nothing safe exists. */
  url?: string;
  caption?: string;
  sourceType?: string;
  original?: boolean;
  watermarked?: boolean;
};

export type PhotobookDetail = Photobook & {
  photos: PhotobookPhoto[];
  freePhotosLimit?: number;
  extraPhotosCount?: number;
  extraPhotosAmount?: number;
  pricePerExtraPhoto?: number;
  paymentRequired?: boolean;
  paymentDeclarationId?: string;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);
const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined);

function mapPhoto(m: Raw): PhotobookPhoto {
  return {
    id: String(m.id ?? ''),
    url: str(m.fileUrl) ?? str(m.url),
    caption: str(m.caption),
    sourceType: str(m.sourceType),
    original: m.original === true,
    watermarked: m.watermarked === true,
  };
}

function mapPhotobook(r: Raw): Photobook {
  const items = Array.isArray(r.mediaItems) ? (r.mediaItems as Raw[]) : [];
  const previews = items
    .map((m) => str(m.fileUrl) ?? str(m.url))
    .filter((u): u is string => !!u)
    .slice(0, 3);
  return {
    id: String(r.id ?? ''),
    name: str(r.name) ?? 'Photobook',
    description: str(r.description),
    coverImage: str(r.coverImage),
    status: str(r.status),
    toName: str(r.photographerName),
    senderName: str(r.senderName),
    photographerName: str(r.photographerName) ?? str(r.senderName),
    mediaCount: num(r.mediaCount),
    createdAt: str(r.createdAt),
    sentAt: str(r.sentAt),
    editedAt: str(r.editedAt),
    resubmittedAt: str(r.resubmittedAt),
    completedAt: str(r.completedAt),
    changeRequestedAt: str(r.changeRequestedAt),
    changeRequestNote: str(r.changeRequestNote),
    closedByPhotographer: r.closedByPhotographer === true,
    layout: str(r.layout),
    eventId: str(r.eventId),
    sourceType: str(r.sourceType),
    sources: strs(r.sources),
    previews: previews.length ? previews : undefined,
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
 * GET /photographer/photobooks, the "received photobooks" list.
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
    pricePerExtraPhoto: num(d.pricePerExtraPhoto),
    paymentRequired: d.paymentRequired === true,
    paymentDeclarationId: str(d.paymentDeclarationId),
    photos: media.map(mapPhoto).filter((p) => p.id),
  };
}

/** Send an edited received photobook back to its client (web: POST /photographer/photobooks/{id}/resubmit). */
export async function resubmitPhotobook(id: string): Promise<void> {
  requireOk(await api.post(`/photographer/photobooks/${encodeURIComponent(id)}/resubmit`));
}

/** Remove or close a received photobook (web: DELETE /photographer/photobooks/{id}, a dismissal: "Closed by photographer"). */
export async function dismissReceivedPhotobook(id: string): Promise<void> {
  requireOk(await api.delete(`/photographer/photobooks/${encodeURIComponent(id)}`));
}

/** The photographer saves edits: the full ordered photo list (nothing may be removed) and, optionally, a new name. */
export async function savePhotographerEdits(id: string, input: { mediaIds: string[]; name?: string }): Promise<void> {
  const body: Record<string, unknown> = { mediaIds: input.mediaIds };
  if (input.name?.trim()) body.name = input.name.trim();
  requireOk(await api.put(`/photographer/photobooks/${encodeURIComponent(id)}`, body));
}

// Authoring

export type CreatePhotobookInput = {
  name: string;
  description?: string;
  mediaIds: string[];
  layout?: string;
  coverImage?: string;
  eventId?: string;
};

/** POST /customer/events/photobook. The server checks every photo again; a refused one fails the whole request. */
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

/** Send the book to its photographer (the owner of the photos). */
export async function sendPhotobookToClient(id: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(`/customer/events/photobook/${encodeURIComponent(id)}/send`);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not send the photobook.' };
  }
}

/** The owner accepts a book that is ready to review. */
export async function acceptPhotobook(id: string): Promise<void> {
  requireOk(await api.post(`/customer/events/photobook/${encodeURIComponent(id)}/accept`));
}

/** The owner sends a reviewed book back to the photographer with a note. */
export async function requestPhotobookChanges(id: string, note: string): Promise<void> {
  requireOk(await api.post(`/customer/events/photobook/${encodeURIComponent(id)}/request-changes`, { note: note.trim() }));
}

// Picker

export type PickerAlbum = {
  id: ID;
  title: string;
  /** event, free, purchased, content or mine. */
  sourceType: string;
  /** Paid or priced: some photos are only usable after buying them. */
  priced: boolean;
  photoCount: number;
  usableCount: number;
  ownerId?: string;
  ownerName?: string;
  eventId?: string;
  eventTitle?: string;
  coverUrl?: string;
};

export type PickerPhoto = { id: ID; thumbUrl?: string; sourceType: string; caption?: string };

export async function listPickerAlbums(): Promise<PickerAlbum[]> {
  const res = await api.getOk<ApiEnvelope<unknown>>('/customer/events/photobook/sources');
  return rows(res?.data).map((r) => ({
    id: String(r.id ?? ''),
    title: str(r.title) ?? 'Album',
    sourceType: str(r.sourceType) ?? 'event',
    priced: r.priced === true,
    photoCount: num(r.photoCount) ?? 0,
    usableCount: num(r.usableCount) ?? 0,
    ownerId: str(r.ownerId),
    ownerName: str(r.ownerName),
    eventId: str(r.eventId),
    eventTitle: str(r.eventTitle),
    coverUrl: str(r.coverUrl),
  })).filter((a) => a.id);
}

export async function listPickerPhotos(albumId: string, page = 0, size = 200): Promise<{ items: PickerPhoto[]; total: number }> {
  const res = await api.getOk<ApiEnvelope<Raw>>(
    `/customer/events/photobook/sources/${encodeURIComponent(albumId)}/photos?page=${page}&size=${size}`,
  );
  const d = (res?.data ?? {}) as Raw;
  const items = Array.isArray(d.items) ? (d.items as Raw[]) : [];
  return {
    total: num(d.total) ?? items.length,
    items: items
      .map((r) => ({ id: String(r.id ?? ''), thumbUrl: str(r.thumbUrl), sourceType: str(r.sourceType) ?? 'event', caption: str(r.caption) }))
      .filter((p) => p.id),
  };
}

export type EventTerms = { eventId: string; title?: string; freePhotosLimit: number; pricePerExtraPhoto: number };

/** An event book's free limit and extra-photo price (the picker's bottom bar). Only the event's owner may ask. */
export async function getEventTerms(eventId: string): Promise<EventTerms> {
  const res = await api.getOk<ApiEnvelope<Raw>>(`/customer/events/photobook/pricing?eventId=${encodeURIComponent(eventId)}`);
  const d = (res?.data ?? {}) as Raw;
  const price = typeof d.pricePerExtraPhoto === 'number' ? d.pricePerExtraPhoto : Number(d.pricePerExtraPhoto ?? 0);
  return { eventId, title: str(d.title), freePhotosLimit: num(d.freePhotosLimit) ?? 0, pricePerExtraPhoto: Number.isFinite(price) ? price : 0 };
}
