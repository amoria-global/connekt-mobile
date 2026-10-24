import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import { WorkspaceAccessPanel } from './WorkspaceAccessPanel';

/**
 * The Workspace access panel rendered over a FAKE invitation API (react-test-renderer): what each side sees, the
 * moves offered per status, confirmation before anything destructive, one request per tap, and an error that reads as
 * an error rather than a silent success. It never talks to a backend.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockApi = {
  listSentInvitations: jest.fn(),
  listReceivedInvitations: jest.fn(),
  lookupPhotographer: jest.fn(),
  sendInvitation: jest.fn(),
  resendInvitation: jest.fn(),
  cancelInvitation: jest.fn(),
  revokeMembership: jest.fn(),
  answerInvitation: jest.fn(),
  leaveWorkspace: jest.fn(),
};
jest.mock('./api', () => ({
  listSentInvitations: (...a: unknown[]) => mockApi.listSentInvitations(...a),
  listReceivedInvitations: (...a: unknown[]) => mockApi.listReceivedInvitations(...a),
  lookupPhotographer: (...a: unknown[]) => mockApi.lookupPhotographer(...a),
  sendInvitation: (...a: unknown[]) => mockApi.sendInvitation(...a),
  resendInvitation: (...a: unknown[]) => mockApi.resendInvitation(...a),
  cancelInvitation: (...a: unknown[]) => mockApi.cancelInvitation(...a),
  revokeMembership: (...a: unknown[]) => mockApi.revokeMembership(...a),
  answerInvitation: (...a: unknown[]) => mockApi.answerInvitation(...a),
  leaveWorkspace: (...a: unknown[]) => mockApi.leaveWorkspace(...a),
}));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isPhotographer: true, role: 'Photographer' }) }));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'PHOTOGRAPHER' } }), { getState: () => ({ user: {} }) }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));
const mockSwitchTo = jest.fn(async () => {});
const mockRefresh = jest.fn(async () => {});
jest.mock('@/store/workspace', () => ({
  useWorkspace: (sel: (s: unknown) => unknown) => sel({ switchTo: mockSwitchTo, refresh: mockRefresh }),
}));
const mockAlert = jest.fn();
jest.mock('@/components/ui/dialog', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));

const person = (id: string, name: string) => ({ id, name, customerType: 'Photographer' });
const inv = (o: Record<string, unknown>) => ({
  id: 'i1', status: 'PENDING', owner: person('o1', 'Aline Uwase'), invitee: person('p1', 'Eric Mugisha'),
  createdAt: '2026-10-20T09:00:00', expiresAt: '2026-11-03T09:00:00', ...o,
});

const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const press = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.accessibilityLabel === label || (n.findAllByType(Text).length > 0 && text(n) === label)))[0];
const pressAll = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.accessibilityLabel === label || (n.findAllByType(Text).length > 0 && text(n) === label)));
async function tap(r: TestRenderer.ReactTestRenderer, label: string) {
  const el = press(r, label);
  if (!el) throw new Error('control not found: ' + label);
  await act(async () => { el.props.onPress(); });
}
const input = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAllByType(TextInput).find((i) => i.props.accessibilityLabel === label)!;
async function typeInto(r: TestRenderer.ReactTestRenderer, label: string, value: string) {
  await act(async () => { input(r, label).props.onChangeText(value); });
}
async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<WorkspaceAccessPanel />); });
  await act(async () => {});
  return r;
}
/** Runs the destructive button of the last confirmation dialog, like a tap on it. */
async function confirmDialog(name: string) {
  const buttons = mockAlert.mock.calls[mockAlert.mock.calls.length - 1][2] as { text: string; onPress?: () => void }[];
  const b = buttons.find((x) => x.text === name)!;
  await act(async () => { b.onPress?.(); });
}

beforeEach(() => {
  Object.values(mockApi).forEach((m) => m.mockReset());
  mockSwitchTo.mockClear();
  mockAlert.mockReset();
  mockApi.listSentInvitations.mockResolvedValue([]);
  mockApi.listReceivedInvitations.mockResolvedValue([]);
});

describe('workspace access panel', () => {
  it('explains what an invited photographer can and cannot do', async () => {
    const r = await mount();
    const t = text(r.root);
    expect(t).toContain('What they can and cannot do');
    expect(t).toContain('cannot withdraw, see transactions or change account settings');
    expect(t).toContain('You have not invited anyone yet');
  });

  it('lists what was sent with its status and the right moves', async () => {
    mockApi.listSentInvitations.mockResolvedValue([
      inv({ id: 'a', status: 'PENDING' }),
      inv({ id: 'b', status: 'ACCEPTED', invitee: person('p2', 'Chantal Ineza') }),
      inv({ id: 'c', status: 'DECLINED', invitee: person('p3', 'Jean Bosco') }),
      inv({ id: 'd', status: 'REVOKED', invitee: person('p4', 'Olive Kamali') }),
    ]);
    const r = await mount();
    const t = text(r.root);
    for (const w of ['Eric Mugisha', 'Waiting', 'Active', 'Declined', 'Removed']) expect(t).toContain(w);
    expect(press(r, 'Send again: Eric Mugisha')).toBeTruthy();
    expect(press(r, 'Cancel: Eric Mugisha')).toBeTruthy();
    expect(press(r, 'Remove access: Chantal Ineza')).toBeTruthy();
    expect(press(r, 'Send again: Jean Bosco')).toBeTruthy();
    expect(press(r, 'Send again: Olive Kamali')).toBeUndefined();
    expect(press(r, 'Remove access: Olive Kamali')).toBeUndefined();
  });

  it('asks before cancelling and only then asks the server', async () => {
    mockApi.listSentInvitations.mockResolvedValue([inv({ id: 'a' })]);
    mockApi.cancelInvitation.mockResolvedValue(inv({ id: 'a', status: 'CANCELLED' }));
    const r = await mount();
    await tap(r, 'Cancel: Eric Mugisha');
    expect(mockApi.cancelInvitation).not.toHaveBeenCalled();
    expect(mockAlert.mock.calls[0][0]).toBe('Cancel this invitation?');
    await confirmDialog('Cancel invitation');
    expect(mockApi.cancelInvitation).toHaveBeenCalledWith('a');
    expect(text(r.root)).toContain('Invitation cancelled.');
  });

  it('asks before removing access, then removes it', async () => {
    mockApi.listSentInvitations.mockResolvedValue([inv({ id: 'b', status: 'ACCEPTED' })]);
    mockApi.revokeMembership.mockResolvedValue(inv({ id: 'b', status: 'REVOKED' }));
    const r = await mount();
    await tap(r, 'Remove access: Eric Mugisha');
    expect(mockAlert.mock.calls[0][1]).toContain('lose access to your workspace right away');
    expect(mockApi.revokeMembership).not.toHaveBeenCalled();
    await confirmDialog('Remove access');
    expect(mockApi.revokeMembership).toHaveBeenCalledWith('b');
  });

  it('finds a photographer by email, sends once, and clears the form', async () => {
    mockApi.lookupPhotographer.mockResolvedValue(person('p9', 'Grace Mutoni'));
    mockApi.sendInvitation.mockResolvedValue(inv({ id: 'n', invitee: person('p9', 'Grace Mutoni') }));
    const r = await mount();
    await typeInto(r, 'Their email', 'grace@example.com');
    await tap(r, 'Find photographer');
    expect(mockApi.lookupPhotographer).toHaveBeenCalledWith('grace@example.com');
    expect(text(r.root)).toContain('Grace Mutoni');
    await typeInto(r, 'Add a note (optional)', 'Weddings in June');
    const send = press(r, 'Send invitation');
    // Two quick taps make one request.
    await act(async () => {
      send.props.onPress();
      send.props.onPress();
    });
    expect(mockApi.sendInvitation).toHaveBeenCalledTimes(1);
    expect(mockApi.sendInvitation).toHaveBeenCalledWith('p9', 'Weddings in June');
    expect(text(r.root)).toContain('Invitation sent to Grace Mutoni');
    expect(input(r, 'Their email').props.value).toBe('');
  });

  it('says plainly when no photographer matches, and when the server refuses a duplicate', async () => {
    mockApi.lookupPhotographer.mockRejectedValueOnce({ status: 400, message: 'No photographer account uses that email' });
    const r = await mount();
    await typeInto(r, 'Their email', 'nobody@example.com');
    await tap(r, 'Find photographer');
    expect(text(r.root)).toContain('No photographer account uses that email');
    expect(press(r, 'Send invitation')).toBeUndefined();

    mockApi.lookupPhotographer.mockResolvedValue(person('p9', 'Grace Mutoni'));
    mockApi.sendInvitation.mockRejectedValue({ status: 409, message: 'An invitation to this photographer is already waiting' });
    await typeInto(r, 'Their email', 'grace@example.com');
    await tap(r, 'Find photographer');
    await tap(r, 'Send invitation');
    expect(text(r.root)).toContain('already waiting');
    expect(text(r.root)).not.toContain('Invitation sent to');
  });

  it('lets the invited photographer accept once, then open the workspace', async () => {
    mockApi.listReceivedInvitations.mockResolvedValueOnce([inv({ id: 'r1', status: 'PENDING' })]);
    mockApi.answerInvitation.mockResolvedValue(inv({ id: 'r1', status: 'ACCEPTED' }));
    const r = await mount();
    expect(text(r.root)).toContain('Invitations for you');
    expect(text(r.root)).toContain('Withdrawals and transactions stay with them');
    mockApi.listReceivedInvitations.mockResolvedValue([inv({ id: 'r1', status: 'ACCEPTED' })]);
    const accept = pressAll(r, 'Accept')[0];
    await act(async () => {
      accept.props.onPress();
      accept.props.onPress();
    });
    expect(mockApi.answerInvitation).toHaveBeenCalledTimes(1);
    expect(mockApi.answerInvitation).toHaveBeenCalledWith('r1', true);
    await tap(r, 'Open workspace');
    expect(mockSwitchTo).toHaveBeenCalledWith('o1');
  });

  it('declines on request', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([inv({ id: 'r1' })]);
    mockApi.answerInvitation.mockResolvedValue(inv({ id: 'r1', status: 'DECLINED' }));
    const r = await mount();
    await tap(r, 'Decline');
    expect(mockApi.answerInvitation).toHaveBeenCalledWith('r1', false);
  });

  it('shows the server error and refreshes when a move fails because the invitation moved on', async () => {
    mockApi.listSentInvitations.mockResolvedValue([inv({ id: 'a', status: 'ACCEPTED' })]);
    mockApi.revokeMembership.mockRejectedValue({ status: 409, message: 'Only a photographer who has joined can be removed' });
    const r = await mount();
    const before = mockApi.listSentInvitations.mock.calls.length;
    await tap(r, 'Remove access: Eric Mugisha');
    await confirmDialog('Remove access');
    expect(text(r.root)).toContain('Only a photographer who has joined can be removed');
    expect(mockApi.listSentInvitations.mock.calls.length).toBeGreaterThan(before);
  });

  it('shows an error with a retry that works', async () => {
    mockApi.listSentInvitations.mockRejectedValueOnce({ status: 500, message: 'Server is down' });
    const r = await mount();
    expect(text(r.root)).toContain('Could not load invitations');
    expect(text(r.root)).toContain('Server is down');
    mockApi.listSentInvitations.mockResolvedValue([inv({})]);
    await tap(r, 'Try again');
    expect(text(r.root)).toContain('Eric Mugisha');
  });
});
