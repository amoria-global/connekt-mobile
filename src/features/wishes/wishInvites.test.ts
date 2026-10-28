import { invitesOn, wishInvitesError, wishInvitesStatus, WISH_INVITES_ERROR } from './wishInvites';

describe('wishInvites', () => {
  it('is on unless the host chose off: an older server with no value stays on', () => {
    expect(invitesOn(true)).toBe(true);
    expect(invitesOn(undefined)).toBe(true);
    expect(invitesOn(null)).toBe(true);
    expect(invitesOn(false)).toBe(false);
  });

  it('needs an explicit choice on a new event', () => {
    expect(wishInvitesError(null)).toBe('Choose whether viewers can invite others');
    expect(wishInvitesError(undefined)).toBe(WISH_INVITES_ERROR);
    expect(wishInvitesError(true)).toBeUndefined();
    expect(wishInvitesError(false)).toBeUndefined();
  });

  it('words the host status', () => {
    expect(wishInvitesStatus(true)).toBe('Wish invites: On');
    expect(wishInvitesStatus(false)).toBe('Wish invites: Off');
  });
});
