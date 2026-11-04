import { isBlockedInSharedWorkspace, mapActivity, mapInvitation, mapMembership, workspaceHeaders } from './model';
import { ownerMeaning as inviteOwnerMeaning } from './invite';
import { passwordStrength, SETUP_PASSWORD_RULE } from './setupPassword';

/** The collaborator rules the phone needs: the wallet is gone entirely, roles and activity are read as the server sends them. */
describe('workspace collaborator on the phone', () => {
  it('keeps the whole wallet away from a collaborator, while an older member keeps the overview', () => {
    expect(isBlockedInSharedWorkspace('/wallet')).toBe(false);
    expect(isBlockedInSharedWorkspace('/wallet', true)).toBe(true);
    expect(isBlockedInSharedWorkspace('/wallet/anything', true)).toBe(true);
    expect(isBlockedInSharedWorkspace('/events', true)).toBe(false);
    expect(isBlockedInSharedWorkspace('/transactions', true)).toBe(true);
  });

  it('never names the workspace on the picker or the collaborator profile', () => {
    const id = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';
    expect(workspaceHeaders('/collaborator/workspaces', id)).toEqual({});
    expect(workspaceHeaders('https://x/api/remote/collaborator/me', id)).toEqual({});
    expect(workspaceHeaders('/photographer/bookings', id)).toEqual({ 'X-Workspace-Id': id });
  });

  it('reads the role and last activity, and ignores a role it does not know', () => {
    expect(mapInvitation({ id: 'i', status: 'ACCEPTED', role: 'COLLABORATOR', lastActiveAt: '2026-11-03T10:00:00', owner: {}, invitee: {} })).toMatchObject({ role: 'COLLABORATOR', lastActiveAt: '2026-11-03T10:00:00' });
    expect(mapInvitation({ id: 'i', status: 'ACCEPTED', role: 'ROOT', owner: {}, invitee: {} }).role).toBeUndefined();
    expect(mapMembership({ workspaceId: 'w', role: 'COLLABORATOR', access: {} }).role).toBe('COLLABORATOR');
    expect(mapMembership({ workspaceId: 'w', access: {} }).role).toBeUndefined();
  });

  it('reads one line of activity, treating anything but refused as done', () => {
    expect(mapActivity({ id: 'a', at: 't', actor: 'Eric', outcome: 'refused', what: 'GET wallet/me', summary: 'by Eric for Aline' })).toMatchObject({ outcome: 'refused', summary: 'by Eric for Aline' });
    expect(mapActivity({ id: 'a', outcome: 'whatever' }).outcome).toBe('done');
  });

  it('tells the owner what a waiting collaborator invitation is waiting for', () => {
    expect(inviteOwnerMeaning({ status: 'PENDING', role: 'COLLABORATOR', invitee: { id: '', name: 'x', registered: false } })).toContain('set a password');
    expect(inviteOwnerMeaning({ status: 'PENDING', role: 'COLLABORATOR', invitee: { id: 'p', name: 'x' } })).toContain('their own login');
  });

  it('shows a strength hint but leaves the decision to the server', () => {
    expect(passwordStrength('').label).toBe('Too short');
    expect(passwordStrength('Sup3r$ecret!').score).toBeGreaterThanOrEqual(3);
    expect(SETUP_PASSWORD_RULE.test('Sup3r$ecret!')).toBe(true);
    expect(SETUP_PASSWORD_RULE.test('password')).toBe(false);
    expect(SETUP_PASSWORD_RULE.test('short1$')).toBe(false);
  });
});
