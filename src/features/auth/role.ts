/** Role helpers derived from the authenticated user's customerType. */
import { useAuth } from '@/store/auth';
import type { CustomerType } from './types';

export type Role = CustomerType;

function normalizeRole(raw?: string): CustomerType | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase().replace(/[\s_]+/g, '-');
  if (r === 'photographer') return 'Photographer';
  if (r === 'client') return 'Client';
  if (r === 'viewer') return 'Viewer';
  if (r === 'user') return 'User';
  if (r === 'coordinator' || r === 'event-coordinator') return 'Coordinator';
  return undefined;
}

export function useRole(): {
  role: Role | undefined;
  isClient: boolean;
  isPhotographer: boolean;
  isCoordinator: boolean;
  isViewer: boolean;
  isUser: boolean;
  ownsEvents: boolean;
} {
  // ROLE INVARIANT: never substitute a role. A missing or unrecognized role
  // is undefined so the UI shows nothing rather than the wrong thing.
  const rawRole = useAuth((s) => s.user?.customerType);
  const role = normalizeRole(rawRole);
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
