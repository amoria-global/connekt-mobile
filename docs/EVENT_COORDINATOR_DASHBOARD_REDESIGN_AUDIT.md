# Event-coordinator dashboard redesign: audit and verification record

Branch `feat/event-coordinator-dashboard-redesign`, started from `main` at `951a23b` (the merge of client batch 3, which holds the accepted Client Dashboard and its shared kit). Frontend only: no backend, API contract, payment, auth or permission change.

## How this was verified, and what that does and does not prove

- Android emulator (Pixel 5, API 34, software rendering), dev client, light, dark and 1.6x system font scale, over a **throwaway local fixture backend with synthetic data** (outside the repo). The coordinator endpoints are the fixture's, not the real backend's, so real coordinator data was **not** seen. The fixture can delay and fail every request, which is how loading and error states were checked.
- No physical phone and no iOS device or simulator were used. Nothing here claims iOS or phone behaviour.
- Tapped end to end on the emulator: Overview retry and trends retry on Home (with failures switched off, data loaded). Not tapped: Pay now, Edit, Share, QR, Message, Add to favorites, Unpublish, Delete, Withdraw, event creation. Those are covered only by the render tests where noted.
- Jest runs against a faked transport (react-test-renderer), not a device.

## What was already correct (kept)

- Role plumbing: `useRole`, the coordinator endpoints in `events/api.ts`, `analytics/api.ts`, `clients/api.ts`, the event page's owner actions (publish, pause, resume, edit, geo pricing, QR, rate, delete with confirmation). Untouched.
- The shared screens already restyled for clients (Payments, Transactions, Gallery, Photographers, Notifications, Inbox, Profile layout, event detail layout) render correctly as a coordinator. They were not restyled again.

## Confirmed defects found and fixed

| # | Where | Defect | Fix | Pinned by |
|---|---|---|---|---|
| 1 | Home | Metrics showed `0` when analytics failed; revenue labelled in a guessed currency before the wallet loaded; pending payments summed and labelled in the wallet currency though the feed is USD ledger values; spinner while loading; failed payments read hidden as "nothing due" | Skeletons, `N/A` plus retry, revenue `N/A` until wallet currency known, dues formatted USD and masked until shown, failed payments read is an error | `CoordinatorHome.render.test.tsx` (10) |
| 2 | Home trend card | Always drew a decorative wave; hard-coded `0` anchor labels; apex label fell back to `60` or `$60` for a real zero; `$0.00` headline when analytics failed; money unmasked | Wave, anchors and apex only for a real series; "No trend data for this period" otherwise, or "Trend data could not be loaded" on failure; `N/A` when unknown; `hidden` masks money | `PerformanceWaveCard.render.test.tsx` (5) |
| 3 | Wallet | `toRole("Coordinator")` fell through to the client view: hero read "Total spent", client vocabulary and filters. Coordinators also kept the old single long screen | `toRole` accepts both spellings; coordinators get Overview and Activity tabs (no Analytics tab: it charts client spend or photographer earnings); breakdown headed "Balance breakdown" | `moneyView.test.ts` (2), `walletTab.render.test.tsx` (updated) |
| 4 | Clients, Client detail | A refused read (HTTP 200, `action: 0`) showed "No clients yet" or a blank client called "Client"; hard-coded favourite colours ignored dark mode; spinner; error without retry; doubled title | `requireOk` on all reads, first failure rethrown unless a legacy fallback read worked; skeletons, ErrorNotice with retry, ListRow cards, MetricCards | `ClientsScreens.render.test.tsx` (6) |
| 5 | Profile | Coordinator stats drew `Events 0`, `Rating 5.0` and a fixed `Status Active` when the account had none | `coordinatorStats`: dash for a missing figure, real identity status | `clientStats.test.ts` (3) |
| 6 | Event page | Two stacked "Booking Progress" cards for every client and coordinator | `progressView()` picks one | `bookingTrack.test.ts` (4) |
| 7 | Events tab | Separate 1,100 line `OwnerEventsDashboard`, two-column dense grid, pink FAB | Coordinator mode of the night-studio events screen (own feed, Photographers and Geo pricing, client named on the card, Manage event and Control live open the event page); old file removed | `CoordinatorEvents.render.test.tsx` (6) |
| 8 | 1.6x text | Client email and long names cut in Clients rows; venue cut on the event page | `ListRow.metaLines` (default unchanged), event detail cards allow five lines | device check |

## Screen by screen (coordinator role)

Legend: L light, D dark, B 1.6x text, S skeleton, E error and retry. "yes" means seen on the emulator after the final change unless noted.

| Screen | Change | L | D | B | S | E | Notes |
|---|---|---|---|---|---|---|---|
| Home | Rebuilt (ClientHome reading order and kit) | yes | yes | yes | yes | yes | Retry tapped for Overview and trends; Action required, Upcoming and Performance errors seen, not tapped |
| Events tab | Coordinator mode of shared screen | yes | yes | yes | yes | yes | Event date pill is one line and ellipsised at 1.6x (shared with the accepted client screen, left) |
| Clients | Restyled | yes | yes | yes | yes | yes | Not in the coordinator More sheet; reached from Home Overview |
| Client detail | Restyled | yes | yes | yes | no | no | Error and skeleton covered by tests only |
| Event detail | Duplicate card fixed; 1.6x lines | yes | yes | yes | no | no | Manage actions not tapped |
| Wallet | Role fix, tabs | yes | yes | no | no | yes | Full-screen error state is the older style (shared with client), not restyled |
| Profile | Stats fix | seen before the fix only | no | no | no | no | Fix covered by tests; **not re-seen on device** |
| Payments, Transactions, Gallery, Photographers, Notifications, Inbox, More sheet | None (shared, already restyled) | yes | no | no | no | no | Fixture has no coordinator albums, so Gallery showed an empty state |
| Analytics | None | yes | no | no | no | no | |
| Geo pricing | None | yes | no | no | no | no | Own form layout, left as is |
| Candidates | None | yes | no | no | no | no | |
| Event create sheet | None | top of form only | no | no | no | no | Not exercised; no event was created |
| Live stream control | None | n/a | n/a | n/a | n/a | n/a | Camera screen, emulator has no camera |
| Settings screens (edit profile, preferences, two-factor, blocked, delete, donate), KYC, TV, map, bookings | None | not opened as a coordinator | | | | | Restyled in client batch 3; not checked in the coordinator role |

## Regression checks

- Client role, emulator: Home, Events (Explore events present, client wording), event page (one Booking Progress), Wallet (Overview, Analytics, Activity, "Total spent") all unchanged and correct, light.
- Photographer role: **not checked on a device**. Their Jest suites (home, events, wallet tabs, payroll, schedule) pass. Shared code touched: `ListRow` gained an optional prop (default unchanged); `PerformanceWaveCard` is used only by the coordinator Home; `listClients` and `getClient` now throw on a refused read, so a photographer's Clients screen shows an error with retry instead of an empty list when the read fails; `progressView` keeps the stepper for photographers.

## Not changed, by design

Backend, API paths and payloads, booking and scheduling rules, payments and checkout, authentication, notification rules. The coordinator pending-payments feed maps `amountInUsd` first and falls back to `amount`; if a coordinator payment lacks the USD field it is still labelled USD. That is existing mapper behaviour and a backend data question, noted rather than changed.

## Checks

- `npx tsc --noEmit`: exit 0.
- Full Jest: 117 suites passed, 912 passed, 1 skipped (913).
- ESLint on changed files against `951a23b`: errors 7 to 2 (the 2 remain in `wallet.tsx`, pre-existing); warnings 12 to 14 (`require()` in jest mock factories, the same pattern the client tests use). Whole-repo lint is not clean and was not before.
