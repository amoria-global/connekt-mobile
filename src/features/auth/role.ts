/** Role helpers derived from the authenticated user's customerType. */
import { useAuth } from '@/store/auth';
import { useWorkspace } from '@/store/workspace';
import type { CustomerType } from './types';

/** The roles the screens branch on. A collaborator login never appears here: inside a workspace it is the owner's role (see useRole). */
export type Role = Exclude<CustomerType, 'Collaborator'>;

function normalizeRole(raw?: string): CustomerType | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase().replace(/[\s_]+/g, '-');
  if (r === 'photographer') return 'Photographer';
  if (r === 'client') return 'Client';
  if (r === 'viewer') return 'Viewer';
  if (r === 'collaborator') return 'Collaborator';
  // "User" was merged into Client on the backend (V307 moved every account,
  // and sign-up stores User as Client). This is the retired name of the same
  // role, not an inference, so a session minted before the merge keeps working.
  if (r === 'user') return 'Client';
  if (r === 'coordinator' || r === 'event-coordinator') return 'Coordinator';
  return undefined;
}

/** Whether a raw customerType is a photographer, by the same rules as useRole. */
export function isPhotographerType(raw?: string): boolean {
  return normalizeRole(raw) === 'Photographer';
}

export function useRole(): {
  role: Role | undefined;
  isClient: boolean;
  isPhotographer: boolean;
  isCoordinator: boolean;
  isViewer: boolean;
  ownsEvents: boolean;
  /** A private collaborator login: it has no business of its own, only the workspaces it was invited to. */
  isCollaboratorLogin: boolean;
  /** Working inside a workspace as a collaborator: no wallet, balance or money figures. */
  isCollaboratorWorkspace: boolean;
} {
  // ROLE INVARIANT: never substitute a role. A missing or unrecognized role
  // is undefined so the UI shows nothing rather than the wrong thing.
  const rawRole = useAuth((s) => s.user?.customerType);
  const base = normalizeRole(rawRole);
  const activeMembershipRole = useWorkspace((s) => (s.activeId ? s.memberships.find((m) => m.workspaceId === s.activeId)?.role : undefined));
  const isCollaboratorLogin = base === 'Collaborator';
  const isCollaboratorWorkspace = isCollaboratorLogin || activeMembershipRole === 'COLLABORATOR';
  // Working in a workspace as a collaborator is working as the photographer who owns it: the screens are theirs, and
  // the server decides what is allowed. This is not a guess about who the person is. It is what the workspace is.
  const role: Role | undefined = isCollaboratorWorkspace ? 'Photographer' : base;
  return {
    role,
    isClient: role === 'Client',
    isPhotographer: role === 'Photographer',
    isCoordinator: role === 'Coordinator',
    isViewer: role === 'Viewer',
    /** Clients and coordinators create/own events. */
    ownsEvents: role === 'Client' || role === 'Coordinator',
    isCollaboratorLogin,
    isCollaboratorWorkspace,
  };
}
