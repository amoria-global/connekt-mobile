/**
 * A workspace invitation the person was sent to unlock, kept across the screens between the link and the workspace.
 *
 * Like a scanned event QR, it has to survive sign-up (names, phone, password), the one-time code, two-factor and an
 * app restart, none of which pass the link along. The id is stored when the link, the pasted text or the sign-in or
 * sign-up screen first sees it, and the root layout asks for it once the person is signed in: the invitation
 * opens in Collaborate. It is the id only: no email, no token, nothing that grants anything. Answering the
 * invitation still needs an account with the invited address.
 */
import { storage } from '@/services/storage';
import { inviteIdFromText } from './invite';

const KEY = 'connekt.pendingWorkspaceInvite';

/** An invitation older than this belongs to an abandoned attempt, not this sign-in. */
export const PENDING_INVITE_TTL_MS = 24 * 60 * 60 * 1000;

export async function setPendingWorkspaceInvite(id: string, now: number = Date.now()): Promise<void> {
  const clean = inviteIdFromText(id);
  if (!clean) return;
  await storage.set(KEY, `${clean}|${now}`);
}

async function read(now: number): Promise<string | null> {
  const raw = await storage.get(KEY);
  if (!raw) return null;
  const [idPart, atPart] = raw.split('|');
  const id = inviteIdFromText(idPart);
  const at = Number(atPart);
  if (!id || !Number.isFinite(at) || now - at > PENDING_INVITE_TTL_MS) {
    await storage.remove(KEY);
    return null;
  }
  return id;
}

/** The waiting invitation id, left in place (a screen reads it; the root layout takes it). */
export const peekPendingWorkspaceInvite = (now: number = Date.now()): Promise<string | null> => read(now);

/** Read and clear. Null when nothing is waiting or it went stale. */
export async function takePendingWorkspaceInvite(now: number = Date.now()): Promise<string | null> {
  const id = await read(now);
  if (id) await storage.remove(KEY);
  return id;
}

export const clearPendingWorkspaceInvite = (): Promise<void> => storage.remove(KEY);

/** Where a signed-in person goes for the waiting invitation, or null. Photographers only: nobody else can join. */
export async function takePendingInviteHref(isPhotographer: boolean, now: number = Date.now()): Promise<string | null> {
  const id = await takePendingWorkspaceInvite(now);
  if (!id || !isPhotographer) return null;
  return `/collaborate?invite=${id}`;
}
