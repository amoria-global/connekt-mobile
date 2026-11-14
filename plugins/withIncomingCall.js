/**
 * Grants permissions for waking the display and vibrating when a device notification arrives on Android.
 * Does NOT set showWhenLocked or turnScreenOn on MainActivity so the app UI never opens over the lock screen.
 */
const { withAndroidManifest } = require('expo/config-plugins');

// PLAY-REJECTION-DISABLED (2026-11-04): Google Play refused the 2.3.2 release submission with HTTP 403, "You must let us
// know whether your app uses any full-screen intent permissions". USE_FULL_SCREEN_INTENT is switched off so the release
// can ship. Nothing else was deleted. To bring the lock-screen ring back: answer the Full-screen intent declaration in
// Play Console (Policy and programs, App content), set FULL_SCREEN_INTENT_ENABLED to true here and in
// src/features/hybrid/useCallReadiness.ts, then ship a new store build. Native config only reaches phones via a store build.
const FULL_SCREEN_INTENT_ENABLED = false;

const PERMISSIONS = [
  // Held back by FULL_SCREEN_INTENT_ENABLED above.
  ...(FULL_SCREEN_INTENT_ENABLED ? ['android.permission.USE_FULL_SCREEN_INTENT'] : []),
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
