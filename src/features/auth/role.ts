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
  // "User" was merged into Client on the backend (V307 moved every account,
  // and sign-up stores User as Client). This is the retired name of the same
  // role, not an inference, so a session minted before the merge keeps working.
  if (r === 'user') return 'Client';
  if (r === 'coordinator' || r === 'event-coordinator') return 'Coordinator';
  return undefined;
}

export function useRole(): {
  role: Role | undefined;
  isClient: boolean;
  isPhotographer: boolean;
  isCoordinator: boolean;
  isViewer: boolean;
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
    /** Clients and coordinators create/own events. */
    ownsEvents: role === 'Client' || role === 'Coordinator',
  };
}
