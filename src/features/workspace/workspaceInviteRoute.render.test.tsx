import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

/**
 * connekt://workspace-invite/<id>: the app's own way into an invitation. Signed in, it goes straight to the invitation
 * in Collaborate. Signed out, the id is kept first (so signing in or up cannot lose it) and the person goes to
 * sign-in, which sends a person with no account on to sign-up. Anything that is not an invitation goes home.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockParams: { id?: string } = {};
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: (...a: unknown[]) => mockReplace(...a) }),
  useLocalSearchParams: () => mockParams,
}));
const mockAuth = { status: 'unauthenticated' as string };
jest.mock('@/store/auth', () => ({ useAuth: (sel: (s: unknown) => unknown) => sel(mockAuth) }));
const mockOnboarding = { termsAccepted: true as boolean | null };
jest.mock('@/store/onboarding', () => ({ useOnboarding: (sel: (s: unknown) => unknown) => sel(mockOnboarding) }));
const mockMem = new Map<string, string>();
jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockMem.get(k) ?? null,
    set: async (k: string, v: string) => { mockMem.set(k, v); },
    remove: async (k: string) => { mockMem.delete(k); },
  },
}));

import WorkspaceInviteScreen from '@/app/(public)/workspace-invite/[id]';

const ID = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const KEY = 'connekt.pendingWorkspaceInvite';

async function mount(id: string | undefined) {
  mockParams.id = id;
  await act(async () => { TestRenderer.create(<WorkspaceInviteScreen />); });
  await act(async () => {});
  await act(async () => {});
}

beforeEach(() => {
  mockMem.clear();
  mockReplace.mockReset();
  mockAuth.status = 'unauthenticated';
  mockOnboarding.termsAccepted = true;
});

describe('workspace invitation deep link', () => {
  it('signed in: goes straight to the invitation in Collaborate and keeps nothing', async () => {
    mockAuth.status = 'authenticated';
    mockMem.set(KEY, `${ID}|${Date.now()}`);
    await mount(ID);
    expect(mockReplace).toHaveBeenCalledWith(`/collaborate?invite=${ID}`);
    expect(mockMem.has(KEY)).toBe(false);
  });

  it('signed out: keeps the id first, then goes to sign-in carrying it', async () => {
    await mount(ID);
    expect(mockMem.get(KEY)).toMatch(new RegExp(`^${ID}\\|`));
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/login', params: { invite: ID } });
  });

  it('reads the id from a pasted link as well as the bare id', async () => {
    await mount(`https://dashboard.connekyt.com/user/photographer/collaborate?tab=workspace&invite=${ID.toUpperCase()}`);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/login', params: { invite: ID } });
  });

  it('goes home for anything that is not an invitation, and keeps nothing', async () => {
    await mount('../../etc/passwd');
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(mockMem.size).toBe(0);
    mockReplace.mockReset();
    await mount(undefined);
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('waits for sign-in state before deciding, so a signed-in person is not sent to sign-in', async () => {
    mockAuth.status = 'loading';
    await mount(ID);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockMem.size).toBe(0);
  });

  it('keeps the id but leaves the first-run terms screen to the layout when terms are not accepted yet', async () => {
    mockOnboarding.termsAccepted = false;
    await mount(ID);
    expect(mockMem.get(KEY)).toMatch(new RegExp(`^${ID}\\|`));
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
