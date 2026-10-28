/**
 * The shared wish link and what its page may show. The link is https://connekyt.com/wish/<event id>, with an optional
 * ?from=<name> when the person sharing gave a name. The same path opens the app's wish screen (scheme connekt://wish/<id>
 * today, the https link too once universal links ship) and the web page, so both read the same rules from here.
 */
import { getEventStatus, type StatusInput } from '@/features/events/eventStatus';

export const HEARTFELT_LINE =
  "Some of the people you love can't be here. Invite them to send a wish or memory, and they'll share this moment with you from wherever they are.";

export const WISH_ORIGIN = 'https://connekyt.com';

/** A name that is safe to show and to put in a link: letters, digits, spaces and . ' - only, 40 characters at most. */
export function sanitizeFrom(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N} .'-]/gu, '')
    .trim()
    .slice(0, 40)
    .trim();
}

export function wishLink(eventId: string, from?: string | null): string {
  const name = sanitizeFrom(from);
  return `${WISH_ORIGIN}/wish/${encodeURIComponent(eventId)}${name ? `?from=${encodeURIComponent(name)}` : ''}`;
}

/** The "<Name> invited you" line, or null when there is no usable name. */
export function invitedByLine(from: string | null | undefined): string | null {
  const name = sanitizeFrom(from);
  return name ? `${name} invited you to send a wish for this event.` : null;
}

/** Wishes are open while the event is upcoming or live; ended and cancelled events show the closed message. */
export function wishesOpen(event: StatusInput, now = Date.now()): boolean {
  const status = getEventStatus(event, now);
  return status === 'UPCOMING' || status === 'LIVE';
}
