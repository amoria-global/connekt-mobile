/**
 * Client profile editing — mirrors the web (/api/remote/customer/profile).
 * - PUT  /customer/profile?firstName=&lastName=&phone=&address=&preferredUsername=
 * - POST /customer/profile/profile-picture  (multipart "profilePicture")
 */
import { api } from '@/api/client';
import type { ApiError } from '@/types';
import type { PickedImage } from '@/services/imagePicker';

export type ProfileUpdate = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  preferredUsername?: string;
};

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

/** Uploads a new avatar; returns the new full URL when the backend provides it. */
export async function updateProfilePicture(image: PickedImage): Promise<string | undefined> {
  const form = new FormData();
  form.append('profilePicture', {
    uri: image.uri,
    name: image.name,
    type: image.type,
  } as unknown as Blob);

  const res = await api.post<{ action?: number; message?: string; data?: Record<string, unknown> }>(
    '/customer/profile/profile-picture',
    form,
  );
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || 'Could not upload the photo.' } satisfies ApiError;
  }
  const d = res.data ?? {};
  const url = d.profilePicture ?? d.url ?? d.profileFullUrl;
  return typeof url === 'string' ? url : undefined;
}
