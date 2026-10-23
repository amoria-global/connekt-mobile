/**
 * How each photographer who accepted an album invitation is getting on, worked out from what the album already holds:
 * its collaborators and every photo submitted to it. Nothing here asks the server for more, so what the owner sees
 * always agrees with the Review and History lists next to it.
 *
 * Mirrors the dashboard's `app/lib/collabProgress.ts`; both are tested against the same cases.
 *
 * "Progress" has no target to measure against (an album has no quota), so it is the honest breakdown of a person's
 * contribution to THIS album: how many of their photos were added, how many wait for the owner, how many were not
 * accepted, how much of the album they account for, and when they last sent something.
 */
import type { Collaborator, Person, Submission } from './model';

/** waiting: has photos the owner has not decided. not_started: joined, sent nothing. up_to_date: sent photos, none waiting. */
export type ContributorState = 'waiting' | 'up_to_date' | 'not_started';

export interface Contributor {
  id: string;
  name: string;
  avatar?: string;
  /** Null once the person has left or been removed: their past photos still count, but there is nothing to manage. */
  membershipId: string | null;
  joinedAt?: string | null;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  /** Photos the owner has decided on, in either direction. */
  decided: number;
  /** Percent of decided photos that were added to the album, or null before anything has been decided. */
  acceptRate: number | null;
  /** Percent of the album's photos this person added, or null while the album has none. */
  share: number | null;
  lastSubmittedAt: string | null;
  state: ContributorState;
}

export interface ProgressTotals {
  submitted: number;
  approved: number;
  pending: number;
  rejected: number;
  /** Photographers currently in the album. */
  collaborators: number;
  /** Of those, how many have sent at least one photo. */
  contributing: number;
  /** Of those, how many have photos waiting for the owner. */
  waiting: number;
}

export interface ProgressSummary {
  totals: ProgressTotals;
  /** Current collaborators, those who need the owner first. */
  contributors: Contributor[];
  /** People who sent photos and are no longer collaborators. */
  former: Contributor[];
}

const percent = (part: number, whole: number): number | null => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : null);

function build(person: Person, subs: readonly Submission[], membershipId: string | null, joinedAt: string | null | undefined, albumImages: number): Contributor {
  const pending = subs.filter((s) => s.status === 'PENDING').length;
  const approved = subs.filter((s) => s.status === 'APPROVED').length;
  const rejected = subs.filter((s) => s.status === 'REJECTED').length;
  const total = subs.length;
  const decided = approved + rejected;
  let last: string | null = null;
  for (const s of subs) if (s.submittedAt && (!last || s.submittedAt > last)) last = s.submittedAt;
  return {
    id: person.id,
    name: person.name,
    avatar: person.avatar,
    membershipId,
    joinedAt,
    total, pending, approved, rejected, decided,
    acceptRate: percent(approved, decided),
    share: percent(approved, albumImages),
    lastSubmittedAt: last,
    state: pending > 0 ? 'waiting' : total === 0 ? 'not_started' : 'up_to_date',
  };
}

const RANK: Record<ContributorState, number> = { waiting: 0, up_to_date: 1, not_started: 2 };

/** Who needs the owner first: most waiting, then the most active, then those who joined longest ago without sending anything. */
function byAttention(a: Contributor, b: Contributor): number {
  if (a.state !== b.state) return RANK[a.state] - RANK[b.state];
  if (a.state === 'waiting' && a.pending !== b.pending) return b.pending - a.pending;
  if (a.state === 'up_to_date' && (a.approved !== b.approved || a.total !== b.total)) return b.approved - a.approved || b.total - a.total;
  if (a.state === 'not_started') {
    const ja = a.joinedAt ?? '';
    const jb = b.joinedAt ?? '';
    if (ja !== jb) return ja.localeCompare(jb);
  }
  return a.name.localeCompare(b.name);
}

export function contributorProgress(
  collaborators: readonly Collaborator[],
  submissions: readonly Submission[],
  albumImageCount: number,
): ProgressSummary {
  const bySender = new Map<string, Submission[]>();
  for (const s of submissions) {
    const list = bySender.get(s.collaborator.id);
    if (list) list.push(s); else bySender.set(s.collaborator.id, [s]);
  }

  const current = new Set(collaborators.map((c) => c.id));
  const contributors = collaborators
    .map((c) => build(c, bySender.get(c.id) ?? [], c.membershipId, c.joinedAt, albumImageCount))
    .sort(byAttention);

  const former: Contributor[] = [];
  for (const [id, subs] of bySender) {
    if (current.has(id)) continue;
    former.push(build(subs[0].collaborator, subs, null, null, albumImageCount));
  }
  former.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const count = (status: Submission['status']) => submissions.filter((s) => s.status === status).length;
  return {
    totals: {
      submitted: submissions.length,
      approved: count('APPROVED'),
      pending: count('PENDING'),
      rejected: count('REJECTED'),
      collaborators: collaborators.length,
      contributing: contributors.filter((c) => c.total > 0).length,
      waiting: contributors.filter((c) => c.pending > 0).length,
    },
    contributors,
    former,
  };
}

/** The photos of one person, for the Review and History lists when the owner narrows them down. */
export function fromContributor<T extends Pick<Submission, 'collaborator'>>(list: readonly T[], contributorId: string | null): T[] {
  return contributorId ? list.filter((s) => s.collaborator.id === contributorId) : [...list];
}
