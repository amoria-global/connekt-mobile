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
JavaScript onto older natives breaks every install. So publish hotfixes from a vehicle
branch: branch off the commit the shipped build was made from, cherry-pick only the fix,
then `eas update --branch production --platform <os>` from there. Confirm the shipped
commit with the EAS build list before choosing the base.

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
