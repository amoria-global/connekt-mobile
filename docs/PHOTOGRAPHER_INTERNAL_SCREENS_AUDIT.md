# Photographer internal screens audit

Branch `feat/photographer-internal-screens` (from `main` at `782faba`). Unmerged, unpublished.
Companion to `PHOTOGRAPHER_WORKSPACE_AUDIT.md`, which covers Home, Wallet, Analytics and Events.

## Honest summary

This pass is partial. Route discovery is complete. The shared building blocks are corrected for photographers
(other roles are unchanged), and a first set of internal screens was checked on the Android emulator in dark mode
against a fixture backend. Many screens are NOT individually restyled or verified, and the table below says which.
The dark-mode pass (earlier) had already moved every internal screen onto the navy palette, so the remaining gap
was composition, not colour.

## Navigation map (photographer role)

- Tabs (custom bar): Home, Events, Wallet, Inbox, More (a sheet, not a route). `profile` is a hidden tab reached from the top bar avatar.
- More sheet (photographer): Profile, Streams, Opportunities, Clients, Collaborate, Transactions, Donate, Alerts, Settings, Sign out.
- Home: Create event, Opportunities (`/bookings?tab=opportunities`), Collaborate, event cards (`/event/[id]`), Analytics, Goals sheet, Gallery, Photobooks, Packages, Clients, recent earnings.
- Wallet: Withdraw, Transactions, Payment accounts, Earnings report (`/payroll`), Analytics tab, activity detail sheet.
- Events: calendar, event cards to `/event/[id]`, QR, Create album (`/album/new`), Live stream control (`/stream/control/[id]`), Content toggle (`/content-albums`, `/content-album/new`).
- Notification taps route to `/event/[id]`, `/event/candidates`, `/payment/[id]`, `/album/[id]`, `/photobook/[id]`, `/conversation/[id]`, `/bookings?tab=opportunities`, `/gallery`, `/wallet`.
- Registered but no photographer entry point: `wallet/movements` (no inbound link at all), `event/hybrid-wizard` (non photographer More only), `stream/[id]`, `map`, `find-my-photos`, `photographers`, `photographer/[id]` (viewer and client branches, notification routing only).
- Overlays with their own `<Modal>`, no shared sheet primitive exists: More sheet, sort sheet and accept/decline sheets in the Events dashboard, EventQrSheet, SatisfactionSurveySheet, IncomingOpportunityAlertModal, BookingRequestCallModal, GoalsSection, wallet activity sheet, inbox sheets, checkout and payment-account sheets, ReportSheet, KYC flows, stream studio sheets.

## What changed (shared, photographer only via `useRole().isPhotographer`)

| Component | Photographer now | Other roles |
|---|---|---|
| `Button` | 48dp, 12dp radius | 52dp pill (unchanged) |
| `Segmented` | bordered track, filled primary selected segment, `selected` accessibility state, 42dp | unchanged |
| `ScreenHeader`, `DataList`, `UserHeaderBand` | `duplicatesHeader` prop: when the native stack header already shows the same title, only the subtitle remains as a lead line. 22sp titles elsewhere | title always shown |
| `EmptyState` | 56dp rounded tile icon | circle (unchanged) |
| `DataList` retry | outlined 44dp control | filled (unchanged) |

Screens given `duplicatesHeader` (title is identical to the native header): Transactions, Clients, My Packages, Payment accounts, Donate, Live Streams, Manage TVs, Geo pricing, Blocked accounts, Bookings. Screens whose in-body title differs from the native one keep it (Withdraw, Two-factor, Preferences).

Transactions (shared with other roles, improvements only): filter chips 40dp (were 30dp), search field 44dp, rows no longer cut a title to one line, tighter radius, no literal `#ffffff`.

## Coverage matrix

Legend: V = viewed on Android emulator, dark mode, fixture backend (not a live account). Shared = changed through a shared component, not individually viewed. Light mode, 1.6x text, loading and error states were NOT checked on these screens.

| Route | Entry point | Status |
|---|---|---|
| `transactions` | More, Wallet | V before and after, restyled |
| `clients` | More, Home | V before and after (duplicate title removed) |
| `packages` | Home | V before and after (duplicate title removed) |
| `bookings` | Home Opportunities, More | V before and after (duplicate title removed) |
| `payment-accounts` | Wallet | V before, duplicate title removed through the shared header, not re-viewed |
| `payroll` | Wallet, Analytics | V before, unchanged. Shows `$0.00` totals when the report is empty, see gaps |
| `withdraw` | Wallet | V before, unchanged. Continue button sits under the gesture bar until scrolled |
| `collaborate/index` | More, Home | V before, unchanged (already consistent) |
| `photobooks` | Home, Events | V before, unchanged |
| `gallery` | Home, profile | V before, unchanged |
| `edit-profile` | profile | V before, unchanged (buttons now 48dp flat) |
| `notifications` | top bar bell | V before, unchanged |
| `profile` | top bar avatar | V before, unchanged |
| `event/[id]` | Home, Events | V, but the fixture has no single event endpoint so only the empty shell was seen |
| `donations`, `streams`, `tv-devices`, `blocked-accounts`, `event/geo-pricing` | profile, More | Shared (duplicate title removed), not viewed |
| `album/new`, `album/[id]`, `content-albums`, `content-album/new`, `photobook/new`, `photobook/[id]`, `conversation/[id]`, `client/[id]`, `collaborate/album/[id]`, `collaborate/joined/[id]`, `collaborate/join/[token]`, `package/new`, `two-factor`, `preferences`, `kyc`, `payment/[id]`, `payments`, `event/new`, `event/candidates`, `stream/control/[id]`, `analytics` | various | Not individually reviewed. Receive the 48dp button and Segmented changes where they use those components |
| Overlays listed above | various | Not restyled. No shared sheet primitive exists |

## Not done, and why

- A full restyle of the long form and detail screens (`event/new` 1.7k lines, `album/[id]` 1.6k, `event/[id]` 1.2k, `analytics` 2.8k). They use their own inputs and `Alert.alert` dialogs. Doing them properly needs a shared sheet, field and row primitive first, which is the recommended next step, not something to rush into one change.
- Light mode and large text were not exercised on these screens. iOS was not exercised at all.
- `payroll` shows `$0.00` for Total, Paid and Pending beside "No earnings yet" when the report returns nothing. Whether that is a real zero or a missing report is not distinguishable from the client, so it needs a decision before it is changed.
- `wallet/movements` is an orphan route with no entry point. Left alone.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npx jest`: 72 suites, 578 passed, 1 skipped (new `photographerChrome.test.tsx`, 6 tests: duplicate title rules per role, Button shape per role).
- `npm run lint`: 585 problems (359 errors), identical to `main` before this branch.
- Emulator: Pixel 5 API 34, dark mode, fixture backend with a temporary sign-in bypass. The harness and bypass are removed and absent from the diff.
