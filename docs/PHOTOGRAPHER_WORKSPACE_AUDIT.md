# Photographer workspace audit (2026-10-14 to 15, reconciled after the dark-mode passes)

Scope: photographer Home, Wallet (Overview, Analytics, Activity), Events calendar and list, Analytics,
Photobooks (photographer side) and the shared pieces they use. Branch `feat/photographer-workspace-redesign`.
Evidence is code, backend source (`PhotographerDashboardController`, `PhotographerAnalyticsService`,
`EcoWalletController`, `WalletController`, `SeoLookupController`), the web checkout (`connekt-dashboard`,
`connekyt-landing`) and an Android emulator run (see "Verification"). Customer, merchant and admin dashboards and the
live-stream experience were not touched.

## Status at a glance (checked against Git, GitHub Actions and EAS on 2026-10-15)

| Work | Branch and commits | State |
|---|---|---|
| Photographer redesign (Home, Wallet tabs, Events calendar, Analytics, goals, photobooks, paging) | `feat/photographer-workspace-redesign` (`618358c`, `0dd59fb`), merged to `main` as `d8bb37d` | Released to Android over the air on runtime 2.2.2 (update group `c917325e`) |
| Dark mode, large-text and shared-surface fixes, honest withdraw balance | `feat/photographer-dark-mode` (`a84a377`, `b8ac8f5`, `480aaa8`), merged to `main` as `602ce3b` | **Published on both platforms on runtime 2.2.2:** Android update group `cecb3ebc` (id `01a14030-d09b-7f0f-b3de-f32206e37da6`, from the promote workflow, `production` at `4977516`) and iOS update group `ac5143a4` (id `01a1403a-c386-7c4e-823a-68a6c8f4baec`, from a manual dispatch of `production.yml` with platform `ios`) |
| iOS store build | Build 41 (2.2.2) in App Review | Waiting for Review when last checked through the App Store Connect API on 2026-10-15 (2.2.1 is the released version) |
| Visual fidelity pass (compact chrome, priority card, shoot cards, business overview, wallet and analytics composition) | `feat/photographer-visual-fidelity` | **Published on both platforms on runtime 2.2.2.** Merged to `main` as `d0a3eed` (feature commit `0e74c12`). Android update id `01a140a0-738c-77ef-9218-867d0607be72` (promote workflow, `production` at `2110352`), iOS update id `01a140a9-1b37-7038-9512-4fcea7586b56` (manual dispatch of `production.yml`, platform `ios`). Both were checked by fetching the manifest a phone would fetch. Not run on an iPhone by me. See "Visual fidelity pass" |

What the iOS update reaches: phones running an iOS 2.2.2 build, which today means TestFlight builds 38 to 41. App Store users are on 2.2.1 (runtime 2.2.1) and do not receive it until Apple releases 2.2.2. A phone fetches the update on a launch and runs it from the next launch.

The iOS bundle was exported locally before publishing and bundles cleanly (the new strings are present, no harness). It has not been run on an iPhone by me: there is no iOS tooling on this machine, so no iOS screen has been visually verified. Whoever tests on TestFlight is the first iOS check.

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
| Tests | `npx jest` | 70 suites passed, 551 tests passed, 1 skipped, exit 0, on the dark-mode branch after the third pass (clean `main` was 52 suites, 407 tests) |
| Lint | per touched file, `npx eslint <file>` against the same file from `git show af5ef62:<file>` (clean `main`) | no touched file has more errors than on `main`, and every new file is clean; the per-file counts are in "Lint comparison" below |
| OTA gate | `node scripts/check-ota-compatibility.mjs` | Passes on the dark-mode branch: version 2.2.2 matches installed build 33, 57 runtime dependencies match, native config unchanged, "Safe to publish to the production channel". (When the redesign first landed, the gate refused because the recorded baseline was build 28; it passes since the baseline was refreshed to build 33.) |

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

Not inspected in that first emulator run: iOS, dark theme, the Analytics screen's failed state, a real photographer account, real payment or withdrawal flows, tablet sizes. The dark theme and Analytics failed states were inspected later; see "Dark mode review". Gestures were `adb` swipes and taps.

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

## Dark mode review (2026-10-15, branch `feat/photographer-dark-mode`, merged as `602ce3b` and published)

Reference: the three prototype screens in `Connekyt_Photographer_Prototype.docx` (Home and business overview, Wallet overview with the work calendar, Wallet analytics). Their colours were sampled from the images: screens sit on a deep blue-teal (about `#071321` to `#0B1828`), cards one step up (about `#0F2231` to `#132434`), a blue hairline, a mid blue for selection, pink used sparingly, and amber, green and blue only on small status pills and tiles.

Method: Android emulator (Pixel 5, API 34, system night mode on) running this branch's JavaScript, with a temporary fixture backend (a fake `fetch` plus an auth bypass in the git-ignored sandbox). It proves how the app renders, not what the real server returns. The harness, the `auth.ts` edit and the local servers were removed afterwards, and `git status` and the final diff show neither.

**What the comparison decided**

| Prototype element | Decision | Why |
|---|---|---|
| Deep blue-teal ground, lighter navy cards, blue hairline | Adopted: new dark surface steps (`#0A1524`, `#0F1D2F`, `#13243A`, `#1A2E47`, `#1B3049`), `#274463` border | This is most of the visual gap, and it is pure palette |
| Page background exactly the prototype's | Adapted | The native splash (`app.json`) is `#0E1117`; changing it is a native change that would block the OTA gate. The app ground is now navy, and `AppPreloader` still draws the splash hex, so the app fades from the splash colour into navy |
| Wallet hero as a row (amount and Withdraw side by side) | Adopted, photographers only | It follows the prototype and removes a tall stack. Other roles keep the centred hero |
| Coloured icon tiles, green incoming amounts, status pills on earnings rows | Adopted on Home (and metric tiles take their tone) | Pure presentation of fields we already have; the status word is the API's own |
| Status badge on shoot cards | Adopted (same bucket and wording as the Events calendar) | One description of a shoot everywhere |
| Pink accent on a needs-attention action | Adopted for a secondary action that has waiting items | Restrained: only when a badge count exists |
| Glowing card borders | Omitted | Decoration that adds a bright edge on every card, and costs legibility on small cards |
| Donut and ring charts, line charts | Already present on Analytics; tracks recoloured to a navy step | Existing components |
| Photo thumbnails | Already rendered where the data has `coverImage`; verified with a cover image in the fixture | No new data was invented |
| The prototype's milestone list with release status | Not built | Blocked by the backend (listed above) |

**Dark screens actually inspected on the emulator (screenshots read)**
- Home: full scroll, balances hidden and shown, loading skeletons, shoot card with cover image and status badge, business overview, goals, recent earnings, recent clients.
- Wallet: Overview, Analytics, Activity (loaded, empty, failed).
- Main Analytics screen: all charts and rows scrolled end to end, period tabs, and its failed state (the "Try again" banner with the rest kept honest as N/A).
- Events: loading, Month, Week, Agenda, List.
- Event detail.
- Goals: new goal form, empty-save validation, save failure, a successful save, the edit form, the delete confirmation.
- Received photobooks: shelf, a book's detail, the resubmit confirmation and its result; My photobooks empty state; Albums empty state.
- Withdraw and Payment accounts, view only (no transaction was started).
- A client account in dark and light (Home, Wallet) to check the shared top bar, tab bar and palette.
- The photographer in light (Home, Wallet, Events List) after the changes.
- Earlier pass: 360dp wide at 1.6x text on Home and Events.

**Defects found in the dark render and corrected, each at its cause**

| Defect | Fix |
|---|---|
| Grey slab look: graphite surfaces, no blue | New navy surface steps and cool text (`palettes.ts`) |
| Status chips and banners (wallet pending and suspended chips, photobook chips, event detail chips) were light pastels or hard-coded hexes | New `warningSoft`, `warningLine`, `errorSoft`, `errorLine` tokens; wallet chips and banner use tokens; `features/photobooks/statusChip.ts` maps photobook chips; event detail chips use tokens |
| Event detail Share button was a solid white slab | The module-level `colors` export is the light palette; the outline button now reads the theme |
| Pushed screens' header was a lighter shade than the tab screens | `(app)/_layout.tsx` header uses the same card step and link blue as `TopBar` in dark |
| Analytics period tabs: selected pill was a dim card | Brand fill with white text in dark; tab role and selected state added |
| Analytics donut tracks were bright translucent white | Navy track step |
| Delete goal looked like an ordinary link | New `destructive` variant (error colour), used for Delete goal |
| "Remove from my list" was low-contrast grey | `textSoft` at semibold |
| Metric tiles and earnings rows were flat text | Tinted icon tiles, signed green amounts, status pills |
| Large text and small screens (earlier pass) | See the earlier table |

**Shared components and other roles.** The palette, `TopBar`, `PersistentBottomBar`, the app stack header and `BrandPill` are used by every role. What changed for them: the dark ground and cards are navy instead of graphite, the Android top bar is opaque, the active tab bubble is calmer in dark, and the stack header matches the top bar in dark. Light mode is unchanged: the link token equals `primary` in light, and the client dashboard and wallet in light were compared after the change and look the same. The client dashboard in dark was rendered and is intact. Coordinator and viewer were not rendered; they use the same shared components. The wallet hero row and the home/shoot badges are photographer-only.

**Pinned by tests.** `src/theme/palettes.test.ts` (text, soft, muted and link at least 4.5:1 on every surface in both palettes, the status colours on their tinted grounds and on cards, the stronger chip grounds, navy hue, ascending dark steps, hairline, identical keys) and `src/features/photobooks/statusChip.test.ts` (light unchanged, dark mapping, unknown status untouched), plus the week-title test.

**Does dark match the prototype?** Close in structure and palette, not identical. After the changes the ground, cards, hairlines, tiles, pills, links and charts read as the same navy family, and the layouts follow the prototype (compact wallet hero, tiled icons, status pills). It still differs in the exact page colour (graphite splash constraint is only visible at launch), the glowing borders (deliberately omitted), and the prototype's richer content (milestone release status, which needs backend data). I do not claim a pixel match.

**Third pass: shared roles, large text, error states and the Withdraw balance (this commit)**

Inspected on the emulator in dark, with screenshots read:
- **Coordinator** Home at normal size and at 1.6x text, including the performance card.
- **Viewer** Home and Wallet at normal size, and Home at 1.6x text.
- **Client** Home and Wallet, dark and light (earlier in the pass).
- **Wallet Analytics failed states:** trends failing (error under the period tabs, balance cards kept), payment activity failing (error beneath real Shoots and Clients figures), and the Try again recovery.
- **Withdraw** with four backend answers: a source reporting 0, an empty list, an unreadable balance, and a failed load.

| Defect found | Fix |
|---|---|
| Coordinator Revenue figure was dark navy on a navy card (hard-coded `#083A85`) | Uses the `link` token (identical in light, readable in dark) |
| Viewer "Open wallet" was light pink on a mid-blue card (about 2:1) | White in dark; light unchanged |
| "See all" on the home sections used the fill blue as small text | `link` token |
| Coordinator at 1.6x: action chips overlapped, "PHOTOGRAPHERS" and "TOTAL REVENUE" broke mid-word or truncated | Scaling capped on those labels; the snapshot labels and the card title shrink to fit instead of wrapping or truncating; Create Event keeps its padding |
| Tab bar label touched the edges of its bubble at 1.6x | Label scaling capped at 1.15x |
| Wallet Analytics error notice touched the period tabs | Vertical gap added where the notice is placed |

**Withdraw `$0.00` traced to its logic.** `listWithdrawableSources` mapped each source through `num()`, which turns a missing, null or non-numeric amount into `0`, and the screen computed `available` as `0` whenever there was no source, then rendered it with the same formatter as a real balance. So three different situations (no source reported, a source with no usable amount, and a genuine zero) all showed `$0.00`. A failed request already showed an error with Try again and is unchanged.

Fix, with the financial rules untouched (no amount, conversion, limit or submission logic changed):
- `listWithdrawableSources` now fails the load ("Could not read your balance.") when the data is not a list, or any source has an unreadable `availableBalance`. An empty list is still a valid answer. A reported `0` is still `0`.
- New `BalanceHero`: no source shows **N/A** with "No withdrawable balance was reported. Reopen this screen to check again." A source shows its own number, including a real `$0.00`, with the USD value beneath when the main currency differs.
- Pinned by `features/withdrawals/api.test.ts` (reported zero, empty list, five unreadable shapes, missing list, action 0) and `BalanceHero.test.tsx` (N/A with no source and no `$0`, reported zero, reported balance, converted balance).
- Verified on the emulator: reported zero shows `RF 0` with `$0.00` beneath; empty shows N/A; unreadable and failed show the error with Try again and no number.

**Not inspected in dark:** event actions beyond Remove and the detail header, the withdraw confirmation, code and selfie steps and a funded balance with a saved payment account (no transaction was started), goal sheets at large text, the coordinator and viewer screens beyond Home and Wallet, tablets, iOS (no iOS tooling here) and any real account. Coordinator and viewer Wallet at large text were not captured.

## Visual fidelity pass (2026-10-15, branch `feat/photographer-visual-fidelity`, merged as `d0a3eed` and published)

Trigger: the released app was compared on an iPhone (TestFlight, `IMG_9057-merged.pdf`) against `Connekyt_Photographer_Prototype.docx`. The released UI had the dark palette but not the prototype's composition: an oversized pink bubble in the tab bar, a tall top bar with a raised brand pill, four same-weight outlined buttons, tall repetitive cards, a wide dashed Goals box, pill-shaped statuses, quick-link rows instead of compact tiles, and a plain progress-bar Analytics.

| Area | Before (released) | After (this branch) | Reason |
|---|---|---|---|
| Bottom tabs (photographer only) | 60dp pink bubble that floats above the bar and hides the icon | Flat tabs: icon and label always shown, the selected one pink with a short rule under it | Prototype nav is restrained. Other roles keep the bubble, so other dashboards are not redesigned |
| Top bar (photographer only) | 60dp, raised circles and a raised brand pill | 52dp, wordmark flat and left, outlined currency chip, 40dp round buttons | Less chrome, same slots and the same actions |
| Home actions | Four equal outlined buttons | Create event filled, Share profile outlined, Opportunities in pink and Collaborate in teal, each with a one line caption | Importance and meaning are visible. The pink one carries the real waiting count |
| Priority today | None | A card with the photograph, client, time, status and View shoot, shown only for a shoot genuinely dated today, with a "n today" chip when there are several | The API has no delivery deadline or upload state, so no "Gallery due" is claimed. Today's shoots are real data |
| Shoot and request cards | Cover banner above stacked text | Photograph at the left (an icon tile when there is none), status, date and time, location, client, then compact actions. One card takes the full row, several peek the next | Closer to the prototype card. Payment and "paid in full" lines are not shown, the event feed carries no payment status |
| Business overview | Six small metric cards in a carousel | Lifetime earnings beside a rating ring, then three counted tiles | Compact. The ring is drawn only from a real rating, and a missing rating says "No reviews yet" |
| Goals empty state | Large dashed box inside a card | One compact block: icon, two lines, one Set a goal action | Stops dominating the screen |
| Recent earnings | Pill status under the amount | Icon tile, two line title (no early cut), signed amount, small icon and word status | Dense rows read faster. Status keeps the API's own word |
| Wallet Overview (photographer) | Hero, tall quick links, grid of pot cards | Compact hero with the Pending release row inside it, one card of breakdown rows, the latest three movements with View all, then compact tiles for Transactions, Payment accounts and Earnings report | Same data, prototype order. Suspension and error banners are unchanged |
| Wallet Analytics | Progress bars, wide bars | Balance card, pending and withdrawn tiles, a donut with a legend for the balance sources, a period section, bars with faint rules, the peak in pink, a note that no amount is labelled | Clearer hierarchy and legible chart. Still no invented period earnings |
| Agenda rows | Text only | The real cover photograph when the event has one | Connects the entry to the work |
| Cards, borders, headings | 16dp padding, faint border, 18sp heading | 12dp padding, the blue hairline border, 17sp heading | Compactness without losing the 44dp touch targets |

New shared pieces, all photographer only: `kit.tsx` (`IconTile`, `StatusText`, accent and teal action variants with a caption, a compact empty state), `charts.tsx` (`SegmentRing`, `ProgressRing`, react-native-svg is already a dependency), `homeParts.tsx` (priority card, shoot card, business overview, earning row). The tab bar and top bar switch on `useRole().isPhotographer` and the other roles render the previous chrome.

Honesty kept: no fabricated names, images, amounts, deadlines or ratings. A rating with no review list shows "Average rating" and never "0 reviews". The Pending release row in the Wallet hero appears only when the wallet reports a pending figure (a reported 0 still shows). Without one it is left out, because an existing test pins that a missing figure is never drawn as $0.00 (my first version drew it and that test failed, so it was corrected). The Withdraw balance rule from the previous pass is untouched.

Verified, on the Android emulator against a fixture backend (not a live account), screenshots read: Home from the top through Recent clients, with a shoot today, a waiting request, a goal and a payout; Wallet Overview and Analytics; the Events week view; light mode on Home; Home at 1.6x text on a 720x1280 screen (actions stack icon over label, no clipping). Found and fixed during that pass: "0 reviews" under a real 4.6 rating, a two word source label cut in the donut legend, and a Pending release row that drew $0.00 for a wallet reporting no pending figure (caught by `walletTab.render.test.tsx`). The pending row itself was seen on the emulator only in the interim version that always drew it, so the final reported-only behaviour is covered by that test and not by a screenshot.

Not verified: iOS (the first iOS check is the tester's TestFlight), a real account, the Wallet and Analytics tabs at 1.6x text, tablet sizes, pixel parity with the prototype. Intentional deviations: the avatar stays at the left of the top bar (it doubles as Back on inner screens), the date and Today strip of the prototype Home is not added, glowing borders are omitted, and the prototype's Delivery pipeline, Booking milestones, "Client paid in full", earnings goal rings, month comparison and "On-time delivery" have no photographer endpoint, so they are absent rather than faked. The incoming booking alert modal is shared and was not redesigned, and it crowds its details card at 1.6x text on a small screen.

## Remaining dependencies and risks

1. Backend: the items in "Blocked by backend".
2. Editing a received photobook, `bonus-status`, and a share or PDF export of the earnings report are not built.
3. Production profile link: `slug-for` is public and unit tested here, but was not called against production.
4. Release: the redesign and the dark-mode work are live on Android over the air and on iOS 2.2.2 builds over the air (see "Status at a glance"). Store build 33 is on the Play production track and iOS 2.2.2 is in App Review. An over-the-air update cannot be recalled, only replaced by a newer one. Real-account checks of goals, photobooks, event Remove, wallet paging and the Withdraw balance states have still not happened, and nothing was run on an iPhone.

## CI incident during this work

The first push of this work to `main` turned both `ci` and `promote main to production` red although all 510 tests passed. Jest exited 1 with "Cannot log after tests are done": my render tests left list and icon timers running, they fired after the file finished and logged an act() warning. It reproduced locally as one such message in a full run. Fixed forward by `src/test/autoUnmount.ts` (unmounts every renderer after each test), imported by the render tests. After the fix jest exits 0 locally in parallel and in band. Nothing was published by the failed run (the promote job was skipped).

## Release status

How a change reaches users (from `docs/RELEASING.md`, `CLAUDE.md`, and the three workflows in `.github/workflows`): a push reaches no phone. Installed apps run JavaScript published to the `production` EAS channel on top of their store build. A push to `main` runs `promote-to-production.yml` (tests, then `scripts/check-ota-compatibility.mjs`); if the gate passes it merges `main` into `production`, and `production.yml` publishes.

What happened, in order (2026-10-15):
1. The gate refused `main` against the recorded baseline (build 28, 2.2.0): app version, 16 patch-level Expo dependencies and the notifications plugin config.
2. Those natives were already built by others. `eas build:list` shows build 33 (EAS build `4f724bff`, 2.2.2, version code 33, commit `74ce1b0`, finished 2026-10-13, never submitted). `main` has no `package.json`, `app.json` or `eas.json` difference from that commit, so no new build was made (a rebuild would only have burned a version code).
3. Path B step 5: `eas submit --platform android --profile production --id 4f724bff...`. Submission `7a276295` reported **finished**, track `production`, release status `completed`, version code 33.
4. Path B step 7: `.eas/production-baseline.json` refreshed from the build record (commit `74ce1b0`, 2.2.2, runtime 2.2.2, build number 33, fingerprint `51877a65...`), committed `85ca327` with `[skip publish]`. The gate then printed "Safe to publish to the production channel" (all 57 runtime dependencies match, native config unchanged).
5. Push of `main` (`85ca327`): `ci` green, `promote main to production` green, `production` branch fast-forwarded by merge `03097a9`, `production.yml` run succeeded.
6. Verification of the publish: the manifest a phone would fetch (`expo-runtime-version: 2.2.2`, channel `production`, platform android) returns update id `01a13f24-975b-76a7-9ea7-eb4ec46dddd5`, update group `c917325e-77a9-4bfe-a764-eb3193c6becb`, created 2026-10-15 10:38 UTC. `eas update:list --branch production` shows the same group, runtime 2.2.2. The CDN refuses direct bundle downloads, so the bundle was checked through a local `expo export` of the same commit: it contains "Lifetime earnings", "Received from clients" and "Load older transactions", and no harness strings.

Distinguish the states:
- **Store build**: finished (build 33, built by a teammate before this work).
- **Store submission**: finished to the Play production track, release status completed (Play's own processing and rollout are outside what the CLI can show).
- **Promotion**: done (`production` = `03097a9`).
- **OTA update available**: yes, on runtime 2.2.2 for Android only. The baseline platforms list is android; no iOS build or update exists for this work.
- Phones receive the update on their next launch and only if they run a 2.2.2 build. Builds 30 to 32 also report 2.2.2 and differ from build 33 only by Expo patch bumps and one notifications flag, which is the exposure the repo's `appVersion` runtime policy already accepts.

Still not done: running this against a real photographer account on a device (goals, photobooks, event remove, wallet paging), and any iOS run. Watch the first launches after this update.
