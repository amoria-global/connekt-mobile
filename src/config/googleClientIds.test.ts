/**
 * @jest-environment node
 */
import fs from 'node:fs';
import path from 'node:path';
import { isGoogleConfiguredFor } from '@/features/auth/GoogleButton';

/**
 * Google sign-in on iPhone.
 *
 * GoogleButton renders nothing in a release build when the platform's own
 * client id is missing. Store builds took only the Android id from eas.json, so
 * every iPhone showed Apple as the only sign-in. These checks read the build
 * profiles the iOS store build is made from, so dropping the id fails here
 * instead of silently hiding the button again.
 */
const IOS = '728809448366-69tueodvvmookki9pfnpmmg3cnunmihe.apps.googleusercontent.com';
const ANDROID = '728809448366-p7n5gjov2ubgkcl0poun7argihmgk71c.apps.googleusercontent.com';

const eas = JSON.parse(fs.readFileSync(path.join(__dirname, '../../eas.json'), 'utf8'));

describe.each(['production', 'preview'])('eas build profile %s', (profile) => {
  const env = eas.build[profile].env;

  it('carries the iOS Google client id, so the button shows on iPhone', () => {
    expect(env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID).toBe(IOS);
    expect(isGoogleConfiguredFor('ios', { ios: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID })).toBe(true);
  });

  it('keeps the Android client id unchanged', () => {
    expect(env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID).toBe(ANDROID);
  });
});
