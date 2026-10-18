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
