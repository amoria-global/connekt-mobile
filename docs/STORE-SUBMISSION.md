# Submitting Connekyt to the stores

What is already configured, what is still missing, and the order to do it in.

Everything here is about a **first** submission. The app has never shipped:
`android.versionCode` is 1 and nothing has been uploaded to either store.

---

## Before anything: run the app

The app has not successfully run since the SDK 54 → 57 upgrade. Expo Go cannot
boot it — it fails with `Cannot find native module 'ExpoAsset'` and
`"main" has not been registered`, because Expo Go ships a fixed set of native
modules per SDK and this project now needs ones it does not carry.

A development build fixes that:

```bash
eas build --profile development-simulator --platform ios
# install the artifact, then:
npx expo start --dev-client
```

**Do not submit before someone has used the app end to end.** A review queue is
an expensive place to discover a crash on launch.

---

## Android — closest to ready

Configured already:

| | |
|---|---|
| `build.production` | app-bundle, autoIncrement, production API |
| Google client ID | baked into the build env |
| `submit.production.android` | track `internal`, releaseStatus `draft` |
| `adaptive-icon.png` | 1024×1024 |
| package | `com.amoria.connekyt.app` |

**Missing: `google-play-service-account.json`.**

1. Google Play Console → Setup → API access → create a service account.
2. Grant it *Release manager* on this app.
3. Download the JSON key to the repo root as `google-play-service-account.json`.
   It is gitignored — confirm with `git check-ignore google-play-service-account.json`
   before you do anything else. **Never commit it.**

Then:

```bash
eas build  --profile production --platform android
eas submit --profile production --platform android
```

It lands on the **internal** track as a **draft**, so nothing reaches the public
until you promote it. Internal testing has no review wait, which makes it the
fastest honest way to get the app onto real phones.

---

## iOS — one real blocker

`submit.production.ios` now exists but reads three values from the environment,
so no identifiers live in this repo:

```bash
export EXPO_APPLE_ID=...        # the Apple ID email that owns the app
export EXPO_ASC_APP_ID=...      # App Store Connect → App Information → Apple ID (numeric)
export EXPO_APPLE_TEAM_ID=...   # developer.apple.com → Membership
```

**The blocker is Google sign-in.** `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` is now
referenced by the build profile but has no value, so the button renders
"not configured". Shipping a visibly dead sign-in button invites a
**guideline 2.1 (app completeness)** rejection.

To fix it you need an **iOS** OAuth client — not the web one:

1. Google Cloud Console → Credentials → Create OAuth client ID → **iOS**.
2. Bundle ID: `com.connekyt.app`.
3. Store it as an EAS secret, so it never enters the repo:

```bash
eas secret:create --scope project \
  --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value <the ios client id>
```

> **Check which Google Cloud project first.** The consent screen on a previous
> attempt read **"Ikibandoh"**, which is not a Connekyt project. Creating the
> client in the wrong project wires the app to someone else's OAuth app.

A web client ID cannot substitute here. They are different client types with
different allowed redirect URIs — https for web, a custom scheme for native —
and using the web one produces exactly this:

```
Error 400: invalid_request
Custom scheme URIs are not allowed for 'WEB' client type.
```

Then:

```bash
eas build  --profile production --platform ios
eas submit --profile production --platform ios
```

---

## Sign in with Apple

Already implemented and correctly configured: the
`com.apple.developer.applesignin` entitlement is in the generated
`Connekyt.entitlements`, `expo-apple-authentication` is in the Podfile, and the
bundle id matches the backend's allowed audience.

This matters for review: **guideline 4.8 requires Sign in with Apple wherever
another third-party sign-in is offered.** Since the app offers Google, Apple is
not optional. It renders nothing on Android and on iOS below 13, which is
correct behaviour, not a gap.

---

## Readiness at a glance

| | Android | iOS |
|---|---|---|
| Build profile | ready | ready |
| Icons | ready | ready |
| Submit config | ready | ready, needs 3 env values |
| Google sign-in | ready | **needs an iOS client ID** |
| Apple sign-in | n/a | ready |
| Credentials to obtain | Play service account JSON | Apple ID, ASC app ID, team ID |
| Run on a device | **not yet** | **not yet** |

Android can reach internal testing as soon as the service account key exists.
iOS needs the Google client ID resolved first, or it ships with a broken button.

---

## Two things that will bite later

**An SDK upgrade cannot ship over the air.** OTA carries JavaScript only.
Anything touching native code — an SDK bump, a new module, an entitlement —
needs a fresh build and a store release. `runtimeVersion` is
`{"policy": "appVersion"}`, so bumping `version` correctly fences older binaries
off from updates meant for newer ones.

**Never commit a credential.** The service account JSON is gitignored, the
client IDs go in EAS secrets. The backend repo had live payment credentials
committed for months; a gitleaks job now blocks that there, and this repo should
not repeat it.
