# Photographer workspace audit (2026-10-14 / 15)

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
| Events (`PhotographerEventsDashboard.tsx`, `ScheduleView.tsx`, `schedule.ts`) | Calendar (Month, Week, Agenda) beside the existing List. Conflict banner only for genuine overlaps. Remove (dismiss) action on completed or cancelled events. Filter counts show a dash until the list has loaded. |
| Analytics (`analytics.tsx`) | Failures are shown with a retry instead of zeros, `N/A` for unknown, "No reviews yet" instead of a fabricated 5.0, period changes cannot be overwritten by a slow older answer. |
| Photobooks (`photobooks.tsx`, `photobook/[id].tsx`) | Photographers get a "Received from clients" shelf (the web's received photobooks) with read, resubmit and remove. |
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
| P3 | Found on the emulator: metric labels cut to "Available to w...", action buttons cut at 1.6x text size, goal card indented twice, period tabs misaligned in the goal form | single-line labels, fixed-height buttons, doubled side margins | Labels and captions wrap, buttons grow, margins cancelled |

## Parity matrix (photographer)

Status: C complete, P partial, M missing, B blocked by backend, I intentionally different, U unverified.

| Capability | Web | Mobile | Status | Evidence |
|---|---|---|---|---|
| Wallet available / pending | `/wallet/me`, pending = `pendingAmount + heldForDelivery` | same formula via `selectWalletStats` | C | `moneyView.ts` |
| Transaction history | `/photographer/transactions`, server paged | `/wallet/me/movements`, first 50 then older pages on demand | C (a different but equivalent endpoint, paged by the server) | `useMovementPages.test.tsx`, `walletTab.render.test.tsx` |
| Withdraw, payment accounts | `/withdraw/*` | `withdraw.tsx`, `payment-accounts.tsx` | C (not exercised, would move money) | `features/withdrawals/api.ts` |
| Goals (plans) | `/photographer/plans` CRUD | `GoalsSection` over the same CRUD | C. Earnings and client progress is not drawn because the server has no per-period single-currency figure; the rating progress is real | `GoalsSection.test.tsx` |
| Booking accept / decline | `/photographer/events/{id}/accept|decline` | same | C | `events/api.ts` |
| Event dismiss | `POST /photographer/events/{id}/dismiss`, shown when the event has an album | Same endpoint, shown for completed or cancelled events | P. The album list the app has carries no `eventId`, so the web's "has an album" gate cannot be reproduced. The server only checks assignment | `photographerApi.test.ts` |
| Photobooks I made | `/events/photobooks` (customer) | same | C | `photobooks/api.test.ts` |
| Photobooks received from clients | `/photographer/photobooks` | same, read, resubmit, remove | P. Editing the book (`PUT`, media picker) is not built | `photobooks/api.test.ts` |
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
| Tests | `npx jest` | 65 suites passed, 501 tests passed, 1 skipped (was 52 suites, 407 tests on clean `main`) |
| Lint | `npx eslint` over every touched folder | No error in any new file. Remaining errors are the same count as `HEAD` for `wallet.tsx` (3), `transactions.tsx` (3), `PhotographerEventsDashboard.tsx` (1), `analytics.tsx` (1), `useAsync.ts` (2: ref write during render, setState in effect). Compared by linting `git show HEAD:` copies. The repo has about 600 lint problems in total from the React-compiler rules |

New regression tests: `useAsync.test.tsx` (first load, failure then retry, newer-before-older, older failure after newer success, failure keeps previous data, overlapping foreground requests, quiet tick superseding a foreground request, unmount), `useForegroundPolling.test.tsx` (interval, background pause and catch-up, no overlap, disabled and cleanup), `useMovementPages.test.tsx`, `walletTab.render.test.tsx` (tabs, analytics honesty, other roles, older-page button), `GoalsSection.test.tsx` (load, empty, failed load and retry, `action:0`, create, failed save keeps the form and lists nothing, validation, edit, delete confirmation), `photobooks/api.test.ts`, `events/photographerApi.test.ts`, `profileLink.test.ts`, `PhotographerHome.render.test.tsx`, `photographerAnalytics.render.test.tsx`, `schedule.test.ts`, `ScheduleView.test.tsx`, `WalletAnalytics.test.tsx`, `money.test.ts`.

### Native verification (Android emulator)

Done: Pixel 5 emulator (`Pixel5_API34`, 1080x2340, API 34), the existing debug APK (built 2026-10-13) with JavaScript from this branch served by Metro. `adb` exists under the Android SDK `platform-tools` but is not on `PATH`.
Observed on the emulator: Home (all sections, carousels peeking and scrolling, vertical scroll under the floating top bar and above the bottom bar), Wallet Overview and Analytics tabs, Events calendar in Week and Month with the conflict banner and badge, the goal form with the soft keyboard (sheet resizes, fields reachable), the existing incoming-booking full-screen alert over the new Home, font scale 1.6 on Home (everything wraps, nothing clipped after the fixes), local day roll-over at midnight.

Limits, stated plainly:
- **Not a live backend.** No test photographer login was available and no real bookings, withdrawals or transfers were made. Responses came from a temporary fixture layer (wallet fixtures from the repo, invented events and goals) installed through a temporary auth bypass. Both were removed afterwards (`src/harness` deleted, `src/store/auth.ts` has no diff).
- Android only. iOS was not run. Gestures were `adb` swipes and taps, not touch-device ergonomics. The soft keyboard was seen on the goal form only.
- Not opened on the emulator: Analytics screen, Wallet Activity tab, Agenda view, photobooks received shelf and detail, transactions "load older", event Remove button. These have jest coverage only.
- Dark theme was not viewed. The prototype's dark navy look was not matched pixel for pixel; the app's own light and dark palettes and brand tokens (navy `#083A85`, pink `#F20C8F`) were used.

Observations left alone (outside this scope or a product call): the KYC banner and the translucent top bar sit over the top of Home and Wallet; the Events header (view tabs, layout toggle, status chips, search, view toggle, banner) uses about half the screen before the calendar starts; the floating add button can cover the right edge of an agenda card.

## Confirmed pre-existing failures

React-compiler lint errors listed above (identical to `HEAD`). `MultipleDonutOverviewCard.tsx` is now dead code, but `moneyHonesty.test.ts` reads its source, so it was left in place.

## Remaining dependencies and risks

1. Backend: the items in "Blocked by backend".
2. Editing a received photobook, `bonus-status`, and a share or PDF export of the earnings report are not built.
3. Production profile link: `slug-for` is public and unit tested here, but was not called against production.
4. Release: nothing was published. Work stays on this branch; the release line is `production` through the OTA gate (`docs/RELEASING.md`), never from `main`.
