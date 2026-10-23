import type { Collaborator, Submission } from './model';
import { contributorProgress, fromContributor } from './progress';

/**
 * Tracking each collaborator's contribution to an album: the counts, the rates, who needs the owner first, people who
 * have since left, and the empty cases. Pure logic over what the album already holds.
 */
const collab = (id: string, name: string, joinedAt: string | undefined = '2026-10-01T09:00:00'): Collaborator => ({ id, name, membershipId: 'm-' + id, joinedAt });
let n = 0;
const sub = (by: Collaborator | { id: string; name: string }, status: Submission['status'], submittedAt = '2026-10-10T10:00:00'): Submission => ({
  id: 's' + ++n, albumId: 'a1', imageUrl: 'x', status, submittedAt, collaborator: { id: by.id, name: by.name },
});
const many = (by: Collaborator, status: Submission['status'], count: number, at = '2026-10-10T10:00:00') =>
  Array.from({ length: count }, () => sub(by, status, at));

const eric = collab('e', 'Eric Mugisha');
const chantal = collab('c', 'Chantal Ineza', '2026-10-02T09:00:00');
const olive = collab('o', 'Olive Kamali', '2026-10-03T09:00:00');

describe('contributorProgress: one contributor', () => {
  it('counts added, waiting and not accepted, and what share of the album they account for', () => {
    const subs = [...many(eric, 'APPROVED', 8), ...many(eric, 'PENDING', 4), ...many(eric, 'REJECTED', 1)];
    const { contributors } = contributorProgress([eric], subs, 50);
    expect(contributors).toHaveLength(1);
    expect(contributors[0]).toMatchObject({
      id: 'e', membershipId: 'm-e', total: 13, approved: 8, pending: 4, rejected: 1, decided: 9, state: 'waiting',
    });
    // 8 of 9 decided were added, and 8 of the album's 50 photos are theirs.
    expect(contributors[0].acceptRate).toBe(89);
    expect(contributors[0].share).toBe(16);
  });

  it('is up to date when everything they sent has been decided', () => {
    const { contributors } = contributorProgress([eric], [...many(eric, 'APPROVED', 2), ...many(eric, 'REJECTED', 2)], 10);
    expect(contributors[0]).toMatchObject({ state: 'up_to_date', pending: 0, acceptRate: 50, share: 20 });
  });

  it('has not started when they joined and sent nothing, with no rates to show', () => {
    const { contributors, totals } = contributorProgress([eric], [], 10);
    expect(contributors[0]).toMatchObject({ state: 'not_started', total: 0, decided: 0, acceptRate: null, lastSubmittedAt: null });
    expect(contributors[0].share).toBe(0);
    expect(totals).toMatchObject({ submitted: 0, collaborators: 1, contributing: 0, waiting: 0 });
  });

  it('shows no accept rate before anything is decided, even with photos waiting', () => {
    const { contributors } = contributorProgress([eric], many(eric, 'PENDING', 3), 10);
    expect(contributors[0]).toMatchObject({ state: 'waiting', decided: 0, acceptRate: null, share: 0 });
  });

  it('shows no share while the album is empty, and never more than 100', () => {
    expect(contributorProgress([eric], many(eric, 'APPROVED', 2), 0).contributors[0].share).toBeNull();
    // The album count can lag behind approvals; the share is capped rather than showing 200 percent.
    expect(contributorProgress([eric], many(eric, 'APPROVED', 2), 1).contributors[0].share).toBe(100);
  });

  it('reports the most recent submission, not the first or the last in the list', () => {
    const subs = [sub(eric, 'APPROVED', '2026-10-12T08:00:00'), sub(eric, 'APPROVED', '2026-10-15T08:00:00'), sub(eric, 'PENDING', '2026-10-11T08:00:00')];
    expect(contributorProgress([eric], subs, 10).contributors[0].lastSubmittedAt).toBe('2026-10-15T08:00:00');
  });

  it('copes with a submission that has no date', () => {
    const s = { ...sub(eric, 'PENDING'), submittedAt: undefined };
    const c = contributorProgress([eric], [s], 5).contributors[0];
    expect(c.total).toBe(1);
    expect(c.lastSubmittedAt).toBeNull();
  });
});

describe('contributorProgress: the whole album', () => {
  const subs = [...many(eric, 'APPROVED', 5), ...many(eric, 'PENDING', 1), ...many(chantal, 'PENDING', 4), ...many(chantal, 'REJECTED', 2)];

  it('adds the totals up and counts who is contributing and who is waiting', () => {
    const { totals } = contributorProgress([eric, chantal, olive], subs, 40);
    expect(totals).toEqual({ submitted: 12, approved: 5, pending: 5, rejected: 2, collaborators: 3, contributing: 2, waiting: 2 });
    expect(totals.approved + totals.pending + totals.rejected).toBe(totals.submitted);
  });

  it('puts the person with the most photos waiting first, then those who are up to date, then those who have not started', () => {
    const up = collab('u', 'Aline Uwase');
    const all = [...subs, ...many(up, 'APPROVED', 3)];
    const { contributors } = contributorProgress([olive, up, eric, chantal], all, 40);
    expect(contributors.map((c) => c.name)).toEqual(['Chantal Ineza', 'Eric Mugisha', 'Aline Uwase', 'Olive Kamali']);
    expect(contributors.map((c) => c.state)).toEqual(['waiting', 'waiting', 'up_to_date', 'not_started']);
  });

  it('puts those who joined longest ago without sending anything first among the ones who have not started', () => {
    const late = collab('l', 'Late Joiner', '2026-10-20T09:00:00');
    const early = collab('y', 'Early Joiner', '2026-10-01T09:00:00');
    expect(contributorProgress([late, early], [], 10).contributors.map((c) => c.name)).toEqual(['Early Joiner', 'Late Joiner']);
  });

  it('breaks ties by name so the order does not jump around', () => {
    const a = collab('a', 'Alice');
    const b = collab('b', 'Bob');
    const subsTie = [...many(b, 'PENDING', 2), ...many(a, 'PENDING', 2)];
    expect(contributorProgress([b, a], subsTie, 10).contributors.map((c) => c.name)).toEqual(['Alice', 'Bob']);
  });

  it('does not change when the same input is given again', () => {
    const first = contributorProgress([eric, chantal, olive], subs, 40);
    const again = contributorProgress([eric, chantal, olive], subs, 40);
    expect(again).toEqual(first);
  });
});

describe('contributorProgress: people who are no longer collaborators', () => {
  const gone = { id: 'g', name: 'Gone Photographer' };

  it('keeps their past photos in the totals and lists them apart, with nothing to manage', () => {
    const subs = [...many(eric, 'APPROVED', 2), ...[sub(gone, 'APPROVED'), sub(gone, 'APPROVED'), sub(gone, 'REJECTED')]];
    const { totals, contributors, former } = contributorProgress([eric], subs, 20);
    expect(totals).toMatchObject({ submitted: 5, approved: 4, rejected: 1, collaborators: 1 });
    expect(contributors.map((c) => c.id)).toEqual(['e']);
    expect(former).toHaveLength(1);
    expect(former[0]).toMatchObject({ id: 'g', name: 'Gone Photographer', membershipId: null, total: 3, approved: 2, rejected: 1, acceptRate: 67, share: 10 });
  });

  it('is empty when everyone who sent photos is still a collaborator', () => {
    expect(contributorProgress([eric], many(eric, 'PENDING', 1), 5).former).toEqual([]);
  });

  it('lists them most active first', () => {
    const g2 = { id: 'g2', name: 'Another Gone' };
    const subs = [sub(gone, 'APPROVED'), sub(g2, 'APPROVED'), sub(g2, 'APPROVED')];
    expect(contributorProgress([], subs, 5).former.map((c) => c.id)).toEqual(['g2', 'g']);
  });
});

describe('contributorProgress: nothing to track', () => {
  it('has no collaborators and no photos', () => {
    expect(contributorProgress([], [], 0)).toEqual({
      totals: { submitted: 0, approved: 0, pending: 0, rejected: 0, collaborators: 0, contributing: 0, waiting: 0 },
      contributors: [],
      former: [],
    });
  });
});

describe('fromContributor', () => {
  const subs = [sub(eric, 'PENDING'), sub(chantal, 'PENDING'), sub(eric, 'APPROVED')];
  it('narrows to one person', () => {
    expect(fromContributor(subs, 'e')).toHaveLength(2);
    expect(fromContributor(subs, 'c')).toHaveLength(1);
    expect(fromContributor(subs, 'nobody')).toEqual([]);
  });
  it('returns everything, as a copy, without a person', () => {
    const all = fromContributor(subs, null);
    expect(all).toEqual(subs);
    expect(all).not.toBe(subs);
  });
});
