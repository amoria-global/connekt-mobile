/**
 * USE_FULL_SCREEN_INTENT is switched off on purpose: Google Play rejected the 2.3.2 submission until the permission is
 * declared in Play Console. See PLAY-REJECTION-DISABLED in plugins/withIncomingCall.js and useCallReadiness.ts. When the
 * declaration is approved and the flags are turned back on, update this test with them.
 */
jest.mock('expo/config-plugins', () => ({
  withAndroidManifest: (config: any, mod: (c: any) => any) => mod(config),
}));

describe('full-screen intent is held back for Play', () => {
  it('does not add the permission to the manifest', () => {
    const withIncomingCall = require('../../plugins/withIncomingCall');
    const config = { modResults: { manifest: { 'uses-permission': [], application: [{ activity: [] }] } } };
    withIncomingCall(config);
    const names = config.modResults.manifest['uses-permission'].map((p: any) => p.$['android:name']);
    expect(names).not.toContain('android.permission.USE_FULL_SCREEN_INTENT');
    expect(names).toEqual(expect.arrayContaining(['android.permission.WAKE_LOCK', 'android.permission.VIBRATE']));
  });
});
