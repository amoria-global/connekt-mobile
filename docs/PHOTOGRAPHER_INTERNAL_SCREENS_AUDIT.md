# Photographer internal screens audit

Branch `feat/photographer-internal-screens` (from `main` at `782faba`). Unmerged, unpublished.
Companion to `PHOTOGRAPHER_WORKSPACE_AUDIT.md`, which covers Home, Wallet, Analytics and Events.

## Honest summary

This is still a partial completion of the larger brief (third commit on the branch). Round three was checked on the Android emulator after closing Chrome freed enough RAM (the earlier hangs were host memory and CPU, not the app). Route discovery is complete. The shared building blocks are corrected for photographers
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
| `components/ui/dialog.tsx` | A themed confirmation dialog with the exact `Alert.alert(title, message, buttons, options)` shape. Photographer sessions get it, drawn from the app tokens (Cancel outlined, destructive outlined in the error colour, never white on light red). Back and a backdrop tap act as Cancel. Dialogs queue. Every other role, and any call made before the host is mounted, uses the native alert with the arguments forwarded unchanged. `<DialogHost />` is mounted once in `(app)/_layout.tsx`. The native alert cannot be restyled, which is why this exists | Implemented, unit tested (6 tests). **Seen on the emulator** (dark and light, 1.6x text): Sign Out dialog, Cancel and Back both dismiss it and leave the user signed in |
| Alert call sites | 30 files now import `Alert` from the dialog module instead of `react-native`: profile, album, album/new, blocked-accounts, bookings, client, collaborate album and joined, conversation, event detail, candidates, geo-pricing, event/new, notifications, packages, payment-accounts, photobook, tv-devices, the More sheet sign out, booking-request and opportunity notifiers, BookingsList, PhotographerHome, EventCard, Events dashboard, KYC flows, ReportSheet, AddAccountSheet, Goals | Implemented. Behaviour for non photographers is unchanged |
| `components/ui/Sheet.tsx` | Bottom sheet: handle, title, 48dp close, scrolling body that keeps taps on inputs, keyboard avoidance, bottom safe area, pinned footer for the primary action. `busy` makes Back, the backdrop and the close button inert so a request in flight cannot be orphaned | Implemented, unit tested (3 tests). Adopted by Goals. **Seen on the emulator** (dark): handle, title, close, pinned Save goal, inline validation errors on an empty save with no request sent |
| Payroll report | `PayrollReport` figures are `number or null`, `entries` is `null` when the response carries no list. A figure is `$0.00` only when the backend sent a numeric 0. No figures and no list is "unavailable", with a retry. A failed request, or HTTP 200 with `action: 0`, is an error with a retry. A confirmed empty list says "No earnings yet". The screen uses the photographer kit (cards, icon tiles, status words, skeletons) | Implemented. Unit tested (5 contract tests) and render tested (5 screen tests). **Seen on the emulator** (dark, light, 1.6x text) with a fixture that returns no figures: every tile says Unavailable and a Try again notice shows, never $0.00. A real confirmed zero was only tested by render test |

Why payroll showed `$0.00`: `getPayrollReport` used `num()`, which turns a missing field into 0, and the screen then drew those zeros beside "No earnings yet". The web behaviour was not available to compare here; the rule applied is the one used for the Withdraw balance.

Round three, found by looking at the running app:

- **Event detail (`event/[id]`):** the details were a grid of nine tinted cards with a wrapping time. Photographers now get one compact list with icon tiles, labels, values and hairlines. Other roles keep the grid. Viewed dark and light, and at 1.6x text.
- **New event (`event/new`):** the in-body "New event" repeated the sheet header, so it is dropped for photographers when creating. "Edit event" keeps its in-body title because the native header always says "New event". The form itself (cover, fields, date and time pickers, who covers the event, Create event) already matched the design system and was left alone.
- **A bug I introduced and device testing caught:** `payroll.render.test.tsx` lived under `src/app/(app)/`, so Expo Router bundled it as a route and the app crashed with "Property 'afterEach' doesn't exist". The test now lives in `src/features/wallet/`. No other test file is under `src/app`.
- **Large text:** payroll's "Unavailable" broke mid-word at 1.6x. It now shrinks to one line.

## Round four: remaining screens on the emulator (dark, fixture backend)

Looked at on the Android emulator this round: booking request call screen, `album/new`, `content-albums`, `content-album/new`, `photobook/new`, `photobook/[id]`, `package/new`, `two-factor`, `preferences`, `kyc` (details step), `payments`, `client/[id]`, `conversation/[id]`, `event/candidates`, `stream/control/[id]`, `payment/[id]`, `collaborate/album/[id]`, `withdraw`, and the Events dashboard (week view, Pending filter, Accept sheet, Decline sheet). All already sit on the navy palette. Defects found and fixed:

- **Keyboard hid the whole decline form (Android).** The booking request call screen, the two Decline sheets (Events dashboard and event detail) and every shared `Sheet` only avoided the keyboard on iOS. On Android the reason field and the Decline button disappeared behind the keyboard. The call screen now pads while the decline box is open. Both Decline sheets now use the shared `Sheet`, and `Sheet` pads on every platform (this also covers the Goals sheet). Seen fixed on the emulator: field and button stay above the keyboard.
- **`event/candidates` crashed** ("Cannot read property 'map' of undefined") when the hybrid options response had no `escrowOptions`, because the default list was overwritten by `undefined`. The default is now kept unless the response carries a real list.
- **Blank labelled fields.** `package/new` (Currency) and `content-album/new` (Category, Currency) showed a label with nothing under it when the list was empty or failed. New `OptionsNote` says "Loading ..." or "... unavailable. Tap to retry." and retries on tap. Unit tested.
- **`package/new`** drops its repeated "New package" body title when creating (kept for editing).
- **`payment/[id]`** showed a bare dash when the amount was unknown; it now says "Amount unavailable".
- Booking request call screen: the time range used an en dash, now "14:00 to 16:00".

Accept on the Events dashboard: the sheet closes and nothing crashes, but the fixture backend does not change the event, so the resulting state change is not verified.

## Coverage matrix

Legend: V = viewed on Android emulator, dark mode, fixture backend (not a live account). Shared = changed through a shared component, not individually viewed. Light mode, 1.6x text, loading and error states were NOT checked on these screens.

| Route | Entry point | Status |
|---|---|---|
| `transactions` | More, Wallet | V before and after, restyled |
| `clients` | More, Home | V before and after (duplicate title removed) |
| `packages` | Home | V before and after (duplicate title removed) |
| `bookings` | Home Opportunities, More | V before and after (duplicate title removed) |
| `payment-accounts` | Wallet | V before, duplicate title removed through the shared header, not re-viewed |
| `payroll` | Wallet, Analytics | V after the rewrite (dark, light, 1.6x). Unknown is never zero. Fixture returned no figures, so the Unavailable state was seen. Confirmed zero and a populated list are render tested only |
| `withdraw` | Wallet | V before, unchanged. Continue button sits under the gesture bar until scrolled |
| `collaborate/index` | More, Home | V before, unchanged (already consistent) |
| `photobooks` | Home, Events | V before, unchanged |
| `gallery` | Home, profile | V before, unchanged |
| `edit-profile` | profile | V before, unchanged (buttons now 48dp flat) |
| `notifications` | top bar bell | V before, unchanged |
| `profile` | top bar avatar | V before, unchanged |
| `event/[id]` | Home, Events | V dark, light, 1.6x. Details restyled (see round three). Action buttons, Booking Progress and Booking Details cards were seen and left as they are |
| `event/new` | Home, Events | V dark. Form already consistent, duplicate title removed. Validation, submission and failure paths were not exercised |
| `album/[id]` | Events, gallery | V dark with fixture photos: 3 column grid, consistent thumbnails, actions row. The owner sees a card naming themself as photographer, left as is |
| `analytics` | Home, Wallet | V dark, full scroll. Structure is consistent with the wallet analytics. The Performance legend reads "Current V1 / Current V2", the backend's unlabeled series, left alone because its meaning is not documented |
| More sheet | bottom bar | V dark. Already a grid of icon tiles with search, no change needed |
| `donations`, `streams`, `tv-devices`, `blocked-accounts`, `event/geo-pricing` | profile, More | Shared (duplicate title removed), not viewed |
| `album/new`, `content-albums`, `content-album/new`, `photobook/new`, `photobook/[id]`, `conversation/[id]`, `client/[id]`, `collaborate/album/[id]`, `package/new`, `two-factor`, `preferences`, `kyc`, `payment/[id]`, `payments`, `event/candidates`, `stream/control/[id]` | various | V dark in round four (empty or fixture data). Defects fixed are listed above |
| `collaborate/joined/[id]`, `collaborate/join/[token]` | collaborate | Not individually reviewed |
| Overlays | various | Decline sheets moved to the shared `Sheet`; Accept sheet seen and consistent; other overlays unchanged |

## Not done, and why

- **Still not reviewed on a device:** `collaborate/joined/[id]`, `collaborate/join/[token]`, the Events sort sheet, KYC steps after Details (camera steps cannot run on the emulator, as with `stream/control`'s camera), and `withdraw` past the amount step. Light mode and 1.6x text were not re-checked on the round four screens.
- **Flows not exercised:** event creation submit and failure, goal save and delete on a live backend, photobook resubmit, accept and reject of a booking, load older transactions on a real account. Only validation and dismissal were driven.
- **iOS** was not exercised at all, and a dialog opened while another native Modal is open has not been tried on iOS.
- Fixture data only. No live account was used.
- `wallet/movements` is an orphan route with no entry point. Left alone.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npx jest`: 77 suites, 600 passed, 1 skipped (re-run after the final edits). New: `photographerChrome.test.tsx` (6), `dialog.test.tsx` (6), `Sheet.test.tsx` (3), `payrollView.test.ts` (5), `payroll.render.test.tsx` (5). Two existing tests (Goals, Events dashboard) needed their mocks extended for the dialog and Sheet; no assertion was weakened.
- `npm run lint`: 359 errors, the same files and counts as `main` before this branch (compared per file).
- Emulator: Pixel 5 API 34, dark mode, fixture backend with a temporary sign-in bypass. The harness and bypass are removed and absent from the diff.
