/**
 * Web checkout handoff.
 *
 * The app no longer collects payment details — no phone numbers, no MoMo/card
 * pickers, no gateway polling. Every flow that needs money shows the price and
 * a single "Complete on connekyt.com" action that opens the web checkout.
 *
 * Two kinds of redirect:
 *  - Public flows (stream access, photos, donations, gifts) go straight to the
 *    existing sessionless pages with plain params.
 *  - JWT-gated flows (booking declarations, archive) first mint a short-lived
 *    handoff token; the web receiver at /user/complete-payment resolves it
 *    without a session and the server-fixed amount can't be tampered with.
 *
 * Whether a given button may even appear on Android is a separate question —
 * digital goods stay behind digitalPurchasesEnabled (see ./policy.ts).
 */
import * as WebBrowser from 'expo-web-browser';
import { api } from '@/api/client';
import { env } from '@/config/env';

type ApiEnvelope<T> = { action?: number; message?: string; data?: T };

export type HandoffType = 'BOOKING_DECLARATION' | 'ARCHIVE';

/** Opens a connekyt.com path in the in-app browser. */
export async function openWebCheckout(path: string): Promise<void> {
  const url = path.startsWith('http') ? path : `${env.webBaseUrl}${path}`;
  await WebBrowser.openBrowserAsync(url);
}

// ────── Public receivers (no token needed) ────────────────────────────────

/** Stream access purchase — package selection + payment happen on web. */
export function streamAccessUrl(eventId: string): string {
  return `/user/events/join-package?id=${encodeURIComponent(eventId)}`;
}

/**
 * Pay-to-watch receiver for the Smart-TV flow. The TV shows a QR encoding this
 * exact page; a phone can instead reach it in-app (see pay-on-tv). `device` is
 * the TV's persisted anonymous-viewer id — access binds to whichever device
 * the QR names, so it MUST be the TV's id, never this phone's. The web page
 * collects identity + runs the payment, then the TV unlocks itself by polling.
 */
export function payToWatchUrl(eventId: string, device: string): string {
  return `/pay-to-watch?eventId=${encodeURIComponent(eventId)}&device=${encodeURIComponent(device)}`;
}

/** Live page with the gift/tip UI (needs the viewer's existing access). */
export function liveGiftUrl(eventId: string, viewerId?: string): string {
  const viewer = viewerId ? `&viewerId=${encodeURIComponent(viewerId)}` : '';
  return `/user/events/live-stream?eventId=${encodeURIComponent(eventId)}${viewer}`;
}

/** Album purchase by invite code (Find My Photos). */
export function albumPurchaseUrl(code: string, email?: string): string {
  const e = email ? `&email=${encodeURIComponent(email)}` : '';
  return `/user/find-my-photos?code=${encodeURIComponent(code)}${e}`;
}

/** Public photo marketplace; a slug deep-links one gallery's checkout. */
export function browsePhotosUrl(gallerySlug?: string): string {
  return gallerySlug
    ? `/user/browse-photos/${encodeURIComponent(gallerySlug)}`
    : '/user/browse-photos';
}

/** Donations page; eventId preselects the cause. */
export function donationUrl(eventId?: string): string {
  return eventId
    ? `/user/donations?eventId=${encodeURIComponent(eventId)}`
    : '/user/donations';
}

// ────── Token handoff (JWT-gated flows) ───────────────────────────────────

/**
 * Mint a handoff token and return the web receiver URL for it.
 *
 * We never send an amount. The server derives it — the declaration's
 * outstanding balance for a booking, the archive.unlock.fee setting for an
 * archive — so a tampered client can't name its own price.
 */
export async function mintHandoffUrl(
  type: HandoffType,
  params: { declarationId?: string; eventId?: string },
): Promise<string> {
  const res = await api.post<ApiEnvelope<{ token: string }>>('/payments/handoff', {
    type,
    declarationId: params.declarationId,
    eventId: params.eventId,
  });
  if (res?.action !== 1 || !res.data?.token) {
    throw { status: 400, message: res?.message || 'Could not prepare the payment.' };
  }
  return `/user/complete-payment?ref=${encodeURIComponent(res.data.token)}`;
}
