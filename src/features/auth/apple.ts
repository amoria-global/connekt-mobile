/**
 * Sign in with Apple: credential acquisition (no network calls here).
 *
 * The Apple contract that shapes this file: `fullName` and `email` are handed
 * over ONLY on the very first authorisation of this app for a given Apple ID.
 * Every later login returns them as null, and there is no API to ask again
 * (the user would have to revoke the app under Settings > Apple ID > Sign in
 * with Apple). So the first handshake is captured and cached on-device until
 * the backend has confirmed the account: a network drop between Apple and our
 * server must not lose the only copy of the user's name.
 *
 * Built on expo-apple-authentication: it ships inside Expo Go, so the flow is
 * testable in the everyday `expo start` workflow, and its config plugin adds
 * the Sign in with Apple entitlement to EAS / prebuild builds.
 *
 * The identity token is verified on the backend (signature via Apple's JWKS,
 * issuer, audience, expiry, nonce). Nothing in the token is trusted here.
 */
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { storage, StorageKeys } from '@/services/storage';
import type { CustomerType } from './types';

/** Body of POST /api/v1/auth/apple. Nulls are deliberate; see the file header. */
export type AppleCredentialPayload = {
  identityToken: string;
  /**
   * Raw nonce. Apple received SHA-256(nonce) and copied it into the token's
   * `nonce` claim; the backend re-hashes this raw value and compares.
   */
  nonce: string;
  /** Apple's stable per-team user id. Must equal the token's `sub`. */
  appleUserId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  customerType: CustomerType;
};

type FirstHandshakeProfile = Pick<AppleCredentialPayload, 'email' | 'firstName' | 'lastName'>;

/**
 * iOS 13+ only. Android would need Apple's web flow (a Services ID and a
 * redirect URL on the backend), which is not wired up. Resolves false on
 * Android and web, and wherever the native module is absent.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return (await appleSignInStatus()).available;
}

/**
 * The same check, but it says WHY when the answer is no.
 *
 * `isAvailableAsync` returning false is indistinguishable from the module being
 * absent, and the button simply renders nothing either way. That silence sent
 * someone hunting for deleted code when the truth was that the host app could
 * not provide the native module. A reason costs nothing and is logged in
 * development only.
 */
export type AppleAvailability = {
  available: boolean;
  /** Why not. `null` when available. */
  reason: null | 'not-ios' | 'module-missing' | 'unsupported-device';
};

export async function appleSignInStatus(): Promise<AppleAvailability> {
  // Apple sign-in is iOS-only here. Android would need Apple's web flow (a
  // Services ID plus a backend redirect), which is not wired up.
  if (Platform.OS !== 'ios') return { available: false, reason: 'not-ios' };

  try {
    const ok = await AppleAuthentication.isAvailableAsync();
    // iOS 12 or earlier, or a device Apple does not offer it on.
    return ok ? { available: true, reason: null } : { available: false, reason: 'unsupported-device' };
  } catch {
    // The native module is not in the host app at all. In practice this is Expo
    // Go running an SDK that does not carry expo-apple-authentication: a
    // development build is the fix, not a code change.
    return { available: false, reason: 'module-missing' };
  }
}

export class AppleSignInCancelled extends Error {
  constructor() {
    super('Apple sign-in was cancelled.');
    this.name = 'AppleSignInCancelled';
  }
}

export function isAppleSignInCancelled(err: unknown): err is AppleSignInCancelled {
  return err instanceof AppleSignInCancelled;
}

/**
 * Presents the native Apple authorisation sheet and returns the payload to
 * POST. Throws AppleSignInCancelled when the user dismisses the sheet; any
 * other failure propagates as a plain Error with a user-readable message.
 */
export async function requestAppleCredential(
  customerType: CustomerType,
): Promise<AppleCredentialPayload> {
  // Replay protection. Apple copies the request nonce verbatim into the
  // identity token, so the HASH goes to Apple and the RAW value goes to our
  // backend, which hashes it again and compares (lower-case hex both sides).
  const nonce = Crypto.randomUUID();
  const hashedNonce = (
    await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce)
  ).toLowerCase();

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if (isCodedError(err) && err.code === 'ERR_REQUEST_CANCELED') {
      throw new AppleSignInCancelled();
    }
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error('Apple did not return an identity token. Please try again.');
  }

  // Explicitly capture the first-handshake fields. On any login after the
  // first they are null, so fall back to what an earlier attempt cached.
  const profile = await rememberFirstHandshake(credential.user, {
    email: credential.email ?? null,
    firstName: credential.fullName?.givenName ?? null,
    lastName: credential.fullName?.familyName ?? null,
  });

  return {
    identityToken: credential.identityToken,
    nonce,
    appleUserId: credential.user,
    ...profile,
    customerType,
  };
}

/** Call once the backend has accepted the account; the cached profile is no longer needed. */
export async function forgetFirstHandshake(appleUserId: string): Promise<void> {
  await storage.remove(handshakeKey(appleUserId)).catch(() => undefined);
}

// Apple user ids look like "001234.abcdef0123456789.5678", which is within the
// character set SecureStore accepts for keys (alphanumeric, ".", "-", "_").
function handshakeKey(appleUserId: string): string {
  return `${StorageKeys.appleFirstHandshake}.${appleUserId}`;
}

async function rememberFirstHandshake(
  appleUserId: string,
  fresh: FirstHandshakeProfile,
): Promise<FirstHandshakeProfile> {
  const key = handshakeKey(appleUserId);
  if (fresh.email || fresh.firstName || fresh.lastName) {
    // The one and only delivery. Persist before the network call so a failed
    // POST can be retried with the same profile.
    await storage.set(key, JSON.stringify(fresh)).catch(() => undefined);
    return fresh;
  }
  const cached = await storage.get(key).catch(() => null);
  if (!cached) return fresh;
  try {
    const parsed = JSON.parse(cached) as Partial<FirstHandshakeProfile>;
    return {
      email: parsed.email ?? null,
      firstName: parsed.firstName ?? null,
      lastName: parsed.lastName ?? null,
    };
  } catch {
    return fresh;
  }
}

function isCodedError(err: unknown): err is { code: string } {
  return typeof err === 'object' && err !== null && typeof (err as { code?: unknown }).code === 'string';
}
