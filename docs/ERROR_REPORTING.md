# Error reporting

What a person sees when something fails is decided by `features/errors/presentError.ts` and the catalogue beside it. This
file covers the other half: how the failure reaches the team.

## The support code ties both halves together

- The backend gives every unexpected failure a support code (`ApiErrors.unexpected`), logs the real exception under it,
  and returns it in the response body as `supportCode`.
- The app shows that code on the sheet or full-screen error ("Support code 7F3-A2C") with a Copy button, and sends it
  with the report as the tag `support_code`.
- Support asks for the code, searches `support_code:7F3-A2C` in Sentry, and finds the backend event and the app event.

## What is reported, and what never is

Reports go through `report.ts`. Before anything leaves the device it removes emails, phone numbers, bearer tokens,
JWTs, card-length digit runs, and the value of any key that looks secret (`password`, `token`, `otp`, `code`, `email`,
`phone`, `key`, `account`, `card`, and so on). `errorCode` stays readable. Request bodies and payment details are not
sent at all. Events are limited to 10 a minute and the same failure is sent once a minute.

## Turning it on (mobile)

`startErrorReporting()` runs once from `ErrorHost` in the root layout. It does nothing unless a DSN is set:

    EXPO_PUBLIC_SENTRY_DSN=https://<key>@<host>/<projectId>

Put it in the shell that publishes, or in `.env` (the DSN is a public ingest key by design, but `.env` is tracked, so
prefer the shell). The value is inlined at publish time, so a phone only reports after the next update that carries it.

## Today: plain HTTPS, no SDK

`sentrySink.ts` speaks Sentry's envelope format directly. It needs no native module, so it works on every installed
build and ships in an OTA update. It reports handled failures (the same ones the user is shown) and uncaught JavaScript
errors (`ErrorUtils.setGlobalHandler`, passing on to the previous handler so crash behaviour is unchanged).

It does not capture native crashes or symbolicated stack traces.

## Next store build: the full SDK

`@sentry/react-native` carries native code, so it cannot ride an OTA update, and adding it to `package.json` on `main`
would trip `scripts/check-ota-compatibility.mjs` and stop every later OTA until a store build. It therefore lives on the
long-lived branch `feat/next-store-build` (with `expo-clipboard`), which is not merged into `main`. When the next store
build is made from that branch:

1. Merge it into `main` together with the `.eas/production-baseline.json` refresh (commit, version, build number,
   fingerprint) described in `docs/RELEASING.md`.
2. The plain-HTTPS sink keeps working beside the SDK, so nothing is lost between OTA and store build.
