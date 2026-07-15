/**
 * "My Library" data for the User (consumer) dashboard.
 *
 * A User's dashboard is about what they've CONSUMED, so it reads from the
 * customer-scoped endpoints:
 *   • Photos purchased / Archives → GET /customer/albums   (ClientAlbumResponseDTO)
 *   • Streams purchased / watches → GET /customer/streams  (CompletedStreamResponseDTO)
 * Payments come from features/payments + features/analytics; settings/help are
 * plain navigation. Everything is mapped defensively — a brand-new User with no
 * history simply yields empty arrays, never an error.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : undefined);

// ────── Purchased photo albums ───────────────────────────────────────────

export type PurchasedAlbum = {
  id: string;
  title: string;
  thumbnail?: string;
  photographer?: string;
  photoCount: number;
  date?: string;
  locked: boolean;
  /** Archived albums surface under the dashboard's "Archives" section. */
  archived: boolean;
  eventId?: string;
};

function mapAlbum(r: Raw): PurchasedAlbum {
  return {
    id: String(r.id ?? ''),
    title: str(r.title) ?? 'Album',
    thumbnail: str(r.thumbnail) ?? str(r.coverImage),
    photographer: str(r.photographer),
    photoCount: num(r.photoCount) ?? 0,
    date: str(r.receivedDate) ?? str(r.date),
    locked: r.isLocked === true || r.locked === true,
    archived: r.isArchived === true || r.archived === true,
    eventId: str(r.eventId),
  };
}

export async function getPurchasedAlbums(): Promise<PurchasedAlbum[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/customer/albums');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapAlbum).filter((a) => a.id);
}

// ────── Completed streams (purchased access / watch history) ─────────────

export type CompletedStream = {
  id: string;
  eventId?: string;
  title: string;
  photographer?: string;
  coverImage?: string;
  date?: string;
  duration?: string;
  replayUrl?: string;
  peakViewers: number;
};

function mapCompletedStream(r: Raw): CompletedStream {
  return {
    id: String(r.id ?? ''),
    eventId: str(r.eventId),
    title: str(r.streamTitle) ?? str(r.eventTitle) ?? 'Live stream',
    photographer: str(r.photographerName),
    coverImage: str(r.coverImage),
    date: str(r.streamDate),
    duration: str(r.duration),
    replayUrl: str(r.replayUrl) || undefined,
    peakViewers: num(r.peakViewers) ?? 0,
  };
}

export async function getCompletedStreams(): Promise<CompletedStream[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>('/customer/streams');
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapCompletedStream).filter((s) => s.id);
}
