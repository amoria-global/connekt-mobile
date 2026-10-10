/**
 * "Post my event" chosen by a guest, remembered across sign-in.
 *
 * The sheet that offers it is shown on the sign-in screen, so the guest is
 * already where they need to be: the sheet records the intent and the sign-in
 * screen asks them to sign in. Once they are in, the home screen delivers it:
 * a client gets the wizard opened in place, a coordinator is sent to the
 * wizard screen, and anyone who cannot post (photographer, viewer) has it
 * dropped so it cannot surface later.
 *
 * Kept in memory for this app session only, and only for a while, so a guest
 * who wandered off does not get the wizard sprung on them at a later login.
 */
import type { Role } from '@/features/auth/role';

export const PENDING_POST_TTL_MS = 30 * 60 * 1000;

let pendingAt: number | null = null;

export const pendingPostEvent = {
  set: (now: number = Date.now()) => { pendingAt = now; },
  clear: () => { pendingAt = null; },
  /** Whether an intent is waiting, without consuming it. */
  has: (now: number = Date.now()): boolean => pendingAt !== null && now - pendingAt <= PENDING_POST_TTL_MS,
  /** Read and clear. False when nothing is waiting or it went stale. */
  take: (now: number = Date.now()): boolean => {
    const fresh = pendingPostEvent.has(now);
    pendingAt = null;
    return fresh;
  },
};

export type PendingPostDelivery = 'in-place' | 'wizard-screen' | 'drop' | 'wait';

/** How the home screen should deliver a waiting intent for this role. */
export function pendingPostDelivery(role: Role | null | undefined): PendingPostDelivery {
  if (role === 'Client') return 'in-place';
  if (role === 'Coordinator') return 'wizard-screen';
  if (!role) return 'wait';
  return 'drop';
}

export type PostChoiceTarget = 'ask-sign-in-here' | 'login-screen' | 'wizard-in-place' | 'wizard-screen';

/**
 * Where "Post my event" in the choice sheet goes. A guest on a screen that
 * can ask for sign-in itself (the sign-in screen) is asked there; navigating
 * to /login from /login is a no-op, which is how the option came to do nothing.
 */
export function postChoiceTarget(o: { signedIn: boolean; canAskSignIn: boolean; canOpenInPlace: boolean }): PostChoiceTarget {
  if (!o.signedIn) return o.canAskSignIn ? 'ask-sign-in-here' : 'login-screen';
  return o.canOpenInPlace ? 'wizard-in-place' : 'wizard-screen';
}
