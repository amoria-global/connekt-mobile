/**
 * Lets an offer ring like a call on Android: the full-screen-intent permission, a wake lock for the screen, and
 * a main activity that may show over the lock screen and turn the screen on. Without these Android only shows
 * a heads-up notification on a locked phone.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const PERMISSIONS = [
  'android.permission.USE_FULL_SCREEN_INTENT',
  'android.permission.WAKE_LOCK',
  'android.permission.VIBRATE',
];

module.exports = function withIncomingCall(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] || [];
    for (const name of PERMISSIONS) {
      if (!manifest['uses-permission'].some((p) => p.$ && p.$['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    }
    const app = manifest.application && manifest.application[0];
    const main = app && (app.activity || []).find((a) => a.$ && a.$['android:name'] === '.MainActivity');
    if (main) {
      main.$['android:showWhenLocked'] = 'true';
      main.$['android:turnScreenOn'] = 'true';
    }
    return cfg;
  });
};
