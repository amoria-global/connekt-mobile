/**
 * Galleries / Albums.
 * - Client list:        GET  /customer/albums         (rich client album API)
 * - Photographer list:  GET  /photographer/albums
 * - Album detail:       GET  /customer/albums/{id}    (images + lock/payment)
 * - Unlock paid album:  POST /customer/albums/{id}/unlock
 * Image URLs come back absolute from the backend.
 */
import { api } from '@/api/client';
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

export async function getAlbum(id: string): Promise<AlbumDetail> {
  const res = await api.get<ApiEnvelope<Raw>>(`/customer/albums/${encodeURIComponent(id)}`);
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
