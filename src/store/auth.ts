/**
 * Global auth state (zustand). Holds the session and exposes login/logout
 * plus a bootstrap() that restores a persisted session on app start.
 */
import { create } from 'zustand';
import { setOnAuthExpired } from '@/api/client';
import * as authApi from '@/features/auth/api';
import type { AuthSession, LoginCredentials, User } from '@/features/auth/types';
import { resetPushRegistration } from '@/features/notifications/push';
import { storage, StorageKeys } from '@/services/storage';
import type { ApiError } from '@/types';

type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  session: AuthSession | null;
  user: User | null;
  /** Restore a persisted session (call once at startup). */
  bootstrap: () => Promise<void>;
  login: (credentials: LoginCredentials) => Promise<void>;
  /** Set the session directly (e.g. after OTP verification or signup). */
  applySession: (session: AuthSession) => void;
  /** Merge fields into the current user (e.g. after a profile edit) and persist. */
  updateUser: (partial: Partial<User>) => void;
  logout: () => Promise<void>;
};

export const useAuth = create<AuthState>((set, get) => ({
  status: 'idle',
  session: null,
  user: null,

  bootstrap: async () => {
    set({ status: 'loading' });
    // When a refresh is genuinely rejected, sign out — and wipe the stored
    // session too. Clearing only in-memory state left the tokens on disk, so
    // the next launch restored a dead session, hit its first 401, and bounced
    // the user to login again on every single start.
    setOnAuthExpired(() => {
      void authApi.clearSession();
      resetPushRegistration();
      set({ status: 'unauthenticated', session: null, user: null });
    });

    try {
      const session = await authApi.loadSession();
      if (session) {
        set({ status: 'authenticated', session, user: session.user });
        return;
      }
    } catch {
      // An unreadable keychain (device locked, corrupted entry, storage
      // disabled) must land on the login screen, not leave `status: loading`
      // forever behind the splash spinner with no way out.
    }
    set({ status: 'unauthenticated', session: null, user: null });
  },

  login: async (credentials) => {
    const session = await authApi.login(credentials);
    set({ status: 'authenticated', session, user: session.user });
  },

  applySession: (session) => {
    set({ status: 'authenticated', session, user: session.user });
  },

  updateUser: (partial) => {
    const cur = get();
    if (!cur.user) return;
    const user = { ...cur.user, ...partial };
    const session = cur.session ? { ...cur.session, user } : null;
    set({ user, session });
    if (session) {
      storage.set(StorageKeys.session, JSON.stringify(session)).catch(() => {});
    }
  },

  logout: async () => {
    await authApi.logout();
    // The next account on this device must register its own push token.
    resetPushRegistration();
    set({ status: 'unauthenticated', session: null, user: null });
  },
}));

/** Narrow helper so screens can show friendly error text. */
export function isApiError(err: unknown): err is ApiError {
  return !!err && typeof err === 'object' && 'message' in err;
}
