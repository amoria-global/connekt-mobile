/**
 * Deferred deep links: a link or QR the person opened before the app was installed, carried through the install and
 * the sign-up, and delivered once they are in.
 *
 * The landing page saved where the visitor was going (the backend's /public/deferred-links) before sending them to the
 * store. On the first launch after an install the app asks for it back, by code from the Google Play referrer on
 * Android (exact) and by network match on iPhone (a best guess the server only gives when it is unambiguous). The answer
 * is a path on connekyt.com; it is turned into a screen here from a short fixed list, so nothing the server or a link
 * says can open an arbitrary route. The screen is kept on disk until the person is signed in (sign-up, the one-time
 * code, two-factor and app restarts all pass without a word of it), then the root layout takes it exactly once. It goes
 * stale after seven days.
 */
import { Platform } from 'react-native';
import { api } from '@/api/client';
import { storage } from '@/services/storage';
import type { ApiEnvelope } from '@/types';

const PENDING_KEY = 'connekt.pendingDestination';
const CHECKED_KEY = 'connekt.deferredLinkChecked';
const ATTEMPTS_KEY = 'connekt.deferredLinkAttempts';

export const PENDING_DESTINATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

type ApplicationModule = {
  getInstallationTimeAsync(): Promise<Date>;
  getInstallReferrerAsync(): Promise<string>;
};

/**
 * expo-application ships with expo-notifications, so every installed build already carries its native half, but it is
 * not a dependency of its own in package.json (adding one would make the OTA gate demand a store build). It is read
 * lazily and defensively: if the native half were ever missing, the check simply runs without the install time and the
 * referrer instead of failing the app at startup.
 */
function application(): ApplicationModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-application') as ApplicationModule;
  } catch {
    return null;
  }
}

/** A path on connekyt.com to the screen that shows it, or null when the app has no matching screen. */
export function webPathToAppHref(path: string): string | null {
  let url: URL;
  try {
    url = new URL(path, 'https://connekyt.com');
  } catch {
    return null;
  }
  if (url.origin !== 'https://connekyt.com') return null;
  const p = url.pathname.replace(/\/+$/, '');
  const wish = p.match(/^\/wish\/([^/]+)$/);
  if (wish && ID.test(wish[1])) {
    const from = (url.searchParams.get('from') ?? '').trim().slice(0, 40);
    return `/(public)/wish/${wish[1]}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  }
  if (p === '/user/events/view-event') {
    const id = url.searchParams.get('id') ?? url.searchParams.get('eventId') ?? '';
    if (!ID.test(id)) return null;
    return `/(public)/event/${id}${url.searchParams.get('src') === 'qr' ? '?src=qr' : ''}`;
  }
  if (p === '/user/find-my-photos') return '/(public)/find-photos';
  if (p.startsWith('/user/browse-photos/')) return '/(public)/browse-photos';
  return null;
}

/** The link code in a Google Play install referrer ("utm_source=...&dl=ABCDEFGHJK"), or null. */
export function codeFromInstallReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  const m = referrer.match(/(?:^|[&?])dl=([A-Z0-9]{6,12})(?:&|$)/);
  return m ? m[1] : null;
}

export async function setPendingDestination(href: string, now: number = Date.now()): Promise<void> {
  await storage.set(PENDING_KEY, JSON.stringify({ href, at: now }));
}

async function readPending(now: number): Promise<string | null> {
  const raw = await storage.get(PENDING_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { href?: unknown; at?: unknown };
    if (typeof v.href === 'string' && typeof v.at === 'number' && now - v.at <= PENDING_DESTINATION_TTL_MS) return v.href;
  } catch {
    /* unreadable: treated as stale */
  }
  await storage.remove(PENDING_KEY);
  return null;
}

/** The waiting screen, left in place. */
export const peekPendingDestination = (now: number = Date.now()): Promise<string | null> => readPending(now);

/** Read and clear. Null when nothing is waiting or it went stale. */
export async function takePendingDestination(now: number = Date.now()): Promise<string | null> {
  const href = await readPending(now);
  if (href) await storage.remove(PENDING_KEY);
  return href;
}

type Answer = { matched: boolean; destination: string | null };

async function ask(path: string): Promise<Answer> {
  const res = await api.get<ApiEnvelope<{ matched?: unknown; destination?: unknown }>>(path, { skipAuth: true });
  if (res?.action !== 1) throw new Error('deferred link refused');
  const d = res.data ?? {};
  return { matched: d.matched === true, destination: typeof d.destination === 'string' ? d.destination : null };
}

/**
 * The one-time check on the first launch of an install: asks for the saved destination and keeps the screen it maps to.
 * Returns that screen's href when one was saved. A check is remembered per install (by its install time, so deleting and
 * reinstalling asks again even though iOS keeps the keychain), a failed attempt is retried on the next launch up to three
 * times, and nothing here can fail the app: every error ends quietly.
 */
export async function resolveDeferredLink(now: number = Date.now()): Promise<string | null> {
  try {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return null;
    const app = application();
    const installedAt = String((await app?.getInstallationTimeAsync().catch(() => null))?.getTime?.() ?? 'unknown');
    if ((await storage.get(CHECKED_KEY)) === installedAt) return null;
    const attempts = Number((await storage.get(ATTEMPTS_KEY)) ?? '0') || 0;
    if (attempts >= MAX_ATTEMPTS) {
      await storage.set(CHECKED_KEY, installedAt);
      return null;
    }
    await storage.set(ATTEMPTS_KEY, String(attempts + 1));

    let answer: Answer = { matched: false, destination: null };
    const code = Platform.OS === 'android' ? codeFromInstallReferrer(await (app?.getInstallReferrerAsync() ?? Promise.resolve('')).catch(() => '')) : null;
    if (code) answer = await ask(`/public/deferred-links/${code}`);
    if (!answer.matched) answer = await ask(`/public/deferred-links/match?platform=${Platform.OS}`);

    await storage.set(CHECKED_KEY, installedAt);
    await storage.remove(ATTEMPTS_KEY);
    const href = answer.matched && answer.destination ? webPathToAppHref(answer.destination) : null;
    if (href) await setPendingDestination(href, now);
    return href;
  } catch {
    return null;
  }
}
