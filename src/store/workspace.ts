/**
 * Which workspace the photographer is working in: their own, or one they were invited to (zustand).
 *
 * `activeId` is the selected shared workspace, or null for their own. It is persisted, and the API client reads the
 * same stored value on every request, so a switch applies to the very next call. `isShared` is true as soon as a
 * workspace other than their own is selected, even before the list of memberships has loaded, so money screens never
 * flash while it does.
 *
 * Switching remounts the signed-in app (the layout is keyed by `activeId`), so no screen state from one workspace can
 * show up in the other.
 */
import { create } from 'zustand';
import { setOnWorkspaceLost } from '@/api/client';
import { listMyWorkspaces } from '@/features/workspace/api';
import type { WorkspaceMembership } from '@/features/workspace/model';
import { storage, StorageKeys } from '@/services/storage';

const ID = /^[0-9a-f-]{36}$/i;

interface WorkspaceState {
  /** The stored selection has been read. Until then the signed-in app waits, so it never paints the wrong workspace. */
  hydrated: boolean;
  activeId: string | null;
  memberships: WorkspaceMembership[];
  loading: boolean;
  hydrate: () => Promise<void>;
  /** Reloads the memberships. A selection that is no longer a live membership is dropped. */
  refresh: () => Promise<void>;
  /** A workspace id, or null for the photographer's own. */
  switchTo: (id: string | null) => Promise<void>;
  /** Back to the own workspace without touching storage (the client already cleared it). */
  lost: () => void;
  reset: () => void;
}

export const useWorkspace = create<WorkspaceState>((set, get) => ({
  hydrated: false,
  activeId: null,
  memberships: [],
  loading: false,

  hydrate: async () => {
    const stored = await storage.get(StorageKeys.activeWorkspace).catch(() => null);
    set({ activeId: stored && ID.test(stored) ? stored : null, hydrated: true });
    setOnWorkspaceLost(() => get().lost());
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const memberships = await listMyWorkspaces();
      set({ memberships });
      const { activeId } = get();
      if (activeId && !memberships.some((m) => m.workspaceId === activeId)) await get().switchTo(null);
    } catch {
      // Offline or a server error: keep what is selected. The server decides on each call.
    } finally {
      set({ loading: false });
    }
  },

  switchTo: async (id) => {
    if (id) await storage.set(StorageKeys.activeWorkspace, id);
    else await storage.remove(StorageKeys.activeWorkspace).catch(() => {});
    set({ activeId: id });
  },

  lost: () => set({ activeId: null }),

  reset: () => set({ activeId: null, memberships: [], loading: false }),
}));

/** The selected shared workspace once its details have loaded. */
export function selectActive(s: Pick<WorkspaceState, 'activeId' | 'memberships'>): WorkspaceMembership | null {
  return s.activeId ? s.memberships.find((m) => m.workspaceId === s.activeId) ?? null : null;
}

export const selectIsShared = (s: Pick<WorkspaceState, 'activeId'>): boolean => s.activeId !== null;
