/**
 * Wishes: short messages or clips viewers leave for an event. The shape mirrors the backend's EventWishDTO
 * (GET /public/events/{id}/wishes, GET /photographer/events/{id}/wishes) and the web's lib/wishes types.
 */
export type WishVisibility = 'public' | 'private';
export type WishStatus = 'pending' | 'approved' | 'hidden';
export type WishType = 'text' | 'video';

export type Wish = {
  id: string;
  type: WishType;
  authorName: string;
  message: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  /** Whole seconds, when the backend knows it. */
  durationSeconds?: number;
  visibility: WishVisibility;
  status: WishStatus;
  createdAt?: string;
  /** Sent from this device, so it can be hidden by its sender. */
  mine: boolean;
};

export type WishPage = { items: Wish[]; page: number; totalPages: number; total: number; allowWishInvites?: boolean };

export const MAX_WISH_TEXT = 500;
export const MAX_WISH_VIDEO_SECONDS = 60;
