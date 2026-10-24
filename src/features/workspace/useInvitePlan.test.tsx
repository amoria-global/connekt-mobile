import React, { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

/**
 * The invitation a sign-in or sign-up screen was opened for: where the id comes from (the route, pasted text, or an
 * earlier screen's storage), that it is kept the first time it is known, and what the screen is told to do about it.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockMem = new Map<string, string>();
jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockMem.get(k) ?? null,
    set: async (k: string, v: string) => { mockMem.set(k, v); },
    remove: async (k: string) => { mockMem.delete(k); },
  },
}));
const mockPreview = jest.fn();
jest.mock('./api', () => ({ getInvitePreview: (...a: unknown[]) => mockPreview(...a) }));

import { useInvitePlan, type InviteJourney } from './useInvitePlan';

const ID = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const OTHER = '9a8b7c6d-1111-4222-8333-444455556666';
const KEY = 'connekt.pendingWorkspaceInvite';
const open = (o: Record<string, unknown> = {}) => ({ found: true, open: true, status: 'PENDING', ownerName: 'Aline Uwase', email: 'new@example.com', account: 'none', ...o });

/** The latest value the hook returned, written after each render rather than during it. */
const seen: { current: InviteJourney | null } = { current: null };
const last = () => seen.current as InviteJourney;
function Probe({ route, useStored }: { route?: unknown; useStored?: boolean }) {
  const journey = useInvitePlan(route, useStored === undefined ? undefined : { useStored });
  useEffect(() => { seen.current = journey; });
  return <Text>{journey.id ?? 'none'}</Text>;
}
async function mount(props: { route?: unknown; useStored?: boolean } = {}) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<Probe {...props} />); });
  await act(async () => {});
  await act(async () => {});
  return r;
}

beforeEach(() => {
  mockMem.clear();
  mockPreview.mockReset();
  mockPreview.mockResolvedValue(open());
});

describe('useInvitePlan', () => {
  it('uses the id in the route, keeps it, and plans sign-up for an address with no account', async () => {
    await mount({ route: ID });
    expect(last().id).toBe(ID);
    expect(last().explicit).toBe(true);
    expect(mockPreview).toHaveBeenCalledWith(ID);
    expect(last().plan).toMatchObject({ view: 'signup', requireSignup: true, lockEmail: true, email: 'new@example.com' });
    // Kept for the sign-up detour: a restart or the one-time code screen must not lose it.
    expect(mockMem.get(KEY)).toMatch(new RegExp(`^${ID}\\|`));
  });

  it('plans sign-in for an address that already has a photographer account', async () => {
    mockPreview.mockResolvedValue(open({ account: 'photographer' }));
    await mount({ route: ID });
    expect(last().plan).toMatchObject({ view: 'login', requireSignup: false, email: 'new@example.com' });
  });

  it('has no plan until the preview arrives, and none when it cannot be read', async () => {
    let release!: (v: unknown) => void;
    mockPreview.mockImplementation(() => new Promise((res) => { release = res; }));
    await mount({ route: ID });
    expect(last().plan).toBeNull();
    await act(async () => { release(null); });
    expect(last().plan).toBeNull();
    expect(last().id).toBe(ID);
  });

  it('reads the id from a pasted link in the route', async () => {
    await mount({ route: `https://dashboard.connekyt.com/user/photographer/collaborate?tab=workspace&invite=${ID}` });
    expect(last().id).toBe(ID);
  });

  it('ignores a route value that is not an invitation, and does not ask for a preview', async () => {
    await mount({ route: '../../etc/passwd' });
    expect(last().id).toBeNull();
    expect(last().explicit).toBe(false);
    expect(mockPreview).not.toHaveBeenCalled();
    expect(mockMem.size).toBe(0);
  });

  it('picks up the invitation an earlier screen kept, when the route has none', async () => {
    mockMem.set(KEY, `${ID}|${Date.now()}`);
    await mount();
    expect(last().id).toBe(ID);
    expect(last().explicit).toBe(false);
    expect(last().plan).not.toBeNull();
  });

  it('does not use the kept invitation when told not to (the sign-up screen only trusts its route)', async () => {
    mockMem.set(KEY, `${ID}|${Date.now()}`);
    await mount({ useStored: false });
    expect(last().id).toBeNull();
    expect(mockPreview).not.toHaveBeenCalled();
  });

  it('does not pick up a stale kept invitation', async () => {
    mockMem.set(KEY, `${ID}|${Date.now() - 3 * 24 * 60 * 60 * 1000}`);
    await mount();
    expect(last().id).toBeNull();
  });

  it('adopts pasted text: a link or an id works, anything else is refused and changes nothing', async () => {
    await mount();
    let ok = true;
    await act(async () => { ok = last().adopt('hello'); });
    expect(ok).toBe(false);
    expect(last().id).toBeNull();
    await act(async () => { ok = last().adopt(`see ${`https://dashboard.connekyt.com/user/photographer/collaborate?tab=workspace&invite=${OTHER}`}`); });
    await act(async () => {});
    expect(ok).toBe(true);
    expect(last().id).toBe(OTHER);
    expect(last().explicit).toBe(true);
    expect(mockPreview).toHaveBeenLastCalledWith(OTHER);
    expect(mockMem.get(KEY)).toMatch(new RegExp(`^${OTHER}\\|`));
  });

  it('follows a new id in the route and asks about it', async () => {
    const r = await mount({ route: ID });
    await act(async () => { r.update(<Probe route={OTHER} />); });
    await act(async () => {});
    expect(last().id).toBe(OTHER);
    expect(mockPreview).toHaveBeenLastCalledWith(OTHER);
  });
});
