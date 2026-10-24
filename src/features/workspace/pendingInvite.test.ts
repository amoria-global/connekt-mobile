const mockMem = new Map<string, string>();

jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockMem.get(k) ?? null,
    set: async (k: string, v: string) => {
      mockMem.set(k, v);
    },
    remove: async (k: string) => {
      mockMem.delete(k);
    },
  },
}));

import {
  PENDING_INVITE_TTL_MS, clearPendingWorkspaceInvite, peekPendingWorkspaceInvite, setPendingWorkspaceInvite,
  takePendingInviteHref, takePendingWorkspaceInvite,
} from './pendingInvite';

/**
 * The invitation kept between the link and the workspace: it has to survive the sign-up detour and an app restart,
 * go stale on its own, be spent exactly once, and never be turned into a screen for someone who cannot use it.
 */
const ID = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const T0 = 1_800_000_000_000;

beforeEach(() => mockMem.clear());

describe('pending workspace invitation', () => {
  it('is kept until it is taken, and taken once', async () => {
    await setPendingWorkspaceInvite(ID, T0);
    expect(await peekPendingWorkspaceInvite(T0 + 1000)).toBe(ID);
    // Peeking does not spend it: a screen reads it, the root layout takes it.
    expect(await peekPendingWorkspaceInvite(T0 + 2000)).toBe(ID);
    expect(await takePendingWorkspaceInvite(T0 + 3000)).toBe(ID);
    expect(await takePendingWorkspaceInvite(T0 + 4000)).toBeNull();
  });

  it('stores only a real invitation id, taken from a link if that is what was given', async () => {
    await setPendingWorkspaceInvite('not an id', T0);
    expect(await peekPendingWorkspaceInvite(T0)).toBeNull();
    await setPendingWorkspaceInvite(`https://dashboard.connekyt.com/user/photographer/collaborate?invite=${ID.toUpperCase()}`, T0);
    expect(await peekPendingWorkspaceInvite(T0)).toBe(ID);
    expect([...mockMem.values()].join('')).not.toContain('@');
  });

  it('goes stale and is dropped rather than hijacking a sign-in days later', async () => {
    await setPendingWorkspaceInvite(ID, T0);
    expect(await takePendingWorkspaceInvite(T0 + PENDING_INVITE_TTL_MS + 1)).toBeNull();
    expect(mockMem.size).toBe(0);
  });

  it('survives corrupt storage by being dropped', async () => {
    mockMem.set('connekt.pendingWorkspaceInvite', 'garbage');
    expect(await peekPendingWorkspaceInvite(T0)).toBeNull();
    expect(mockMem.size).toBe(0);
    mockMem.set('connekt.pendingWorkspaceInvite', `${ID}|not-a-time`);
    expect(await takePendingWorkspaceInvite(T0)).toBeNull();
  });

  it('can be cleared', async () => {
    await setPendingWorkspaceInvite(ID, T0);
    await clearPendingWorkspaceInvite();
    expect(await peekPendingWorkspaceInvite(T0)).toBeNull();
  });
});

describe('where a signed-in person goes for the waiting invitation', () => {
  it('sends a photographer to the invitation in Collaborate', async () => {
    await setPendingWorkspaceInvite(ID, T0);
    expect(await takePendingInviteHref(true, T0 + 10)).toBe(`/collaborate?invite=${ID}`);
    expect(await takePendingWorkspaceInvite(T0 + 20)).toBeNull();
  });

  it('sends anyone else nowhere, and still spends it, since nobody but a photographer can join', async () => {
    await setPendingWorkspaceInvite(ID, T0);
    expect(await takePendingInviteHref(false, T0 + 10)).toBeNull();
    expect(await takePendingWorkspaceInvite(T0 + 20)).toBeNull();
  });

  it('is null when nothing is waiting', async () => {
    expect(await takePendingInviteHref(true, T0)).toBeNull();
  });
});
