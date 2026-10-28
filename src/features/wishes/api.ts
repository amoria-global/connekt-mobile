/**
 * Wishes API. Sending lives in features/streams/api.ts (sendEventWish, sendEventVideoWish); this file reads the
 * public feed, lets a sender hide their own wish, and gives the host the moderation queue.
 *
 * Public: GET /public/events/{id}/wishes, POST /public/events/{id}/wishes/{wishId}/hide.
 * Host:   GET /photographer/events/{id}/wishes, PUT /photographer/events/{id}/wishes/{wishId}/moderation.
 * Reporting a wish reuses the chat report routes (features/moderation/api.ts), since a wish is a chat row.
 */
import { api } from '@/api/client';
import type { ApiEnvelope } from '@/types';
import { getDeviceId } from '@/utils/deviceId';
import type { Wish, WishPage, WishStatus, WishVisibility } from './types';

type Raw = Record<string, unknown>;

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

export function mapWish(r: Raw): Wish {
  const status = String(r.status ?? '').toLowerCase();
  const seconds = Number(r.duration);
  return {
    id: String(r.id ?? ''),
    type: r.type === 'VIDEO' ? 'video' : 'text',
    authorName: text(r.authorName) ?? 'Guest',
    message: typeof r.message === 'string' ? r.message : '',
    videoUrl: text(r.videoUrl),
    thumbnailUrl: text(r.thumbnailUrl),
    durationSeconds: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : undefined,
    visibility: String(r.visibility ?? '').toLowerCase() === 'public' ? 'public' : 'private',
    status: status === 'approved' || status === 'hidden' ? (status as WishStatus) : 'pending',
    createdAt: text(r.createdAt),
    mine: r.mine === true,
  };
}

function fail(res: ApiEnvelope<unknown> | undefined, fallback: string): never {
  throw { status: 400, message: res?.message || fallback };
}

/** Approved public wishes, newest first. Never throws on an empty feed. */
export async function listWishes(eventId: string, page = 0, size = 20): Promise<WishPage> {
  const fingerprint = await getDeviceId();
  const res = await api.get<ApiEnvelope<Raw>>(
    `/public/events/${encodeURIComponent(eventId)}/wishes?page=${page}&size=${size}&deviceFingerprint=${encodeURIComponent(fingerprint)}`,
    { skipAuth: true },
  );
  if (res?.action !== 1) fail(res, 'Could not load the wishes.');
  const d = (res.data ?? {}) as Raw;
  return {
    items: (Array.isArray(d.items) ? (d.items as Raw[]) : []).map(mapWish).filter((w) => w.id),
    page: Number(d.page) || 0,
    totalPages: Number(d.totalPages) || 0,
    total: Number(d.total) || 0,
    allowWishInvites: typeof d.allowWishInvites === 'boolean' ? d.allowWishInvites : undefined,
  };
}

/** A sender hides a wish their own device sent. */
export async function hideOwnWish(eventId: string, wishId: string): Promise<void> {
  const res = await api.post<ApiEnvelope<unknown>>(
    `/public/events/${encodeURIComponent(eventId)}/wishes/${encodeURIComponent(wishId)}/hide`,
    { deviceFingerprint: await getDeviceId() },
    { skipAuth: true },
  );
  if (res?.action !== 1) fail(res, 'Could not hide this wish.');
}

/** Every wish for an event the signed-in person hosts, with its status. */
export async function listHostWishes(eventId: string): Promise<Wish[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(`/photographer/events/${encodeURIComponent(eventId)}/wishes`);
  if (res?.action !== 1) fail(res, 'Could not load the wishes.');
  return (Array.isArray(res.data) ? res.data : []).map(mapWish).filter((w) => w.id);
}

export async function moderateWish(eventId: string, wishId: string, status: 'approved' | 'hidden'): Promise<Wish> {
  const res = await api.put<ApiEnvelope<Raw>>(
    `/photographer/events/${encodeURIComponent(eventId)}/wishes/${encodeURIComponent(wishId)}/moderation`,
    { status: status.toUpperCase() },
  );
  if (res?.action !== 1) fail(res, 'Could not update this wish.');
  return mapWish((res.data ?? {}) as Raw);
}

export const visibilityLabel = (v: WishVisibility) => (v === 'public' ? 'Public' : 'Private');
