/**
 * Photobooks (customer view).
 * - List:   GET /api/remote/customer/events/photobooks
 * - Detail: GET /api/remote/customer/events/photobooks/{id}
 * Response uses PhotobookResponseDTO (name, status, coverImage, mediaItems[]…).
 */
import { api } from '@/api/client';
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

export async function listPhotobooks(): Promise<Photobook[]> {
  const res = await api.get<ApiEnvelope<unknown>>('/customer/events/photobooks');
  const data = Array.isArray(res?.data) ? (res.data as Raw[]) : [];
  return data.map(mapPhotobook).filter((p) => p.id);
}

export async function getPhotobook(id: string): Promise<PhotobookDetail> {
  const res = await api.get<ApiEnvelope<Raw>>(`/customer/events/photobooks/${encodeURIComponent(id)}`);
  const d = (res?.data ?? {}) as Raw;
  const media = Array.isArray(d.mediaItems) ? (d.mediaItems as Raw[]) : [];
  return {
    ...mapPhotobook(d),
    freePhotosLimit: num(d.freePhotosLimit),
    extraPhotosCount: num(d.extraPhotosCount),
    extraPhotosAmount: num(d.extraPhotosAmount),
    paymentRequired: d.paymentRequired === true,
    photos: media
      .map((m) => ({ id: String(m.id ?? ''), url: str(m.fileUrl) ?? str(m.url), caption: str(m.caption) }))
      .filter((p) => p.id),
  };
}
