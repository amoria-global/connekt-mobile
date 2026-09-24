#!/usr/bin/env node
/**
 * Refuses to build a store binary that store review has already rejected us for.
 *
 * Wired as the `eas-build-post-install` hook, so EAS runs it inside every
 * build, on EAS servers or with --local, whoever starts it and from whatever
 * branch, as long as the commit contains this file. It fails the build before
 * any native compile, which costs a minute instead of a review cycle.
 *
 * Each test below pins a rejection we already paid for:
 *   - Apple, 2026-09-24, Guideline 2.1 face data: every face capture must sit
 *     behind a consent notice that names AWS (see docs/FACE_DATA.md).
 *   - Google Play, 2026-09-23, Photo and Video Permissions: no READ_MEDIA_*.
 *
 * Development builds are skipped so a broken consent string never blocks a
 * dev client. Set STORE_POLICY_CHECK=1 to force it, e.g. before a local build.
 * Add a test to TESTS whenever a store rejects us for something new.
 */
import { spawnSync } from 'node:child_process';

const TESTS = [
  'src/features/privacy/faceDataConsent.test.ts',
  'src/config/androidPermissions.test.ts',
];

const STORE_PROFILES = new Set(['production', 'production-apk', 'preview']);
const profile = process.env.EAS_BUILD_PROFILE;
const forced = process.env.STORE_POLICY_CHECK === '1';

if (!forced && profile && !STORE_PROFILES.has(profile)) {
  console.log(`store policy check skipped for build profile "${profile}"`);
  process.exit(0);
}

console.log(`store policy check for ${profile ? `build profile "${profile}"` : 'this tree'}`);
const run = spawnSync('npx', ['jest', '--ci', '--runTestsByPath', ...TESTS], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

if (run.status !== 0) {
  console.error(
    '\nThis build would reintroduce a store rejection, so it was stopped.\n' +
      'Read the failing test above and docs/FACE_DATA.md, fix it, then build again.',
  );
  process.exit(run.status ?? 1);
}
console.log('store policy check passed');
