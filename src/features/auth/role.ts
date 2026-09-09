/** Role helpers derived from the authenticated user's customerType. */
import { useAuth } from '@/store/auth';
import type { CustomerType } from './types';

export type Role = CustomerType;

export function useRole(): {
  role: Role | undefined;
  isClient: boolean;
  isPhotographer: boolean;
  isCoordinator: boolean;
  isViewer: boolean;
  isUser: boolean;
  ownsEvents: boolean;
} {
  // ROLE INVARIANT: never substitute a role. This used to be `?? 'Client'`,
  // which meant a session with no role silently gained Client's routing and
  // capabilities (ownsEvents, isClient, ...). A missing role is now `undefined`
  // and every derived flag is false, so the UI shows nothing rather than the
  // wrong thing. Callers that need a role must handle its absence.
  const role = useAuth((s) => s.user?.customerType);
  return {
    role,
    isClient: role === 'Client',
    isPhotographer: role === 'Photographer',
    isCoordinator: role === 'Coordinator',
    isViewer: role === 'Viewer',
    /** Mobile/TV consumer role: buys streams & photos, books photographers,
     *  pays pending payments. */
    isUser: role === 'User',
    /** Clients and coordinators create/own events. A `User`'s events are the
     *  ones created under the hood when they book a photographer, so they also
     *  get an events list. */
    ownsEvents: role === 'Client' || role === 'Coordinator' || role === 'User',
  };
}
