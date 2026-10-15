/**
 * Post My Event rules for how a server state is shown, kept identical to the
 * web dashboard's app/lib/hybridStatus.ts. They never decide eligibility.
 */

export type OpportunityFilter = 'PENDING_RESPONSE' | 'APPROVED' | 'ALL';

/**
 * The photographer's opportunity filter that lists a given status: an open
 * invite is New, a yes waiting on the client is Waiting, everything else
 * (selected, not selected, declined, expired, closed) is History.
 */
export function opportunityFilterFor(status?: string | null): OpportunityFilter {
  const s = (status || '').toUpperCase();
  if (s === 'INVITED') return 'PENDING_RESPONSE';
  if (s === 'APPROVED') return 'APPROVED';
  return 'ALL';
}

/**
 * The client's answers screen after a photographer was chosen: the event is
 * BOOKED and its match COMPLETED, so nobody is listed and nothing is pending.
 * That is a booking, not a match that ended without one.
 */
export function isMatchBooked(overview?: { status?: string | null; matchStatus?: string | null } | null): boolean {
  if (!overview) return false;
  return (overview.status || '').toUpperCase() === 'BOOKED'
    || (overview.matchStatus || '').toUpperCase() === 'COMPLETED';
}
