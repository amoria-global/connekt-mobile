/**
 * Photographer reviews.
 * - Submit: POST /api/remote/photographer-reviews  { eventId, rating, comment }
 * - List:   GET  /api/remote/public/photographers/{id}/reviews
 */
import { api } from '@/api/client';
import type { ApiError, ApiEnvelope, ID } from '@/types';

export type Review = {
  id: ID;
  rating: number;
  comment?: string;
  reviewerName?: string;
  createdAt?: string;
};

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0);

function mapReview(r: Raw): Review {
  const reviewer = (r.reviewer ?? {}) as Raw;
  const reviewerName =
    [str(reviewer.firstName), str(reviewer.lastName)].filter(Boolean).join(' ') ||
    str(reviewer.name) ||
    str(r.reviewerName);
  return {
    id: String(r.id ?? ''),
    rating: num(r.rating),
    comment: str(r.comment),
    reviewerName,
    createdAt: str(r.createdAt),
  };
}

export async function listPhotographerReviews(photographerId: string): Promise<Review[]> {
  const res = await api.get<ApiEnvelope<Raw[]>>(
    `/public/photographers/${encodeURIComponent(photographerId)}/reviews`,
    { skipAuth: true },
  );
  const data = Array.isArray(res?.data) ? res.data : [];
  return data.map(mapReview).filter((r) => r.id);
}

/** Submit a review for the photographer who shot the given event. */
export async function submitReview(eventId: string, rating: number, comment?: string): Promise<void> {
  const res = await api.post<ApiEnvelope<Raw>>('/photographer-reviews', {
    eventId,
    rating,
    comment: comment ?? null,
  });
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not submit your review.' } satisfies ApiError;
  }
}
