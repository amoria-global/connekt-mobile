# Photographer internal screens audit

Branch `feat/photographer-internal-screens` (from `main` at `782faba`). Unmerged, unpublished.
Companion to `PHOTOGRAPHER_WORKSPACE_AUDIT.md`, which covers Home, Wallet, Analytics and Events.

## Honest summary

This is still a partial completion of the larger brief (second commit on the branch). Route discovery is complete. The shared building blocks are corrected for photographers
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

## Second round: shared overlays and the payroll report

| Piece | What it is | Status |
|---|---|---|
| `components/ui/dialog.tsx` | A themed confirmation dialog with the exact `Alert.alert(title, message, buttons, options)` shape. Photographer sessions get it, drawn from the app tokens (Cancel outlined, destructive outlined in the error colour, never white on light red). Back and a backdrop tap act as Cancel. Dialogs queue. Every other role, and any call made before the host is mounted, uses the native alert with the arguments forwarded unchanged. `<DialogHost />` is mounted once in `(app)/_layout.tsx`. The native alert cannot be restyled, which is why this exists | Implemented, unit tested (6 tests). Not seen on a device |
| Alert call sites | 30 files now import `Alert` from the dialog module instead of `react-native`: profile, album, album/new, blocked-accounts, bookings, client, collaborate album and joined, conversation, event detail, candidates, geo-pricing, event/new, notifications, packages, payment-accounts, photobook, tv-devices, the More sheet sign out, booking-request and opportunity notifiers, BookingsList, PhotographerHome, EventCard, Events dashboard, KYC flows, ReportSheet, AddAccountSheet, Goals | Implemented. Behaviour for non photographers is unchanged |
| `components/ui/Sheet.tsx` | Bottom sheet: handle, title, 48dp close, scrolling body that keeps taps on inputs, keyboard avoidance, bottom safe area, pinned footer for the primary action. `busy` makes Back, the backdrop and the close button inert so a request in flight cannot be orphaned | Implemented, unit tested (3 tests). Adopted by Goals (create, edit, delete). Not seen on a device |
| Payroll report | `PayrollReport` figures are `number or null`, `entries` is `null` when the response carries no list. A figure is `$0.00` only when the backend sent a numeric 0. No figures and no list is "unavailable", with a retry. A failed request, or HTTP 200 with `action: 0`, is an error with a retry. A confirmed empty list says "No earnings yet". The screen uses the photographer kit (cards, icon tiles, status words, skeletons) | Implemented. Unit tested (5 contract tests) and render tested (5 screen tests). Not seen on a device |

Why payroll showed `$0.00`: `getPayrollReport` used `num()`, which turns a missing field into 0, and the screen then drew those zeros beside "No earnings yet". The web behaviour was not available to compare here; the rule applied is the one used for the Withdraw balance.

## Coverage matrix

Legend: V = viewed on Android emulator, dark mode, fixture backend (not a live account). Shared = changed through a shared component, not individually viewed. Light mode, 1.6x text, loading and error states were NOT checked on these screens.

| Route | Entry point | Status |
|---|---|---|
| `transactions` | More, Wallet | V before and after, restyled |
| `clients` | More, Home | V before and after (duplicate title removed) |
| `packages` | Home | V before and after (duplicate title removed) |
| `bookings` | Home Opportunities, More | V before and after (duplicate title removed) |
| `payment-accounts` | Wallet | V before, duplicate title removed through the shared header, not re-viewed |
| `payroll` | Wallet, Analytics | V before. Rewritten in round two (unknown is never zero, kit styling). Render tested, not re-viewed on a device |
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

- **Device verification of round two.** The Android emulator was started three times for this round and the system process hung each time ("System UI isn't responding" / "Process system isn't responding"). The host had about 1.9 GB of its 8 GB free, which is the likely cause. After the third failure with a smaller emulator I stopped. So the themed dialog, the Sheet, the Goals sheet and the payroll screen are covered by unit and render tests only, NOT by a screenshot. I also did not restyle the large forms blind.
- **Not restyled:** `event/new` (1.7k lines), `event/[id]` (1.2k), `album/[id]` (1.6k), `analytics` (2.8k) and their own inputs, plus the More sheet and the Events dashboard's accept, decline and sort sheets (they were already designed with the dashboard and were not moved onto `Sheet`). Their Alert dialogs are themed through the dialog module, but their layouts are as before. Moving them needs the visual check that was not possible.
- **Light mode, large text and iOS** were not exercised on any of these screens. A dialog shown while another native Modal is open has not been tried on iOS.
- `wallet/movements` is an orphan route with no entry point. Left alone.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npx jest`: 76 suites, 597 passed, 1 skipped. New: `photographerChrome.test.tsx` (6), `dialog.test.tsx` (6), `Sheet.test.tsx` (3), `payrollView.test.ts` (5), `payroll.render.test.tsx` (5). Two existing tests (Goals, Events dashboard) needed their mocks extended for the dialog and Sheet; no assertion was weakened.
- `npm run lint`: 359 errors, the same files and counts as `main` before this branch (compared per file).
- Emulator: Pixel 5 API 34, dark mode, fixture backend with a temporary sign-in bypass. The harness and bypass are removed and absent from the diff.
