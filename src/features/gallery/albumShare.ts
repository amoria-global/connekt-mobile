/**
 * The buyer-facing link for an album on Find My Photos. Same rule and host as the dashboard
 * (lib/albums/albumShare.ts), so a QR saved on either platform scans to the same place.
 *   free album : ?code=<accessCode>
 *   otherwise  : ?code=<inviteCode>
 * The code is the secret; no email rides along.
 */
export const ALBUM_SHARE_HOST = 'https://connekyt.com';

export type AlbumShareCodes = { isFreeAlbum?: boolean; accessCode?: string; inviteCode?: string };

/** The share link, or null when the album has no code yet so nobody is offered a broken link. */
export function albumShareUrl(album: AlbumShareCodes): string | null {
  const code = album.isFreeAlbum && album.accessCode ? album.accessCode : album.inviteCode;
  if (!code) return null;
  return `${ALBUM_SHARE_HOST}/user/find-my-photos?code=${encodeURIComponent(code)}`;
}
