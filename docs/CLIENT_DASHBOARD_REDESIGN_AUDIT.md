# Client dashboard redesign audit (2026-10-17)

Branch `feat/client-dashboard-redesign`, based on `main` at `50769d8` (the photographer redesign, dark mode, visual
fidelity and trend chart branches are all ancestors of that commit). Frontend only: no backend, schema, contract or
permission change. Nothing was merged, pushed or published.

Reference for layout: the supplied client prototype (Home, Calendar, Wallet). Reference for styling: the shipped
photographer workspace (`features/photographer/kit.tsx`, `homeParts.tsx`). Where the prototype shows something the product
has no data for (billing details, refunds, "Support a creator" tip picker on the wallet, AI matched talent, a Deadlines or
Offers calendar), it was not invented.

## Status vocabulary

- **Implemented**: code written and in the diff.
- **Automated**: Jest passes for it (react-test-renderer, faked transport, not a device).
- **Android visual**: seen on the emulator. **Not done in this pass, see "Verification".**
- Nothing below is marked verified on a device.

## Screen inventory

| Screen or flow | Source | State |
|---|---|---|
| Client Home | `features/dashboard/ClientHome.tsx` (rewritten, 3015 to 687 lines), `features/client/homeModel.ts` | Implemented. Automated (render test with 13 cases, model test). Android visual: done, light, dark, 1.6x (see Verification) |
| Client Wallet (Overview, Activity, Payments due) | `app/(app)/(tabs)/wallet.tsx`, `features/wallet/ClientPaymentsDue.tsx` | Implemented. Automated (4 new cases in `walletTab.render.test.tsx`). Android visual: done, light, dark, 1.6x |
| Client Events tab | `features/events/ClientEventsDashboard.tsx`, `clientEventsModel.ts` | Implemented. Automated (render test with 11 cases, model test). Android visual: done, light, dark, 1.6x |
| Payments (client and coordinator share it) | `app/(app)/payments.tsx`, `features/payments/summary.ts`, `payments/api.ts` | Honesty defects fixed. Automated (5 render cases, summary and mapper tests). Android visual: light only. Restyling: not done, see "Not restyled" |
| Photographer discovery, profile, reviews | `app/(app)/photographers.tsx`, `photographer/[id]`, `features/photographers/*` | Audited. Only the loader changed (`listPhotographers` now rejects a refused page). Not restyled |
| Booking wizard, hybrid sheets | `features/booking/*`, `features/hybrid/*` | Audited, untouched. Reused as is from Home and Events |
| Event detail, candidates | `app/(app)/event/*`, `app/(public)/event/[id].tsx` | Audited, untouched |
| Transactions | `app/(app)/transactions.tsx` | Audited. Has error and empty handling, formats `movement.currency`. Untouched |
| Inbox, notifications, conversations | `(tabs)/inbox.tsx`, `notifications.tsx`, `conversation/*` | Audited, untouched |
| Gallery, photobooks, find my photos | `gallery.tsx`, `photobooks.tsx`, `find-my-photos.tsx` | Audited, untouched |
| Profile, preferences, KYC, security | `(tabs)/profile.tsx`, `preferences.tsx`, `kyc.tsx`, `two-factor.tsx` | Audited, untouched |
| Tab bar and More sheet | `components/PersistentBottomBar.tsx` | Audited. Shared by every role, so labels were not renamed to the prototype's Calendar and Messages |

## What changed and why

### Home
Reading order: welcome and search, actions (Book photographer, Publish offer when hybrid is on, My albums, Find my photos,
Explore events), Upcoming event, Action required, Your bookings, Featured photographers, Recent activity. Repeated
independent items (action cards, bookings, photographers) are horizontal carousels that show the next card; activity stays
a vertical list. Every section has its own loading, empty and error state.

Defects in the old Home, each now pinned by a test:

| Defect | Root cause | Fix |
|---|---|---|
| Every event that carries a stream said LIVE NOW | `hasLiveStream === true` was treated as live | `isLiveNow`: ONGOING, or a connected stream that has not ended |
| An evening event dropped off Home a day early | Compared a UTC ISO date with `eventDate` | Local calendar days (`dayKey`, `daysUntil`) |
| Amount due shown in the wallet currency | `formatPrice(total, wallet.currency)` over `amountInUsd` ledger values | Formatted as USD (`DUE_CURRENCY`) |
| A failed events or photographers read said "No upcoming events" and "no photographers" | `fetchAllEventPages` and `listPhotographers` used `api.get`, so HTTP 200 with `action: 0` read as an empty page | `requireOk` in both loaders. Every other caller already handles a rejection (`allSettled`, `catch`, `useAsync`) |

Removed on purpose, with reasons: the inline search suggestions overlay (about 400 lines) became a search pill that opens the
existing `GlobalSearchModal`; the auto-scrolling featured rail (it moved under a finger) became a normal carousel; the
category chip rail and the interleaved bookings and activity feed (the carousel and the list now do their jobs).
The pending-payment alert's six-hour snooze is gone.

### Wallet
Clients get Overview and Activity sections (no Analytics tab, that endpoint is photographer-only) and a Payments due block
with Pay now. The hidden-amount mask no longer hard-codes a dollar sign.

### Events
Single column of cards under a title row with New, filter chips with counts (no count until loaded), search and sort,
Show more paging, error with retry, stale list kept on a failed refresh. All old actions kept. Coordinators keep
`OwnerEventsDashboard` unchanged.

### Payments (found while auditing money screens)
| Defect | Fix |
|---|---|
| Totals added every amount and labelled the sum with the first payment's currency | Per-currency totals (`summarizePayments`). A mix says "Several currencies" and lists each |
| Total card drawn as a zero while loading and after a failed read | Drawn only after a successful read with at least one counted payment |
| The latest 20 payments presented as "total spending" | Says "Based on your latest 20 payments" when the page is full |
| `amountInUsd` fallback labelled with the row's own currency | Labelled USD |
| A payment with no currency or amount silently counted as 0 | Counted as not included, and the screen says so |

## Shared components touched

| Component | Change | Regression check |
|---|---|---|
| `kit.tsx` `ActionButton` | Caption colour on a primary fill; stacked captions centre | Used by the photographer Home, Wallet and Events; a caption was never used on a primary button there. Photographer tests pass. Not re-seen on a photographer screen on the emulator |
| `homeParts.tsx` `ShootCard` | Optional `photographer` line | Additive. `homeParts.test.tsx` and `PhotographerHome.render.test.tsx` pass |
| `wallet.tsx` | `tabbed` now includes clients; tab list depends on role; hidden mask has no `$` | `walletTab.render.test.tsx` (photographer, coordinator and client cases) passes |
| `events/api.ts` `fetchAllEventPages` | `requireOk` | Coordinator and client lists, `EventsList`, tab Home preview: all inside `useAsync` or `try` |
| `photographers/api.ts` `listPhotographers` | `requireOk` | `GlobalSearchModal` (`.catch`), inbox (`allSettled`), `photographers.tsx` (`useAsync`), `event/new.tsx` (`useAsync`) |
| `payments/api.ts` | Mapper currency pairing, `PAYMENTS_PAGE_SIZE` | `payments/api.test.ts` |

## Verification

Run on the tree that is committed:

| Check | Result |
|---|---|
| `tsc --noEmit` | Clean |
| Jest, full suite | 93 suites passed, 745 tests passed, 1 skipped (pre-existing), 0 failed |
| ESLint on the 21 changed TypeScript files | 3 errors, 8 warnings. All 3 errors are patterns already in the base files: `wallet.tsx` `setActivityPage(1)` inside an effect and a `useMemo` dependency the React Compiler rule flags; `ClientHome.tsx` `setBookingStep(1)` inside the mount effect that consumes `pendingPostEvent` (same lines as before the rewrite, and `take()` is a one-shot flag, so it cannot move into a state initializer without breaking under double render). Warnings are `require()` in test mocks (the style the neighbouring tests use) and `exhaustive-deps` in `payments.tsx` for `payments` and `giftPayments` fallbacks |

**Android emulator pass (done, 2026-10-18).** Pixel 5 emulator (`Pixel5_API34`, API 34, 1080x2340), the existing debug APK, JavaScript from this branch
through Metro, and a temporary fixture backend (a local Node server on the scratchpad, synthetic data: a client, four events, two payments, three
photographers, a mixed-currency payment history). The app signed in through its real login form against that server. The server, Metro, the
emulator and every script were removed afterwards; nothing of the harness is in the repo, and `git status` shows only the intended files. It proves
how the app renders and behaves, not what the real server returns.

Seen on the emulator, screenshots read:

| Screen | Light | Dark | 1.6x text | Notes |
|---|---|---|---|---|
| Home (top to bottom) | seen | seen | seen (top section) | Live event with Watch live, payment amounts of 300 and 120 minus 20 paid, "Photographer confirmed", featured photographers carousel, activity list. Failed events read seen as an error with Try again while the other sections kept working |
| Wallet Overview | seen | seen | seen | Total spent masked then revealed as $450.00, Payments due cards with USD amounts |
| Events | seen | seen | seen | One chip row that scrolls, equal-height buttons, status words |
| Payments | seen | not seen | not seen | "Several currencies" with RWF 50,000 and $205.00 listed separately, pending alert $120.00 |

Found on the emulator and fixed in this pass (each after a screenshot):

| Defect | Fix |
|---|---|
| "Direct booking" caption on the navy Book photographer button was dark grey on navy (failed contrast); it was a shared `ActionButton` gap, never hit before because no photographer button had a caption on a primary fill | Caption takes the on-primary colour |
| Payments due on the wallet and every card on Events were indented twice (the kit components carry their own side margins inside a padded scroll) | Wallet block bleeds out of the scroll padding; Events list has no list padding and the header rows pad themselves |
| Events filter chips wrapped onto two rows and "Find a photographer" wrapped to two lines | Chips are one horizontal row; the button reads "Photographers" |
| At 1.6x text the stacked button captions were left-aligned under a centred label, and the search pill cut its text | Stacked captions centre; the search text may use two lines |

**Not done:** iOS (no iOS tooling on this machine); live backend; a real device; a real payment (PayNowSheet was never opened on the emulator and is mocked in
every test); Payments in dark and at 1.6x; Home and Events lower sections at 1.6x past what the screenshots covered; carousel swipe gestures (the horizontal
peeking was seen, the swipe itself was not exercised).

## Known limits and open items

- **Not restyled** (audited, behaviour intact): Payments rows, Photographers directory and profile, booking wizard, event detail,
  inbox, notifications, gallery, photobooks, profile and settings. They keep their current look. Restyling them to the kit is the
  next batch; it was not claimed here.
- Event to payment matching on Home and Wallet is by title because the pending-payments feed carries no event id. Two events with
  the same title would share a Pay now. A backend `eventId` on that feed would fix it.
- `PayNowSheet` from the Payments screen is given `paidAmount: 0` because the payment-history record carries no paid amount. A
  part-paid booking opened there shows the full amount until the sheet reads it.
- Tab labels stay Home, Events, Wallet, Inbox, More (shared by every role).

---

# Continuation plan (2026-10-18, second pass)

Start: `7f7048e` on `feat/client-dashboard-redesign` (tree clean). Goal: finish every client screen and bring the whole client experience to the
night-studio standard of the supplied prototype. Frontend only, nothing merged, pushed or published.

## What already exists (so nothing is reinvented)

- **Theme**: `src/theme/palettes.ts` already carries a deep blue-teal dark palette (`background #0A1524`, `surface #0F1D2F`, `card #13243A`, `elevated
  #1B3049`, `border #274463`, brightened `primary #3D6FD6`, `link #7FA6F5`, `accent #F20C8F`) and the light palette anchored on `#083A85` and `#F20C8F`.
  Elevation is `makeElevation`/`elevation(level)` (surface lightness plus hairline in dark, cast shadow in light). Gradients come from `gradientsFor`
  (`brand`, `accent`, `wash`). The app follows the system scheme; dark is the night-studio look and light is kept intentional, not forced off.
- **Installed**: `expo-linear-gradient`, `expo-image`, `expo-blur`, `react-native-reanimated 4.5.1`, `react-native-svg`, `react-native-gesture-handler`,
  `@expo/vector-icons`. `@shopify/flash-list` is **not** installed, so long lists use tuned `FlatList`; no new dependency is added.
- **Shared UI**: `features/photographer/kit.tsx` (SectionHeader, HCarousel, MetricCard, ActionButton, IconTile, StatusText, Chip, SegmentedTabs, StatusBadge,
  Skeleton, ErrorNotice, EmptyNote, Card), `homeParts.tsx` (Thumb, ShootCard, PriorityCard), `components/ui/*` (Button, Input, Sheet, dialog, Segmented,
  ScreenHeader, Rating, StatusPill, EmptyState, Fab, VerifiedAvatar, live/*). Gaps for the night-studio set: a gradient HeroActionCard, a ListRow, a
  ProgressTrack, an EventSummary row. Those are added once in `features/client/studio.tsx` and reused.

## Client route inventory

Scope rule: a route is in scope when a Client reaches it from the tab bar, the More sheet, Home, or a client action. Photographer, coordinator, studio
and admin-only routes (analytics, withdraw, payroll, collaborate, packages, clients, stream control, geo-pricing, tv/pay-on-tv) are **out of scope** and
not touched.

| Route | File | Lines | Plan |
|---|---|---|---|
| Home (tab) | `features/dashboard/ClientHome.tsx` | 687 | Elevate: hero action cards, event summary |
| Events (tab) | `features/events/ClientEventsDashboard.tsx` | ~400 | Elevate with shared parts |
| Wallet (tab) | `(tabs)/wallet.tsx`, `features/wallet/ClientPaymentsDue.tsx` | 1471 | Elevate; verify dark and 1.6x |
| Inbox (tab) | `(tabs)/inbox.tsx` | 1081 | Redesign list rows |
| Conversation | `conversation/[id].tsx` | 393 | Redesign bubbles and composer |
| More sheet | `components/PersistentBottomBar.tsx` | 1024 | Audit only (shared, already modern) |
| Profile (tab) | `(tabs)/profile.tsx` | 1098 | Redesign as grouped settings |
| Edit profile, preferences, two-factor, blocked, delete | `edit-profile.tsx`, `preferences.tsx`, `two-factor.tsx`, `blocked-accounts.tsx`, `delete-account.tsx` | 142 to 354 | Restyle with the same rows |
| Photographers directory | `photographers.tsx` | 1642 | Redesign cards and filters |
| Photographer profile | `photographer/[id].tsx` | 1278 | Redesign header, portfolio, sticky CTA |
| Booking wizard | `event/new.tsx`, `features/booking/*`, `event/hybrid-wizard.tsx` | 1773 + | Progress and card grouping, payload unchanged |
| Event detail | `event/[id].tsx` | 1269 | Redesign hierarchy |
| Candidates | `event/candidates.tsx` | 323 | Restyle |
| Notifications | `notifications.tsx` | 967 | Group by day, icon tiles |
| Bookings | `bookings.tsx` | 725 | Restyle |
| Gallery, albums | `gallery.tsx`, `album/[id].tsx`, `album/new.tsx`, `content-albums.tsx`, `content-album/new.tsx` | 1079 to 1600 | Restyle list and grid |
| Photobooks | `photobooks.tsx`, `photobook/[id].tsx`, `photobook/new.tsx` | 623 to 935 | Restyle |
| Transactions, payments, payment detail | `transactions.tsx`, `payments.tsx`, `payment/[id].tsx`, `payment-accounts.tsx` | 159 to 924 | Restyle rows |
| Donations | `donations.tsx` | 142 | Restyle |
| Public flows a client uses (explore events, event page, live stream, pay, find photos, browse photos, help centre, legal) | `(public)/*` | up to 3603 | Out of this pass: shared with guests and the viewer role; audited, untouched |
| Auth and onboarding | `(auth)/*`, `(onboarding)/*` | | Out of scope (not the dashboard) |

Honest scope note: the in-scope routes above are about 14,000 lines. Every route gets the loop (intent, hierarchy, states, tests, emulator pass), but
the depth is bounded: logic, payloads, validation and navigation are never rewritten; the presentation layer is. The per-route status table at the end of
this document is the source of truth for what was actually done.

---

# Second pass: status (2026-10-18)

Base of this pass `7f7048e`, final commit is the tip of `feat/client-dashboard-redesign`. Frontend only. Nothing merged, pushed or published.

## Design language: what was done

The dark "night studio" palette already existed in `src/theme/palettes.ts` (deep blue-teal ground, stepped surfaces, blue hairline, brightened primary, pink accent), so the work was to use it
consistently, not to create a second system. Added: two reserved hero gradients (`heroBlue`, `heroViolet`, white text 4.5:1 on every stop, pinned by `palettes.test.ts`) and three shared parts in
`features/client/studio.tsx` (`HeroActionCard`, `ListRow`, `ProgressTrack`), tested. No dependency was added; `@shopify/flash-list` is not installed so lists stay tuned `FlatList`.
Gradients: one blue hero and at most one violet secondary on Home, nowhere else.

## Per route (done means: redesigned in code, Jest passing; the device columns say only what was actually seen)

| Route | File | Redesigned | Tests | Android light | Android dark | 1.6x text | Status |
|---|---|---|---|---|---|---|---|
| Home | `features/dashboard/ClientHome.tsx` | Yes (heroes, Review payments on ambiguity) | render 14 | seen | seen | seen | Done |
| Events | `features/events/ClientEventsDashboard.tsx` | Yes | render 11, model | seen | seen | seen | Done |
| Wallet | `(tabs)/wallet.tsx`, `ClientPaymentsDue` | Yes | render | seen | seen | seen | Done |
| Payments | `payments.tsx` | Yes (heroBlue summary, SegmentedTabs, Chip, ListRow, StatusBadge, SkeletonCard, ErrorNotice) | render 11 | seen | seen | seen | Done |
| Photographers directory | `photographers.tsx`, `PhotographerRow` | Yes (compact rows, real price currency) | row 8, pricing | seen | seen | seen (re-verified full price at 1.6x in light and dark) | Done |
| Photographer profile | `photographer/[id].tsx` | Yes (real facts, portfolio grid, About, sticky Book now) | render 8, facts | seen | not seen | not seen | Partial |
| Booking wizard (hybrid) | `BookingModeSelector.tsx` | Progress track and options guard; step logic and payload untouched | existing 19, shape | seen (step 1) | not seen | not seen | Partial |
| Direct booking form | `event/new.tsx` | Yes (heroBlue booking banner, EVENT/WHEN/ABOUT eyebrows, accent active chips, KeyboardAvoidingView + sticky CTA) | existing | seen | seen | seen | Done |
| Event detail | `event/[id].tsx` | Truthful track, danger zone | track 5 | seen (incl. Danger zone) | seen (incl. Danger zone) | seen (incl. Danger zone) | Done |
| Inbox | `(tabs)/inbox.tsx`, `ConversationRow` | Yes | row 8 | seen | seen (photographer) | not seen | Partial |
| Conversation | `conversation/[id].tsx` | Accessibility, 44dp send, 12pt time, bubbles on card colour | render 6 | seen | seen (photographer) | not seen | Partial |
| Notifications | `notifications.tsx` | Error state; layout was already grouped by day | render 4 | seen | seen (photographer) | not seen | Partial |
| Profile | `(tabs)/profile.tsx` | Honest client figures, tab roles | stats 16 | not seen | not seen | not seen | Partial |
| Gallery, albums | `gallery.tsx`, `album/[id].tsx`, `PhotoViewer` | Yes (hero latest delivery, 3-col thumbnail grid, swipe viewer, skeleton, error/retry) | render 6, viewer 5, facts 4 | seen | seen | seen | Done |
| Photobooks | `photobooks.tsx`, `photobook/[id].tsx` | Yes (spine cover cards, real count/status, 3-col grid, swipe viewer, skeleton, error/retry) | card 4 | seen | seen | not seen | Partial |
| Bookings | `bookings.tsx` | Yes (UserHeaderBand hideTitle, SegmentedTabs, SectionHeader, IconTile, StatusBadge, ActionButton, SkeletonCard, ErrorNotice) | existing | seen (incl. error + retry) | seen | seen | Done |
| Content albums, candidates, donations, transactions, edit profile, preferences, two-factor, blocked, delete account | various | Audited, not restyled | existing | not seen | not seen | not seen | Not redesigned |
| More sheet, tab bar | `PersistentBottomBar.tsx` | Audited, untouched (shared by every role) | existing | seen | seen | not seen | Audited |
| iOS | all | not run (no iOS tooling) | | | | | Not verified |

## Defects found and fixed in this pass

| Defect | Root cause | Fix |
|---|---|---|
| Directory price hard-coded "$" and the profile invented 5.0, "0 Events", "Since May 2026", AVAILABLE for all | Values not in the data were drawn | `startingPriceText`, `profileFacts`; absent facts are absent |
| Portfolio tab said empty although images existed; Working Experience tab had no data | Never wired | Portfolio grid from real images, About from the bio |
| Event detail stepper ticked Deposit Paid, Album Delivered, Photobook | Index-based ticking | `bookingTrack`: four steps provable from statuses; photographers keep their stepper (follow-up) |
| Inbox, notifications, albums, conversations read a refusal (HTTP 200, action 0) as empty | `api.get` without `requireOk` | `requireOk` in all four loaders, `refusedReads.test` |
| Inbox said "Sent a message" for no message; read rows had an "Open camera" button that opened the chat | Invented copy, mislabelled control | "No messages yet", control removed, unread in the spoken label |
| Pay now from Payments sent the history record (own currency, no paid amount) and the sheet formatted it as USD | Wrong source | Looks the declaration up in the pending feed, says so when it cannot |
| Publish offer crashed (`find` of undefined) on a success body that was not the options object | Unchecked shape | `hasOptionLists` makes it a failed load with the wizard's own error |
| Client profile showed Events 0, Reviews 0 and a fixed Status Active for absent fields; "Rwanda" as a default location | Defaults drawn as facts | Dashes, real identity status, "Not provided" |
| Badge text green on green over a dark photograph; progress line coloured the wrong side of its end dots; Delete the loudest button in its card; price "Fro..." at 1.6x | Visual | Fixed after screenshots (the last is not re-seen) |

## Payment and booking limitations (confirmed) and backend follow-ups

1. Pending-payments feed has no `eventId`: events are matched to payments by title. A direct Pay now is offered only when exactly one event and one payment carry the title; otherwise Home offers Review payments. **Backend follow-up:** `eventId` on `/customer/payments/pending`.
2. Payment history records have no paid amount, so they cannot show a remaining balance. Pay now now reads the pending feed instead. **Backend follow-up:** `amountPaid` on `/customer/payments`.
3. The history endpoint is one page of 20 (stated on screen when full). **Backend follow-up:** a total or a next-page flag.
4. The photographer-role stepper on the event page still lists seven steps including Deposit Paid and Album Delivered with index-based ticking. Out of this pass (the photographer dashboard is accepted); same fix pattern as `bookingTrack`.

## Prototype elements not implemented (product decision needed)

"Support a creator / Send tip" on the wallet, "Manage accounts" and Personal and Business switching, an "On the way, Arrived" tracker, a "Client" role switcher, billing details and refunds screens, a deadlines and offers calendar, AI matched talent on Home. None exists in the app or the API, so none was drawn.

## Performance

The directory shows one memoised compact row per photographer (about a third of the old card height); lists that were already virtualised stay so; no real-time blur, no gradients in rows; carousels use the existing snapped `FlatList`. No measured before and after numbers were taken, so none are claimed.

## Verification

- `tsc --noEmit`: clean. Jest full suite: 106 suites, 838 passed, 1 skipped (pre-existing), 0 failed.
- ESLint on the 27 changed files that existed on the base: 29 errors now against 35 on the base, and no file has more than before. All remaining errors are patterns already in those files (set-state-in-effect, manual memoization, static-components in `BookingModeSelector`). New files: 0 errors after the last fix.
- Emulator (Pixel 5 API 34, fixture backend, synthetic data, real login form): see the table. The emulator hung repeatedly under memory pressure (about 3 GB free with the browsers closed) and was rebooted twice; every screenshot listed as seen was read.
- Photographer regression: **Jest only.** Shared files touched: `kit.tsx` `ActionButton` (first pass), `homeParts.tsx` (additive), `ConversationRow` (camera button removed and copy changed for every role), `notifications.tsx` and the four loaders (all roles), `palettes.ts` (two added keys). The photographer Jest suites pass; **no photographer screen was opened on the emulator in this pass.**
- No backend, contract, auth, payment-integration, config or dependency change; no real payment (`PayNowSheet` was never opened on the emulator and is mocked in every test); the fixture backend, Metro and emulator were removed afterwards.

## Handoff

Resume with: (1) dark and 1.6x on Payments, profile, wizard, event detail, inbox, conversation, notifications; (2) restyle the "Not redesigned" rows with `ListRow` and `HeroActionCard`; (3) open a photographer account's Home, Wallet and Inbox on the emulator for the shared-component regression check; (4) re-see the directory row at 1.6x.


# Third pass, batch 1 (2026-10-18)

Frontend only, nothing merged, pushed or published. **Device used: the Pixel 5 emulator (API 34), not a physical phone**: `adb devices` listed no attached device (USB debugging or authorisation was not available), so the prompt's fallback applied. Synthetic fixture backend (a Node script outside the repo; images are generated PNGs it serves), real login form, dev build.

## 1. Photographer regression check (shared changes from the second pass)

Signed in as a photographer on the fixture and opened each screen. Nothing needed a variant.

| Screen | Light | Dark | Result |
|---|---|---|---|
| Home (ActionButton contrast, shared kit) | seen | seen | No regression. Create event keeps white text on navy; the Opportunities and Collaborate captions are legible |
| Inbox (ConversationRow, requireOk loader) | seen | seen | No regression. Unread row bold with badge; "No messages yet" for an empty thread |
| Conversation | seen | seen | No regression |
| Notifications (error state, loader) | seen | seen | No regression. Day groups, unread dots, filter chips as before |
| Albums list | seen (old UI, before this batch, then after) | not seen | Photographer keeps the primary-coloured controls and gets no hero (see 2) |
| Album detail | seen after the batch-1 change | not seen | Add Photos, Share, more, face chip unchanged |

Not seen: photographer dark mode for the albums list and album detail, and 1.6x text for any photographer screen.

## 2. Gallery and photobooks

What changed (frontend only; download, share, permissions and the one-shot album load are untouched):

- Albums list: cover cards with the real photo count, the event date and, for a client, the photographer; the client sees the newest unlocked album with a cover as the screen's one gradient hero ("Latest delivery"); accent on the active filter for client and coordinator; skeleton while loading; error with Try again; counts hidden until the list has loaded. A count the API did not send is not drawn (the old card printed "0 photos"), and the filler lines "Event Collection" and "Photo Vault" are gone.
- Album detail: memoised 3-column grid of thumbnails (the API's `thumbnailUrl` where it sends one), tuned FlatList (windowed, clipped subviews, stable separator), skeleton, date and place chips from the data, status chip tones for dark.
- Photo viewer (new `PhotoViewer`): swipe between photos on a paged, virtualised strip, full-size file over its thumbnail, counter, previous and next, Save and Share acting on the photo on screen. Used by the album and the photobook.
- Photobooks list: spine-edged cover cards with the API's own status, real count, photographer or creation date, skeleton, error with Try again. Photobook detail: same grid and viewer.

Found, not changed (needs a decision or the backend):

- Save to Camera Roll in the album saves `url`, which is the thumbnail when the API sends one, not `fullUrl`. A one-word change; left alone because the prompt said keep download unchanged.
- Photobook media items carry only `fileUrl` (no thumbnail field), so the photobook grid decodes full-size files. Backend follow-up: a `thumbnailUrl` on `MediaItemDTO`.
- The album and photobook loads are a single response (no paging); with 240 photos the grid is windowed but the payload is whole.

Evidence: render tests for the albums screen (6), the viewer (5), the photobook card (4), the facts helpers (4).

| Screen | Light | Dark | 1.6x | Notes |
|---|---|---|---|---|
| Albums (client) | seen | seen | seen | hero, grid, skeleton (dark), error (dark) |
| Albums (photographer) | seen | not seen | not seen | |
| Album detail (client) | seen | seen | seen | locked album seen light; empty album not seen on device |
| Photo viewer (client) | seen at 1.6x | not seen | seen | swipe both ways, next and previous checked by counter |
| Photobooks list (client) | seen | seen | not seen | |
| Photobook detail and viewer (client) | not seen after the change | seen | not seen | |

Scroll smoothness with 240 photos: **not measurable here.** The emulator renders in software on a debug bundle (every frame janky, median 150 ms), so those numbers say nothing about a phone. The structural measures are in place (thumbnails, memoised tiles, windowing); a real device run is still owed.

## 3. Payments, bookings and direct booking form

What changed (frontend only; all payment lookup, booking actions, form validation and API payloads are untouched):

- **Payments (`src/app/(app)/payments.tsx`, commit `8ee478b`)**:
  - Summary block converted to the screen's single `LinearGradient` (`gradients.heroBlue`) with white contrast text, keeping per-currency honesty (`Several currencies` with per-currency rows, latest-20 note, and uncounted note).
  - Coordinator/client sub-tabs (`Events`, `Subscriptions`, `Gifts`) switched to shared `SegmentedTabs`; status filters (`All`, `Completed`, `Pending`, `Failed`) switched to shared `Chip` with pink accent active state (`#F20C8F`).
  - Payment history, subscription, and gift rows converted to shared `ListRow` with `IconTile` leading icon, `StatusBadge` (`statusTone`) and `ActionButton` for `Pay now` / `Receipt` / `Renew`.
  - Loading state uses `SkeletonCard` rows; error state uses `ErrorNotice` with `Try again`; empty states use `EmptyNote` (with `Clear filter` when filtered).
  - Added 2 new render cases in `src/features/payments/paymentsScreen.render.test.tsx` (skeleton loading state, error with retry callback; 11 cases total).
- **Bookings (`src/app/(app)/bookings.tsx`, commit `5133862`)**:
  - `UserHeaderBand` given an optional `hideTitle` prop (`src/components/ui/UserHeaderBand.tsx`) so screens that already sit inside the stack header (`Bookings`, `Payments`) do not print the title twice; also fixed a conditional `useRole()` call in `UserHeaderBand` so the hook always runs unconditionally.
  - Photographer/client mode toggle switched to `SegmentedTabs` (fixed double horizontal padding); list header uses `SectionHeader` (`Your bookings` / `Booking requests` with count subtitle).
  - Cards restyled onto `c.card` / `c.border` surfaces with `IconTile` leading badge, `StatusBadge` (`statusTone`), and `ActionButton` for `Decline` / `Accept` / `Pay now`.
  - Loading state uses `SkeletonCard`; error state uses `ErrorNotice` with `Try again`; empty state uses `EmptyNote` with `Find a Photographer` CTA.
- **Direct booking form (`src/app/(app)/event/new.tsx`, commit `5133862`)**:
  - Wrapped in `KeyboardAvoidingView` with a sticky bottom action bar (`styles.stickyBar`) holding the primary CTA (`Book & pay …` / `Create event` / `Save changes`).
  - Direct-booking photographer banner converted to the screen's single `LinearGradient` (`gradients.heroBlue`) with high-contrast white labels (`#FFFFFF` / `rgba(255,255,255,0.82)` — fixing dark-blue text on blue gradient in dark mode).
  - Form sections grouped under pink `EVENT`, `WHEN`, and `ABOUT` eyebrows (`c.accent`), `c.card` / `c.border` surfaces on cover picker and inputs, pink `#F20C8F` active state on category chips for non-photographer roles, and bottom-aligned side-by-side time fields (`justifyContent: 'flex-end'` on `rowItem`) so `Start time` and `End time (optional)` boxes stay aligned when the label wraps at `1.6x`.

| Screen | Light | Dark | 1.6x | Notes |
|---|---|---|---|---|
| Payments (`connekt:///payments`) | seen | seen | seen | `heroBlue` summary (`Several currencies`: `RWF 50,000` + `$205.00`), pending alert `$120.00`, `SegmentedTabs`, pink `All` chip, `ListRow` + `StatusBadge` + `Pay now` / `Receipt` |
| Bookings (`connekt:///bookings`) | seen | seen | seen | `REQUESTS` eyebrow (no duplicate title), `Your bookings / 3 requests`, `PENDING` / `ACCEPTED` / `REJECTED` `StatusBadge`, `Find Available Matches` rescue card, plus error state (`ErrorNotice` + `Try again` recovery) verified |
| Direct booking form (`connekt:///event/new?...`) | seen | seen | seen | `heroBlue` booking banner (`BOOKING / Aline Mutesi / RWF 850,000`), `EVENT` / `WHEN` / `ABOUT` eyebrows, pink `#F20C8F` active `Weddings` chip, aligned `Start time` / `End time (optional)` inputs at `1.6x`, sticky `Book & pay RWF 850,000` bar |

## 4. Second-pass re-verification (directory 1.6x price and event Danger zone)

Both items that were fixed in code during the second pass but not yet re-seen on device were opened and screenshot-verified on the emulator:

| Item | Light | Dark | 1.6x | Result |
|---|---|---|---|---|
| Photographer directory price at `1.6x` (`connekt:///photographers`) | seen at `1.6x` | seen at `1.6x` | seen | Footer stacks price (`From RWF 850,000`, `From RWF 180,000`, `From $250.00`) above the `View profile ->` pill; zero `"Fro..."` truncation in either theme |
| Event `Danger zone` (`connekt:///event/e-del`, deletable fixture event) | seen | seen | seen | `Manage` card shows primary/outline action buttons (`Publish`, `Edit`, `Geo pricing`, `Share`, `Rate`), followed by a hairline divider, `DANGER ZONE` eyebrow, and quiet outlined red `Delete event` button (`dangerOutline`) |

# Fourth pass: Client–Photographer Dashboard Parity & Typography (2026-10-19)

Branch: `feat/client-dashboard-parity` (frontend only, no backend/API/payment changes, no fabricated data).

## 1. Overview, Analytics & Chart Parity Across Client Screens

| Screen | What changed to match Photographer dashboard | Data honesty & role separation | Verification |
|---|---|---|---|
| **Client Home** (`src/features/dashboard/ClientHome.tsx`, `src/features/client/ClientOverview.tsx`, `src/features/client/ClientCharts.tsx`) | Added header privacy toggle (`eye-off-outline` / `eye-outline`, 44×44, default `hidden = true`) masking amounts on `NextEventCard`, `PaymentCard`, and `ClientOverview`. Added **Your overview** section with `View analytics` CTA (`-> /analytics`), two `MetricCard`s (`Total spent` from wallet, `Payments due` from pending USD ledger), an events-by-stage `StatusBreakdownCard` (`SegmentRing` + legend), and three count tiles (`Bookings`, `Photos delivered`, `Saved photographers`). | `Total spent` uses `selectWalletStats(wallet, 'client').hero.value` in `wallet.currency` (never `CustomerAnalytics.totalSpent`, whose currency depends on cache freshness). `Payments due` sums `remaining(p)` in `USD`. Unknown figures show `N/A`. | Jest (`ClientHome.render.test.tsx`, `ClientCharts.test.tsx`) |
| **Client Wallet — Analytics Tab** (`src/app/(app)/(tabs)/wallet.tsx`, `src/features/client/ClientWalletAnalytics.tsx`) | Added the **Analytics** tab to the client `SegmentedTabs` (`Overview` / `Analytics` / `Activity`), matching the photographer wallet. Renders `Total spent` hero `Card`, `Processing` `MetricCard`, **Where your money goes** `StatusBreakdownCard` (`SegmentRing` over `selectWalletStats(wallet, 'client').cards`), period `SegmentedTabs` (`Today` / `Week` / `Month`), period `MetricCard`s (`Events`, `Photographers` with `trendCaption`), **Spending trend** (`TrendChart`), **Events in this period** (`CountBars` histogram), and `Open payments` / `Custom date range` actions. | Spending trend (`value1`) is relative-only with no currency label because the backend sums payments across currencies; event histogram (`value2`) shows real integer counts per interval. | Jest (`walletTab.render.test.tsx`, `ClientCharts.test.tsx`) |
| **Client Events Tab** (`src/features/events/ClientEventsDashboard.tsx`, `src/features/photographer/ScheduleView.tsx`) | Added **Your events by status** `StatusBreakdownCard` (`SegmentRing` summary) and `SegmentedTabs` layout switcher (`List` / `Month` / `Week` / `Agenda`) reusing `ScheduleView` with `variant="client"`. | `variant="client"` uses `eventStatus(event)` labels, shows `photographerName` instead of `clientName`, hides photographer-only `Accept`/`Decline` buttons and schedule-conflict banners, and leaves photographer `ScheduleView` default behaviour untouched. | Jest (`ClientEventsDashboard.render.test.tsx`, `ScheduleView.test.tsx`) |
| **Analytics Screen** (`src/app/(app)/analytics.tsx`) | Replaced legacy client `SaloPerformanceChart` with `SpendingTrendChart` (`TrendChart` area curve) and `EventsHistogram` (`CountBars` histogram). | Photographer `EventsChart` and coordinator charts remain untouched. | `tsc --noEmit` + Jest (`ClientCharts.test.tsx`) |
| **Payments Screen** (`src/app/(app)/payments.tsx`) | Added **Payments by status** `StatusBreakdownCard` (`Paid`, `Pending`, `Failed` counts and percentages) above the Activity section. | Unsettled viewer digital declarations (`unfinished`) remain excluded from owed counts. | Jest (`paymentsScreen.render.test.tsx`) |
| **Bookings Screen** (`src/app/(app)/bookings.tsx`) | Added **Bookings by status** `StatusBreakdownCard` (`Accepted`, `Pending`, `Rejected` counts and percentages) at the top of the direct bookings list. | Computed directly from the loaded `/bookings` list; hidden when empty or loading. | `tsc --noEmit` |

## 2. Typography Scale Pass (Client-Facing Screens)

All sub-12px body, meta, badge, pill, and caption font sizes (`7.5`–`11.5` and `fontSize.xs`) across client-facing screens were raised to a minimum of `12` (`12`–`13` meta, `14`–`15` body, `16`/`700` card titles, `17`/`800` section headers, `23`–`26`/`800` screen titles) to match the Photographer workspace scale:

- `src/app/(app)/photographers.tsx` & `src/features/photographers/DirectBookingMapView.tsx`
- `src/app/(app)/gallery.tsx`, `src/app/(app)/photobooks.tsx`, `src/app/(app)/content-albums.tsx`
- `src/app/(app)/album/new.tsx`, `src/app/(app)/photobook/new.tsx`, `src/app/(app)/content-album/new.tsx`
- `src/app/(app)/event/new.tsx` & `src/features/events/SatisfactionSurveySheet.tsx`
- `src/app/(app)/payments.tsx`, `src/features/payments/CheckoutSheet.tsx`, `src/features/payments/PaymentMethodPicker.tsx`
- `src/app/(app)/bookings.tsx`, `src/app/(app)/notifications.tsx`, `src/app/(app)/pay-on-tv.tsx`
- `src/app/(app)/(tabs)/wallet.tsx`, `src/app/(app)/(tabs)/inbox.tsx`, `src/app/(app)/(tabs)/profile.tsx`
- `src/app/(app)/analytics.tsx`, `src/app/(app)/donations.tsx`, `src/app/(app)/edit-profile.tsx`, `src/app/(app)/payment-accounts.tsx`, `src/app/(app)/preferences.tsx`, `src/app/(app)/transactions.tsx`, `src/app/(app)/tv-devices.tsx`

## 3. Verification Honesty

- **TypeScript (`npx tsc --noEmit`)**: 0 errors.
- **Jest (`npx jest`)**: All touched and regression suites pass (`ClientHome.render.test.tsx`, `PhotographerHome.render.test.tsx`, `ClientCharts.test.tsx`, `walletTab.render.test.tsx`, `WalletAnalytics.test.tsx`, `ClientEventsDashboard.render.test.tsx`, `ScheduleView.test.tsx`, `paymentsScreen.render.test.tsx`).
- **Device / Emulator**: Not run in this pass (`adb devices` had no physical phone attached and host free physical RAM was ~970 MB, below the ~2 GB required to boot the Android emulator and Metro). Visual verification of this fourth pass is via `react-test-renderer` Jest tests only.


## 5. Gap-closing device pass and batch 2 audit (2026-10-20, emulator)

Device: Pixel 5 emulator (API 34, software rendering). No physical phone. No iOS.

| Screen | Light | Dark | 1.6x | Result |
|---|---|---|---|---|
| Photobooks list | seen | seen | seen | clean, chips and cards intact |
| Photobook detail (no cover) | not re-seen | not seen | seen | FOUND: hero caption overlapped the chips and title. Fixed (caption removed, icon higher), re-seen |
| Inbox | seen | seen | seen | clean |
| Notifications | seen | seen | seen | clean |
| Profile | seen | not seen | seen | FOUND: "Member since Recent" invented a date. Line now omitted when there is no join date (code only, not re-seen) |
| Photographer profile | seen | seen | seen | clean |
| Edit profile, Preferences, Two-factor, Blocked accounts, Delete account, Donate, Transactions, Content albums | seen | seen (listed screens other than Edit profile and Delete account captured; two captures landed on the wrong screen) | seen (Edit profile did not navigate) | Coherent with the rest of the app, no overlap or clipping at 1.6x. Not restyled. |

Batch 2 findings, not changed: Content albums shows a second "New Content Album" button next to the empty-state one, and its search placeholder truncates at 1.6x; Transactions shows backend description text (for example "MS1_PHOTOBOOK_HOLD ...") verbatim; Blocked accounts has a large empty gap above the empty state.

Not verified: booking wizard, conversation, Photobook detail with photos in dark, any screen on a physical phone or iOS, scroll smoothness.

## 6. Batch 3: settings and account screens (2026-10-20, emulator)

Branch `feat/client-dashboard-batch3`. Frontend only; no merge, push to main or OTA from this branch. Device: Pixel 5 emulator, fixture backend with synthetic data; no physical phone, no iOS.

| Screen | What changed | Light | Dark | 1.6x |
|---|---|---|---|---|
| Transactions | Backend codes shown in words (`movementLabel.ts`, 3 tests), shared Chip filters (wrap at 1.6x), ListRow cards with icon tiles | seen | seen | seen |
| Blocked accounts | ListRow group with avatar and Unblock action, skeleton, error retry, compact empty state (gap removed) | seen (empty state) | seen (empty state) | seen (empty state) |
| Two-factor | Status card with ON/OFF badge, grouped sections, separated DANGER ZONE for disable | seen (off state) | seen (off state) | seen (off state) |
| Delete account | Consequences as ListRows, separated DANGER ZONE with typed DELETE confirmation | seen | seen | seen (text no longer truncated) |
| Donate | Hero donate action, suggested amounts, history as ListRows, skeleton, error, empty | seen | seen | seen |
| Preferences | App and Alert types sections, icon tiles, toggles with accessibility labels | seen | seen | seen |
| Edit profile | Profile header card, grouped field sections, sticky solid Save bar | seen | seen | seen |
| Content albums | Shared chips, single New Content Album action, shorter search placeholder, skeleton, error, empty | seen | seen | seen |
| Booking wizard (step 1) | not changed | seen | seen | seen |
| Conversation | not changed | seen | seen | seen |

Shared changes (defaults unchanged for existing screens): `SectionHeader`, `UserHeaderBand` and `ErrorNotice` gained an opt-in `flush`; `ListRow` gained `titleLines`.

Not seen: Blocked accounts with real blocked users, its error state, and the loading skeletons on every screen (the fixture answers instantly); Two-factor in the enabled and QR setup states; Edit profile as a coordinator; Donate history with rows; Transactions pagination; photobook detail with photos in dark (the fixture book has no photos). Existing lint errors remain in `blocked-accounts.tsx`, `preferences.tsx` and `transactions.tsx` (set-state-in-effect, memoization), which predate this branch.
