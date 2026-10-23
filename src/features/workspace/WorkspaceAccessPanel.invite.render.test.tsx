import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';

import { WorkspaceAccessPanel } from './WorkspaceAccessPanel';

/**
 * Inviting someone who has no account yet, and opening an invitation from its link, on the phone: what the owner sees
 * when the address has no account, how an emailed invitation reads, and what the person who opened the link is
 * offered in each case. Over a FAKE invitation API (react-test-renderer); it never talks to a backend.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockApi = {
  listSentInvitations: jest.fn(),
  listReceivedInvitations: jest.fn(),
  lookupPhotographer: jest.fn(),
  sendInvitation: jest.fn(),
  sendInvitationByEmail: jest.fn(),
  getInvitePreview: jest.fn(),
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
  sendInvitationByEmail: (...a: unknown[]) => mockApi.sendInvitationByEmail(...a),
  getInvitePreview: (...a: unknown[]) => mockApi.getInvitePreview(...a),
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

const ID = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
const person = (id: string | null, name: string, extra: Record<string, unknown> = {}) => ({ id, name, customerType: 'Photographer', ...extra });
const inv = (o: Record<string, unknown> = {}) => ({
  id: ID, status: 'PENDING', owner: person('o1', 'Aline Uwase'), invitee: person('p1', 'Eric Mugisha'),
  createdAt: '2026-10-20T09:00:00', expiresAt: '2026-11-03T09:00:00', ...o,
});
// The panel receives what ./api maps, so the fakes are already mapped.
const mapped = (o: Record<string, unknown>) => ({
  ...o,
  owner: { ...(o.owner as object), id: (o.owner as { id: string }).id },
  invitee: { ...(o.invitee as object), id: (o.invitee as { id: string | null }).id ?? '' },
});

const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean).join(' | ');
const pressables = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => typeof n.props?.onPress === 'function' && (n.props.accessibilityLabel === label || (n.findAllByType(Text).length > 0 && text(n) === label)));
async function tap(r: TestRenderer.ReactTestRenderer, label: string) {
  const el = pressables(r, label)[0];
  if (!el) throw new Error('control not found: ' + label);
  await act(async () => { el.props.onPress(); });
}
const input = (r: TestRenderer.ReactTestRenderer, label: string) => r.root.findAllByType(TextInput).find((i) => i.props.accessibilityLabel === label)!;
async function typeInto(r: TestRenderer.ReactTestRenderer, label: string, value: string) {
  await act(async () => { input(r, label).props.onChangeText(value); });
}
async function mount(props: { inviteId?: string | null; onInviteHandled?: () => void } = {}) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<WorkspaceAccessPanel {...props} />); });
  await act(async () => {});
  await act(async () => {});
  return r;
}
const focusCard = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => n.props?.testID === 'invite-focus');

beforeEach(() => {
  Object.values(mockApi).forEach((m) => m.mockReset());
  mockSwitchTo.mockClear();
  mockAlert.mockReset();
  mockApi.listSentInvitations.mockResolvedValue([]);
  mockApi.listReceivedInvitations.mockResolvedValue([]);
  mockApi.getInvitePreview.mockResolvedValue(null);
});

describe('inviting an address with no account yet', () => {
  const NEW = { id: '', name: 'new@example.com', registered: false, email: 'new@example.com', customerType: 'Photographer' };

  it('says no account uses it, that they will be emailed, and offers to email the invitation', async () => {
    mockApi.lookupPhotographer.mockResolvedValue(NEW);
    const r = await mount();
    await typeInto(r, 'Their email', 'new@example.com');
    await tap(r, 'Find photographer');
    expect(mockApi.lookupPhotographer).toHaveBeenCalledWith('new@example.com');
    expect(text(r.root)).toContain('No account uses this address yet');
    expect(text(r.root)).toContain('create a photographer account with this exact address');
    expect(pressables(r, 'Email invitation').length).toBeGreaterThan(0);
    expect(pressables(r, 'Send invitation')).toHaveLength(0);
  });

  it('emails it once by address, not by account, and says so', async () => {
    mockApi.lookupPhotographer.mockResolvedValue(NEW);
    mockApi.sendInvitationByEmail.mockResolvedValue(mapped(inv({ id: 'n', invitee: { ...NEW, id: null } })));
    const r = await mount();
    await typeInto(r, 'Their email', 'new@example.com');
    await tap(r, 'Find photographer');
    await tap(r, 'Email invitation');
    expect(mockApi.sendInvitationByEmail).toHaveBeenCalledTimes(1);
    expect(mockApi.sendInvitationByEmail).toHaveBeenCalledWith('new@example.com', undefined);
    expect(mockApi.sendInvitation).not.toHaveBeenCalled();
    expect(text(r.root)).toContain('Invitation emailed to new@example.com');
    expect(text(r.root)).toContain('create an account with that address first');
  });

  it('keeps an account holder on the ordinary in-app invitation', async () => {
    mockApi.lookupPhotographer.mockResolvedValue({ id: 'p9', name: 'Grace Mutoni', registered: true, customerType: 'Photographer' });
    mockApi.sendInvitation.mockResolvedValue(mapped(inv({ id: 'n', invitee: person('p9', 'Grace Mutoni') })));
    const r = await mount();
    await typeInto(r, 'Their email', 'grace@example.com');
    await tap(r, 'Find photographer');
    await tap(r, 'Send invitation');
    expect(mockApi.sendInvitation).toHaveBeenCalledWith('p9', undefined);
    expect(mockApi.sendInvitationByEmail).not.toHaveBeenCalled();
  });

  it('shows an emailed invitation as waiting for an account, with emailing it again as the move', async () => {
    mockApi.listSentInvitations.mockResolvedValue([mapped(inv({ id: 'e', invitee: { ...NEW, id: null }, delivery: 'email' }))]);
    const r = await mount();
    const all = text(r.root);
    expect(all).toContain('new@example.com');
    expect(all).toContain('No account yet');
    expect(all).toContain('Emailed. Waiting for them to create an account and answer.');
    expect(pressables(r, 'Email again: new@example.com').length).toBeGreaterThan(0);
    expect(pressables(r, 'Cancel: new@example.com').length).toBeGreaterThan(0);
  });

  it('says why when the server refuses to email it again so soon', async () => {
    mockApi.listSentInvitations.mockResolvedValue([mapped(inv({ id: 'e', invitee: { ...NEW, id: null }, delivery: 'email' }))]);
    mockApi.resendInvitation.mockRejectedValue({ status: 409, message: 'This invitation was just emailed. Try again in a few minutes.' });
    const r = await mount();
    await tap(r, 'Email again: new@example.com');
    expect(text(r.root)).toContain('just emailed');
  });
});

describe('opening an invitation from its link', () => {
  it('puts a waiting invitation first and accepts it and opens the workspace in one step', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([mapped(inv())]);
    mockApi.answerInvitation.mockResolvedValue(mapped(inv({ status: 'ACCEPTED' })));
    const handled = jest.fn();
    const r = await mount({ inviteId: ID, onInviteHandled: handled });
    expect(focusCard(r).length).toBeGreaterThan(0);
    expect(text(r.root)).toContain('YOUR INVITATION');
    expect(text(r.root)).toContain('Aline Uwase invited you to work in their workspace');
    // It is on the card, not listed a second time under "Invitations for you".
    expect(text(r.root)).not.toContain('Invitations for you');
    await tap(r, 'Accept and open workspace');
    expect(mockApi.answerInvitation).toHaveBeenCalledWith(ID, true);
    expect(handled).toHaveBeenCalledTimes(1);
    expect(mockSwitchTo).toHaveBeenCalledWith('o1');
  });

  it('can be declined from the card, and opens nothing', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([mapped(inv())]);
    mockApi.answerInvitation.mockResolvedValue(mapped(inv({ status: 'DECLINED' })));
    const handled = jest.fn();
    const r = await mount({ inviteId: ID, onInviteHandled: handled });
    await tap(r, 'Decline');
    expect(mockApi.answerInvitation).toHaveBeenCalledWith(ID, false);
    expect(mockSwitchTo).not.toHaveBeenCalled();
    expect(handled).toHaveBeenCalled();
  });

  it('does not accept twice on a double tap', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([mapped(inv())]);
    let release!: () => void;
    mockApi.answerInvitation.mockImplementation(() => new Promise((res) => { release = () => res(mapped(inv({ status: 'ACCEPTED' }))); }));
    const r = await mount({ inviteId: ID });
    const accept = pressables(r, 'Accept and open workspace')[0];
    await act(async () => { accept.props.onPress(); accept.props.onPress(); });
    release();
    await act(async () => {});
    expect(mockApi.answerInvitation).toHaveBeenCalledTimes(1);
  });

  it('shows a failed accept as an error and does not open the workspace', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([mapped(inv())]);
    mockApi.answerInvitation.mockRejectedValue({ status: 409, message: 'This invitation has expired. Ask for a new one.' });
    const r = await mount({ inviteId: ID });
    await tap(r, 'Accept and open workspace');
    expect(text(r.root)).toContain('has expired');
    expect(mockSwitchTo).not.toHaveBeenCalled();
  });

  it('offers to open the workspace when it is already accepted', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([mapped(inv({ status: 'ACCEPTED' }))]);
    const r = await mount({ inviteId: ID });
    expect(text(r.root)).toContain("You already work in Aline Uwase's workspace");
    await tap(r, 'Open workspace');
    expect(mockSwitchTo).toHaveBeenCalledWith('o1');
  });

  it('says an ended invitation ended, and that nothing can be accepted', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([mapped(inv({ status: 'REVOKED' }))]);
    const r = await mount({ inviteId: ID });
    expect(text(r.root)).toContain('is removed');
    expect(pressables(r, 'Accept and open workspace')).toHaveLength(0);
  });

  it('says it was sent to another address, without printing it in full, when this account cannot answer it', async () => {
    mockApi.getInvitePreview.mockResolvedValue({ found: true, open: true, status: 'PENDING', ownerName: 'Aline Uwase', email: 'intended.person@example.com', account: 'none' });
    const r = await mount({ inviteId: ID });
    expect(mockApi.getInvitePreview).toHaveBeenCalledWith(ID);
    expect(text(r.root)).toContain('sent to i•••@example.com');
    expect(text(r.root)).toContain('Sign out, then sign in or create an account with that address');
    expect(text(r.root)).not.toContain('intended.person');
    expect(pressables(r, 'Accept and open workspace')).toHaveLength(0);
  });

  it('says it is no longer open, or that it could not be opened, when the preview says so', async () => {
    mockApi.getInvitePreview.mockResolvedValue({ found: true, open: false, status: 'CANCELLED' });
    expect(text((await mount({ inviteId: ID })).root)).toContain('no longer open');
    mockApi.getInvitePreview.mockResolvedValue(null);
    expect(text((await mount({ inviteId: ID })).root)).toContain('We could not open this invitation');
  });

  it('does not ask for a preview when the invitation is this account\'s own', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([mapped(inv())]);
    await mount({ inviteId: ID });
    expect(mockApi.getInvitePreview).not.toHaveBeenCalled();
  });

  it('shows nothing extra without an invitation link', async () => {
    mockApi.listReceivedInvitations.mockResolvedValue([mapped(inv())]);
    const r = await mount();
    expect(focusCard(r)).toHaveLength(0);
    expect(text(r.root)).toContain('Invitations for you');
    expect(mockApi.getInvitePreview).not.toHaveBeenCalled();
  });

  it('can be dismissed', async () => {
    mockApi.getInvitePreview.mockResolvedValue({ found: false, open: false });
    const handled = jest.fn();
    const r = await mount({ inviteId: ID, onInviteHandled: handled });
    await tap(r, 'Dismiss');
    expect(handled).toHaveBeenCalledTimes(1);
  });
});
