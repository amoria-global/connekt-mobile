import { isGoogleConfiguredFor } from './GoogleButton';

/**
 * Regression cover for a live Google 400.
 *
 * The native branches used to read `platformId || webClientId`. With only a web
 * client ID configured, the button rendered on a phone, useAuthRequest received
 * only `webClientId`, and expo-auth-session built a CUSTOM SCHEME redirect for
 * native. Google refuses that pairing outright:
 *
 *     Error 400: invalid_request
 *     Custom scheme URIs are not allowed for 'WEB' client type.
 *
 * A web client ID is not a substitute for a native one. They are different
 * OAuth client types with different allowed redirect URIs: https for web, a
 * custom scheme for iOS and Android. So "we have SOME Google id" must never
 * satisfy the check for a platform whose own id is missing.
 */
const WEB_ONLY = { web: 'web-id.apps.googleusercontent.com' };

describe('isGoogleConfiguredFor', () => {
  it('does NOT accept a web client ID on iOS', () => {
    // The exact configuration that produced the 400.
    expect(isGoogleConfiguredFor('ios', WEB_ONLY)).toBe(false);
  });

  it('does NOT accept a web client ID on Android', () => {
    expect(isGoogleConfiguredFor('android', WEB_ONLY)).toBe(false);
  });

  it('accepts each platform only with its own id', () => {
    expect(isGoogleConfiguredFor('web', WEB_ONLY)).toBe(true);
    expect(isGoogleConfiguredFor('ios', { ios: 'ios-id' })).toBe(true);
    expect(isGoogleConfiguredFor('android', { android: 'android-id' })).toBe(true);
  });

  it('is unaffected by ids belonging to other platforms', () => {
    // A build carrying every id must still gate on the right one.
    const all = { web: 'w', ios: 'i', android: 'a' };
    expect(isGoogleConfiguredFor('ios', all)).toBe(true);
    expect(isGoogleConfiguredFor('android', { web: 'w', ios: 'i' })).toBe(false);
  });

  it('treats an empty string as absent, not as configured', () => {
    // env.google*ClientId defaults to '' rather than undefined, so a truthiness
    // check is load-bearing here.
    expect(isGoogleConfiguredFor('ios', { ios: '' })).toBe(false);
    expect(isGoogleConfiguredFor('web', { web: '' })).toBe(false);
  });

  it('refuses an unknown platform rather than guessing', () => {
    expect(isGoogleConfiguredFor('windows', { web: 'w', ios: 'i', android: 'a' })).toBe(false);
    expect(isGoogleConfiguredFor('', {})).toBe(false);
  });
});
