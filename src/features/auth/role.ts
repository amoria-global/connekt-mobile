/** Role helpers derived from the authenticated user's customerType. */
import { useAuth } from '@/store/auth';
import type { CustomerType } from './types';

export type Role = CustomerType;

export function useRole() {
  const role = useAuth((s) => s.user?.customerType) ?? 'Client';
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
