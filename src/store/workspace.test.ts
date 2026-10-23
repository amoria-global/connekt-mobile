/**
 * The workspace store: the stored selection is read before the app paints, a selection that is no longer a live
 * membership is dropped, and a switch is persisted so the API client names it on the very next call.
 */
const mockStore = new Map<string, string>();
jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockStore.get(k) ?? null,
    set: async (k: string, v: string) => { mockStore.set(k, v); },
    remove: async (k: string) => { mockStore.delete(k); },
  },
  StorageKeys: { activeWorkspace: 'workspace.active', authToken: 'auth.token', refreshToken: 'auth.refreshToken', session: 'auth.session' },
}));
jest.mock('@/config/env', () => ({ env: { apiBaseUrl: 'https://api.test/api/remote', requestTimeoutMs: 5000, uploadTimeoutMs: 5000 } }));
const mockList = jest.fn();
jest.mock('@/features/workspace/api', () => ({ listMyWorkspaces: () => mockList() }));

import { selectActive, selectIsShared, useWorkspace } from './workspace';

const OWNER = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const membership = (id: string, name: string) => ({
  workspaceId: id, invitationId: 'i-' + id, owner: { id, name },
  access: { business: true, financial: false, ownerAccount: false, manageMembers: false },
});

beforeEach(() => {
  mockStore.clear();
  mockList.mockReset();
  useWorkspace.setState({ hydrated: false, activeId: null, memberships: [], loading: false });
});

describe('workspace store', () => {
  it('starts in the own workspace and waits for the stored selection before the app paints', async () => {
    expect(useWorkspace.getState().hydrated).toBe(false);
    await useWorkspace.getState().hydrate();
    expect(useWorkspace.getState()).toMatchObject({ hydrated: true, activeId: null });
    expect(selectIsShared(useWorkspace.getState())).toBe(false);
  });

  it('restores a stored selection, and counts as shared before the list has loaded', async () => {
    mockStore.set('workspace.active', OWNER);
    await useWorkspace.getState().hydrate();
    const s = useWorkspace.getState();
    expect(s.activeId).toBe(OWNER);
    expect(selectIsShared(s)).toBe(true);
    // Details have not loaded yet, so there is no active membership to name.
    expect(selectActive(s)).toBeNull();
  });

  it('ignores a stored value that is not a workspace id', async () => {
    mockStore.set('workspace.active', 'garbage');
    await useWorkspace.getState().hydrate();
    expect(useWorkspace.getState().activeId).toBeNull();
  });

  it('persists a switch and goes back to the own workspace', async () => {
    await useWorkspace.getState().switchTo(OWNER);
    expect(mockStore.get('workspace.active')).toBe(OWNER);
    expect(useWorkspace.getState().activeId).toBe(OWNER);
    await useWorkspace.getState().switchTo(null);
    expect(mockStore.has('workspace.active')).toBe(false);
    expect(useWorkspace.getState().activeId).toBeNull();
  });

  it('loads the memberships and names the active one', async () => {
    mockList.mockResolvedValue([membership(OWNER, 'Aline Uwase')]);
    await useWorkspace.getState().switchTo(OWNER);
    await useWorkspace.getState().refresh();
    const s = useWorkspace.getState();
    expect(s.memberships).toHaveLength(1);
    expect(selectActive(s)?.owner.name).toBe('Aline Uwase');
    expect(s.activeId).toBe(OWNER);
  });

  it('drops a selection that is no longer a live membership (revoked while away)', async () => {
    await useWorkspace.getState().switchTo(OWNER);
    mockList.mockResolvedValue([]);
    await useWorkspace.getState().refresh();
    expect(useWorkspace.getState().activeId).toBeNull();
    expect(mockStore.has('workspace.active')).toBe(false);
  });

  it('keeps the selection when the list cannot be loaded (offline), because the server decides on each call', async () => {
    await useWorkspace.getState().switchTo(OWNER);
    mockList.mockRejectedValue({ status: 0, message: 'offline' });
    await useWorkspace.getState().refresh();
    expect(useWorkspace.getState().activeId).toBe(OWNER);
    expect(useWorkspace.getState().loading).toBe(false);
  });

  it('forgets the selection and the memberships when another account signs in', async () => {
    mockList.mockResolvedValue([membership(OWNER, 'Aline Uwase')]);
    await useWorkspace.getState().switchTo(OWNER);
    await useWorkspace.getState().refresh();
    useWorkspace.getState().reset();
    expect(useWorkspace.getState()).toMatchObject({ activeId: null, memberships: [], loading: false });
  });

  it('goes back to the own workspace when the client reports the workspace lost', async () => {
    await useWorkspace.getState().hydrate();
    await useWorkspace.getState().switchTo(OWNER);
    useWorkspace.getState().lost();
    expect(useWorkspace.getState().activeId).toBeNull();
  });
});
