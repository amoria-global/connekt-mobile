import http from 'http';
import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

/**
 * The REAL mobile client code against the REAL backend pipeline (real security chain, really signed tokens, real
 * controllers: see the backend's WorkspaceClientsIT). It does nothing unless that test starts the server and sets
 * WS_E2E_URL: it seeds the accounts, runs this file once per phase (alternating with the web client, so an invitation
 * sent from one client is answered from the other), then checks the database.
 *
 * Real here: the Workspace access panel, the invitation API module, the API client (token, workspace header, fallback
 * on a refused workspace), the workspace store and the app's own mapping of what the server sends. Faked here: only
 * the transport (node http), secure storage (in memory) and the confirmation dialog (answered "yes"). Not a device run.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Real endpoints on a cold JVM: the first requests can take several seconds.
jest.setTimeout(90000);

const BASE = process.env.WS_E2E_URL;
const PHASE = process.env.WS_E2E_PHASE ?? '';
const ME = process.env.WS_E2E_ME_ID ?? '';
const ME_TOKEN = process.env.WS_E2E_ME_TOKEN ?? '';
const STRANGER_TOKEN = process.env.WS_E2E_STRANGER_TOKEN ?? '';
const OWNER_BOOKING_ID = process.env.WS_E2E_OWNER_BOOKING_ID ?? '';
const OWNER_BOOKING_TITLE = process.env.WS_E2E_OWNER_BOOKING_TITLE ?? '';
const MEMBER_BOOKING_TITLE = process.env.WS_E2E_MEMBER_BOOKING_TITLE ?? '';
const OWNER = process.env.WS_E2E_OWNER_ID ?? '';
const MEMBER_EMAIL = process.env.WS_E2E_MEMBER_EMAIL ?? '';
const MEMBER_NAME = process.env.WS_E2E_MEMBER_NAME ?? '';

const mockStore = new Map<string, string>();
jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockStore.get(k) ?? null,
    set: async (k: string, v: string) => { mockStore.set(k, v); },
    remove: async (k: string) => { mockStore.delete(k); },
  },
  StorageKeys: { authToken: 'auth.token', refreshToken: 'auth.refreshToken', session: 'auth.session', activeWorkspace: 'workspace.active' },
}));
jest.mock('@/config/env', () => ({
  env: { apiBaseUrl: (process.env.WS_E2E_URL ?? 'http://localhost:1') + '/api/remote', requestTimeoutMs: 15000, uploadTimeoutMs: 15000 },
}));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isPhotographer: true, role: 'Photographer' }) }));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'PHOTOGRAPHER' } }), { getState: () => ({ user: {} }) }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));
/** The confirmation dialog: answer by running the destructive (last) button, like a tap on it. */
const mockAlert = jest.fn();
jest.mock('@/components/ui/dialog', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));

import { api } from '@/api/client';
import { WorkspaceAccessPanel } from './WorkspaceAccessPanel';
import { answerInvitation, listMyWorkspaces, listReceivedInvitations, listSentInvitations, revokeMembership, sendInvitation } from './api';
import { useWorkspace } from '@/store/workspace';

/** A fetch over node http: the same wire the phone would use, without a phone. */
function nodeFetch(url: string, init: { method?: string; headers?: Record<string, string>; body?: unknown } = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = init.body == null ? undefined : String(init.body);
    const headers: Record<string, string | number> = { ...(init.headers ?? {}) };
    if (body !== undefined) headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: init.method ?? 'GET', headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: (res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300,
          status: res.statusCode,
          headers: { get: (k: string) => { const v = res.headers[k.toLowerCase()]; return Array.isArray(v) ? v.join(',') : (v ?? null); } },
          text: async () => text,
          json: async () => JSON.parse(text),
        });
      });
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const press = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.accessibilityLabel === label || (n.findAllByType(Text).length > 0 && text(n) === label)))[0];
async function tap(r: TestRenderer.ReactTestRenderer, label: string) {
  const el = press(r, label);
  if (!el) throw new Error('control not found: ' + label);
  await act(async () => { el.props.onPress(); });
}
const input = (r: TestRenderer.ReactTestRenderer, label: string) => r.root.findAllByType(TextInput).find((i) => i.props.accessibilityLabel === label)!;
async function typeInto(r: TestRenderer.ReactTestRenderer, label: string, value: string) {
  await act(async () => { input(r, label).props.onChangeText(value); });
}
const settle = () => act(async () => { await new Promise((res) => setTimeout(res, 200)); });
/** Waits for the real server to answer: the first request after start-up can take a second or two. */
async function waitForText(r: TestRenderer.ReactTestRenderer, expected: string, ms = 15000) {
  const until = Date.now() + ms;
  while (!text(r.root).includes(expected) && Date.now() < until) await act(async () => { await new Promise((res) => setTimeout(res, 100)); });
  expect(text(r.root)).toContain(expected);
}
async function mountPanel() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<WorkspaceAccessPanel />); });
  for (let i = 0; i < 20 && r.root.findAll((n) => n.props?.accessibilityLabel === 'Loading invitations').length > 0; i++) await settle();
  return r;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const get = (path: string) => api.get<any>(path);

/** The member's own booking id, read from their personal workspace (no workspace header). */
async function ownBookingId(): Promise<string> {
  const selected = mockStore.get('workspace.active');
  mockStore.delete('workspace.active');
  try {
    return (await get('/photographer/bookings')).data[0].id as string;
  } finally {
    if (selected) mockStore.set('workspace.active', selected);
  }
}

beforeEach(() => {
  (globalThis as { fetch: unknown }).fetch = nodeFetch;
  mockStore.clear();
  mockStore.set('auth.token', ME_TOKEN);
  mockAlert.mockReset();
  useWorkspace.setState({ hydrated: true, activeId: null, memberships: [], loading: false });
});

const only = (phase: string) => (BASE && PHASE === phase ? it : it.skip);

describe('mobile client against the real backend', () => {
  only('invite')('the owner invites a photographer through the Workspace access panel', async () => {
    const r = await mountPanel();
    expect(text(r.root)).toContain('Let another photographer work in your workspace');
    await typeInto(r, 'Their email', MEMBER_EMAIL);
    await tap(r, 'Find photographer');
    await waitForText(r, MEMBER_NAME);
    await typeInto(r, 'Add a note (optional)', 'Weddings this season');
    await tap(r, 'Send invitation');
    await waitForText(r, 'Invitation sent to ' + MEMBER_NAME);

    const mine = (await listSentInvitations()).find((i) => i.invitee.name === MEMBER_NAME)!;
    expect(mine.status).toBe('PENDING');
    expect(mine.note).toBe('Weddings this season');
    // A second invitation to the same photographer is refused by the server, not just hidden by the screen.
    await expect(sendInvitation(mine.invitee.id)).rejects.toMatchObject({ message: expect.stringMatching(/already waiting/) });
  });

  only('accept')('the invited photographer accepts, works in the workspace, and is kept away from withdrawals and transactions', async () => {
    const pending = (await listReceivedInvitations()).find((i) => i.status === 'PENDING')!;
    expect(pending.owner.id).toBe(OWNER);

    // Someone else's account cannot answer it.
    mockStore.set('auth.token', STRANGER_TOKEN);
    await expect(answerInvitation(pending.id, true)).rejects.toMatchObject({ message: 'Invitation not found' });
    mockStore.set('auth.token', ME_TOKEN);

    const r = await mountPanel();
    expect(text(r.root)).toContain('Invitations for you');
    await tap(r, 'Accept');
    await waitForText(r, 'Workspaces you can open');
    const mine = await listMyWorkspaces();
    expect(mine).toHaveLength(1);
    expect(mine[0].workspaceId).toBe(OWNER);
    expect(mine[0].access).toEqual({ business: true, financial: false, ownerAccount: false, manageMembers: false });

    // Open the workspace from the screen, the way a user would.
    await tap(r, 'Open workspace');
    await settle();
    expect(useWorkspace.getState().activeId).toBe(OWNER);
    expect(mockStore.get('workspace.active')).toBe(OWNER);

    // Work calls run in the OWNER's workspace: the owner's booking is listed with its amount, the member's own is not.
    const listed = JSON.stringify((await get('/photographer/bookings')).data);
    expect(listed).toContain(OWNER_BOOKING_TITLE);
    expect(listed).not.toContain(MEMBER_BOOKING_TITLE);
    expect(listed).toContain('300');
    // The balance, the wallet summary, analytics and opportunities are available.
    expect((await get('/photographer/balance')).data).toHaveProperty('withdrawableBalance');
    expect((await get('/wallet/me')).data).toHaveProperty('totalWithdrawn');
    expect((await get('/photographer/analytics')).action).toBe(1);
    expect((await get('/photographer/opportunities')).action).toBe(1);
    // The real booking rules apply: the member's own booking cannot be accepted from here, the owner's can.
    const ownId = await ownBookingId();
    await expect(api.post(`/photographer/bookings/${ownId}/accept`)).rejects.toMatchObject({ status: 403 });
    const accepted = await api.post<any>(`/photographer/bookings/${OWNER_BOOKING_ID}/accept`); // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(accepted.data.status).toBe('ACCEPTED');

    // Withdrawals and transactions are refused by the real backend, and that does not drop the workspace selection.
    for (const call of [() => get('/photographer/transactions'), () => get('/wallet/me/movements'), () => api.post('/photographer/withdraw', { amount: 10 })]) {
      await expect(call()).rejects.toMatchObject({ status: 403, message: 'This is not available in a shared workspace' });
    }
    expect(mockStore.get('workspace.active')).toBe(OWNER);

    // A call about the person themself does not carry the workspace: under the real policy it would be refused if it did.
    expect(await listSentInvitations()).toEqual([]);
  });

  only('revoke')('the owner removes access, after confirming', async () => {
    const accepted = (await listSentInvitations()).find((i) => i.status === 'ACCEPTED')!;
    const r = await mountPanel();
    await tap(r, `Remove access: ${accepted.invitee.name}`);
    expect(mockAlert.mock.calls[0][0]).toBe('Remove access?');
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    await act(async () => { buttons.find((b) => b.text === 'Remove access')!.onPress?.(); });
    await settle();
    expect((await listSentInvitations()).find((i) => i.id === accepted.id)!.status).toBe('REVOKED');
    // Repeating it is harmless: the server answers with the state it is already in.
    await expect(revokeMembership(accepted.id)).resolves.toMatchObject({ status: 'REVOKED' });
  });

  only('after-revoke')('a removed collaborator is sent back to their own workspace on the very next request', async () => {
    mockStore.set('workspace.active', OWNER);
    useWorkspace.setState({ activeId: OWNER });
    await useWorkspace.getState().hydrate();
    await expect(get('/photographer/bookings')).rejects.toMatchObject({ status: 403, message: 'Workspace access is not available' });
    expect(mockStore.has('workspace.active')).toBe(false);
    expect(useWorkspace.getState().activeId).toBeNull();

    // Their own account and workspace carry on: their own booking, not the owner's.
    const own = JSON.stringify((await get('/photographer/bookings')).data);
    expect(own).toContain(MEMBER_BOOKING_TITLE);
    expect(own).not.toContain(OWNER_BOOKING_TITLE);
    expect((await get('/wallet/me')).action).toBe(1);
    expect(await listMyWorkspaces()).toEqual([]);
    expect((await listReceivedInvitations()).map((i) => i.status)).toEqual(['REVOKED']);
  });
});
