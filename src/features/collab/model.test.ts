import { notificationTarget } from '../notifications/routing';
import {
  collabRouteFromLink, isPhotographerType, mapOwnedDetail, mapSubmission, tokenFromInput,
} from './model';

/**
 * Album collaboration replaced the Team. These pin the pieces the screens
 * lean on: reading a pasted invite link, mapping the backend's shapes
 * defensively, and routing its notifications to the right screen.
 */
describe('invite links', () => {
  it('takes the code from a full link or accepts a bare code', () => {
    expect(tokenFromInput('https://dashboard.connekyt.com/user/photographer/collaborate/join/Ab_c-12')).toBe('Ab_c-12');
    expect(tokenFromInput('https://dashboard.connekyt.com/user/photographer/collaborate/join/Ab_c-12?utm=x')).toBe('Ab_c-12');
    expect(tokenFromInput('  Ab_c-12 ')).toBe('Ab_c-12');
    expect(tokenFromInput('')).toBe('');
  });
});

describe('who can collaborate', () => {
  it('is photographers and videographers only', () => {
    expect(isPhotographerType('Photographer')).toBe(true);
    expect(isPhotographerType('Videographer')).toBe(true);
    expect(isPhotographerType('Client')).toBe(false);
    expect(isPhotographerType('Event-coordinator')).toBe(false);
    expect(isPhotographerType(undefined)).toBe(false);
  });
});

describe('mapping', () => {
  it('treats an unknown submission status as waiting, never as added', () => {
    expect(mapSubmission({ id: '1', status: 'SOMETHING_NEW' }).status).toBe('PENDING');
    expect(mapSubmission({ id: '1', status: 'APPROVED' }).status).toBe('APPROVED');
  });

  it('survives missing lists in an album detail', () => {
    const d = mapOwnedDetail({ album: { id: 'a', title: 'Wedding' } });
    expect(d.album.title).toBe('Wedding');
    expect(d.collaborators).toEqual([]);
    expect(d.invites).toEqual([]);
    expect(d.submissions).toEqual([]);
  });
});

describe('notifications', () => {
  it('maps the dashboard paths the backend links to onto app screens', () => {
    expect(collabRouteFromLink('/user/photographer/collaborate/albums/abc')).toBe('/collaborate/album/abc');
    expect(collabRouteFromLink('/user/photographer/collaborate/joined/abc')).toBe('/collaborate/joined/abc');
    expect(collabRouteFromLink('/user/photographer/collaborate')).toBe('/collaborate');
    expect(collabRouteFromLink('/user/photographer/events?tab=content')).toBeNull();
    expect(collabRouteFromLink(undefined)).toBeNull();
  });

  it('routes by link before the ALBUM referenceId, which is a dedup key here', () => {
    // Without the link check this went to /album/abc:submitted, a screen that does not exist.
    expect(notificationTarget({
      type: 'ALBUM', referenceId: 'abc:submitted', link: '/user/photographer/collaborate/albums/abc',
    })).toBe('/collaborate/album/abc');
  });

  it('leaves ordinary album notifications alone', () => {
    expect(notificationTarget({ type: 'ALBUM', referenceId: 'abc', link: '/user/photographer/events?tab=content' })).toBe('/album/abc');
  });
});
