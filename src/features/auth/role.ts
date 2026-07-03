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
    /** Mobile/TV consumer role: buys streams & photos, books photographers,
     *  pays pending payments. */
    isUser: role === 'User',
    /** Clients and coordinators create/own events. A `User`'s events are the
     *  ones created under the hood when they book a photographer, so they also
     *  get an events list. */
    ownsEvents: role === 'Client' || role === 'Coordinator' || role === 'User',
  };
}
