#!/usr/bin/env node
/**
 * The migration gate of the mobile pipeline.
 *
 * A published OTA update reaches every installed phone on next launch and
 * cannot be pulled back. The runtimeVersion policy is "appVersion", so a
 * phone on 2.1.7 accepts ANY update whose app version reads 2.1.7, including
 * one whose JavaScript needs native code that build never shipped. That
 * update installs and then crashes on launch, with no way to recall it.
 *
 * So before publishing we prove the branch still fits the natives the
 * installed build has, by comparing against .eas/production-baseline.json:
 *
 *   1. app version still equals the installed build's, or phones would never
 *      be offered the update (silent no-op) and we would think we shipped.
 *   2. runtimeVersion policy unchanged, since the whole check rests on it.
 *   3. no runtime dependency added, removed or changed since the build
 *      commit. That is the one class of change that installs and then
 *      crashes. JS-only additions can be allowlisted in the baseline.
 *   4. no native app config change (plugins, permissions, identifiers, new
 *      architecture), which needs a store build rather than an update.
 *
 * eas.json build env is reported but never fails the run: it feeds the EAS
 * fingerprint, not the installed binary.
 *
 * Each platform is checked against the build it actually runs. The top level
 * of the baseline is the Android build (the original shape, so existing
 * callers keep working). An optional "ios" object holds the iOS build's own
 * buildCommit, appVersion and allowedJsOnlyDeps, because iOS and Android ship
 * on different versions and different commits (iOS 2.3.2 vs Android 2.3.1).
 *
 *   node scripts/check-ota-compatibility.mjs                   android (default)
 *   node scripts/check-ota-compatibility.mjs --platform ios
 *   node scripts/check-ota-compatibility.mjs --platform all    both, either fails
 *
 * Needs git history for the build commit, so CI checks out with fetch-depth: 0.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASELINE_PATH = '.eas/production-baseline.json';
const PLATFORMS = ['android', 'ios'];

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function readJsonAt(ref, path) {
  return JSON.parse(git(['show', `${ref}:${path}`]));
}

function argPlatforms() {
  const i = process.argv.indexOf('--platform');
  const value = i === -1 ? 'android' : process.argv[i + 1];
  if (value === 'all') return PLATFORMS;
  if (!PLATFORMS.includes(value)) {
    console.error(`Unknown platform "${value}". Use android, ios or all.`);
    process.exit(2);
  }
  return [value];
}

/** The build a platform's phones run: Android is the baseline's top level, iOS has its own block. */
function baselineFor(baseline, platform) {
  if (platform === 'android') return baseline;
  if (!baseline.ios?.buildCommit || !baseline.ios?.appVersion) {
    console.error(
      'The baseline has no iOS build. Add an "ios" object with buildCommit and appVersion ' +
      '(from `eas build:list --platform ios`) before checking or publishing an iOS update.',
    );
    process.exit(2);
  }
  return { ...baseline.ios, allowedJsOnlyDeps: baseline.ios.allowedJsOnlyDeps ?? baseline.allowedJsOnlyDeps };
}

function check(platform, build) {
  const fail = [];
  const warn = [];
  const ok = [];
  const buildCommit = build.buildCommit;

  // The build commit must be reachable, otherwise every later check is a guess.
  try {
    git(['cat-file', '-e', `${buildCommit}^{commit}`]);
  } catch {
    console.error(
      `Cannot find the ${platform} build commit ${buildCommit} in this checkout.\n` +
      'Fetch full history (actions/checkout with fetch-depth: 0) and retry.',
    );
    process.exit(2);
  }

  const appNow = readJson('app.json').expo;
  const appBase = readJsonAt(buildCommit, 'app.json').expo;
  const pkgNow = readJson('package.json');
  const pkgBase = readJsonAt(buildCommit, 'package.json');

  // 1. Version phones accept.
  if (appNow.version !== build.appVersion) {
    fail.push(
      `app.json version is ${appNow.version}, but installed ${platform} phones run ${build.appVersion}. ` +
      'With the appVersion policy they would never be offered this update. ' +
      'Publish from a branch at the installed version, or ship a store build and update the baseline.',
    );
  } else {
    ok.push(`app version ${appNow.version} matches the installed ${platform} build`);
  }

  // 2. The policy this whole check depends on.
  const policyNow = appNow.runtimeVersion?.policy ?? appNow.runtimeVersion;
  const policyBase = appBase.runtimeVersion?.policy ?? appBase.runtimeVersion;
  if (policyNow !== policyBase) {
    fail.push(`runtimeVersion policy changed (${policyBase} -> ${policyNow}). Re-derive the baseline before publishing.`);
  } else {
    ok.push(`runtimeVersion policy unchanged (${policyNow})`);
  }

  // 3. Native modules. Runtime dependency drift is what crashes phones.
  const allowed = new Set(build.allowedJsOnlyDeps ?? []);
  const depsNow = pkgNow.dependencies ?? {};
  const depsBase = pkgBase.dependencies ?? {};
  const drifted = [];
  for (const name of new Set([...Object.keys(depsNow), ...Object.keys(depsBase)])) {
    if (depsNow[name] === depsBase[name]) continue;
    if (allowed.has(name)) {
      warn.push(`dependency ${name} differs but is allowlisted as JS-only: ${depsBase[name] ?? 'absent'} -> ${depsNow[name] ?? 'removed'}`);
      continue;
    }
    drifted.push(`${name}: ${depsBase[name] ?? 'absent'} -> ${depsNow[name] ?? 'removed'}`);
  }
  if (drifted.length > 0) {
    fail.push(
      'runtime dependencies changed since the installed build:\n    ' + drifted.join('\n    ') +
      '\n  An update carrying these installs and then crashes. Ship a store build, ' +
      'or allowlist the package in the baseline if it is genuinely JS-only.',
    );
  } else {
    ok.push(`all ${Object.keys(depsNow).length} runtime dependencies match the installed build`);
  }

  // 4. Native app config. A key tied to one platform only fails that platform's check.
  const nativeKeys = [
    ['plugins', (c) => JSON.stringify(c.plugins ?? [])],
    ['android.package', (c) => c.android?.package ?? '', 'android'],
    ['ios.bundleIdentifier', (c) => c.ios?.bundleIdentifier ?? '', 'ios'],
    ['android.permissions', (c) => JSON.stringify(c.android?.permissions ?? []), 'android'],
    ['ios.associatedDomains', (c) => JSON.stringify(c.ios?.associatedDomains ?? []), 'ios'],
    ['ios.infoPlist', (c) => JSON.stringify(c.ios?.infoPlist ?? {}), 'ios'],
    ['newArchEnabled', (c) => String(c.newArchEnabled ?? '')],
    ['scheme', (c) => JSON.stringify(c.scheme ?? '')],
  ];
  const configDrift = nativeKeys
    .filter(([, , only]) => !only || only === platform)
    .filter(([, read]) => read(appNow) !== read(appBase))
    .map(([key, read]) => `${key}: ${read(appBase)} -> ${read(appNow)}`);
  if (configDrift.length > 0) {
    fail.push('native app config changed since the installed build:\n    ' + configDrift.join('\n    ') + '\n  These take effect only in a new store build.');
  } else {
    ok.push('native app config (plugins, permissions, identifiers, scheme) unchanged');
  }

  // Informational: fingerprint inputs that do not reach the installed binary.
  try {
    const easDiff = git(['diff', '--name-only', buildCommit, 'HEAD', '--', 'eas.json']).trim();
    if (easDiff) warn.push('eas.json changed since the build commit. It feeds the EAS fingerprint, not the installed natives, so it does not block an update.');
  } catch {
    // A missing eas.json history is not a safety signal; stay quiet.
  }

  const label = `${platform}: ${git(['rev-parse', '--short', 'HEAD']).trim()} vs installed build ${buildCommit.slice(0, 7)} (${build.appVersion})`;
  console.log(`OTA compatibility ${label}\n`);
  for (const line of ok) console.log(`  pass  ${line}`);
  for (const line of warn) console.log(`  note  ${line}`);
  for (const line of fail) console.log(`  FAIL  ${line}`);
  console.log('');
  return fail.length === 0;
}

const baseline = readJson(BASELINE_PATH);
const results = argPlatforms().map((platform) => check(platform, baselineFor(baseline, platform)));

if (results.includes(false)) {
  console.log('This branch must NOT be published as an OTA update.');
  process.exit(1);
}
console.log('Safe to publish to the production channel.');
