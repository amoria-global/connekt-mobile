/**
 * Album collaboration, the photographer-only replacement for the Team.
 * Mirrors the dashboard's Collaborate section against
 * `/api/remote/photographer/collab/**` (AlbumCollaborationController.java).
 *
 * An album owner invites fellow photographers with a link. Collaborators
 * submit photos, and the owner approves each one into the album or rejects
 * it. Nobody gets access to anyone else's dashboard.
 *
 * Every refusal the backend sends as `action: 0` is thrown as an ApiError,
 * even on HTTP 200.
 */
import { api } from '@/api/client';
import type { PickedImage } from '@/services/imagePicker';
import type { ApiEnvelope, ApiError } from '@/types';
import { appendFile } from '@/utils/upload';
import {
  mapInvite, mapInvitePreview, mapJoinedAlbum, mapJoinedDetail, mapOwnedAlbum, mapOwnedDetail, mapSubmission,
  type Invite, type InvitePreview, type JoinedAlbum, type JoinedAlbumDetail, type OwnedAlbum,
  type OwnedAlbumDetail, type ReviewResult, type Submission,
} from './model';

type Raw = Record<string, unknown>;

const BASE = '/photographer/collab';

function data(res: ApiEnvelope<Raw> | undefined, fallback: string): Raw {
  if (res?.action !== 1) {
    throw { status: 400, message: res?.message || fallback } satisfies ApiError;
  }
  return (res?.data ?? {}) as Raw;
}

const id = (v: string) => encodeURIComponent(v);

// ─── Owner ───

export async function listOwnedAlbums(): Promise<OwnedAlbum[]> {
  const d = data(await api.get<ApiEnvelope<Raw>>(`${BASE}/albums`), 'Could not load your albums.');
  return (Array.isArray(d.albums) ? (d.albums as Raw[]) : []).map(mapOwnedAlbum);
}

export async function getOwnedAlbum(albumId: string): Promise<OwnedAlbumDetail> {
  return mapOwnedDetail(data(await api.get<ApiEnvelope<Raw>>(`${BASE}/albums/${id(albumId)}`), 'Could not load this album.'));
}

export async function createInvite(albumId: string, note?: string): Promise<Invite> {
  const d = data(
    await api.post<ApiEnvelope<Raw>>(`${BASE}/albums/${id(albumId)}/invites`, { note: note?.trim() || null }),
    'Could not create the invite link.',
  );
  return mapInvite((d.invite ?? {}) as Raw);
}

/** Cancels an unused invite link, or removes a collaborator from the album. */
export async function revokeMembership(membershipId: string): Promise<void> {
  data(await api.delete<ApiEnvelope<Raw>>(`${BASE}/members/${id(membershipId)}`), 'Could not update collaborators.');
}

export async function reviewSubmissions(
  ids: string[],
  decision: 'APPROVE' | 'REJECT',
  note?: string,
): Promise<ReviewResult> {
  const d = data(
    await api.post<ApiEnvelope<Raw>>(`${BASE}/submissions/review`, { ids, decision, note: note?.trim() || null }),
    'Could not save your decision.',
  );
  const list = (v: unknown) => (Array.isArray(v) ? (v as unknown[]).map(String) : []);
  return { reviewed: list(d.reviewed), skipped: list(d.skipped), duplicates: list(d.duplicates) };
}

// ─── Collaborator ───

export async function previewInvite(token: string): Promise<InvitePreview> {
  return mapInvitePreview(data(await api.get<ApiEnvelope<Raw>>(`${BASE}/invites/${id(token)}`), 'This invite link is not valid.'));
}

/** Joins the album and returns its id. */
export async function acceptInvite(token: string): Promise<string> {
  const d = data(await api.post<ApiEnvelope<Raw>>(`${BASE}/invites/${id(token)}/accept`), 'Could not join this album.');
  return String(((d.album ?? {}) as Raw).id ?? '');
}

export async function listJoinedAlbums(): Promise<JoinedAlbum[]> {
  const d = data(await api.get<ApiEnvelope<Raw>>(`${BASE}/joined`), 'Could not load the albums you joined.');
  return (Array.isArray(d.albums) ? (d.albums as Raw[]) : []).map(mapJoinedAlbum);
}

export async function getJoinedAlbum(albumId: string): Promise<JoinedAlbumDetail> {
  return mapJoinedDetail(data(await api.get<ApiEnvelope<Raw>>(`${BASE}/joined/${id(albumId)}`), 'Could not load this album.'));
}

export async function submitPhoto(albumId: string, image: PickedImage): Promise<Submission> {
  const form = new FormData();
  await appendFile(form, 'file', image);
  const d = data(
    await api.post<ApiEnvelope<Raw>>(`${BASE}/joined/${id(albumId)}/submissions`, form),
    'This photo could not be submitted.',
  );
  return mapSubmission((d.submission ?? {}) as Raw);
}

export async function withdrawSubmission(submissionId: string): Promise<void> {
  data(await api.delete<ApiEnvelope<Raw>>(`${BASE}/submissions/${id(submissionId)}`), 'Could not withdraw this photo.');
}

export async function leaveAlbum(albumId: string): Promise<void> {
  data(await api.post<ApiEnvelope<Raw>>(`${BASE}/joined/${id(albumId)}/leave`), 'Could not leave this album.');
}
