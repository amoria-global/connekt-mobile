# Photographer workspace audit (2026-10-14 to 15, final pass)

Scope: photographer Home, Wallet (Overview, Analytics, Activity), Events calendar and list, Analytics,
Photobooks (photographer side) and the shared pieces they use. Branch `feat/photographer-workspace-redesign`.
Evidence is code, backend source (`PhotographerDashboardController`, `PhotographerAnalyticsService`,
`EcoWalletController`, `WalletController`, `SeoLookupController`), the web checkout (`connekt-dashboard`,
`connekyt-landing`) and an Android emulator run (see "Verification"). Customer, merchant and admin dashboards and the
live-stream experience were not touched.

## Screen by screen

| Screen | Change |
|---|---|
| Home (`PhotographerHome.tsx`) | Rewritten (about 2540 lines to about 620). Order: greeting and privacy eye, available and pending cards, four actions, bookings awaiting a reply, next shoots, business overview, goals, recent earnings, recent clients. Repeated small items are horizontal carousels that show the next card; earnings stay a vertical list. Every section has its own loading, empty and error state. The Today/Week/Month selector, the hardcoded USD goal presets, inline search and the donut card were removed (reasons below). |
| Home goals (`GoalsSection.tsx`, `plans.ts`) | New. Persisted through `/photographer/plans` (GET, POST, PUT, DELETE), the contract the web uses. Create, edit, delete with confirmation, validation that mirrors the server. Nothing is shown as saved until the server accepts it. |
| Wallet (`wallet.tsx`, `WalletAnalytics.tsx`) | Photographers get Overview, Analytics and Activity tabs. Other roles are unchanged (one screen). Activity can load older pages (`useMovementPages`). |
| Transactions (`transactions.tsx`) | Same "Load older transactions" paging. |
| Events (`PhotographerEventsDashboard.tsx`, `ScheduleView.tsx`, `schedule.ts`) | One view switch (Month, Week, Agenda, List) instead of two stacked switches. Conflict banner only for genuine overlaps. Remove (dismiss) action on completed or cancelled events. Filter counts show a dash until the list has loaded. Creating an event is a `New` button in the search row in every mode; the floating button is gone, so nothing floats over a card or the pager. Sort shows in List mode only. |
| Analytics (`analytics.tsx`) | Failures are shown with a retry instead of zeros, `N/A` for unknown, "No reviews yet" instead of a fabricated 5.0, period changes cannot be overwritten by a slow older answer. Found on the emulator: the cards said "Total Earnings $4,820" under a "This week" tab, with a period sparkline beside it. The endpoint has no period, so the cards are now "Lifetime earnings", "Pending release", "Clients served", "Lifetime bonuses", the sparklines are gone from them, and a line under the tabs says totals are all time and the period moves trends and charts. |
| Photobooks (`photobooks.tsx`, `photobook/[id].tsx`) | Photographers get a "Received from clients" shelf (the web's received photobooks) with read, resubmit and remove. The shelf refreshes quietly when the screen regains focus, so a resubmitted or removed book is not shown stale. A lone card keeps one column's width. No create button and no customer share link on a received book. |
| Home chrome (`KycBanner.tsx`, `TopBar.tsx`) | The identity banner has a `compact` mode (title, one action, dismiss) used on Home, so the first screen shows balances. The top bar tint is more opaque on Android, which has no real blur, so content scrolling under it no longer shows through as clutter. |
| Shared (`kit.tsx`, `useAsync`, `useForegroundPolling`) | New kit components, race-safe `useAsync` with a quiet refresh, lifecycle-aware polling hook. |

## Defects fixed and root causes

| Sev | Defect | Root cause | Fix |
|---|---|---|---|
| P0 | Home "this week / month" earnings were lifetime totals; the period selector changed labels only | `getPhotographerAnalytics()` has no period; `totalEarnings` is `available + withdrawn` | Selector removed, figure labelled "Lifetime earnings", periods live on Analytics |
| P0 | A failed load showed `$0` and the new-creator state | Home never read `analytics.error` or `wallet.error` and used `?? 0` | `N/A` plus inline error and retry |
| P0 | Analytics showed a `5.0` rating with no reviews | `averageRating ?? 5` | "No reviews yet" |
| P1 | A refused events request showed "No upcoming events" | `listPhotographerEvents` used `api.get`, so HTTP 200 + `action:0` was an empty list | `requireOk` |
| P1 | Photographers could not see photobooks clients sent them | Mobile read only `/customer/events/photobooks` (books the user owns as a customer); the web reads `/photographer/photobooks` for received books | New received shelf, detail through `/photographer/photobooks/{id}`, resubmit, dismiss |
| P1 | Photobook lists and details read refused requests as empty | plain `api.get` | `getOk` |
| P1 | Transaction history stopped at 50 rows with no way to see more | Fixed `listWalletMovements(0, 50)`; `/wallet/me/movements` is a Spring Page (`last`, `page`, `size`) | `listWalletMovementsPage` + `useMovementPages` (de-duplicates, stops when a page adds nothing, keeps what is shown on error) |
| P1 | A slow old response could overwrite a newer one (period or filter change) | No stale guard in `useAsync` or analytics `load` | Ticketed requests |
| P1 | Home labelled USD ledger values with the wallet currency | Analytics totals and `amountInUsd` formatted with `wallet.currency` | Formatted as USD |
| P1 | Opportunities were polled twice with no lifecycle awareness | Home ran its own 6 s timer (rebuilt every render) next to the global 5 s notifier, never paused when the app was backgrounded or Home was not focused | `useForegroundPolling`: only while focused and active, one catch-up tick on return, never overlapping |
| P2 | Pull-to-refresh spinner flashed every 6 s | poll used foreground `refresh` | `refreshQuietly` |
| P2 | "Today" wrong before 02:00 in Rwanda | UTC date | Local day keys |
| P2 | Declined booking counted as upcoming | `statusOf` had no DECLINED case | Shared `bucketOf` |
| P2 | Carousels virtualised away later cards | `initialNumToRender={3}` | Short previews render in full |
| P2 | Share profile sent the site home page | Hardcoded `https://connekyt.com` | Landing route `/photographers/{slug}`, slug from the public `slug-for` lookup, site home only as the fallback |
| P2 | No way to remove a finished event | Web has Dismiss, mobile did not | `dismissPhotographerEvent`, completed or cancelled only |
| P3 | Hardcoded USD goal presets, never saved | Local state | Replaced by the persisted goals |
| P1 | Analytics showed lifetime totals as if they were for the selected period | `/photographer/analytics` has no period; the screen titled them "Total Earnings" under Today/Week/Month tabs and drew period sparklines beside them | Titles say lifetime, sparklines removed, explanatory line, regression test |
| P2 | Large system text: the "Agenda" tab became "Agen...", status badges were clipped | single-line labels | Tabs shrink to fit (capped at 1.4x), badges may wrap to two lines |
| P2 | The floating create button covered a card edge, the pager and the last card; the identity banner took a third of the first screen | absolute FAB, full-height banner | In-flow `New` button, compact banner |
| P3 | Found on the emulator: metric labels cut to "Available to w...", action buttons cut at 1.6x text size, goal card indented twice, period tabs misaligned in the goal form | single-line labels, fixed-height buttons, doubled side margins | Labels and captions wrap, buttons grow, margins cancelled |

## Parity matrix (photographer)

Status: C complete, P partial, M missing, B blocked by backend, I intentionally different, U unverified.

| Capability | Web | Mobile | Status | Evidence |
|---|---|---|---|---|
| Wallet available / pending | `/wallet/me`, pending = `pendingAmount + heldForDelivery` | same formula via `selectWalletStats` | C | `moneyView.ts` |
| Transaction history | `/photographer/transactions`, server paged | `/wallet/me/movements`, first 50 then older pages on demand | C (a different but equivalent endpoint, paged by the server) | `useMovementPages.test.tsx`, `walletTab.render.test.tsx` |
| Withdraw, payment accounts | `/withdraw/*` | `withdraw.tsx`, `payment-accounts.tsx` | C (not exercised, would move money) | `features/withdrawals/api.ts` |
| Goals (plans) | `/photographer/plans` CRUD | `GoalsSection` over the same CRUD (create, edit, delete verified on the emulator against a fake backend, not the real API) | C. Earnings and client progress is not drawn because the server has no per-period single-currency figure; the rating progress is real | `GoalsSection.test.tsx` |
| Booking accept / decline | `/photographer/events/{id}/accept|decline` | same | C | `events/api.ts` |
| Event dismiss | `POST /photographer/events/{id}/dismiss`, shown when the event has an album | Same endpoint, shown for completed or cancelled events (verified on the emulator against a fake backend) | P. The album list the app has carries no `eventId`, so the web's "has an album" gate cannot be reproduced. The server only checks assignment | `photographerApi.test.ts` |
| Photobooks I made | `/events/photobooks` (customer) | same | C | `photobooks/api.test.ts` |
| Photobooks received from clients | `/photographer/photobooks` | same, read, resubmit, remove (verified on the emulator against a fake backend) | P. Editing the book (`PUT`, media picker) is not built | `photobooks/api.test.ts` |
| Event media upload, list, delete | `/events/{id}/media/upload`, `/photographer/events/{id}/media[/id]` | none | I. On the web these only stage images into the album form (the upload helper has no caller); mobile uploads straight into the album (`createEventAlbum`, `addAlbumImages`) | `events.tsx` `uploadMediaToEvent`, `gallery/api.ts` |
| Live stream start, stop, pause, resume, reset, config | `/photographer/events/{id}/stream/*` | same, in `stream/control/[id].tsx` | C (not exercised) | `streams/photographer.ts` |
| Opportunities accept / decline | `/photographer/opportunities/*` | same, plus alert modal | C | `hybrid/api.ts` |
| Album collaboration | `/photographer/collab/*` | same | C | `collab/api.ts` |
| Share profile | `https://connekyt.com/photographers/{slug}` | same, slug from the public lookup, home page fallback | C. Unit tested; the slug lookup was not run against production | `profileLink.test.ts` |
| Calendar Month / Week / Agenda | none | added | I (mobile ahead) | `ScheduleView.tsx` |
| Schedule conflicts | server 409 only | client flag, genuine overlaps only | I | `schedule.ts` |
| Bonus / milestone status | `/photographer/bonus-status` | none | M | grep of mobile |
| Earnings report export | print only | opens `/payroll`, no share or PDF | P | `payroll.tsx` |

## Blocked by backend (documented, not faked)

- **Period earnings in a currency.** `/photographer/analytics/trends` and `/performance` sum payments in each payment's own currency. Mobile shows counts, change percentages and a relative-size chart with no currency.
- **Goal progress for earnings and clients.** Needs the same per-period figures.
- **Booking milestones with release status** (50/20/30), **collaboration invitations with a fee**, **gallery delivery deadlines**, **Year range and "released this month"**, **period ledger reconciliation**: no photographer endpoint or field.
- **Album `eventId` in the photographer album list** (summary DTO leaves it unset), which blocks the web's dismiss gate.

## Scrolling decisions

- Horizontal carousel (next card peeks, snaps per card, `directionalLockEnabled`): bookings awaiting a reply, next shoots, business overview figures, goals, recent clients. All are short repeated cards.
- Vertical: recent earnings, transactions, the chronological agenda, the week's day list, forms. Dense or long data stays vertical.
- Week days are a short horizontal strip (7 items) over a vertical list. No same-direction nesting. Long lists remain virtualised.

## Verification (commands run on the final tree)

| Check | Command | Result |
|---|---|---|
| Types | `npx tsc --noEmit` | exit 0 |
| Tests | `npx jest` | 67 suites passed, 510 tests passed, 1 skipped (clean `main` was 52 suites, 407 tests) |
| Lint | per touched file, `npx eslint <file>` against the same file from `git show af5ef62:<file>` (clean `main`) | no touched file has more errors than on `main`, and every new file is clean; the per-file counts are in "Lint comparison" below |
| OTA gate | `node scripts/check-ota-compatibility.mjs` | refuses: 41 native dependency versions and the config plugins differ from the installed build, "This branch must NOT be published as an OTA update". `main` already has the same refusal; this work changes no dependency and no `app.json` |

New regression tests (react-test-renderer, the repo's style): `useAsync.test.tsx` (first load, failure then retry, newer-before-older, older failure after newer success, failure keeps previous data, overlapping foreground requests, quiet tick superseding a foreground request, unmount), `useForegroundPolling.test.tsx` (interval, background pause and catch-up, no overlap, disabled and cleanup), `useMovementPages.test.tsx` and `walletTab.render.test.tsx` (paging), `GoalsSection.test.tsx`, `photobooks/api.test.ts`, `events/photographerApi.test.ts`, `PhotographerEventsDashboard.render.test.tsx` (one switch, creation without a floating button, Sort only in List, Remove only on finished events, confirm then dismiss, a refusal keeps the event), `KycBanner.compact.test.tsx`, `ScheduleView.test.tsx` (controlled mode), `photographerAnalytics.render.test.tsx` (lifetime labels), `profileLink.test.ts`, `PhotographerHome.render.test.tsx`, `schedule.test.ts`, `WalletAnalytics.test.tsx`, `money.test.ts`.

### Native verification (Android emulator)

Environment: Pixel 5 emulator (`Pixel5_API34`, 1080x2340, API 34) from the Android SDK already on this machine (`adb` lives in `platform-tools`, just not on `PATH`), the existing debug APK, and JavaScript from this branch served by Metro. There is no iOS tooling on this Windows machine (no Xcode, no simulator), so **iOS was not run**.

Data: no photographer test login exists in this environment, so the app talked to a fixture backend, not production. It was a fake `fetch` plus a temporary auth bypass, kept in the git-ignored `src/_design-sandbox/` and a one-line edit of `src/store/auth.ts`. Both were deleted afterwards, and `git status` and `git diff` show neither. The fake backend held state in memory and could be told to fail, so create, edit, delete, resubmit and dismiss really changed what the screens showed. That proves the app's behaviour, not the real server's. No bookings, withdrawals or transfers were made.

Inspected on the emulator, with screenshots:
- Home: compact identity banner under the top bar, balances and the four actions in the first viewport, carousels peeking and scrolling, goals, recent earnings and clients.
- Wallet: Overview, Activity with 50 rows, "Load older transactions" appending 31 more (one repeated row dropped, total 80, button then gone), Activity empty state, Activity failed state.
- Events: the Month/Week/Agenda/List switch, conflict banner and badges, Agenda scrolling with no floating button, List mode with Sort, Remove on a completed and a cancelled event (confirm dialog, server refusal message with the event kept, success with the event gone).
- Goals: new goal with the soft keyboard (sheet, numeric keypad, Save), the new goal appearing first in the carousel, the edit form preloaded, delete with confirmation.
- Photobooks: the "Received from clients" shelf with status chips, a book's detail, Resubmit (confirm, status became Resubmitted), Remove (confirm, back on the shelf with the book gone).
- Analytics: the finished screen (lifetime titles, all-time note, rating 4.6/5, empty trajectory state).
- Larger text (font scale 1.6): Home, and Events Agenda with the switch, badges and conflict banner after the fixes.

Not inspected natively: iOS, dark theme, the Analytics screen's failed state, a real photographer account, real payment or withdrawal flows, tablet sizes. Gestures were `adb` swipes and taps.

### Lint comparison

Each touched file was linted and compared with the same file taken from `main` (`af5ef62`):

| File | errors / warnings now | on `main` |
|---|---|---|
| `app/(app)/(tabs)/wallet.tsx` | 2 / 0 | 3 / 0 |
| `app/(app)/analytics.tsx` | 1 / 5 | 1 / 5 |
| `app/(app)/transactions.tsx` | 3 / 1 | 3 / 1 |
| `app/(app)/photobooks.tsx` | 0 / 0 | 0 / 2 |
| `features/dashboard/PhotographerHome.tsx` | 0 / 0 | 4 / 9 |
| `features/events/PhotographerEventsDashboard.tsx` | 1 / 2 | 1 / 2 |
| `hooks/useAsync.ts` | 2 / 0 | 2 / 0 |
| `features/wallet/walletTab.render.test.tsx` | 0 / 1 | 0 / 1 |
| every other touched or new file (28 files) | 0 errors | 0 errors or new |

The remaining errors are the React-compiler rules (`set-state-in-effect`, refs during render, skipped memoization) in code that was already there. The only warnings in new tests are the repo's usual `require()` fixture loads.

## Confirmed pre-existing failures

React-compiler lint errors listed above (identical to `HEAD`). `MultipleDonutOverviewCard.tsx` is now dead code, but `moneyHonesty.test.ts` reads its source, so it was left in place.

## Remaining dependencies and risks

1. Backend: the items in "Blocked by backend".
2. Editing a received photobook, `bonus-status`, and a share or PDF export of the earnings report are not built.
3. Production profile link: `slug-for` is public and unit tested here, but was not called against production.
4. Release: nothing was published. Work stays on this branch; the release line is `production` through the OTA gate (`docs/RELEASING.md`), never from `main`.

## Release status

How a change reaches users (from `docs/RELEASING.md`, `CLAUDE.md`, and the three workflows in `.github/workflows`):
- A push reaches no phone. Installed apps run JavaScript published to the `production` EAS channel on top of their store build.
- `ci.yml` checks branches. A push to `main` runs `promote-to-production.yml`: tests, then `scripts/check-ota-compatibility.mjs`. If the gate passes, it merges `main` into `production`, and `production.yml` then publishes the update. If the gate refuses, nothing is merged, the run stays green, and it says a store build is needed.
- `main` is on Expo SDK 57 and version 2.2.x; the installed baseline in `.eas/production-baseline.json` is older. The gate currently refuses `main` itself (41 native dependency versions and new config plugins), so a push to `main` publishes nothing.

What happened here:
- The work is committed on `feat/photographer-workspace-redesign` and integrated into `main` with a `--no-ff` merge. Because the gate refuses, the promote step does not merge into `production` and **no update was published**.
- **Not released to users.** Reaching phones needs a store build first (path B in `docs/RELEASING.md`: build, submit to the production track, wait for it to finish, refresh the baseline, push), and that is a deliberate release action that was not part of this work. Nothing was run with `eas`.
- Before a store build ships this work, run it against a real photographer account on a device (goals, photobooks, event remove, wallet paging), and run iOS, neither of which could be done here.
