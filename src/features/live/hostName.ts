/**
 * Who the host is, as a viewer sees them: the event creator's name first, then the organizer, then the photographer.
 * Never the word "Organizer". The web viewer reads the same order (lib/live/hostName.ts in the landing repo).
 *
 * This is for display only. The guest chat's host badge keeps comparing against its own value, so which messages are
 * marked as the host's does not move when this order is applied.
 */

type Person = { firstName?: string | null; lastName?: string | null; profilePicture?: string | null } | null | undefined;

export type EventHostFields = {
  creator?: Person;
  eventOrganizer?: string | null;
  photographerName?: string | null;
};

export const HOST_FALLBACK = 'Host';

function clean(s: unknown): string {
  return typeof s === 'string' ? s.trim() : '';
}

export function resolveHostName(ev: EventHostFields | null | undefined): string {
  if (!ev) return HOST_FALLBACK;
  const creator = `${clean(ev.creator?.firstName)} ${clean(ev.creator?.lastName)}`.trim();
  return creator || clean(ev.eventOrganizer) || clean(ev.photographerName) || HOST_FALLBACK;
}
