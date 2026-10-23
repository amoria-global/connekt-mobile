/**
 * Workspace invitations API, wraps /api/remote/photographer/workspaces/** (WorkspaceInvitationController.java).
 *
 * The backend owns every rule and every status change; this only asks. Every refusal it sends as `action: 0` is
 * thrown as an ApiError, even on HTTP 200.
 */
import { api } from '@/api/client';
import type { ApiEnvelope, ApiError } from '@/types';
import {
  mapInvitation, mapMembership, mapPerson,
  type WorkspaceInvitation, type WorkspaceMembership, type WorkspacePerson,
} from './model';

type Raw = Record<string, unknown>;

const BASE = '/photographer/workspaces';
const id = (v: string) => encodeURIComponent(v);

function data(res: ApiEnvelope<Raw> | undefined, fallback: string): Raw {
  if (res?.action !== 1) throw { status: 400, message: res?.message || fallback } satisfies ApiError;
  return (res?.data ?? {}) as Raw;
}

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export async function lookupPhotographer(email: string): Promise<WorkspacePerson> {
  const d = data(await api.get<ApiEnvelope<Raw>>(`${BASE}/lookup?email=${id(email.trim())}`), 'Could not look that up.');
  return mapPerson(d.photographer);
}

export async function listSentInvitations(): Promise<WorkspaceInvitation[]> {
  return list(data(await api.get<ApiEnvelope<Raw>>(`${BASE}/sent`), 'Could not load your invitations.').invitations).map(mapInvitation);
}

export async function sendInvitation(inviteeId: string, note?: string): Promise<WorkspaceInvitation> {
  const d = data(await api.post<ApiEnvelope<Raw>>(`${BASE}/invitations`, { inviteeId, note: note?.trim() || null }), 'Could not send the invitation.');
  return mapInvitation(d.invitation);
}

export async function resendInvitation(invitationId: string): Promise<WorkspaceInvitation> {
  return mapInvitation(data(await api.post<ApiEnvelope<Raw>>(`${BASE}/invitations/${id(invitationId)}/resend`), 'Could not send it again.').invitation);
}

export async function cancelInvitation(invitationId: string): Promise<WorkspaceInvitation> {
  return mapInvitation(data(await api.delete<ApiEnvelope<Raw>>(`${BASE}/invitations/${id(invitationId)}`), 'Could not cancel the invitation.').invitation);
}

export async function revokeMembership(invitationId: string): Promise<WorkspaceInvitation> {
  return mapInvitation(data(await api.post<ApiEnvelope<Raw>>(`${BASE}/invitations/${id(invitationId)}/revoke`), 'Could not remove access.').invitation);
}

export async function listReceivedInvitations(): Promise<WorkspaceInvitation[]> {
  return list(data(await api.get<ApiEnvelope<Raw>>(`${BASE}/received`), 'Could not load your invitations.').invitations).map(mapInvitation);
}

export async function answerInvitation(invitationId: string, accept: boolean): Promise<WorkspaceInvitation> {
  // Two literal calls, so the contract test can see and check both paths.
  const res = accept
    ? await api.post<ApiEnvelope<Raw>>(`${BASE}/received/${id(invitationId)}/accept`)
    : await api.post<ApiEnvelope<Raw>>(`${BASE}/received/${id(invitationId)}/decline`);
  return mapInvitation(data(res, 'Could not answer the invitation.').invitation);
}

export async function leaveWorkspace(invitationId: string): Promise<WorkspaceInvitation> {
  return mapInvitation(data(await api.post<ApiEnvelope<Raw>>(`${BASE}/received/${id(invitationId)}/leave`), 'Could not leave the workspace.').invitation);
}

export async function listMyWorkspaces(): Promise<WorkspaceMembership[]> {
  return list(data(await api.get<ApiEnvelope<Raw>>(`${BASE}/mine`), 'Could not load your workspaces.').workspaces).map(mapMembership);
}
