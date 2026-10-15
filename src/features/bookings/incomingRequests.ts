/**
 * Which direct booking requests are waiting for this photographer's answer,
 * and a signal a notification tap uses to open the incoming-request screen.
 */
import type { EventItem } from '@/features/events/types';

/**
 * Bookings still PENDING the photographer's answer, for today or later,
 * that they haven't put off with "Later" this session. Newest first.
 */
export function pendingRequests(events: EventItem[], today: string, dismissed: ReadonlySet<string>): EventItem[] {
  return events
    .filter((e) => (e.bookingStatus ?? '').toUpperCase() === 'PENDING')
    .filter((e) => !e.eventDate || e.eventDate.length < 10 || e.eventDate.slice(0, 10) >= today)
    .filter((e) => !dismissed.has(e.id) && (!e.bookingId || !dismissed.has(e.bookingId)))
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

type Listener = (eventId: string) => void;
const listeners = new Set<Listener>();
let queued: string | null = null;

/**
 * Ask the incoming-request screen to show this event (from a notification
 * tap or its "View & respond" button). If the screen isn't mounted yet, e.g.
 * right after a cold start, the request waits for it.
 */
export function showIncomingRequest(eventId: string): void {
  if (listeners.size === 0) {
    queued = eventId;
    return;
  }
  listeners.forEach((l) => l(eventId));
}

export function onShowIncomingRequest(listener: Listener): () => void {
  listeners.add(listener);
  if (queued) {
    const id = queued;
    queued = null;
    listener(id);
  }
  return () => {
    listeners.delete(listener);
  };
}
