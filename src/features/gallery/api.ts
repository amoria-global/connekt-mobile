/**
 * Galleries / Albums.
 * - Client list:        GET  /customer/albums         (rich client album API)
 * - Photographer list:  GET  /photographer/albums
 * - Album detail:       GET  /customer/albums/{id}    (images + lock/payment)
 * - Unlock paid album:  POST /customer/albums/{id}/unlock
 * Image URLs come back absolute from the backend.
 */
import { api } from '@/api/client';
import type { PickedImage } from '@/services/imagePicker';
import type { ApiError, ApiEnvelope, ID } from '@/types';

export type GalleryItem = {
  id: ID;
  name: string;
  coverPhoto?: string;
  photoCount?: number;
  locked?: boolean;
};

export type AlbumImage = { id: ID; url?: string; caption?: string };

export type AlbumDetail = GalleryItem & {
  images: AlbumImage[];
  amountDue?: number;
  currency?: string;
  photographer?: string;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

function mapGallery(r: Raw): GalleryItem {
  return {
    id: String(r.id ?? ''),
    name: str(r.title) ?? str(r.name) ?? 'Album',
    coverPhoto: str(r.thumbnail) ?? str(r.coverPhoto) ?? str(r.coverImage),
    photoCount: num(r.photoCount) ?? num(r.photosCount),
    locked: r.isLocked === true || r.locked === true,
  };
}

export async function listGalleries(isPhotographer: boolean): Promise<GalleryItem[]> {
  const path = isPhotographer ? '/photographer/albums' : '/customer/albums';
  const res = await api.get<ApiEnvelope<Raw[]>>(path);
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapGallery).filter((g) => g.id);
}

export async function getAlbum(id: string, isPhotographer = false): Promise<AlbumDetail> {
  const path = isPhotographer
    ? `/photographer/albums/${encodeURIComponent(id)}`
    : `/customer/albums/${encodeURIComponent(id)}`;
  const res = await api.get<ApiEnvelope<Raw>>(path);
  const d = (res?.data ?? {}) as Raw;
  const rawImages = Array.isArray(d.images) ? (d.images as Raw[]) : [];
  const payment = (d.payment ?? {}) as Raw;
  return {
    ...mapGallery(d),
    photographer: str(d.photographer),
    amountDue: num(payment.amountDue),
    currency: str(payment.currency) ?? str(d.currency),
    images: rawImages
      .map((i) => ({ id: String(i.id ?? ''), url: str(i.fileUrl) ?? str(i.url), caption: str(i.caption) }))
      .filter((i) => i.id),
  };
}

export async function unlockAlbum(id: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>(`/customer/albums/${encodeURIComponent(id)}/unlock`);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not unlock this album.' } satisfies ApiError;
  }
}

// --- Photographer album management ---------------------------------------

export type AlbumCategory = { value: string; label: string };

/** Content-album categories (enum name + display label). */
export async function listAlbumCategories(): Promise<AlbumCategory[]> {
  const res = await api.get<ApiEnvelope<Raw>>('/photographer/albums/content/categories');
  const cats = (res?.data as Raw)?.categories;
  if (!Array.isArray(cats)) return [];
  return cats
    .map((c) => {
      if (typeof c === 'string') return { value: c, label: c };
      const r = c as Raw;
      const value = str(r.name) ?? str(r.value) ?? str(r.id);
      return value ? { value, label: str(r.label) ?? str(r.name) ?? value } : null;
    })
    .filter((c): c is AlbumCategory => !!c);
}

export type CreateAlbumInput = {
  title: string;
  description?: string;
  category: string; // enum name
  pricePerImage: number;
  currencyId: string;
  cover?: PickedImage | null;
  images: PickedImage[];
};

const asBlob = (img: PickedImage) =>
  ({ uri: img.uri, name: img.name, type: img.type }) as unknown as Blob;

/** Creates a paid content album (web parity: POST /photographer/albums/content). */
export async function createContentAlbum(input: CreateAlbumInput): Promise<void> {
  const form = new FormData();
  form.append('title', input.title.trim());
  if (input.description) form.append('description', input.description);
  form.append('category', input.category);
  form.append('pricePerImage', String(input.pricePerImage));
  form.append('currencyId', input.currencyId);
  if (input.cover) form.append('coverImage', asBlob(input.cover));
  for (const img of input.images) form.append('images', asBlob(img));

  const res = await api.post<ApiEnvelope<Raw>>('/photographer/albums/content', form);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not create the album.' } satisfies ApiError;
  }
}

/** Adds more photos to an existing album. */
export async function addAlbumImages(albumId: string, images: PickedImage[]): Promise<void> {
  for (const img of images) {
    const form = new FormData();
    form.append('file', asBlob(img));
    await api.post(`/photographer/albums/${encodeURIComponent(albumId)}/images`, form);
  }
}

/** Deletes an album the photographer owns. */
export async function deleteAlbum(id: string): Promise<void> {
  const res = await api.delete<ApiEnvelope<Raw>>(`/photographer/albums/${encodeURIComponent(id)}`);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not delete the album.' } satisfies ApiError;
  }
}

// ────── Face-scan / AWS Rekognition index ───────────────────────────────
//
// When a photographer uploads photos to an album, the backend kicks off
// AWS Rekognition to index faces in each image. The resulting "face
// collection" is what powers the public face-search endpoint that
// clients use to find their own photos. This helper surfaces the
// indexing status so a photographer can verify their album is
// face-searchable.

export type AlbumFaceStatus = {
  albumId: string;
  eventId?: string;
  isPublished?: boolean;
  galleryImageCount: number;
  eventMediaCount?: number;
  /** Face collection metadata from Rekognition (faceCount, status). */
  collection?: {
    faceCount?: number;
    status?: string;
    error?: string;
    message?: string;
  };
  message?: string;
};

export async function getAlbumFaceStatus(albumId: string): Promise<AlbumFaceStatus> {
  const res = await api.get<ApiEnvelope<Raw>>(
    `/photographer/albums/${encodeURIComponent(albumId)}/face-status`,
  );
  const d = (res?.data ?? {}) as Raw;
  const col = (d.collection ?? {}) as Raw;
  const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);
  return {
    albumId,
    eventId: str(d.eventId),
    isPublished: d.isPublished === true,
    galleryImageCount: num(d.galleryImageCount) ?? 0,
    eventMediaCount: num(d.eventMediaCount),
    collection: col
      ? {
          faceCount: num(col.faceCount) ?? num(col.totalFaces),
          status: str(col.status),
          error: str(col.error),
          message: str(col.message),
        }
      : undefined,
    message: str(res?.message),
  };
}
