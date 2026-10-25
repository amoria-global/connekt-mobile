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
JavaScript onto older natives breaks every install. **Never publish an update from `main`.**
Whether the two agree is not a judgement call: `scripts/check-ota-compatibility.mjs`
answers it. They disagreed by 41 runtime dependencies, new config plugins and renamed
Android permissions between 2026-08-23 and 2026-09-23, and the gate blocked every publish
for that month, correctly.

The release line is the `production` branch. It sits on the commit the shipped store build
was made from, plus the JavaScript the gate has cleared, and it carries the gated pipeline
(`.github/workflows/production.yml`): verify, test, build, migrate, deploy. The migrate
stage is `scripts/check-ota-compatibility.mjs` against `.eas/production-baseline.json`, and
deploy publishes automatically once those stages pass on a push to `production`, with
`[skip publish]` in a commit subject as the opt-out, plus a manual `workflow_dispatch` that
also offers a dry run.

`main` reaches `production` through `.github/workflows/promote-to-production.yml`, which
merges it automatically once the gate passes. Never publish from `main`, and never merge
`main` into `production` by hand to force a release past the gate.

When a new store build ships from `main`, refresh `.eas/production-baseline.json` (commit,
app version, build number, fingerprint from `eas build:list`) and let the promote workflow
merge `main` into `production`. Do **not** reset or force-push `production` onto the
build's commit: it carries commits `main` does not, including this pipeline itself, and a
reset discards them silently. The full procedure is in `docs/RELEASING.md`.

**Release notes are part of every release.** The update prompt shows users what is new before they tap
"Update now", and reads it from `expo.extra.releaseNotes` in `app.json`. Before publishing anything user visible, add a
release at the top of that list with one plain-language item per feature or fix (rules in `docs/RELEASING.md`, validated
by `src/features/updates/releaseNotes.test.ts`). Never publish without it.

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

## Design System: Midnight Glass

Every screen follows Midnight Glass. The references in `design/` (`home.png`, `events.png`,
`profile.png`, `brief.png`) are the source of truth; a new screen must read as one of them.

- **Tokens and kit only.** Colour, type, radius, shadow and motion come from `@/theme`
  (`useTheme`, `makeStyles`, `fonts`, `radii`, `spacing`, `shadows`, `motion`). Build with the
  kit in `src/components/ui`: `GlassScene`/`GlassCard`, `GlowOrbs`, `BentoGrid`/`BentoTile`,
  `PrimaryButton`, `AccentButton`, `GhostButton`, `InsetField`/`InsetWell`, `StatusChip`,
  `IconTile`, `SegmentedControl`, `WeekStrip`, `EmptyState`/`ErrorState`, `Skeleton`/`SkeletonList`,
  and the floating glass tab bar in `PersistentBottomBar`. Never hardcode a colour.
  `src/test/hexColors.rule.test.ts` fails on a hex literal outside `src/theme` (ESLint flags it
  too); `eslint/hex-colors-pending.json` lists the files still waiting for migration, and it only
  shrinks. Remove a file from it when you migrate that file.
- **Density: Compact Glass** (`design/compact-glass.png`, `src/theme/density.ts`). Same glass, tighter size: title 22, card title
  14.5 to 16, body 14, caption 11.5 to 12, card padding 10 to 12, gap 8, radius 16/12, icons 16 to 18 in 32 to 36 tiles, tiles 48 to
  56, rows 48 to 52. `makeStyles` applies it to every themed sheet (`compactSheet` for a module-level one; `{ compact: false }`
  for a kit already at density), so write the old design sizes and do not hand-shrink. Tappable means a coloured signal (tint plus 1px
  border, a raised gradient, or coloured text with a chevron); navigation rows end in a chevron; info-only cards stay flat. Buttons:
  Primary 44 raised (one per screen), Secondary 40, Tertiary 36, Chip 32, each with a 44pt hit area (`hitSlop`). Use `ActionTile`,
  `ActionRow`, `StatStrip`, `StatGrid`, `NavGroup`/`NavRow` from `components/ui/Compact` instead of a bento tile for a single action or number.
- **Type.** Space Grotesk (`fonts.display`, `fonts.bold`) for headings, numbers and buttons;
  Inter (`fonts.regular`, `fonts.medium`, `fonts.semibold`) for body and UI. Body 13 to 15.
- **Radius** 14 tile · 20 card · 24 panel · 28 hero · pill. **Spacing** on the 4pt grid.
- **Restraint.** One raised (`PrimaryButton` or `AccentButton`) per screen; every other action is
  a flat `Button`, a `GhostButton` or text. At most 3 glows per screen, the tab bar's pill
  counting as one.
- **Colour means something.** Blue = action, magenta = attention, cyan = live or collaboration,
  amber = pending. Do not use a colour for decoration.
- **Glass needs light behind it.** Glass sits over a `GlassScene` (or `GlowOrbs`), never over the
  flat background alone. Where blur is unsupported it falls back to solid `glassSolid`
  (#16243C); `GlassSurface` handles that, so do not hand-roll a blur.
- **Patterns.** Bento for summaries, glass panels for groups, the raised button for the main
  action. A screen with no reference image applies these.
- **Accessibility.** Touch targets of 44pt or more; text contrast of 4.5:1 or more, checked on the
  brightest glow; nothing floats over a button (the global Help button steps aside, see
  `helpButtonPlacement`). Motion is 180 to 260ms on `motion.easing`, and every animation honours
  `useReducedMotion()`.
- **States.** Every list has an empty state with a next step, a skeleton loading state and an
  error state with a retry.
- **Appearance.** Midnight Glass (dark) is the default; the Profile header's appearance button
  saves light or dark per device (`useTheme().setPreference`). Light mode keeps the same
  structure on the light palette, so both palettes must carry every role.

## Modals use the glass kit

Every `<Modal>` draws the sign-in sheet's frosted glass look from `src/components/ui/GlassModal.tsx`: wrap the
panel in `GlassScrim` (blurred dim, closes on outside tap) and `GlassSheetHost` (the glass panel; `variant="dialog"`
for a centred one), or use the shared `Sheet` / `Alert` dialog, which are built on them. Keep colour, border and radius
out of the host's style, and use `glassTile(c)` / `glassField(c)` for rows and inputs on the glass, never a solid card
colour. `src/test/glassModals.rule.test.ts` fails on a modal that skips this; the only exemptions are full-screen
media viewers, incoming-call screens and native page sheets, each listed there with its reason.

## Google and Apple sign-in

Client ids are per platform and per Google Cloud project, and the type is fixed when the
client is created. Android must use an Android-type client; a Web client is refused with
"Custom scheme URIs are not allowed". iOS uses its own iOS-type client
(`728809448366-69tue...`, bundle `com.connekyt.app`, added 2026-10-09). Its redirect is
`com.connekyt.app:/oauthredirect`, and Expo prebuild already registers the bundle id as a
URL scheme, so no reversed-client-id scheme is needed.

The backend verifies the Google token against its own audience allowlist
(`connekyt.google.allowed-audiences`). Adding a platform means adding its client id there
too, or every login from that platform is refused.

## iOS

An iOS build exists: `build-13.ipa` is 2.2.0 (13), bundle `com.connekyt.app`, signed by
Apple team `Z34A347245` with `aps-environment: production`, so it can receive push.
`eas.json` has the iOS submit profile (App Store Connect app `6811336076`). As of
2026-10-07 the app is going through App Store submission, not released; the open items
are in `~/Desktop/ME/Connekyt-iOS-Submission/`. Push delivery also needs the APNs key on
the EAS project, which isn't visible from the repo; check expo.dev → Credentials.

Build 13 predates the bundled notification sounds (2026-10-07), so custom ringtones on
iPhone need a newer iOS build.

Expo Go can load the JavaScript for a look at the UI, but custom notification sounds,
notification categories (lock-screen buttons), sign-in, push, updates and deep links
behave differently there and prove nothing. Test those on a development or TestFlight
build.

The greenfield sandbox lives at `src/_design-sandbox/` and is git-ignored.

## ⚠️ Payments — read `docs/PAYMENTS.md` before touching anything money-related

Payments complete in the app (see the 2026-09-30 note in `docs/PAYMENTS.md`), but
**digital goods are OFF on native builds** (`digitalPurchasesEnabled` is true only on
web or with `EXPO_PUBLIC_ENABLE_DIGITAL_PURCHASES=true`; no `NODE_ENV` clause). Stream
tickets, gifts, photo purchases, archive unlock, photobook extras and pay-on-TV are
built but absent in store builds. Bookings and donations are exempt and always on.
Never loosen the flag to ship a feature; read `policy.ts` first. Booking balances, photobook extras, archive unlock and
catalog gifts go through `features/payments/CheckoutSheet` (with
`HandoffCheckoutSheet` and `GiftCheckoutSheet` on top). Stream access, donations
and photo purchases use `events/pay`, `donate` and `PhotoCheckoutSheet`. Signed-in gifts (`initiate-gift`), pay-on-TV (`events/pay?device=`) and a free album's
extra photos (PhotoCheckoutSheet, overflow only) are in the app too. Still on the
connekyt.com checkout: group stream packages, and a gift from a viewer who has not
registered yet (the web page registers one).

- **Read `docs/PAYMENTS.md` and the backend's `docs/PAYMENTS.md`** before changing
  any of it. The web flow took seven production defects to get right.
- **One poller.** Use `pollStatus` in `features/payments/nativeCheckout.ts`. It is
  bounded, survives failed reads, ignores a card's early FAILED, and ends in
  `unknown`, never `failed`, when it runs out of time. Never offer a retry from
  `unknown`: the charge may have landed and a retry charges again.
- **Never poll an authenticated status endpoint for a buyer.** Use
  `/public/payments/xentripay/status/{refid}` (or the anonymous-viewer status,
  which also unlocks access).
- **Never send an amount from the client** for a declaration or archive handoff;
  the server sets the price. Gifts are priced by `giftCode`.
- **Pass the operator id through untouched.** Guessing a provider charges the
  wrong network.
- **Lock the form while a card page is open** so a second tap cannot start a
  second charge.
- **Only BOOKING and PHOTOBOOK_EXTRAS are owed** (`isOwedObligation`). Unsettled
  digital declarations are viewers' unfinished purchases, not bills.
- **Always check `action` on the envelope**; HTTP 200 with `action: 0` is a failure.
- **Do not change gateway routing** (no country or redirect the web receiver does
  not send) without an explicit decision.
