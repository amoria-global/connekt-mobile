/**
 * Client profile editing — mirrors the web (/api/remote/customer/profile).
 * - GET  /customer/profile
 * - PUT  /customer/profile?firstName=&lastName=&phone=&address=&preferredUsername=
 * - POST /customer/profile/profile-picture  (multipart "profilePicture")
 * - POST /customer/profile/cover-picture    (multipart "coverPicture")
 * - POST /photographer/update-cover-photo   (multipart "coverPhoto") — web parity for photographers
 */
import { api } from '@/api/client';
import { env } from '@/config/env';
import type { CustomerType } from '@/features/auth/types';
import type { ApiError } from '@/types';
import type { PickedImage } from '@/services/imagePicker';
import { appendFile } from '@/utils/upload';

export type ProfileUpdate = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  preferredUsername?: string;
};

/** Fields we care about from GET/PUT/upload profile envelopes. */
export type ProfileSnapshot = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  preferredUsername?: string;
  profilePicture?: string;
  coverPicture?: string;
  profileCompletionPercentage?: number;
  kycStatus?: string;
  joinedFrom?: string;
  rating?: number;
  completedEvents?: number;
  reviewsCount?: number;
  acceptanceRate?: number;
  organizationName?: string;
  specialty?: string;
  about?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Drop empty / "null" paths and anchor relative upload paths to the API host. */
export function normalizeMediaUrl(url: unknown): string | undefined {
  if (typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (!trimmed || trimmed === 'null' || trimmed.includes('/null')) return undefined;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file:') ||
    trimmed.startsWith('content:') ||
    trimmed.startsWith('ph://') ||
    trimmed.startsWith('assets-library:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    // apiBaseUrl ends with /api/remote — uploads live on the host root.
    const origin = env.apiBaseUrl.replace(/\/api\/remote\/?$/, '');
    return `${origin}${trimmed}`;
  }
  return trimmed;
}

function pickUrl(...candidates: unknown[]): string | undefined {
  for (const c of candidates) {
    const n = normalizeMediaUrl(c);
    if (n) return n;
  }
  return undefined;
}

function snapshotFromData(data: Record<string, unknown>): ProfileSnapshot {
  const completion = data.completionPercentage ?? data.profileCompletionPercentage;
  const reviews = Array.isArray(data.reviews) ? data.reviews.length : undefined;
  return {
    firstName: typeof data.firstName === 'string' ? data.firstName : undefined,
    lastName: typeof data.lastName === 'string' ? data.lastName : undefined,
    phone: typeof data.phone === 'string' ? data.phone : undefined,
    address: typeof data.address === 'string' ? data.address : undefined,
    preferredUsername:
      typeof data.preferredUsername === 'string' ? data.preferredUsername : undefined,
    profilePicture: pickUrl(data.profilePicture, data.profileFullUrl, data.url),
    coverPicture: pickUrl(data.coverPicture, data.coverFullUrl, data.coverImage),
    profileCompletionPercentage:
      typeof completion === 'number'
        ? completion
        : typeof completion === 'string' && completion.trim() !== ''
          ? Number(completion)
          : undefined,
    kycStatus: typeof data.kycStatus === 'string' ? data.kycStatus : undefined,
    joinedFrom:
      typeof data.joinedFrom === 'string'
        ? data.joinedFrom
        : typeof data.createdAt === 'string'
          ? data.createdAt
          : undefined,
    rating: typeof data.rating === 'number' ? data.rating : undefined,
    completedEvents:
      typeof data.completedEvents === 'number' ? data.completedEvents : undefined,
    reviewsCount: typeof reviews === 'number' ? reviews : undefined,
    acceptanceRate:
      typeof data.acceptanceRate === 'number' ? data.acceptanceRate : undefined,
    organizationName:
      typeof data.organizationName === 'string' ? data.organizationName : undefined,
    specialty: typeof data.specialty === 'string' ? data.specialty : undefined,
    about: typeof data.about === 'string' ? data.about : undefined,
  };
}

function urlFromEnvelope(
  res: { data?: unknown; profilePicture?: unknown; coverPicture?: unknown; url?: unknown },
  kind: 'avatar' | 'cover',
): string | undefined {
  const data = asRecord(res.data) ?? {};
  if (kind === 'avatar') {
    return pickUrl(data.profilePicture, data.profileFullUrl, data.url, res.profilePicture, res.url);
  }
  return pickUrl(
    data.coverPicture,
    data.coverFullUrl,
    data.coverImage,
    data.url,
    res.coverPicture,
    res.url,
  );
}

/** Latest profile from the server (role-aware: photographer, coordinator, customer). */
export async function fetchProfile(role?: string): Promise<ProfileSnapshot> {
  const normRole = (role || '').toLowerCase();
  let roleEndpoint: string | null = null;
  if (normRole === 'photographer' || normRole === 'videographer') {
    roleEndpoint = '/photographer/profile-summary';
  } else if (normRole === 'coordinator' || normRole === 'event-coordinator') {
    roleEndpoint = '/coordinator/profile';
  }

  if (roleEndpoint) {
    try {
      const roleRes = await api.get<{ action?: number; message?: string; data?: unknown }>(
        roleEndpoint,
      );
      if (roleRes?.action === 1 && roleRes.data) {
        return snapshotFromData(asRecord(roleRes.data) ?? {});
      }
    } catch {
      // Fall through to /customer/profile
    }
  }

  const res = await api.get<{ action?: number; message?: string; data?: unknown }>(
    '/customer/profile',
  );
  if (res?.action !== 1) {
    throw {
      status: 400,
      message: res?.message || 'Could not load your profile.',
    } satisfies ApiError;
  }
  const data = asRecord(res.data) ?? {};
  return snapshotFromData(data);
}

export async function updateProfile(input: ProfileUpdate): Promise<void> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) {
    if (v != null && v.trim() !== '') qs.append(k, v.trim());
  }
  const res = await api.put<{ action?: number; message?: string }>(
    `/customer/profile?${qs.toString()}`,
    undefined,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not update your profile.' } satisfies ApiError;
  }
}

/**
 * Permanently deletes the signed-in user's account and personal data.
 * Backend anonymizes all PII and disables login (DELETE /customer/profile).
 * Callers should log the user out immediately after this resolves.
 */
export async function deleteAccount(): Promise<void> {
  const res = await api.delete<{ action?: number; message?: string }>('/customer/profile');
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not delete your account.' } satisfies ApiError;
  }
}

/** Uploads a new avatar; returns the new full URL. */
export async function updateProfilePicture(image: PickedImage): Promise<string> {
  const form = new FormData();
  await appendFile(form, 'profilePicture', image);

  const res = await api.post<{
    action?: number;
    message?: string;
    data?: unknown;
    profilePicture?: unknown;
    url?: unknown;
  }>('/customer/profile/profile-picture', form);
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not upload the photo.' } satisfies ApiError;
  }

  const fromUpload = urlFromEnvelope(res, 'avatar');
  if (fromUpload) return fromUpload;

  // Some envelopes omit the URL — re-read the profile so we never keep a file:// URI.
  const profile = await fetchProfile();
  if (profile.profilePicture) return profile.profilePicture;
  throw {
    status: 400,
    message: 'Photo uploaded but no image URL came back. Please try again.',
  } satisfies ApiError;
}

/**
 * Uploads a new cover photo and returns the canonical server URL.
 *
 * Photographers use the same endpoint + field name as the web dashboard
 * (`coverPhoto` on `/photographer/update-cover-photo`). Everyone else —
 * including Client — uses `/customer/profile/cover-picture`.
 *
 * Either way we re-fetch the profile afterwards: the photographer endpoint
 * returns no URL in its body, and we must never persist a temporary local URI.
 */
export async function updateCoverPicture(
  image: PickedImage,
  role?: CustomerType,
): Promise<string> {
  if (role === 'Photographer') {
    const form = new FormData();
    await appendFile(form, 'coverPhoto', image);
    const res = await api.post<{ action?: number; message?: string }>(
      '/photographer/update-cover-photo',
      form,
    );
    if (res?.action !== 1) {
      throw {
        status: 400,
        message: res?.message || 'Could not upload the cover photo.',
      } satisfies ApiError;
    }
  } else {
    const form = new FormData();
    await appendFile(form, 'coverPicture', image);
    const res = await api.post<{
      action?: number;
      message?: string;
      data?: unknown;
      coverPicture?: unknown;
      url?: unknown;
    }>('/customer/profile/cover-picture', form);
    if (res?.action !== 1) {
      throw {
        status: 400,
        message: res?.message || 'Could not upload the cover photo.',
      } satisfies ApiError;
    }
    const fromUpload = urlFromEnvelope(res, 'cover');
    if (fromUpload) return fromUpload;
  }

  const profile = await fetchProfile();
  if (profile.coverPicture) return profile.coverPicture;
  throw {
    status: 400,
    message: 'Cover uploaded but no image URL came back. Please try again.',
  } satisfies ApiError;
}
