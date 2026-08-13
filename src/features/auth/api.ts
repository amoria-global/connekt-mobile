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

/**
 * `token` is the session minted by the very login that demanded the change.
 * /auth/set-new-password now resolves the account from that token instead of
 * a body field, so the change-password screen has to carry it through.
 */
export type NeedsPasswordChangeError = ApiError & {
  needsPasswordChange: true;
  email: string;
  token?: string;
};

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
    throw {
      status: 403,
      message: 'You must change your password to continue.',
      needsPasswordChange: true,
      email: credentials.email,
      // Carried, not persisted: the account isn't usable until the password is
      // changed, so this token exists only to authorize that one call.
      token: res.token,
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

/**
 * Change the password of an already-identified caller (the forced-change flow
 * after a `mustChangePassword` login).
 *
 * The body is exactly the backend's `SetNewPasswordDto`: `password` and
 * `confirmPassword`. The ACCOUNT comes from the bearer token — the endpoint
 * used to trust an `email` field in the body, which let anyone change anyone's
 * password. There is also no `code` anywhere: forgotten passwords are reset
 * through the emailed single-use link, not in the app.
 *
 * `token` is passed explicitly because this runs before a session is persisted
 * — the user isn't logged in yet, so the client has nothing to attach.
 */
export async function setNewPassword(data: {
  password: string;
  confirmPassword: string;
  token?: string;
}): Promise<void> {
  const { token, ...body } = data;
  const res = await api.post<{ action: number; message?: string }>('/auth/set-new-password', body, {
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

/**
 * Whether a VERIFIED account already owns this email.
 *
 * Used to tell "sign in" from "register" on the Google button: `/auth/google`
 * is login-or-register, and it only applies `customerType` when creating. So an
 * existing user must never be asked for a role, and a new one always must be.
 *
 * Backend convention (AuthController.checkEmail): action 0 = taken,
 * 1 = available. Unverified signups count as available — they're abandoned
 * registrations the signup flow is allowed to resume.
 */
export async function emailTaken(email: string): Promise<boolean> {
  const res = await api.post<{ action: number; message?: string }>(
    '/auth/check-email',
    { email },
    { skipAuth: true },
  );
  return res.action === 0;
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

/**
 * Account types offered at sign-up, in the order the role sheet presents
 * them. `User` is the mobile/TV consumer role — it is only reachable from
 * the app (the web sign-up offers it too, but the app is where it matters),
 * so it must be in this allowlist or a `?role=User` deep link silently
 * degrades to the default.
 */
export const CUSTOMER_TYPES: CustomerType[] = [
  'User',
  'Photographer',
  'Client',
  'Coordinator',
];

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
