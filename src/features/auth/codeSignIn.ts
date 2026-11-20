import { useEffect, useState } from 'react';

import { storage, StorageKeys } from '@/services/storage';

/**
 * "Sign in with an email code" is for invited team members (collaborator logins) only: for every other address the
 * server sends nothing. Showing it to everyone made people tap it expecting a password reset and wait for a code that
 * never came. So the sign-in screen offers it only on a device where a collaborator login has already signed in.
 */
export async function rememberCodeSignIn(): Promise<boolean> {
  try {
    await storage.set(StorageKeys.codeSignIn, '1');
    return true;
  } catch {
    return false;
  }
}

export async function codeSignInRemembered(): Promise<boolean> {
  try {
    return (await storage.get(StorageKeys.codeSignIn)) === '1';
  } catch {
    return false;
  }
}

/** Whether the sign-in screen should offer the emailed-code route on this device. False until it has been read. */
export function useCodeSignInOffered(): boolean {
  const [offered, setOffered] = useState(false);
  useEffect(() => {
    let live = true;
    void codeSignInRemembered().then((v) => {
      if (live) setOffered(v);
    });
    return () => {
      live = false;
    };
  }, []);
  return offered;
}
