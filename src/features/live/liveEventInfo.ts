/**
 * The facts the live page's info section shows beyond what the stream feed carries: the tagline, the location, whether
 * entry is free or by ticket, and whether wishes are still open. Read from the public event, the same record the
 * web page reads.
 */
import { useEffect, useState } from 'react';
import { getPublicEventDetailed } from '@/features/events/api';
import type { PublicEvent } from '@/features/events/types';
import type { EventAccess } from './sections/LivePlayer';

export type LiveEventInfo = { tagline?: string; location?: string; access: EventAccess; wishesClosed: boolean; allowWishInvites?: boolean };

const CLOSED = new Set(['COMPLETED', 'AWAITING_REVIEW', 'CANCELLED', 'ENDED']);

/** The first sentence of the description, capped, as the tagline. */
export function taglineOf(description?: string): string | undefined {
  const text = (description ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  const first = text.split(/(?<=[.!?])\s/)[0];
  return first.length > 140 ? `${first.slice(0, 137).trimEnd()}...` : first;
}

export function mapLiveEventInfo(e: Pick<PublicEvent, 'description' | 'location' | 'streamFee' | 'eventStatus' | 'allowWishInvites'>): LiveEventInfo {
  return {
    tagline: taglineOf(e.description),
    location: e.location?.trim() || undefined,
    access: typeof e.streamFee === 'number' && e.streamFee > 0 ? 'ticket' : 'free',
    wishesClosed: CLOSED.has(String(e.eventStatus ?? '').toUpperCase()),
    allowWishInvites: e.allowWishInvites,
  };
}

export function useLiveEventInfo(eventId?: string): LiveEventInfo | null {
  const [info, setInfo] = useState<LiveEventInfo | null>(null);
  useEffect(() => {
    if (!eventId) return;
    let live = true;
    getPublicEventDetailed(eventId)
      .then((e) => live && setInfo(mapLiveEventInfo(e)))
      .catch(() => undefined); // the page works without it: no chip, tagline or location
    return () => {
      live = false;
    };
  }, [eventId]);
  return info;
}
