/**
 * Whether the signed-in person may create things here. An owner always may. A workspace collaborator may only where
 * the workspace's business access allows it (the server refuses the rest), so the create buttons stay hidden otherwise.
 */
import { useRole } from '@/features/auth/role';
import { useWorkspace } from '@/store/workspace';

export function useCanCreate(): boolean {
  const { isCollaboratorWorkspace } = useRole();
  const business = useWorkspace((s) => (s.activeId ? s.memberships.find((m) => m.workspaceId === s.activeId)?.access.business : undefined));
  return !isCollaboratorWorkspace || business === true;
}
