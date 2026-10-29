const mockMem = new Map<string, string>();
const mockGet = jest.fn();
let mockOs = 'android';
let mockReferrer = '';

jest.mock('@/services/storage', () => ({
  storage: {
    get: async (k: string) => mockMem.get(k) ?? null,
    set: async (k: string, v: string) => { mockMem.set(k, v); },
    remove: async (k: string) => { mockMem.delete(k); },
  },
}));
jest.mock('@/api/client', () => ({ api: { get: (...a: unknown[]) => mockGet(...a) } }));
jest.mock('expo-application', () => ({
  getInstallationTimeAsync: async () => new Date(1_700_000_000_000),
  getInstallReferrerAsync: async () => mockReferrer,
}));
jest.mock('react-native', () => ({ Platform: { get OS() { return mockOs; } } }));

import {
  PENDING_DESTINATION_TTL_MS, codeFromInstallReferrer, peekPendingDestination, resolveDeferredLink,
  setPendingDestination, takePendingDestination, webPathToAppHref,
} from './deferredLink';

const T0 = 1_800_000_000_000;
const found = (destination: string) => ({ action: 1, data: { matched: true, destination } });
const none = { action: 1, data: { matched: false, destination: null } };

beforeEach(() => { mockMem.clear(); mockGet.mockReset(); mockOs = 'android'; mockReferrer = ''; });

describe('which screen a saved link opens', () => {
  it.each([
    ['/wish/abc123?from=Amina', '/(public)/wish/abc123?from=Amina'],
    ['/wish/abc123', '/(public)/wish/abc123'],
    ['/user/events/view-event?id=e1&src=qr', '/(public)/event/e1?src=qr'],
    ['/user/events/view-event?id=e1', '/(public)/event/e1'],
    ['/user/find-my-photos?code=A1', '/(public)/find-photos'],
    ['/user/browse-photos/an-album', '/(public)/browse-photos'],
  ])('%s opens %s', (path, href) => expect(webPathToAppHref(path)).toBe(href));

  it.each([
    'https://evil.example/wish/abc', '//evil.example/wish/abc', '/user/auth/login', '/wish/a/b', '/wish/a b', '/user/events/view-event',
    '/user/events/view-event?id=../../x', '/user/events/some-slug', '',
  ])('refuses %s', (path) => expect(webPathToAppHref(path)).toBeNull());

  it('keeps a long inviter name short and encoded', () => {
    const href = webPathToAppHref(`/wish/abc?from=${'A'.repeat(100)}`) as string;
    expect(href.length).toBeLessThan(80);
  });
});

describe('the install referrer', () => {
  it('reads the link code', () => {
    expect(codeFromInstallReferrer('utm_source=connekyt_web&utm_medium=qr&dl=ABCDEFGHJK')).toBe('ABCDEFGHJK');
    expect(codeFromInstallReferrer('dl=ABCDEFGHJK')).toBe('ABCDEFGHJK');
  });
  it('ignores anything else', () => {
    expect(codeFromInstallReferrer('utm_source=google-play&utm_medium=organic')).toBeNull();
    expect(codeFromInstallReferrer('dl=abc')).toBeNull();
    expect(codeFromInstallReferrer('')).toBeNull();
    expect(codeFromInstallReferrer(null)).toBeNull();
  });
});

describe('the saved destination', () => {
  it('is kept until taken, taken once, and stale after seven days', async () => {
    await setPendingDestination('/(public)/wish/a', T0);
    expect(await peekPendingDestination(T0 + 1000)).toBe('/(public)/wish/a');
    expect(await takePendingDestination(T0 + 2000)).toBe('/(public)/wish/a');
    expect(await takePendingDestination(T0 + 3000)).toBeNull();
    await setPendingDestination('/(public)/wish/b', T0);
    expect(await takePendingDestination(T0 + PENDING_DESTINATION_TTL_MS + 1)).toBeNull();
  });
});

describe('resolveDeferredLink', () => {
  it('Android: asks for the code from the referrer and keeps the screen', async () => {
    mockReferrer = 'utm_source=connekyt_web&dl=ABCDEFGHJK';
    mockGet.mockResolvedValueOnce(found('/wish/abc?from=Amina'));
    expect(await resolveDeferredLink(T0)).toBe('/(public)/wish/abc?from=Amina');
    expect(mockGet.mock.calls[0][0]).toBe('/public/deferred-links/ABCDEFGHJK');
    expect(await takePendingDestination(T0 + 1)).toBe('/(public)/wish/abc?from=Amina');
  });

  it('Android without a code, and iPhone: asks the network match', async () => {
    mockGet.mockResolvedValueOnce(found('/user/events/view-event?id=e1&src=qr'));
    expect(await resolveDeferredLink(T0)).toBe('/(public)/event/e1?src=qr');
    expect(mockGet.mock.calls[0][0]).toBe('/public/deferred-links/match?platform=android');
    mockMem.clear();
    mockOs = 'ios';
    mockGet.mockResolvedValueOnce(found('/wish/abc'));
    await resolveDeferredLink(T0);
    expect(mockGet.mock.calls[1][0]).toBe('/public/deferred-links/match?platform=ios');
  });

  it('falls back to the network match when the code finds nothing', async () => {
    mockReferrer = 'dl=ABCDEFGHJK';
    mockGet.mockResolvedValueOnce(none).mockResolvedValueOnce(found('/wish/abc'));
    expect(await resolveDeferredLink(T0)).toBe('/(public)/wish/abc');
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('asks once per install, and again after a reinstall', async () => {
    mockGet.mockResolvedValue(none);
    expect(await resolveDeferredLink(T0)).toBeNull();
    await resolveDeferredLink(T0);
    expect(mockGet).toHaveBeenCalledTimes(1);
    mockMem.set('connekt.deferredLinkChecked', 'a-previous-install');
    await resolveDeferredLink(T0);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('retries after a failure, three times at most, and never throws', async () => {
    mockGet.mockRejectedValue(new Error('offline'));
    for (let i = 0; i < 5; i++) expect(await resolveDeferredLink(T0)).toBeNull();
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('keeps nothing when the destination has no screen in the app', async () => {
    mockGet.mockResolvedValueOnce(found('/user/events/some-slug'));
    expect(await resolveDeferredLink(T0)).toBeNull();
    expect(await takePendingDestination(T0)).toBeNull();
  });
});
