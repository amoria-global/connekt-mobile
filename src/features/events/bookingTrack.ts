/**
 * The booking progress track on the client's event page, from statuses the API really returns.
 *
 * The old stepper listed seven steps, among them "Deposit Paid", "Album Delivered" and "Photobook", and ticked every
 * step up to the current index, so an ongoing event showed "Deposit Paid" as done although nothing in the data says
 * a deposit was paid. This track has only steps the status can prove: Requested, Accepted, Event day, Completed.
 * A cancelled or declined booking has no track (the badge says so).
 */
import type { TrackStep } from '@/features/client/studio';
import type { EventItem } from '@/features/events/types';

const ACCEPTED_STATUSES = new Set(['UPCOMING', 'PUBLISHED', 'PAUSED', 'ONGOING', 'IN_PROGRESS', 'AWAITING_REVIEW', 'COMPLETED', 'DONE']);
const EVENT_DAY_STATUSES = new Set(['ONGOING', 'IN_PROGRESS', 'AWAITING_REVIEW', 'COMPLETED', 'DONE']);

export function bookingTrack(ev?: Pick<EventItem, 'status' | 'bookingStatus'> | null): TrackStep[] | null {
  if (!ev) return null;
  const s = (ev.status ?? '').toUpperCase();
  const b = (ev.bookingStatus ?? '').toUpperCase();
  if (s.includes('CANCEL') || b === 'DECLINED' || b === 'CANCELLED' || b === 'CANCELED') return null;

  const accepted = b === 'ACCEPTED' || ACCEPTED_STATUSES.has(s);
  const eventDay = EVENT_DAY_STATUSES.has(s);
  const completed = s === 'COMPLETED' || s === 'DONE';

  const flags = [true, accepted, eventDay, completed];
  const labels = ['Requested', 'Accepted', 'Event day', 'Completed'];
  const firstOpen = flags.findIndex((f) => !f);
  return labels.map((label, i) => ({
    key: label,
    label,
    state: flags[i] ? 'done' : i === firstOpen ? 'current' : 'todo',
  }));
}
