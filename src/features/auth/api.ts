/**
 * Auth endpoints against amoria-connect (/api/remote/auth/*).
 * Login returns a flat `action` response; we translate it into an AuthSession.
 */
import { api } from '@/api/client';
import { storage, StorageKeys } from '@/services/storage';
import type { ApiError } from '@/types';
import type {
  AuthSession,
  CustomerType,
  LoginCredentials,
  LoginResponse,
  SignupPayload,
  User,
} from './types';

/**
 * The backend is inconsistent about the coordinator role string
 * ("Coordinator", "event-coordinator", "event_coordinator"). Normalize every
 * variant to the four roles the app understands, the same way the web does.
 */
function normalizeRole(raw?: string): CustomerType | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase().replace(/[\s_]+/g, '-');
  if (r === 'photographer') return 'Photographer';
  if (r === 'client') return 'Client';
  if (r === 'viewer') return 'Viewer';
  if (r === 'user') return 'User';
  if (r === 'coordinator' || r === 'event-coordinator') return 'Coordinator';
  return 'Client'; // unknown → safe default
}

/** Thrown by login() when the account exists but its email isn't verified yet. */
export type NeedsVerificationError = ApiError & { needsVerification: true; customerId: string };

export function isNeedsVerification(err: unknown): err is NeedsVerificationError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { needsVerification?: unknown }).needsVerification === true &&
    typeof (err as { customerId?: unknown }).customerId === 'string'
  );
}

export type NeedsTotpError = ApiError & { needsTotp: true; customerId: string };

export function isNeedsTotp(err: unknown): err is NeedsTotpError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { needsTotp?: unknown }).needsTotp === true &&
    typeof (err as { customerId?: unknown }).customerId === 'string'
  );
}

export type NeedsPasswordChangeError = ApiError & { needsPasswordChange: true; email: string };

export function isNeedsPasswordChange(err: unknown): err is NeedsPasswordChangeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { needsPasswordChange?: unknown }).needsPasswordChange === true &&
    typeof (err as { email?: unknown }).email === 'string'
  );
}

function userFromResponse(res: LoginResponse, fallbackEmail: string): User {
  return {
    customerId: res.customerId ?? '',
    email: res.email ?? fallbackEmail,
    firstName: res.firstName,
    lastName: res.lastName,
    phone: res.phone,
    customerType: normalizeRole(res.customerType as string | undefined),
    profilePicture: res.profilePicture,
    profileCompletionPercentage: res.profileCompletionPercentage,
  };
}

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  const res = await api.post<LoginResponse>('/auth/login', credentials, { skipAuth: true });

  if (res.action !== 1 || !res.token) {
    // Unverified email: backend returns action 0 + "OTP not verified" + a
    // customerId (and re-sends the code). Surface it so the UI can route to
    // the OTP screen instead of just showing an error.
    const unverified = /not verified|verify.*otp|otp.*sent/i.test(res.message ?? '');
    if (unverified && res.customerId) {
      throw {
        status: 403,
        message: res.message || 'Please verify your email to continue.',
        needsVerification: true,
        customerId: res.customerId,
      } as NeedsVerificationError;
    }
    // action 0 = locked / bad creds, action 2 = 2FA required.
    if (res.action === 2 && res.customerId) {
      throw {
        status: 403,
        message: res.message || 'Two-factor authentication is required.',
        needsTotp: true,
        customerId: res.customerId,
      } as NeedsTotpError;
    }

    throw { status: 401, message: res.message || 'Login failed. Check your email and password.' } satisfies ApiError;
  }

  if (res.mustChangePassword) {
    // Park the token ONLY — never persistSession, which would treat someone
    // still holding a temporary password as fully signed in. The forced-change
    // screen needs this one credential to prove to /auth/set-new-password who
    // it is; the backend resolves the account from it and will not accept an
    // email in the body as identity.
    if (res.token) await storage.set(StorageKeys.authToken, res.token);
    throw {
      status: 403,
      message: 'You must change your password to continue.',
      needsPasswordChange: true,
      email: credentials.email,
    } as NeedsPasswordChangeError;
  }

  const session: AuthSession = {
    token: res.token,
    refreshToken: res.refreshToken,
    user: userFromResponse(res, credentials.email),
  };
  await persistSession(session);
  return session;
}

/** Registers a new account. Returns the customerId needed to verify the OTP. */
export async function signup(payload: SignupPayload): Promise<{ customerId: string }> {
  const res = await api.post<LoginResponse>('/auth/signup', payload, { skipAuth: true });
  if (res.action !== 1 || !res.customerId) {
    throw {
      status: 400,
      message: res.message || 'Could not create your account. Please try again.',
    } satisfies ApiError;
  }
  return { customerId: res.customerId };
}

/** Verifies the emailed OTP and returns an authenticated session. */
export async function verifyOtp(customerId: string, otp: string): Promise<AuthSession> {
  const res = await api.post<LoginResponse>('/auth/verify-otp', { customerId, otp }, {
    skipAuth: true,
  });
  if (res.action !== 1 || !res.token) {
    throw {
      status: 400,
      message: res.message || 'That code is invalid or expired.',
    } satisfies ApiError;
  }
  const session: AuthSession = {
    token: res.token,
    refreshToken: res.refreshToken,
    user: userFromResponse(res, ''),
  };
  await persistSession(session);
  return session;
}

/** Verifies a TOTP code during login for users with 2FA enabled. */
export async function verifyTotp(customerId: string, code: string): Promise<AuthSession> {
  const res = await api.post<LoginResponse>('/auth/verify-totp', { customerId, code }, {
    skipAuth: true,
  });
  if (res.action !== 1 || !res.token) {
    throw {
      status: 400,
      message: res.message || 'That code is invalid.',
    } satisfies ApiError;
  }
  const session: AuthSession = {
    token: res.token,
    refreshToken: res.refreshToken,
    user: userFromResponse(res, ''),
  };
  await persistSession(session);
  return session;
}

export async function resendOtp(customerId: string): Promise<void> {
  await api.post(`/auth/resend-otp?customerId=${encodeURIComponent(customerId)}`, undefined, {
    skipAuth: true,
  });
}

/**
 * Requests a password-reset email. Mirrors the web: the backend takes the
 * email as a query param and emails a reset link (the reset itself is
 * completed on the web). Throws with the backend message on failure.
 */
export async function forgotPassword(email: string): Promise<void> {
  const res = await api.post<{ action: number; message?: string }>(
    `/auth/forgot-password?email=${encodeURIComponent(email)}`,
    undefined,
    { skipAuth: true },
  );
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'We could not send a reset link. Check the email and try again.',
    } satisfies ApiError;
  }
}

export async function setNewPassword(data: {
  /** Advisory. The backend resolves the account from `code` or the session. */
  email?: string;
  /** Reset token from the emailed link. Omit for the forced first change. */
  code?: string;
  password: string;
  newPassword?: string;
  confirmPassword: string;
}): Promise<void> {
  // Attach the parked token explicitly rather than dropping skipAuth: that
  // keeps the client's 401 auto-refresh disabled. A forced-change user has no
  // refresh token yet, and that path would sign them straight back out.
  const token = await storage.get(StorageKeys.authToken);
  const res = await api.post<{ action: number; message?: string }>('/auth/set-new-password', data, {
    skipAuth: true,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (res.action !== 1) {
    throw {
      status: 400,
      message: res.message || 'Password reset failed. Please try again.',
    } satisfies ApiError;
  }
}

/** Google profile fetched from an OAuth access token. */
export type GoogleProfile = {
  email: string;
  firstName: string;
  lastName: string;
  picture?: string;
};

/** Exchange a Google access token for the user's basic profile. */
export async function fetchGoogleProfile(accessToken: string): Promise<GoogleProfile> {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw { status: res.status, message: 'Could not read your Google profile.' } satisfies ApiError;
  }
  const p = (await res.json()) as {
    email?: string;
    given_name?: string;
    family_name?: string;
    name?: string;
    picture?: string;
  };
  return {
    email: p.email ?? '',
    firstName: p.given_name ?? p.name ?? '',
    lastName: p.family_name ?? '',
    picture: p.picture,
  };
}

/**
 * Sign in / register via Google. Mirrors the web: the backend takes the
 * profile as query params plus the chosen role, and returns the same flat
 * session as /auth/login.
 */
export async function googleLogin(
  profile: GoogleProfile,
  customerType: CustomerType,
): Promise<AuthSession> {
  const qs = new URLSearchParams({
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    customerType,
  }).toString();

  const res = await api.post<LoginResponse>(`/auth/google?${qs}`, undefined, { skipAuth: true });

  if (res.action !== 1 || !res.token) {
    throw {
      status: 401,
      message: res.message || 'Google sign-in failed. Please try again.',
    } satisfies ApiError;
  }

  const session: AuthSession = {
    token: res.token,
    refreshToken: res.refreshToken,
    user: { ...userFromResponse(res, profile.email), profilePicture: res.profilePicture ?? profile.picture },
  };
  await persistSession(session);
  return session;
}

export const CUSTOMER_TYPES: CustomerType[] = ['Client', 'Photographer', 'Coordinator'];

/**
 * Establish + persist a session from tokens handed back by the web signup
 * flow (browser-based registration). The web app redirects to the
 * `connekt://auth-callback` deep link carrying the freshly minted token so
 * the app can log the new user straight in without a second login.
 */
export async function establishSession(params: {
  token: string;
  refreshToken?: string;
  customerId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customerType?: string;
}): Promise<AuthSession> {
  const session: AuthSession = {
    token: params.token,
    refreshToken: params.refreshToken,
    user: {
      customerId: params.customerId ?? '',
      email: params.email ?? '',
      firstName: params.firstName,
      lastName: params.lastName,
      phone: params.phone,
      customerType: normalizeRole(params.customerType),
    },
  };
  await persistSession(session);
  return session;
}

export async function logout(): Promise<void> {
  try {
    // Ends this phone's session only (CONN-AUTH-7). '/auth/logout' is "sign
    // out everywhere" and used to run here, so logging out of the phone
    // silently signed out the web dashboard and any paired TV hours later.
    const refreshToken = await storage.get(StorageKeys.refreshToken).catch(() => null);
    await api.post('/auth/logout-device', refreshToken ? { refreshToken } : undefined);
  } catch {
    // Even if the server call fails, clear local state.
  }
  await clearSession();
}

async function persistSession(session: AuthSession): Promise<void> {
  await storage.set(StorageKeys.authToken, session.token);
  if (session.refreshToken) {
    await storage.set(StorageKeys.refreshToken, session.refreshToken);
  } else {
    // Critical on an account switch: if the new session carries no refresh
    // token, the PREVIOUS account's one used to survive here. The next 401
    // would then refresh into that other identity and silently swap who is
    // signed in. A session without a refresh token must leave none behind.
    await storage.remove(StorageKeys.refreshToken);
  }
  await storage.set(StorageKeys.session, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  // A rejected read (locked keychain, corrupted entry) must not propagate:
  // bootstrap would be left hanging and the app would sit on the splash.
  const raw = await storage.get(StorageKeys.session).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await storage.remove(StorageKeys.authToken);
  await storage.remove(StorageKeys.refreshToken);
  await storage.remove(StorageKeys.session);
}
