import {
  WORKSPACE_HEADER,
  apiPath,
  inviteeActions,
  isBlockedInSharedWorkspace,
  isPersonalCall,
  mapInvitation,
  mapMembership,
  ownerActions,
  shortDate,
  sortInvitations,
  statusView,
  workspaceHeaders,
} from './model';

const OWNER = '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50';

describe('which calls carry the workspace', () => {
  it('names the workspace on the work calls', () => {
    for (const p of ['/photographer/events', '/photographer/clients', '/photographer/bookings/b1/accept', '/customer/galleries', '/photographer/albums']) {
      expect(workspaceHeaders(p, OWNER)).toEqual({ [WORKSPACE_HEADER]: OWNER });
    }
  });

  it('keeps calls about the signed-in person themself out of the workspace', () => {
    for (const p of [
      '/auth/refresh', '/public/events', '/customer/profile', '/customer/kyc/status', '/customer/totp/enable', '/customer/notifications',
      '/photographer/notifications/unread-count', '/photographer/workspaces/mine', '/photographer/profile-summary', '/team/me/permissions',
    ]) {
      expect(isPersonalCall(p)).toBe(true);
      expect(workspaceHeaders(p, OWNER)).toEqual({});
    }
  });

  it('sends nothing in the own workspace, or for a value that is not a workspace id', () => {
    expect(workspaceHeaders('/photographer/events', null)).toEqual({});
    expect(workspaceHeaders('/photographer/events', undefined)).toEqual({});
    expect(workspaceHeaders('/photographer/events', 'not-an-id')).toEqual({});
    expect(workspaceHeaders('/photographer/events', '<script>')).toEqual({});
  });

  it('reads a full URL and a query string the same way as a path', () => {
    expect(apiPath('https://backend.connekyt.com/api/remote/photographer/events?page=0')).toBe('/photographer/events');
    expect(apiPath('/photographer/clients?size=20')).toBe('/photographer/clients');
    expect(workspaceHeaders('https://backend.connekyt.com/api/remote/photographer/workspaces/sent', OWNER)).toEqual({});
    expect(workspaceHeaders('https://backend.connekyt.com/api/remote/photographer/events', OWNER)).toEqual({ [WORKSPACE_HEADER]: OWNER });
  });
});

describe('screens that do not exist in a shared workspace', () => {
  it('blocks money, account, notification, chat and collaboration screens and their sub screens', () => {
    for (const p of [
      '/wallet', '/wallet/movements', '/transactions', '/withdraw', '/payroll', '/analytics', '/payments', '/payment/p1', '/payment-accounts',
      '/donations', '/notifications', '/inbox', '/conversation/c1', '/preferences', '/profile', '/edit-profile', '/kyc', '/two-factor',
      '/delete-account', '/collaborate', '/collaborate/join/abc', '/client/c1',
    ]) {
      expect(isBlockedInSharedWorkspace(p)).toBe(true);
    }
  });

  it('leaves the work screens open', () => {
    for (const p of ['/', '/events', '/event/e1', '/clients', '/bookings', '/album/a1', '/gallery', '/packages', '/photobooks', '/more']) {
      expect(isBlockedInSharedWorkspace(p)).toBe(false);
    }
    expect(isBlockedInSharedWorkspace(null)).toBe(false);
  });

  it('does not block a path that merely starts with the same letters', () => {
    expect(isBlockedInSharedWorkspace('/walletish')).toBe(false);
    expect(isBlockedInSharedWorkspace('/clients')).toBe(false);
  });
});

describe('reading what the server sends', () => {
  it('maps an invitation and never guesses a friendly status for an unknown one', () => {
    const inv = mapInvitation({
      id: 'i1', status: 'accepted', owner: { id: 'o1', name: 'Aline' }, invitee: { id: 'p1', name: 'Eric' }, note: 'Hi', delivery: 'in_app',
    });
    expect(inv).toMatchObject({ id: 'i1', status: 'ACCEPTED', owner: { id: 'o1', name: 'Aline' }, invitee: { name: 'Eric' }, note: 'Hi' });
    expect(mapInvitation({ id: 'x', status: 'SOMETHING_NEW' }).status).toBe('EXPIRED');
    expect(mapInvitation(undefined).owner.name).toBe('A photographer');
  });

  it('treats a missing access flag as no access', () => {
    const m = mapMembership({ workspaceId: 'w', invitationId: 'i', owner: { id: 'w', name: 'Aline' } });
    expect(m.access).toEqual({ business: false, financial: false, ownerAccount: false, manageMembers: false });
    const full = mapMembership({ workspaceId: 'w', invitationId: 'i', owner: { id: 'w', name: 'Aline' }, access: { business: true, financial: false, ownerAccount: false, manageMembers: false } });
    expect(full.access.business).toBe(true);
    expect(full.access.financial).toBe(false);
  });
});

describe('invitation status rules', () => {
  it('offers the owner only moves that can work', () => {
    expect(ownerActions('PENDING')).toEqual(['resend', 'cancel']);
    expect(ownerActions('ACCEPTED')).toEqual(['revoke']);
    expect(ownerActions('DECLINED')).toEqual(['resend']);
    expect(ownerActions('EXPIRED')).toEqual(['resend']);
    expect(ownerActions('CANCELLED')).toEqual(['resend']);
    expect(ownerActions('REVOKED')).toEqual([]);
    expect(ownerActions('LEFT')).toEqual([]);
  });

  it('offers the invited photographer only moves that can work', () => {
    expect(inviteeActions('PENDING')).toEqual(['accept', 'decline']);
    expect(inviteeActions('ACCEPTED')).toEqual(['open', 'leave']);
    for (const s of ['DECLINED', 'CANCELLED', 'EXPIRED', 'REVOKED', 'LEFT'] as const) expect(inviteeActions(s)).toEqual([]);
  });

  it('words every status in plain terms', () => {
    expect(statusView('PENDING').label).toBe('Waiting');
    expect(statusView('ACCEPTED').tone).toBe('success');
    expect(statusView('REVOKED').meaning.invitee).toBe('Your access was removed.');
  });

  it('puts waiting then active invitations first, newest first within a group', () => {
    const sorted = sortInvitations([
      { status: 'DECLINED' as const, createdAt: '2026-10-20T10:00:00' },
      { status: 'ACCEPTED' as const, createdAt: '2026-10-01T10:00:00' },
      { status: 'PENDING' as const, createdAt: '2026-10-10T10:00:00' },
      { status: 'PENDING' as const, createdAt: '2026-10-21T10:00:00' },
    ]);
    expect(sorted.map((x) => x.status + (x.createdAt as string).slice(8, 10))).toEqual(['PENDING21', 'PENDING10', 'ACCEPTED01', 'DECLINED20']);
  });

  it('formats dates the same everywhere and tolerates missing ones', () => {
    expect(shortDate('2026-10-22T09:30:00')).toBe('22 Oct 2026');
    expect(shortDate(undefined)).toBe('');
    expect(shortDate('nonsense')).toBe('');
  });
});
