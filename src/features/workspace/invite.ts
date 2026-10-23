/**
 * A workspace invitation link, followed through sign-up and sign-in. Mirrors the landing's `workspace-invite.ts` and
 * the dashboard's `workspaceStatus.ts` (the link is the same one: `.../collaborate?tab=workspace&invite=<id>`).
 *
 * Another photographer invites an email address to work in their workspace. Someone who has no account is sent to
 * sign up first, as a photographer, with that address fixed; someone who has one signs in with it. Nothing here lets
 * anyone in: the invitation can only be answered by an account whose own, verified email is the invited address,
 * and the screens say so when it is not. This only makes the right door the first one they see.
 */
import type { WorkspaceInvitation } from './model';
import { statusView } from './model';

export interface InvitePreview {
  found: boolean;
  open: boolean;
  status?: string;
  ownerName?: string;
  email?: string;
  account?: 'none' | 'photographer' | 'other';
}

type Raw = Record<string, unknown>;
const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The public preview as the server sent it, with anything unexpected dropped rather than guessed. */
export function mapPreview(raw: unknown): InvitePreview {
  const r = (raw ?? {}) as Raw;
  const account = text(r.account);
  return {
    found: r.found === true,
    open: r.open === true,
    status: text(r.status),
    ownerName: text(r.ownerName),
    email: text(r.email),
    account: account === 'none' || account === 'photographer' || account === 'other' ? account : undefined,
  };
}

const UUID_SRC = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const WHOLE = new RegExp(`^${UUID_SRC}$`, 'i');
const IN_LINK = new RegExp(`(?:[?&]invite=|workspace-invite/)(${UUID_SRC})`, 'i');

/**
 * The invitation id in what someone pasted or tapped: the bare id, the link from the email, or the app's own
 * `connekt://workspace-invite/<id>`. Anything else is not an invitation, and an id is never taken from other text.
 */
export function inviteIdFromText(raw: unknown): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (WHOLE.test(t)) return t.toLowerCase();
  const m = IN_LINK.exec(t);
  return m ? m[1].toLowerCase() : null;
}

/** "a•••@example.com": enough to recognise an address without printing it in full. */
export function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return 'another email address';
  const [name, domain] = email.split('@');
  return `${name.slice(0, 1)}•••@${domain}`;
}

// ─── What the sign-in and sign-up screens do about an invitation ───

export type InviteTone = 'info' | 'warn' | 'error';

export interface InvitePlan {
  /** Changes whenever the plan does, so a screen can apply it once. */
  key: string;
  /** Which door to show first; `none` leaves whatever the visitor chose. */
  view: 'signup' | 'login' | 'none';
  email: string;
  ownerName: string;
  /** The sign-up email is fixed to the invited address. */
  lockEmail: boolean;
  /** There is no account yet, so signing in is not offered. */
  requireSignup: boolean;
  notice: { tone: InviteTone; text: string };
}

/** What the screen should do for this invitation. Null when the preview could not be read: change nothing. */
export function planForInvite(preview: InvitePreview | null | undefined, id: string): InvitePlan | null {
  if (!preview) return null;
  const owner = preview.ownerName?.trim() || 'A photographer';
  const email = preview.email?.trim().toLowerCase() || '';

  if (!preview.found || !preview.open) {
    return {
      key: `${id}:closed`, view: 'none', email: '', ownerName: '', lockEmail: false, requireSignup: false,
      notice: { tone: 'warn', text: 'This workspace invitation is no longer open. You can still sign in or create an account.' },
    };
  }
  if (preview.account === 'other') {
    return {
      key: `${id}:other`, view: 'none', email, ownerName: owner, lockEmail: false, requireSignup: false,
      notice: { tone: 'error', text: `${email || 'That email'} belongs to an account that is not a photographer, so it cannot join ${owner}'s workspace.` },
    };
  }
  if (preview.account === 'photographer') {
    return {
      key: `${id}:login`, view: 'login', email, ownerName: owner, lockEmail: false, requireSignup: false,
      notice: { tone: 'info', text: `${owner} invited you to work in their workspace. Sign in with ${email} to continue.` },
    };
  }
  return {
    key: `${id}:signup`, view: 'signup', email, ownerName: owner, lockEmail: !!email, requireSignup: true,
    notice: { tone: 'info', text: `${owner} invited you to work in their workspace. Create your photographer account with ${email} to continue.` },
  };
}

// ─── What the invitation means once signed in ───

export type InviteFocus =
  | { kind: 'pending'; invitation: WorkspaceInvitation }
  | { kind: 'accepted'; invitation: WorkspaceInvitation }
  | { kind: 'ended'; invitation: WorkspaceInvitation; label: string }
  | { kind: 'mismatch'; maskedEmail: string }
  | { kind: 'closed' }
  | { kind: 'unavailable' };

/**
 * What the invitation link means for the signed-in person who opened it. The invitations this account can answer are
 * matched by id; one that is not among them was sent to a different address, which the public preview confirms
 * without saying more than the masked address. Null means the preview could not be read.
 */
export function inviteFocus(received: readonly WorkspaceInvitation[], id: string, preview: InvitePreview | null): InviteFocus {
  const inv = received.find((i) => i.id === id);
  if (inv) {
    if (inv.status === 'PENDING') return { kind: 'pending', invitation: inv };
    if (inv.status === 'ACCEPTED') return { kind: 'accepted', invitation: inv };
    return { kind: 'ended', invitation: inv, label: statusView(inv.status).label.toLowerCase() };
  }
  if (!preview) return { kind: 'unavailable' };
  if (!preview.found || !preview.open) return { kind: 'closed' };
  return { kind: 'mismatch', maskedEmail: maskEmail(preview.email) };
}

/** What the owner reads next to an invitation: an emailed one is still waiting for someone to sign up. */
export function ownerMeaning(inv: Pick<WorkspaceInvitation, 'status' | 'invitee'>): string {
  if (inv.status === 'PENDING' && inv.invitee.registered === false) return 'Emailed. Waiting for them to create an account and answer.';
  return statusView(inv.status).meaning.owner;
}

/** The label of an owner action: sending an emailed invitation again is emailing it again. */
export function ownerActionLabel(action: 'resend' | 'cancel' | 'revoke', inv: Pick<WorkspaceInvitation, 'invitee'>): string {
  if (action === 'resend') return inv.invitee.registered === false ? 'Email again' : 'Send again';
  return action === 'cancel' ? 'Cancel' : 'Remove access';
}
