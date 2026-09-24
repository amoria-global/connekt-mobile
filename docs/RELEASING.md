# Releasing connekt-mobile

A git push reaches no phone. Installed apps run the JavaScript published to the
`production` EAS channel, wrapped in natives that only a store build can change. This
file is the procedure for getting a fix from a branch to a user.

Everything forks on one question: **does the change touch natives?**

Natives means any runtime dependency added, removed or version-bumped, any `app.json`
plugin, permission, identifier or scheme change, an Expo SDK upgrade, or an app version
bump. Anything else is JavaScript-only.

You do not have to judge that by eye. The gate answers it:

```sh
node scripts/check-ota-compatibility.mjs
```

It compares the branch against `.eas/production-baseline.json`, which records the build
users are actually running. "Safe to publish" means path A. Any refusal means path B, and
the refusal is information, not an obstacle.

## Path A — JavaScript-only, reaches phones over the air

1. Branch off `main`, make the fix, then `yarn typecheck` and `yarn test`.
2. Run the gate. Expect "Safe to publish to the production channel".
3. Merge into `main` with `--no-ff` and push.
4. The rest is automatic:
   - `promote-to-production.yml` runs the tests, asks the gate, and merges `main` into
     `production`.
   - that push runs `production.yml`: verify, test, export the bundle, re-check the gate,
     publish.
5. Verify, per the section below.

Put `[skip publish]` in the commit subject for documentation, CI or bookkeeping commits.

`[skip publish]` survives promotion: `promote-to-production.yml` puts the marker on the
merge subject when every promoted non-merge commit carries it. One unmarked commit in the
range means real JavaScript is being promoted, and the merge publishes as normal. So mark
every commit in a documentation-only batch, or the batch publishes.

## Path B — touches natives, needs a store build

Steps 1 to 3 are identical. The gate then refuses to promote, which is correct. Do not
work around it: publishing JavaScript that imports native modules the installed app does
not contain crashes every phone on launch, and an update cannot be recalled.

4. Build. `autoIncrement` assigns the next version code, so never hand-edit it.

   ```sh
   npx eas build --platform android --profile production
   ```

5. Submit straight to the production track.

   ```sh
   npx eas submit --platform android --profile production --latest
   ```

6. Wait for the submission to report **finished**. A finished build means nothing on its
   own; only a finished submission to the production track means users can install it.
   Check with `npx eas submit:list --platform android --limit 1`.
7. Refresh `.eas/production-baseline.json` from `eas build:list`: `buildCommit`,
   `appVersion`, `runtimeVersion`, `androidBuildNumber`, `androidFingerprint`. Commit with
   `[skip publish]` and push to `main`.
8. Push `main`. The gate now passes, promotion merges, and the matching JavaScript
   publishes.

## Verifying a publish

Never take the CLI's word for it.

- Fetch the manifest a phone would fetch, sending `expo-runtime-version`,
  `expo-channel-name`, `expo-platform` and `accept: multipart/mixed`, and check the update
  id is the one you just published.
- Grep the exported bundle under `dist/_expo/static/js/android/` for the string you
  changed. The CDN refuses direct downloads, so grep the local export.
- `npx eas update:list --branch production --limit 1`, and confirm the runtime version is
  the one phones actually run.

## Rules paid for in production

**Face data needs the same answer in four places.** Apple held iOS 2.2.0 (13) on 2026-09-24
until we documented every face path. Before submitting any iOS build, the App Review Notes
must carry the "FACE DATA" block, and it, privacy policy section 8 and `docs/FACE_DATA.md`
must agree. Any change that captures, sends or stores a face follows the checklist in
`docs/FACE_DATA.md`; `src/features/privacy/faceDataConsent.test.ts` enforces the consent side, and
`scripts/check-store-policy.mjs` runs it inside every store build, so EAS refuses to build a
binary that would repeat a rejection. Add a test to that script for every new rejection.

**A submission to any track burns the version code.** On 2026-09-19 build 10 went up as an
internal draft first. That consumed code 10, and the production submission was then refused
`SUBMISSION_SERVICE_ANDROID_OLD_VERSION_CODE_ERROR`. 2.2.0 sat stranded in internal testing
for four days while every phone stayed on 2.1.7. Use the `internal` submit profile only
when you deliberately want a draft, knowing it costs a code and the next production attempt
needs a fresh build.

**Never reset or force-push `production`.** It carries commits `main` does not, including
the release pipeline itself, the ported Jest suite and the Google sign-in fixes. Let the
promote workflow merge `main` in. The merge is clean and the gate passes on the result;
a reset silently discards that work.

**Never publish from `main`,** and never merge `main` into `production` by hand to force a
release. The gate is the only thing standing between a dependency bump and a crash loop on
every installed phone.

**The baseline is the record of what phones run, not a switch.** Update it only after a
production-track submission reports finished. Editing it to turn a red gate green is the
single change that can break every install at once.

## Credentials

| Secret | Used by | Purpose |
|---|---|---|
| `EXPO_TOKEN` | `production.yml` | publishing OTA updates |
| `PROMOTE_TOKEN` | `promote-to-production.yml` | pushing `production`; the default token is read-only here |

Play submission uses the service account
`ci-cd-deployment-api-access@connekyt-app.iam.gserviceaccount.com`. `eas.json` expects its
key at `./google-play-service-account.json`, which `.gitignore` covers via
`*-service-account.json`. Keep it repo-relative: an absolute path works on one laptop and
resolves nowhere else.

Known gap: no workflow submits to Play. Steps 4 and 5 are manual until a job writes that
key from a repository secret.

## Submit profiles

`eas.json` has two, and the difference is deliberate:

- `production` — Play `production` track, `releaseStatus: completed`. Reaches every user.
- `internal` — `internal` track, `releaseStatus: draft`. For deliberate test uploads.

Before 2026-09-23 the `production` profile pointed at the internal track, so
`eas submit --profile production` did not release to production. That is the mistake that
stranded 2.2.0.
