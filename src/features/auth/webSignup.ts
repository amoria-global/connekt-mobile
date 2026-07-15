/**
 * Browser-based registration.
 *
 * Registration was moved OFF the native form and INTO the web app so that a
 * single sign-up implementation (knockout) owns every account type — including
 * roles like `User` that only the mobile app used to offer.
 *
 * Flow:
 *   1. Open `${webBaseUrl}/user/auth/signup` in an in-app auth browser,
 *      pre-selecting the chosen role and passing our `connekt://auth-callback`
 *      deep link as `redirect` (plus `source=app` so the web knows the origin).
 *   2. The user registers + verifies the OTP on the web.
 *   3. The web redirects to the deep link carrying the freshly minted session
 *      (`token`, `refreshToken`, profile fields). `openAuthSessionAsync`
 *      resolves the instant that link fires and closes the browser.
 *   4. We persist that session so the user lands in the app already logged in.
 *
 * If the browser is dismissed before completion, or the web returns without a
 * token (e.g. the session couldn't be minted), we surface `cancelled` /
 * `registered` so the caller can react (the latter → "please sign in").
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { env } from '@/config/env';
import { establishSession } from './api';
import type { AuthSession, CustomerType } from './types';

export type WebSignupResult =
  | { status: 'success'; session: AuthSession }
  | { status: 'registered' }
  | { status: 'cancelled' };

/** Coerce a parsed query param (string | string[] | undefined) to a string. */
function str(v: string | string[] | undefined | null): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

export async function openWebSignup(role?: CustomerType): Promise<WebSignupResult> {
  // connekt://auth-callback in a standalone build; exp://…/--/auth-callback in dev.
  const returnUrl = Linking.createURL('auth-callback');

  const url = new URL(`${env.webBaseUrl}/user/auth/signup`);
  // Omitting userType lets the web app show its own account-type picker — the
  // single source of truth for roles, so the app carries no duplicate modal.
  if (role) url.searchParams.set('userType', role);
  url.searchParams.set('source', 'app');
  url.searchParams.set('redirect', returnUrl);

  const result = await WebBrowser.openAuthSessionAsync(url.toString(), returnUrl);
  if (result.type !== 'success' || !result.url) {
    return { status: 'cancelled' };
  }

  const { queryParams } = Linking.parse(result.url);
  const q = queryParams ?? {};
  const token = str(q.token);

  if (!token) {
    return { status: 'registered' };
  }

  const session = await establishSession({
    token,
    refreshToken: str(q.refreshToken),
    customerId: str(q.customerId),
    email: str(q.email),
    firstName: str(q.firstName),
    lastName: str(q.lastName),
    phone: str(q.phone),
    customerType: str(q.customerType),
  });
  return { status: 'success', session };
}
