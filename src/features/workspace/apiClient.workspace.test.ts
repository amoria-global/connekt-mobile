/**
 * The one choke point every app call goes through: it must name the workspace on work calls only, and a revoked or
 * unknown workspace must drop the user back to their own instead of leaving the app on errors.
 */
const mockStore = new Map<string, string>();
jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockStore.get(k) ?? null,
    set: async (k: string, v: string) => { mockStore.set(k, v); },
    remove: async (k: string) => { mockStore.delete(k); },
  },
  StorageKeys: { authToken: 'auth.token', refreshToken: 'auth.refreshToken', session: 'auth.session', activeWorkspace: 'workspace.active' },
}));
jest.mock('@/config/env', () => ({ env: { apiBaseUrl: 'https://api.test/api/remote', requestTimeoutMs: 5000, uploadTimeoutMs: 5000 } }));

import { api, setOnWorkspaceLost } from '@/api/client';
import { WORKSPACE_NOT_AVAILABLE } from './model';

const OWNER = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const sent: { url: string; headers: Record<string, string> }[] = [];

function reply(status: number, body: unknown) {
  (globalThis as { fetch: unknown }).fetch = jest.fn(async (url: string, init: { headers: Record<string, string> }) => {
    sent.push({ url, headers: { ...init.headers } });
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => 'application/json' },
      json: async () => body,
      text: async () => JSON.stringify(body),
    };
  });
}

beforeEach(() => {
  mockStore.clear();
  mockStore.set('auth.token', 'tok');
  sent.length = 0;
  setOnWorkspaceLost(null);
});

describe('api client with a workspace selected', () => {
  it('names the workspace on a work call and not on a personal one', async () => {
    reply(200, { action: 1 });
    mockStore.set('workspace.active', OWNER);
    await api.get('/photographer/events');
    await api.get('/customer/profile');
    await api.get('/photographer/workspaces/mine');
    expect(sent[0].headers['X-Workspace-Id']).toBe(OWNER);
    expect(sent[1].headers['X-Workspace-Id']).toBeUndefined();
    expect(sent[2].headers['X-Workspace-Id']).toBeUndefined();
  });

  it('sends nothing extra in the photographer own workspace', async () => {
    reply(200, { action: 1 });
    await api.get('/photographer/events');
    expect(sent[0].headers['X-Workspace-Id']).toBeUndefined();
  });

  it('applies a switch on the very next call', async () => {
    reply(200, { action: 1 });
    await api.get('/photographer/events');
    mockStore.set('workspace.active', OWNER);
    await api.get('/photographer/events');
    mockStore.delete('workspace.active');
    await api.get('/photographer/events');
    expect(sent.map((s) => s.headers['X-Workspace-Id'])).toEqual([undefined, OWNER, undefined]);
  });

  it('drops a refused workspace and tells the app, on the fixed refusal only', async () => {
    const lost = jest.fn();
    setOnWorkspaceLost(lost);
    mockStore.set('workspace.active', OWNER);
    reply(403, { action: 0, message: WORKSPACE_NOT_AVAILABLE });
    await expect(api.get('/photographer/events')).rejects.toMatchObject({ status: 403 });
    expect(mockStore.has('workspace.active')).toBe(false);
    expect(lost).toHaveBeenCalledTimes(1);

    // An ordinary refusal (a money page) does not throw the user out of the workspace.
    mockStore.set('workspace.active', OWNER);
    reply(403, { action: 0, message: 'This is not available in a shared workspace' });
    await expect(api.get('/photographer/balance')).rejects.toMatchObject({ status: 403 });
    expect(mockStore.get('workspace.active')).toBe(OWNER);
    expect(lost).toHaveBeenCalledTimes(1);
  });

  it('does not treat a refusal of a personal call as a lost workspace', async () => {
    const lost = jest.fn();
    setOnWorkspaceLost(lost);
    mockStore.set('workspace.active', OWNER);
    reply(403, { action: 0, message: WORKSPACE_NOT_AVAILABLE });
    await expect(api.get('/customer/profile')).rejects.toMatchObject({ status: 403 });
    expect(mockStore.get('workspace.active')).toBe(OWNER);
    expect(lost).not.toHaveBeenCalled();
  });
});
