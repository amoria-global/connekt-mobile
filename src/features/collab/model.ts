/**
 * Types and pure helpers for album collaboration. No React Native or Expo
 * imports, so tests load this directly.
 */

type Raw = Record<string, unknown>;

export type SubmissionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type InviteState = 'OPEN' | 'OWNER' | 'ALREADY_MEMBER' | 'USED' | 'REVOKED' | 'EXPIRED';

export type Person = { id: string; name: string; avatar?: string };

export type CollabAlbum = {
  id: string;
  title: string;
  albumType?: string;
  coverImage?: string;
  imageCount: number;
};

export type OwnedAlbum = CollabAlbum & { collaboratorCount: number; pendingCount: number };
export type JoinedAlbum = CollabAlbum & {
  owner: Person;
  joinedAt?: string;
  counts: { pending: number; approved: number; rejected: number };
};
export type Invite = { id: string; token: string; link: string; note?: string; expiresAt: string; createdAt?: string };
export type Collaborator = Person & { membershipId: string; joinedAt?: string };
export type Submission = {
  id: string;
  albumId: string;
  imageUrl?: string;
  caption?: string;
  status: SubmissionStatus;
  reviewNote?: string;
  submittedAt?: string;
  reviewedAt?: string;
  collaborator: Person;
};
export type OwnedAlbumDetail = {
  album: CollabAlbum;
  collaborators: Collaborator[];
  invites: Invite[];
  submissions: Submission[];
};
export type JoinedAlbumDetail = { album: CollabAlbum; owner: Person; submissions: Submission[] };
export type InvitePreview = { album: CollabAlbum; owner: Person; state: InviteState; expiresAt?: string };
export type ReviewResult = { reviewed: string[]; skipped: string[]; duplicates: string[] };

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const list = (v: unknown) => (Array.isArray(v) ? (v as Raw[]) : []);

const STATUSES: SubmissionStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];
const STATES: InviteState[] = ['OPEN', 'OWNER', 'ALREADY_MEMBER', 'USED', 'REVOKED', 'EXPIRED'];

export function mapPerson(r: unknown): Person {
  const p = (r ?? {}) as Raw;
  return { id: String(p.id ?? ''), name: str(p.name) ?? 'A photographer', avatar: str(p.avatar) };
}

export function mapAlbum(r: Raw): CollabAlbum {
  return {
    id: String(r.id ?? ''),
    title: str(r.title) ?? 'Untitled album',
    albumType: str(r.albumType),
    coverImage: str(r.coverImage),
    imageCount: num(r.imageCount),
  };
}

export function mapOwnedAlbum(r: Raw): OwnedAlbum {
  return { ...mapAlbum(r), collaboratorCount: num(r.collaboratorCount), pendingCount: num(r.pendingCount) };
}

export function mapJoinedAlbum(r: Raw): JoinedAlbum {
  const c = (r.counts ?? {}) as Raw;
  return {
    ...mapAlbum(r),
    owner: mapPerson(r.owner),
    joinedAt: str(r.joinedAt),
    counts: { pending: num(c.pending), approved: num(c.approved), rejected: num(c.rejected) },
  };
}

export function mapInvite(r: Raw): Invite {
  return {
    id: String(r.id ?? ''),
    token: String(r.token ?? ''),
    link: String(r.link ?? ''),
    note: str(r.note),
    expiresAt: String(r.expiresAt ?? ''),
    createdAt: str(r.createdAt),
  };
}

export function mapSubmission(r: Raw): Submission {
  const status = String(r.status ?? '') as SubmissionStatus;
  return {
    id: String(r.id ?? ''),
    albumId: String(r.albumId ?? ''),
    imageUrl: str(r.imageUrl),
    caption: str(r.caption),
    status: STATUSES.includes(status) ? status : 'PENDING',
    reviewNote: str(r.reviewNote),
    submittedAt: str(r.submittedAt),
    reviewedAt: str(r.reviewedAt),
    collaborator: mapPerson(r.collaborator),
  };
}

export function mapOwnedDetail(d: Raw): OwnedAlbumDetail {
  return {
    album: mapAlbum((d.album ?? {}) as Raw),
    collaborators: list(d.collaborators).map((c) => ({
      ...mapPerson(c),
      membershipId: String(c.membershipId ?? ''),
      joinedAt: str(c.joinedAt),
    })),
    invites: list(d.invites).map(mapInvite),
    submissions: list(d.submissions).map(mapSubmission),
  };
}

export function mapJoinedDetail(d: Raw): JoinedAlbumDetail {
  return {
    album: mapAlbum((d.album ?? {}) as Raw),
    owner: mapPerson(d.owner),
    submissions: list(d.submissions).map(mapSubmission),
  };
}

export function mapInvitePreview(d: Raw): InvitePreview {
  const state = String(d.state ?? '') as InviteState;
  return {
    album: mapAlbum((d.album ?? {}) as Raw),
    owner: mapPerson(d.owner),
    state: STATES.includes(state) ? state : 'OPEN',
    expiresAt: str(d.expiresAt),
  };
}

/** Pulls the invite code out of a pasted link, or returns the input when it already is one. */
export function tokenFromInput(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/join\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

/**
 * The backend links collaboration notifications to dashboard paths. This
 * maps them onto the matching app screens, or returns null for any other
 * link.
 */
export function collabRouteFromLink(link?: string): string | null {
  if (!link) return null;
  const path = link.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const prefix = '/user/photographer/collaborate';
  if (path !== prefix && !path.startsWith(prefix + '/')) return null;
  const rest = path.slice(prefix.length).split('/').filter(Boolean);
  if (rest[0] === 'albums' && rest[1]) return `/collaborate/album/${rest[1]}`;
  if (rest[0] === 'joined' && rest[1]) return `/collaborate/joined/${rest[1]}`;
  if (rest[0] === 'join' && rest[1]) return `/collaborate/join/${rest[1]}`;
  return '/collaborate';
}

export function timeAgo(iso?: string, now = Date.now()): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((now - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function daysLeft(iso: string, now = Date.now()): string {
  const days = Math.ceil((new Date(iso).getTime() - now) / 86400000);
  if (!Number.isFinite(days)) return '';
  if (days <= 0) return 'expires today';
  return `expires in ${days} day${days === 1 ? '' : 's'}`;
}

export function isPhotographerType(customerType?: string | null): boolean {
  const t = (customerType ?? '').toLowerCase();
  return t === 'photographer' || t === 'videographer';
}
