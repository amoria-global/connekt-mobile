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
    const message =
      res.action === 2
        ? 'Two-factor authentication is required. Please use the web app to finish signing in.'
        : res.message || 'Login failed. Check your email and password.';
    throw { status: 401, message } satisfies ApiError;
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

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } catch {
    // Even if the server call fails, clear local state.
  }
  await clearSession();
}

async function persistSession(session: AuthSession): Promise<void> {
  await storage.set(StorageKeys.authToken, session.token);
  if (session.refreshToken) await storage.set(StorageKeys.refreshToken, session.refreshToken);
  await storage.set(StorageKeys.session, JSON.stringify(session));
}

export async function loadSession(): Promise<AuthSession | null> {
  const raw = await storage.get(StorageKeys.session);
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
