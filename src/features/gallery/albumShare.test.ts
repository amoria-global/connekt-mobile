import { albumShareUrl } from './albumShare';

describe('albumShareUrl', () => {
  it('uses the invite code for a paid or event album', () => {
    expect(albumShareUrl({ inviteCode: 'ALB1234ABCD' })).toBe('https://connekyt.com/user/find-my-photos?code=ALB1234ABCD');
  });
  it('uses the access code for a free album', () => {
    expect(albumShareUrl({ isFreeAlbum: true, accessCode: '482913', inviteCode: 'ALB1234ABCD' })).toBe('https://connekyt.com/user/find-my-photos?code=482913');
  });
  it('falls back to the invite code when a free album has no access code', () => {
    expect(albumShareUrl({ isFreeAlbum: true, inviteCode: 'ALB1234ABCD' })).toContain('code=ALB1234ABCD');
  });
  it('offers no link without a code', () => {
    expect(albumShareUrl({})).toBeNull();
    expect(albumShareUrl({ inviteCode: '' })).toBeNull();
  });
});
