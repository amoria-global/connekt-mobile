# The next store build: what is waiting on this branch

Branch `feat/next-store-build` holds the changes that need native code. They are **not** merged into `main`, because
adding a native dependency to `main` makes `scripts/check-ota-compatibility.mjs` fail, and the promote workflow then stops
merging `main` into `production`, which blocks every OTA until a store build ships. Run the gate on this branch and it
fails on purpose ("native app config changed", "dependencies the installed build does not have"). Never publish from it.

## What is on it

| Change | Why it needs a store build |
|---|---|
| `expo-clipboard` | The Copy buttons (authenticator key, support code) copy straight to the clipboard instead of opening the share sheet. `utils/copyText.ts` already looks the module up optionally, so no code change is needed. |
| `@sentry/react-native` (+ its config plugin in `app.json`) | Native crash capture and symbolicated stack traces. |
| `features/errors/startReporting.ts` | Starts the SDK (no default PII, no tracing, events scrubbed in `beforeSend`) and sends handled failures through it, tagged `support_code`. On `main` the same file uses the plain-HTTPS sink. |

Keep the branch current with `git rebase origin/main`. It only touches `package.json`, the two lockfiles, `app.json`
(one plugin line), `startReporting.ts`, its test and this file, so rebases are clean.

## Before the store build

1. Rebase on `origin/main`. `yarn install --frozen-lockfile`, `yarn typecheck`, `yarn test`.
2. Decide the store disclosures. The SDK collects crash and diagnostic data, so update **App Store Connect** (App Privacy:
   crash data and performance data, not linked to the user, not used for tracking) and **Google Play** (Data safety:
   crash logs and diagnostics). Both are manual and are yours to submit.
3. Optional, for readable traces: set `SENTRY_AUTH_TOKEN`, organisation and project in the EAS build environment and use
   `getSentryExpoConfig` in `metro.config.js`. Without them the build still works; traces are not symbolicated.
4. Set `EXPO_PUBLIC_SENTRY_DSN` in the build environment (a public ingest key, kept out of the tracked `.env`).

## The build

1. `eas build --profile production --platform android` and `--platform ios` from this branch (bump the iOS version first,
   see `docs/RELEASING.md`).
2. Install the build on a real phone. Check: the Copy buttons copy directly; trigger a handled failure and find its
   support code in Sentry; throw a test native crash and confirm it appears.
3. Submit to the stores.

## After the builds are live

1. Merge `feat/next-store-build` into `main` **in the same commit that refreshes `.eas/production-baseline.json`**
   (commit, app version, build number, fingerprint from `eas build:list`). Then the gate passes and the promote workflow
   carries it to `production`.
2. Do not reset or force-push `production`; see `docs/RELEASING.md`.
3. The plain-HTTPS sink (`sentrySink.ts`) stays in the code as the fallback.
