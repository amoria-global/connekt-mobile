/**
 * What a host may do about an event's visibility, and the words for it. Unpublished events stay visible to the host with
 * an "Unpublished" badge and never appear in Explore, search, story rings or counts (the server already lists only
 * published events publicly).
 *
 * The server refuses to unpublish a completed event and, on republish, sets the status back to PUBLISHED, so ended
 * events are only offered the action once the backend supports it (ENDED_UNPUBLISH_SUPPORTED).
 */
import type { EventStatus } from '@/features/events/eventStatus';

/** Flip once the backend change for ended events is deployed (see the proposal in the audit). */
export const ENDED_UNPUBLISH_SUPPORTED = false;

export type PublishAction =
  | { kind: 'unpublish' }
  | { kind: 'republish' }
  | { kind: 'blocked'; reason: string }
  | { kind: 'none' };

export function publishActionFor(published: boolean | undefined, status: EventStatus, endedSupported = ENDED_UNPUBLISH_SUPPORTED): PublishAction {
  if (status === 'LIVE') return { kind: 'blocked', reason: 'End the stream first' };
  if (!published) return endedSupported || status !== 'ENDED' ? { kind: 'republish' } : { kind: 'none' };
  if (status === 'ENDED' && !endedSupported) return { kind: 'none' };
  return { kind: 'unpublish' };
}

export type UnpublishImpact = { bookings?: number; ticketsSold?: number };

export function unpublishCopy(impact?: UnpublishImpact): { title: string; body: string; warning?: string } {
  const parts: string[] = [];
  if (impact?.bookings) parts.push(`${impact.bookings} booking${impact.bookings === 1 ? '' : 's'}`);
  if (impact?.ticketsSold) parts.push(`${impact.ticketsSold} ticket${impact.ticketsSold === 1 ? '' : 's'} sold`);
  return {
    title: 'Unpublish this event?',
    body: 'It will be hidden from Explore and its public link will stop working. Your photos, wishes and data are kept, and you can republish it at any time.',
    warning: parts.length ? `This event has ${parts.join(' and ')}. People who already have one will not be able to open the public page.` : undefined,
  };
}
