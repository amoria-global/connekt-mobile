/**
 * Grants permissions for waking the display and vibrating when a device notification arrives on Android.
 * Does NOT set showWhenLocked or turnScreenOn on MainActivity so the app UI never opens over the lock screen.
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
    if (main && main.$) {
      delete main.$['android:showWhenLocked'];
      delete main.$['android:turnScreenOn'];
    }
    return cfg;
  });
};
