/**
 * Find My Photos — facial-recognition photo search.
 * Mirrors the web: POST /public/face-search (multipart) with a selfie and an
 * optional invite `code`. Returns matched photos across events / paid albums.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ID } from '@/types';
import type { PickedImage } from '@/services/imagePicker';

export type FoundPhoto = {
  id: ID;
  thumbnailUrl?: string;
  /** Full-res URL (null for unpurchased paid-album photos). */
  url?: string;
  isPurchased: boolean;
  albumId?: string;
  eventId?: string;
  eventTitle?: string;
  photographerName?: string;
  price?: number;
  currency?: string;
  createdAt?: string;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

function mapPhoto(r: Raw): FoundPhoto {
  return {
    id: String(r.id ?? ''),
    thumbnailUrl: str(r.thumbnailUrl) ?? str(r.url),
    url: str(r.url),
    isPurchased: r.isPurchased === true,
    albumId: str(r.albumId) ?? str((r.album as Raw)?.id),
    eventId: str(r.eventId),
    eventTitle: str(r.eventTitle),
    photographerName: str(r.photographerName),
    price: num(r.price) ?? num(r.pricePerImage),
    currency: str(r.currency) ?? str(r.currencyCode),
    createdAt: str(r.createdAt),
  };
}

/**
 * @param selfie picked image (camera or library)
 * @param code optional invite code to scope the search to one event/album
 */
export async function faceSearch(selfie: PickedImage, code?: string): Promise<FoundPhoto[]> {
  const form = new FormData();
  // React Native multipart file shape.
  form.append('selfie', { uri: selfie.uri, name: selfie.name, type: selfie.type } as unknown as Blob);
  if (code && code.trim()) form.append('code', code.trim());

  const res = await api.post<ApiEnvelope<Raw[]>>('/public/face-search', form);
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapPhoto).filter((p) => p.id);
}
