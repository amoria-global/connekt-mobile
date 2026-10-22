/**
 * Who is sending a wish or a comment. A signed-in user is already someone: their account has a name and an email, so
 * they are never asked for them again. A guest is asked once, and what they typed is remembered on the device (the web
 * keeps the same thing under `eventWishIdentity`), so the second wish does not ask either.
 */
import { storage } from '@/services/storage';
import type { User } from '@/features/auth/types';

export type Identity = { name: string; email: string };

const KEY = 'eventWishIdentity';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(v: string): boolean {
  return EMAIL.test(v.trim());
}

/** The account's own name and email, or null when the account lacks either (then the form asks). */
export function accountIdentity(user: Pick<User, 'firstName' | 'lastName' | 'email'> | null | undefined): Identity | null {
  if (!user) return null;
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  const email = (user.email ?? '').trim();
  return name && isEmail(email) ? { name, email } : null;
}

/** What a guest typed last time, for prefilling. Never throws. */
export async function loadGuestIdentity(): Promise<Partial<Identity>> {
  try {
    const raw = await storage.get(KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<Identity>;
    return { name: typeof p.name === 'string' ? p.name : undefined, email: typeof p.email === 'string' ? p.email : undefined };
  } catch {
    return {};
  }
}

export async function saveGuestIdentity(id: Identity): Promise<void> {
  try {
    await storage.set(KEY, JSON.stringify(id));
  } catch {
    /* remembering is a convenience */
  }
}
