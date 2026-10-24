import {
  inviteFocus, inviteIdFromText, mapPreview, maskEmail, ownerActionLabel, ownerMeaning, planForInvite,
  type InvitePreview,
} from './invite';
import { mapInvitation, mapPerson, type WorkspaceInvitation } from './model';

/**
 * A workspace invitation link followed through sign-up and sign-in: which id is in what was pasted or tapped, which
 * door to open first, what the link means once signed in, and how an invitation to an address with no account yet
 * reads to the owner who sent it.
 */
const ID = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const LINK = `https://dashboard.connekyt.com/user/photographer/collaborate?tab=workspace&invite=${ID}`;

describe('inviteIdFromText', () => {
  it('reads the bare id, the email link and the app link', () => {
    expect(inviteIdFromText(ID)).toBe(ID);
    expect(inviteIdFromText(`  ${ID.toUpperCase()}  `)).toBe(ID);
    expect(inviteIdFromText(LINK)).toBe(ID);
    expect(inviteIdFromText(`connekt://workspace-invite/${ID}`)).toBe(ID);
    expect(inviteIdFromText(`Hi! Open this: ${LINK} thanks`)).toBe(ID);
  });
  it('takes the first value of a route parameter array', () => {
    expect(inviteIdFromText([ID, 'x'])).toBe(ID);
  });
  it('is null for anything that is not an invitation', () => {
    for (const bad of [null, undefined, '', '   ', 123, {}, 'abc', ID + 'x', '../../etc/passwd',
      'https://dashboard.connekyt.com/user/photographer/collaborate?tab=workspace',
      'https://dashboard.connekyt.com/user/photographer/collaborate/join/Dl-BJR1AHVfgoAYoTKzJyFM9oP0C3WfF',
      `https://evil.example/?next=${ID}`]) {
      expect(inviteIdFromText(bad)).toBeNull();
    }
  });
});

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => expect(maskEmail('eric.mugisha@example.com')).toBe('e•••@example.com'));
  it('says something sensible when there is no address', () => {
    expect(maskEmail(undefined)).toBe('another email address');
    expect(maskEmail('nope')).toBe('another email address');
  });
});

describe('mapPreview', () => {
  it('keeps the known fields and drops the unexpected', () => {
    expect(mapPreview({ found: true, open: true, status: 'PENDING', ownerName: ' Aline ', email: 'a@b.co', account: 'none', secret: 'x' }))
      .toEqual({ found: true, open: true, status: 'PENDING', ownerName: 'Aline', email: 'a@b.co', account: 'none' });
  });
  it('never guesses an account kind or an open invitation from nothing', () => {
    expect(mapPreview({ account: 'admin' })).toMatchObject({ found: false, open: false, account: undefined });
    expect(mapPreview(null)).toMatchObject({ found: false, open: false });
    expect(mapPreview({ found: 'yes', open: 1 })).toMatchObject({ found: false, open: false });
  });
});

const open = (o: Partial<InvitePreview> = {}): InvitePreview => ({
  found: true, open: true, status: 'PENDING', ownerName: 'Aline Uwase', email: 'New.Person@Example.com', account: 'none', ...o,
});

describe('planForInvite', () => {
  it('changes nothing when the preview could not be read', () => {
    expect(planForInvite(null, ID)).toBeNull();
    expect(planForInvite(undefined, ID)).toBeNull();
  });
  it('sends an address with no account to sign up, email fixed, with no way to sign in', () => {
    const plan = planForInvite(open(), ID)!;
    expect(plan).toMatchObject({ view: 'signup', requireSignup: true, lockEmail: true, email: 'new.person@example.com' });
    expect(plan.notice.tone).toBe('info');
    expect(plan.notice.text).toContain('Aline Uwase');
    expect(plan.notice.text).toContain('Create your photographer account with new.person@example.com');
  });
  it('sends an address with a photographer account to sign in, email filled in', () => {
    const plan = planForInvite(open({ account: 'photographer' }), ID)!;
    expect(plan).toMatchObject({ view: 'login', requireSignup: false, lockEmail: false, email: 'new.person@example.com' });
    expect(plan.notice.text).toContain('Sign in with new.person@example.com');
  });
  it('says an address with a non-photographer account cannot join and opens neither door', () => {
    const plan = planForInvite(open({ account: 'other' }), ID)!;
    expect(plan).toMatchObject({ view: 'none', requireSignup: false });
    expect(plan.notice.tone).toBe('error');
    expect(plan.notice.text).toContain('not a photographer');
  });
  it.each([
    ['unknown', { found: false, open: false }],
    ['answered or cancelled', { found: true, open: false, status: 'CANCELLED' }],
    ['expired', { found: true, open: false, status: 'EXPIRED' }],
  ])('says an invitation that is %s is no longer open and changes nothing else', (_n, p) => {
    const plan = planForInvite(p as InvitePreview, ID)!;
    expect(plan).toMatchObject({ view: 'none', requireSignup: false, email: '' });
    expect(plan.notice.tone).toBe('warn');
    expect(plan.notice.text).toContain('no longer open');
  });
  it('does not lock an email it does not have', () => {
    expect(planForInvite(open({ email: undefined }), ID)!.lockEmail).toBe(false);
  });
  it('has a different key for each outcome so a screen applies each plan once', () => {
    const keys = new Set([
      planForInvite(open(), ID)!.key,
      planForInvite(open({ account: 'photographer' }), ID)!.key,
      planForInvite(open({ account: 'other' }), ID)!.key,
      planForInvite({ found: false, open: false }, ID)!.key,
    ]);
    expect(keys.size).toBe(4);
  });
});

const inv = (o: Record<string, unknown> = {}): WorkspaceInvitation => mapInvitation({
  id: ID, status: 'PENDING', owner: { id: 'o1', name: 'Aline Uwase' }, invitee: { id: 'p1', name: 'Eric Mugisha' },
  createdAt: '2026-10-20T09:00:00', expiresAt: '2026-11-03T09:00:00', ...o,
});

describe('inviteFocus', () => {
  const preview = (o: Partial<InvitePreview> = {}): InvitePreview => open({ email: 'eric@example.com', account: 'photographer', ...o });
  it('finds a waiting invitation among the account\'s own', () => {
    expect(inviteFocus([inv()], ID, null).kind).toBe('pending');
  });
  it('recognises one already accepted, and says how another one ended', () => {
    expect(inviteFocus([inv({ status: 'ACCEPTED' })], ID, null).kind).toBe('accepted');
    expect(inviteFocus([inv({ status: 'REVOKED' })], ID, null)).toMatchObject({ kind: 'ended', label: 'removed' });
    expect(inviteFocus([inv({ status: 'EXPIRED' })], ID, null)).toMatchObject({ kind: 'ended', label: 'expired' });
  });
  it('says it went to another address when it is open but not this account\'s', () => {
    expect(inviteFocus([inv({ id: 'someone-elses' })], ID, preview())).toEqual({ kind: 'mismatch', maskedEmail: 'e•••@example.com' });
  });
  it('says closed for a finished or unknown invitation, and unavailable when the preview could not be read', () => {
    expect(inviteFocus([], ID, preview({ open: false, status: 'CANCELLED' })).kind).toBe('closed');
    expect(inviteFocus([], ID, { found: false, open: false }).kind).toBe('closed');
    expect(inviteFocus([], ID, null).kind).toBe('unavailable');
  });
  it('never exposes more than the masked address for another account\'s invitation', () => {
    const f = inviteFocus([], ID, preview({ email: 'secret.person@example.com' }));
    expect(JSON.stringify(f)).not.toContain('secret.person');
    expect(JSON.stringify(f)).not.toContain('Aline');
  });
});

describe('an invitation to an address with no account yet, as the owner reads it', () => {
  const emailed = inv({ invitee: { id: null, name: 'new@example.com', registered: false, email: 'new@example.com' } });
  it('maps an invitee with no id as an address, not an account', () => {
    expect(emailed.invitee).toMatchObject({ id: '', name: 'new@example.com', registered: false, email: 'new@example.com' });
    expect(mapPerson({ id: 'p1', name: 'Eric' }).registered).toBeUndefined();
  });
  it('says it is waiting for them to create an account, and only while it is waiting', () => {
    expect(ownerMeaning(emailed)).toBe('Emailed. Waiting for them to create an account and answer.');
    expect(ownerMeaning(inv())).toBe('Waiting for them to answer.');
    expect(ownerMeaning({ ...emailed, status: 'CANCELLED' })).toBe('You cancelled it.');
  });
  it('calls sending it again emailing it again', () => {
    expect(ownerActionLabel('resend', emailed)).toBe('Email again');
    expect(ownerActionLabel('resend', inv())).toBe('Send again');
    expect(ownerActionLabel('cancel', emailed)).toBe('Cancel');
    expect(ownerActionLabel('revoke', emailed)).toBe('Remove access');
  });
});
