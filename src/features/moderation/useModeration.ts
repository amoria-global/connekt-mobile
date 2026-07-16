/**
 * Block state.
 *
 * Two kinds of block exist, because two kinds of chatter exist:
 *
 *  - Signed-in users are blocked server-side (`blocked_users`). The block is
 *    account-wide and symmetric — it hides them here and stops their DMs.
 *  - Anonymous stream viewers have no account, only a display name scoped to
 *    one event. They are hidden device-locally by "<eventId>:<viewerName>".
 *    Reports still reach the server either way, so moderators can act on the
 *    underlying chat row.
 */
import { create } from 'zustand';
import { storage, StorageKeys } from '@/services/storage';
import { blockUser, listBlockedUsers, unblockUser, type BlockedUser } from './api';

/** Local key for an anonymous chatter — they only exist within one event. */
export function anonKey(eventId: string, viewerName: string): string {
  return `${eventId}:${viewerName}`;
}

type ModerationState = {
  /** Server-side blocked account ids. */
  blockedIds: Set<string>;
  blocked: BlockedUser[];
  /** Device-local hidden anonymous chatters ("<eventId>:<viewerName>"). */
  hiddenChatters: Set<string>;
  loading: boolean;
  /** Read persisted local hides + fetch the server block list. */
  load: () => Promise<void>;
  /** Refresh only the server block list (for the Blocked accounts screen). */
  refresh: () => Promise<void>;
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
  isBlocked: (userId?: string | null) => boolean;
  hideChatter: (eventId: string, viewerName: string) => Promise<void>;
  unhideChatter: (eventId: string, viewerName: string) => Promise<void>;
  isChatterHidden: (eventId: string, viewerName?: string | null) => boolean;
  /**
   * Drop server-side block state on logout. Local chatter hides deliberately
   * survive — they're a property of the device, not the account, and the
   * anonymous chatters they refer to have no account to key them to.
   */
  reset: () => void;
};

async function persistHidden(keys: Set<string>): Promise<void> {
  await storage.set(StorageKeys.hiddenChatters, JSON.stringify([...keys])).catch(() => {});
}

export const useModeration = create<ModerationState>((set, get) => ({
  blockedIds: new Set(),
  blocked: [],
  hiddenChatters: new Set(),
  loading: false,

  load: async () => {
    const raw = await storage.get(StorageKeys.hiddenChatters).catch(() => null);
    let hidden: string[] = [];
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) hidden = parsed.filter((k) => typeof k === 'string');
    } catch {
      // Corrupt payload — start clean rather than trapping the user with a
      // chat they can't unhide.
      hidden = [];
    }
    set({ hiddenChatters: new Set(hidden) });
    // Startup + public screens call this; a signed-out 401 or an offline
    // failure is expected and must not throw. Local hides still apply.
    // Screens that need to surface the failure call refresh() directly.
    await get().refresh().catch(() => {});
  },

  refresh: async () => {
    set({ loading: true });
    try {
      const blocked = await listBlockedUsers();
      set({ blocked, blockedIds: new Set(blocked.map((b) => b.id)) });
    } finally {
      set({ loading: false });
    }
  },

  block: async (userId) => {
    await blockUser(userId);
    // Hide immediately; the authoritative list refreshes in the background.
    // A refresh failure must not read as a failed block — it already succeeded.
    set((s) => ({ blockedIds: new Set(s.blockedIds).add(userId) }));
    await get().refresh().catch(() => {});
  },

  unblock: async (userId) => {
    await unblockUser(userId);
    set((s) => {
      const next = new Set(s.blockedIds);
      next.delete(userId);
      return { blockedIds: next, blocked: s.blocked.filter((b) => b.id !== userId) };
    });
  },

  isBlocked: (userId) => (userId ? get().blockedIds.has(userId) : false),

  hideChatter: async (eventId, viewerName) => {
    const next = new Set(get().hiddenChatters).add(anonKey(eventId, viewerName));
    set({ hiddenChatters: next });
    await persistHidden(next);
  },

  unhideChatter: async (eventId, viewerName) => {
    const next = new Set(get().hiddenChatters);
    next.delete(anonKey(eventId, viewerName));
    set({ hiddenChatters: next });
    await persistHidden(next);
  },

  isChatterHidden: (eventId, viewerName) =>
    viewerName ? get().hiddenChatters.has(anonKey(eventId, viewerName)) : false,

  reset: () => set({ blockedIds: new Set(), blocked: [] }),
}));
