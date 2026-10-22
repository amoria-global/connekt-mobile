/**
 * Photographer workspace invitations: the rules the app needs, kept apart from the screens so each can be tested.
 * Mirrors the dashboard's `app/lib/workspace.ts`, `workspaceStatus.ts` and `APIs/workspaces.ts` against
 * `/api/remote/photographer/workspaces/**`.
 *
 * A photographer can be invited to work inside another photographer's workspace. The server owns every rule: it
 * binds an answer to the signed-in invitee, checks the membership on every request, and refuses money and
 * owner-account operations itself. Nothing here grants anything. This only keeps the app honest about it: which calls
 * name the workspace, which screens do not exist there, and which buttons are worth showing.
 */

export const WORKSPACE_HEADER = 'X-Workspace-Id';

/** The server's refusal for "not a member" and "no such workspace". Both read the same on purpose. */
export const WORKSPACE_NOT_AVAILABLE = 'Workspace access is not available';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED' | 'REVOKED' | 'LEFT';

export interface WorkspacePerson {
  id: string;
  name: string;
  customerType?: string;
  profilePicture?: string;
}

export interface WorkspaceInvitation {
  id: string;
  status: InvitationStatus;
  owner: WorkspacePerson;
  invitee: WorkspacePerson;
  note?: string;
  createdAt?: string;
  expiresAt?: string;
  respondedAt?: string;
  endedAt?: string;
}

/** What the server says a member may do in a workspace. Fixed by the policy; shown, never trusted. */
export interface WorkspaceAccess {
  business: boolean;
  financial: boolean;
  ownerAccount: boolean;
  manageMembers: boolean;
}

export interface WorkspaceMembership {
  workspaceId: string;
  invitationId: string;
  owner: WorkspacePerson;
  joinedAt?: string;
  access: WorkspaceAccess;
}

type Raw = Record<string, unknown>;
const STATUSES: readonly string[] = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'REVOKED', 'LEFT'];
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

export function mapPerson(raw: unknown): WorkspacePerson {
  const r = (raw ?? {}) as Raw;
  return { id: String(r.id ?? ''), name: str(r.name) ?? 'A photographer', customerType: str(r.customerType), profilePicture: str(r.profilePicture) };
}

export function mapInvitation(raw: unknown): WorkspaceInvitation {
  const r = (raw ?? {}) as Raw;
  const status = String(r.status ?? '').toUpperCase();
  return {
    id: String(r.id ?? ''),
    // An unknown status is never guessed into a friendly one: it is shown as ended, with no actions.
    status: (STATUSES.includes(status) ? status : 'EXPIRED') as InvitationStatus,
    owner: mapPerson(r.owner),
    invitee: mapPerson(r.invitee),
    note: str(r.note),
    createdAt: str(r.createdAt),
    expiresAt: str(r.expiresAt),
    respondedAt: str(r.respondedAt),
    endedAt: str(r.endedAt),
  };
}

export function mapMembership(raw: unknown): WorkspaceMembership {
  const r = (raw ?? {}) as Raw;
  const a = (r.access ?? {}) as Raw;
  return {
    workspaceId: String(r.workspaceId ?? ''),
    invitationId: String(r.invitationId ?? ''),
    owner: mapPerson(r.owner),
    joinedAt: str(r.joinedAt),
    // Anything the server did not say is "no": a missing flag never grants.
    access: { business: a.business === true, financial: a.financial === true, ownerAccount: a.ownerAccount === true, manageMembers: a.manageMembers === true },
  };
}

// ─── Which calls carry the workspace ───

/**
 * Calls about the signed-in person, not the workspace, so they never carry the workspace header: sign-in, their own
 * profile and security, their own notifications and permissions, and the invitation endpoints themselves. Paths are
 * relative to the API base (`/api/remote`).
 */
const PERSONAL_PATHS = [
  '/auth/',
  '/public/',
  '/customer/profile',
  '/customer/kyc',
  '/customer/totp',
  '/customer/notifications',
  '/photographer/notifications',
  '/photographer/workspaces',
  '/photographer/profile-summary',
  '/photographer/pending-changes',
  '/photographer/update-important-details',
  '/photographer/submit-profile',
  '/team/',
  '/push/',
];

/** The API path of a request, relative to the base, whether it was given as a path or a full URL. */
export function apiPath(pathOrUrl: string): string {
  const i = pathOrUrl.indexOf('/api/remote/');
  const rest = i >= 0 ? pathOrUrl.slice(i + '/api/remote'.length) : pathOrUrl;
  const q = rest.indexOf('?');
  return q >= 0 ? rest.slice(0, q) : rest;
}

export function isPersonalCall(pathOrUrl: string): boolean {
  const p = apiPath(pathOrUrl);
  return PERSONAL_PATHS.some((x) => p.startsWith(x));
}

const ID = /^[0-9a-f-]{36}$/i;

/** The header to add to a call, if the call belongs to the selected workspace. */
export function workspaceHeaders(pathOrUrl: string, workspaceId: string | null | undefined): Record<string, string> {
  if (!workspaceId || !ID.test(workspaceId) || isPersonalCall(pathOrUrl)) return {};
  return { [WORKSPACE_HEADER]: workspaceId };
}

// ─── Screens that do not exist in a shared workspace ───

/**
 * Route paths (as expo-router reports them) that are not part of a shared workspace: everything about money, the
 * owner's account, notifications, chat, opportunities and managing who else is invited. The server refuses the
 * matching calls regardless; this keeps menus, tabs and deep links honest.
 */
const SHARED_BLOCKED_ROUTES = [
  '/wallet',
  '/transactions',
  '/withdraw',
  '/payroll',
  '/analytics',
  '/payments',
  '/payment',
  '/payment-accounts',
  '/client',
  '/donations',
  '/pay-on-tv',
  '/notifications',
  '/inbox',
  '/conversation',
  '/preferences',
  '/profile',
  '/edit-profile',
  '/kyc',
  '/two-factor',
  '/delete-account',
  '/blocked-accounts',
  '/tv-devices',
  '/connect-to-tv',
  '/collaborate',
  '/content-albums',
  '/content-album',
];

export function isBlockedInSharedWorkspace(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return SHARED_BLOCKED_ROUTES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// ─── Status wording and the moves each side is offered ───

export type Tone = 'success' | 'warning' | 'error' | 'muted';

export interface StatusView {
  label: string;
  tone: Tone;
  meaning: { owner: string; invitee: string };
}

const VIEWS: Record<InvitationStatus, StatusView> = {
  PENDING: { label: 'Waiting', tone: 'warning', meaning: { owner: 'Waiting for them to answer.', invitee: 'Waiting for your answer.' } },
  ACCEPTED: { label: 'Active', tone: 'success', meaning: { owner: 'They can work in your workspace.', invitee: 'You can work in this workspace.' } },
  DECLINED: { label: 'Declined', tone: 'muted', meaning: { owner: 'They declined.', invitee: 'You declined.' } },
  CANCELLED: { label: 'Cancelled', tone: 'muted', meaning: { owner: 'You cancelled it.', invitee: 'It was cancelled.' } },
  EXPIRED: { label: 'Expired', tone: 'muted', meaning: { owner: 'It was not answered in time.', invitee: 'It expired before you answered.' } },
  REVOKED: { label: 'Removed', tone: 'error', meaning: { owner: 'You removed their access.', invitee: 'Your access was removed.' } },
  LEFT: { label: 'Left', tone: 'muted', meaning: { owner: 'They left your workspace.', invitee: 'You left this workspace.' } },
};

export const statusView = (s: InvitationStatus): StatusView => VIEWS[s];

export type OwnerAction = 'resend' | 'cancel' | 'revoke';
export type InviteeAction = 'accept' | 'decline' | 'open' | 'leave';

/** What the owner can do to an invitation they sent, in the order shown. */
export function ownerActions(status: InvitationStatus): OwnerAction[] {
  switch (status) {
    case 'PENDING': return ['resend', 'cancel'];
    case 'ACCEPTED': return ['revoke'];
    case 'DECLINED':
    case 'CANCELLED':
    case 'EXPIRED': return ['resend'];
    default: return [];
  }
}

/** What the invited photographer can do with an invitation they received. */
export function inviteeActions(status: InvitationStatus): InviteeAction[] {
  switch (status) {
    case 'PENDING': return ['accept', 'decline'];
    case 'ACCEPTED': return ['open', 'leave'];
    default: return [];
  }
}

/** Waiting invitations first, then active, then the rest; newest first within a group. */
export function sortInvitations<T extends Pick<WorkspaceInvitation, 'status' | 'createdAt'>>(list: readonly T[]): T[] {
  const rank = (s: InvitationStatus) => (s === 'PENDING' ? 0 : s === 'ACCEPTED' ? 1 : 2);
  return [...list].sort((a, b) => rank(a.status) - rank(b.status) || String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "22 Oct 2026", or an empty string when there is no date. Fixed English month names, so it reads the same everywhere. */
export function shortDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
