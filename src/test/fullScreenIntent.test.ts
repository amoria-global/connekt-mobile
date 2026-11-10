/**
 * Verifies that plugins/withIncomingCall.js adds USE_FULL_SCREEN_INTENT, WAKE_LOCK, VIBRATE,
 * and sets showWhenLocked="true" and turnScreenOn="true" on .MainActivity so incoming calls
 * wake and override the lock screen.
 */
jest.mock('expo/config-plugins', () => ({
  withAndroidManifest: (config: any, mod: (c: any) => any) => mod(config),
}));

describe('full-screen intent and lock-screen wake in withIncomingCall', () => {
  it('adds USE_FULL_SCREEN_INTENT, WAKE_LOCK, VIBRATE and enables showWhenLocked/turnScreenOn on MainActivity', () => {
    const withIncomingCall = require('../../plugins/withIncomingCall');
    const mainActivity: any = { $: { 'android:name': '.MainActivity' } };
    const config = {
      modResults: {
        manifest: {
          'uses-permission': [],
          application: [{ activity: [mainActivity] }],
        },
      },
    };
    withIncomingCall(config);
    const names = config.modResults.manifest['uses-permission'].map((p: any) => p.$['android:name']);
    expect(names).toEqual(
      expect.arrayContaining([
        'android.permission.USE_FULL_SCREEN_INTENT',
        'android.permission.WAKE_LOCK',
        'android.permission.VIBRATE',
      ]),
    );
    expect(mainActivity.$['android:showWhenLocked']).toBe('true');
    expect(mainActivity.$['android:turnScreenOn']).toBe('true');
  });
});
