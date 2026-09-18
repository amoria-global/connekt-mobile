@AGENTS.md

# Connekyt Mobile — Project Instructions

> Shared rules (repo map, deploy paths, UI design directive, commit and prose
> conventions) live in `~/.claude/CLAUDE.md` and load automatically. This file only
> carries what is specific to this repo.

Expo (React Native) app using expo-router. Styling is React Native `StyleSheet` with design
tokens from `@/theme` (`colors`, `spacing`, `radii`, `fontSize`, `fontWeight`). There is no
Tailwind, no NativeWind and no HTML here, so apply the shared design directive in React
Native terms.

## Web and mobile parity

This app stays in feature parity with the web dashboard and landing. When a feature is
built or changed on either side, mirror it here against the same
`backend.connekyt.com` contract. Say explicitly when a change needs mirroring rather than
shipping one platform silently.

## Shipping to installed apps

A git push reaches nobody. Installed apps pull JavaScript from the `production` EAS channel.

`main` may sit on an Expo SDK newer than the natives users are running, and publishing that
JavaScript onto older natives breaks every install. So the `production` branch, not `main`,
is what installed phones run. It sits on the commit the shipped store build was made from,
plus cherry-picked JavaScript-only fixes. Never publish an update from `main`.

The flow mirrors the backend's pipeline, in `.github/workflows/production.yml`:
verify (typecheck) then test then build (`expo export`) then migrate then deploy.

- **migrate** is `scripts/check-ota-compatibility.mjs`. It compares the branch against
  `.eas/production-baseline.json`, which records the commit, app version and fingerprint
  of the installed build. It refuses the publish when the app version no longer matches
  what phones run, when the `runtimeVersion` policy changed, when any runtime dependency
  was added, removed or bumped, or when native app config changed (plugins, permissions,
  identifiers, scheme). Those changes need a new store build, not an update. The
  `runtimeVersion` policy is `appVersion`, so phones accept any update that claims their
  version, which is exactly why this gate exists.
- **deploy** publishes automatically once every stage above passes, the same way a push to
  the backend's `production` deploys. It needs the `EXPO_TOKEN` repository secret (an
  account-level Expo robot token) and uses the commit subject as the update message.
  - Put `[skip publish]` in the commit subject for CI, test or documentation commits that
    should not reach phones.
  - A manual `workflow_dispatch` run still works: type `publish` to ship, or leave it blank
    for a dry run that checks the credential with `eas whoami`, re-runs the gate and
    publishes nothing.
  - A bad update is recovered by publishing a good one (or republishing the previous
    update); phones pick it up on their next launch, so keep the fix small and fast.
- Run the gate locally before asking for a publish: `node scripts/check-ota-compatibility.mjs`.
- When a new store build ships from `main`, point `production` at that build's commit and
  update `.eas/production-baseline.json` (commit, app version, build number, fingerprint
  from `eas build:list`).
- GitHub Free gives private repos no branch protection and no required reviewers, so
  nothing enforces review on `production`. The manual publish step is the real gate.

Verify a publish two ways, never by trusting the CLI output alone:

- Fetch the manifest a phone would fetch, with headers `expo-runtime-version`,
  `expo-channel-name`, `expo-platform` and `accept: multipart/mixed`, and check the update
  id matches what you just published.
- Grep the exported bundle under `dist/_expo/static/js/<platform>/` for the string you
  changed. The CDN refuses direct downloads, so grep the local export.

The Expo project is `@amoria-global-tech-ltd/connekt-mobile`. `.env` is tracked in this
repo and its `EXPO_PUBLIC_*` values are inlined at publish time, so check it before
publishing; an exported shell variable wins over it, which makes a stale `.env` easy to
miss.

## Google and Apple sign-in

Client ids are per platform and per Google Cloud project, and the type is fixed when the
client is created. Android must use an Android-type client; a Web client is refused with
"Custom scheme URIs are not allowed". iOS has no client configured, so the Google button
does not offer sign-in there.

The backend verifies the Google token against its own audience allowlist
(`connekyt.google.allowed-audiences`). Adding a platform means adding its client id there
too, or every login from that platform is refused.

## iOS

No iOS build has ever been produced and no Apple team is linked to the EAS project.
Expo Go can load the JavaScript for a look at the UI, but sign-in, push notifications,
updates and deep links all behave differently there and prove nothing. A real iPhone build
needs an Apple Developer membership first.

The greenfield sandbox lives at `src/_design-sandbox/` and is git-ignored.

## ⚠️ Payments — read `docs/PAYMENTS.md` before touching anything money-related

**This app does not take payments.** No phone collection, no MoMo/card picker,
no gateway polling, no settlement. Every paid flow opens the connekyt.com web
checkout in the in-app browser (`src/features/payments/webCheckout.ts`).

That means the **web client owns payment correctness and this app inherits its
fixes automatically** — a web payment fix reaches mobile buyers with no app
release, and no change here can repair a web payment bug.

- **Do not build a native payment flow** without reading `docs/PAYMENTS.md`
  and the backend's `docs/PAYMENTS.md`. The web flow took seven production
  defects to get right, including one where anonymous buyers were told a
  successful payment had failed and offered a retry that charges again.
- **Do not wire up the dead payment helpers** in `features/photos/api.ts`,
  `features/streams/api.ts` or `features/donations/api.ts`. They are defined
  and never called, and they are flagged in place.
- **Never poll an authenticated status endpoint for a buyer.** Photo and
  stream buyers are anonymous; use `/public/payments/xentripay/status/{refid}`.
- **Never send an amount from the client.** `mintHandoffUrl` sends none by
  design so the server sets the price.
- **The in-app browser is a separate storage jar.** Nothing the checkout
  writes to localStorage is readable here. Delivery relies on the emailed
  unlock code.
- **Always check `action` on the envelope** — the backend returns HTTP 200 for
  failures, so `action: 0` with a 200 is a failure.
