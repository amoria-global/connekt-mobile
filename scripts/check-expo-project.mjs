#!/usr/bin/env node
/**
 * Guards the app's Expo identity.
 *
 * On 2026-09-12 a commit repointed app.json at a personal Expo project
 * because the signed-in account could not read the organisation's one. The
 * commit believed the app had never shipped. It had: the Android store build
 * dated 2026-08-23 lives in the organisation project, and phones fetch their
 * updates from it. A store build made under the wrong project would have
 * taken users onto a channel this organisation cannot publish to, and no
 * error would have appeared anywhere.
 *
 * The same commit also left two "owner" keys in app.json. JSON keeps the
 * last, so the config silently resolved to the personal account while the
 * file still read as the organisation's at a glance. Hence the raw-text
 * duplicate check below: parsing alone would not have caught it.
 *
 * If the app ever genuinely moves to another Expo project, change EXPECTED
 * here in the same commit, and say in the message how installed users keep
 * receiving updates.
 */
import { readFileSync } from 'node:fs';

const EXPECTED = {
  owner: 'amoria-global-tech-ltd',
  projectId: 'd81fbfa6-f576-4450-97c6-c443332179be',
  updatesUrl: 'https://u.expo.dev/d81fbfa6-f576-4450-97c6-c443332179be',
};

const raw = readFileSync('app.json', 'utf8');
const problems = [];

// Duplicate keys parse silently, so read the text as well as the object.
for (const key of ['owner', 'projectId', 'url', 'version']) {
  const hits = raw.match(new RegExp(`"${key}"\\s*:`, 'g')) ?? [];
  const limit = key === 'url' ? 1 : 1;
  if (hits.length > limit) {
    problems.push(`app.json declares "${key}" ${hits.length} times. JSON keeps the last one, so the effective value is not the one you read first.`);
  }
}

const expo = JSON.parse(raw).expo;
const actual = {
  owner: expo.owner,
  projectId: expo.extra?.eas?.projectId,
  updatesUrl: expo.updates?.url,
};

for (const [key, want] of Object.entries(EXPECTED)) {
  if (actual[key] !== want) {
    problems.push(`${key} is ${actual[key] ?? 'missing'}, expected ${want}`);
  }
}

if (problems.length > 0) {
  console.error('Expo project identity has drifted:\n');
  for (const p of problems) console.error(`  - ${p}`);
  console.error(
    '\nBuilding or publishing from a different project cuts installed phones off from\n' +
    'updates, silently. If the move is deliberate, update EXPECTED in\n' +
    'scripts/check-expo-project.mjs in the same commit.',
  );
  process.exit(1);
}

console.log(`Expo project: ${actual.owner} / ${actual.projectId} (app version ${expo.version})`);
console.log('Identity matches the project that serves installed phones.');
