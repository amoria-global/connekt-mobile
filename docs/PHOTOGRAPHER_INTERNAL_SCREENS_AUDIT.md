# Photographer internal screens audit

Branch `feat/photographer-internal-screens` (from `main` at `782faba`). Unmerged, unpublished.
Companion to `PHOTOGRAPHER_WORKSPACE_AUDIT.md`, which covers Home, Wallet, Analytics and Events.

## Honest summary

This is still a partial completion of the larger brief (fifth commit on the branch; the last round could not use the emulator, see round five). Round three was checked on the Android emulator after closing Chrome freed enough RAM (the earlier hangs were host memory and CPU, not the app). Route discovery is complete. The shared building blocks are corrected for photographers
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

## Round five: analytics legend, interaction tests, remaining routes

**Analytics legend (traced end to end).** `Current V1` and `Current V2` are the web dashboard's own placeholder tooltips (`PerformanceChart.tsx`), which the mobile chart copied. The meaning comes from the backend, `PhotographerDashboardController.getPerformanceChart` (`/photographer/performance`): `value1` is the sum of `paidAmount - refundedAmount` over payment declarations created in each bucket for events where this user is the photographer (`EventPaymentDeclarationRepository.sumPaidAmountByPhotographerIdAndDateRange`), and `value2` is the count of the photographer's events in the bucket. The two series use different units and share one Y axis on mobile, so event counts look tiny beside amounts. The amounts are summed as stored with no currency conversion, so no currency is named. The photographer legend now reads "Net payments received" and "Events". Calculations and the shared axis are unchanged. The customer and coordinator endpoints return the same two field names (spent or revenue, and an event count) but were not audited for this screen, so other roles keep the old legend text. The web dashboard still shows `Current V1/V2` (separate repository, not changed).

**Accept and decline, fixture verified.** `PhotographerEventsDashboard.bookings.render.test.tsx` (7 tests, fake transport, not the real backend) renders the real dashboard with a pending booking. Accept posts once to `/photographer/events/p1/accept`, closes the sheet and, after the refresh returns the event as accepted, the Accept control is gone. An HTTP 200 with `action: 0` keeps the booking pending and the sheet open, shows "Could not accept" and does not refresh. Cancel and Back dismiss without a request. The confirm control is disabled while a request runs and only one request is sent. Decline sends the typed reason once, closes the sheet, and the card loses Deny after the refresh. A refused decline keeps the sheet and the typed reason and shows "Could not decline". Back dismisses without a request but is ignored while one is in flight. Limitation: the visible outcome is proved against fixture responses. A real accept or decline was never sent anywhere.

**Withdrawal, fixture verified.** `withdrawFlow.render.test.tsx` (11 tests, fake withdrawals API, never a real transfer) renders the real Withdraw screen. Amount then donation validation run before anything is sent. No account blocks Continue and links to Payment accounts. An unreadable balance shows an error with retry and not a zero. Initiate sends the USD amount with the chosen account and source. The fee summary and code step render. A short code is refused locally. A wrong code keeps the screen and counts attempts. A correct code shows "Request submitted". A dropped connection is reported as unknown, neither success nor failure. A second confirm is blocked while one is in flight. A KYC or plain refusal shows its reason with the right next step. The Withdraw form no longer repeats its title under the native header.

**Collaboration invite, fixture verified.** `joinInvite.render.test.tsx` (10 tests, controlled token, fake API): open invite, each blocked state (owner, removed, revoked, expired) with its own explanation and no Join button, already a member opens the album, an unreadable link says so with a way out, join succeeds once, a failed join keeps the invite and the reason and allows a retry, and a second tap while joining is blocked. `collaborate/joined/[id]` was read: uploads are guarded while running, partial failures are listed, Withdraw and Leave confirm first. Its small text-only Withdraw action is now a 44dp target.

**Events Sort sheet.** Read and found well formed (option rows with icon, label, description and a check, plus a close control). Added a radio role and selected state to the options and a Close label. Not seen on a device.

**KYC.** `LiveSelfieVerification` handles a pending permission, a denied permission that can be asked again, and a permanently blocked one (explanation, Open Settings, and a photo library alternative). `KycVerifyFlow` reports an unavailable camera or library and has a Try again state. Verified by reading the code and the existing stepper, liveness and API tests. The camera and capture steps could not run on the emulator, so they were not exercised. No identity document was used.

**Device checks this round: blocked.** After Chrome and the Edge webviews were closed with the user's approval, the Android emulator repeatedly froze on this 8 GB host once the development client began loading (System UI not responding, `adb` calls and screenshots that never returned, a blank white screen after a display size change). Several fresh boots, including lower memory and a software GPU, did not help. No screenshot of `collaborate/joined/[id]`, `collaborate/join/[token]`, the Sort sheet or the KYC steps was obtained, and no light mode or 1.6x text pass was possible for the round four screens. Those items are marked not verified below. A static review of the round four fixes found no fixed heights or one line clamps that would clip at large text, but that is not a substitute for the check. All temporary harness code was removed afterwards.

## Route inventory (89 screen files under `src/app`, 95 files with layouts)

Status words follow the brief. D = seen on the Android emulator in dark mode against a fixture backend (earlier rounds). T = covered by a render or unit test over a fake transport. C = read in code only. "Not verified" means exactly that.

| Route | Reached from | Status |
|---|---|---|
| `(tabs)/index` Home, `(tabs)/events`, `(tabs)/wallet`, `(tabs)/inbox`, `(tabs)/profile`, `(tabs)/more` | tab bar, More | Implemented and visually verified (D; light and dark in the earlier workspace audit). Inbox and the More sheet were seen once and left unchanged |
| `analytics` | Home, Wallet | Implemented and visually verified (D). Legend now labeled from the backend source |
| `payroll` | Wallet, Analytics | Implemented, functionally verified (T, 10 tests) and visually verified (D, light, dark, 1.6x). Confirmed zero and populated list: T only |
| `transactions`, `clients`, `packages`, `bookings`, `payment-accounts`, `notifications`, `gallery`, `photobooks`, `edit-profile`, `collaborate/index` | More, Home, Wallet | Implemented and visually verified (D) |
| `withdraw` | Wallet | Implemented (duplicate title removed). Visually verified for the amount, account and donation form (D). Functionally verified through verify, wrong code, unknown outcome, success, refusal and KYC (T, 11 tests, fake API, no real transfer). The code step was never seen on a device |
| `event/[id]` | Home, Events | Implemented and visually verified (D, light, dark, 1.6x). Decline sheet now the shared `Sheet` (T) |
| `event/new` | Home, Events | Implemented and visually verified (D, dark). Submit and failure paths not exercised |
| `event/candidates` | notifications | Fixed (crash on a response with no `escrowOptions`) and visually verified (D) |
| `event/geo-pricing`, `donations`, `streams`, `tv-devices`, `blocked-accounts` | profile, More | Implemented (duplicate title removed). Not viewed on a device. Not verified |
| `album/[id]`, `album/new`, `content-albums`, `content-album/new` | Events, gallery | Implemented and visually verified (D). Content album options show loading or unavailable (T) |
| `photobook/new`, `photobook/[id]` | photobooks | Verified within the available environment (D, empty fixture data). Resubmit flow not exercised |
| `package/new` | packages | Implemented and visually verified (D). Currency unavailable state (T) |
| `client/[id]`, `conversation/[id]` | clients, inbox | Verified within the available environment (D, empty fixture data) |
| `payment/[id]` | notifications | Implemented ("Amount unavailable") and visually verified (D) |
| `payments` | alias of Transactions | Verified within the available environment (D) |
| `two-factor`, `preferences` | profile | Visually verified (D) |
| `kyc` | profile, withdraw, banners | First step visually verified (D). Permission and camera states verified in code (C) and existing tests. Capture steps: blocked, the emulator camera could not be exercised |
| `stream/control/[id]` | Events | Visually verified up to "Preparing your camera" (D). Live camera blocked on the emulator |
| `collaborate/album/[id]` | collaborate | Verified within the available environment (D, empty fixture data) |
| `collaborate/join/[token]` | pasted invite links, notifications | Functionally verified (T, 10 tests, controlled token, fake API). Not seen on a device: blocked, the emulator froze |
| `collaborate/joined/[id]` | collaborate, notifications | Read in code (C), Withdraw target fixed. Not seen on a device: blocked, the emulator froze. Not verified visually |
| Booking request call screen (overlay) | incoming booking notification | Fixed (keyboard hid the decline form) and visually verified (D) |
| Events dashboard Accept sheet | Events | Visually verified (D). Functionally verified (T, fixture) |
| Events dashboard Decline sheet | Events, event detail | Visually verified (D, keyboard safe). Functionally verified (T, fixture) |
| Events dashboard Sort sheet | Events list mode | Read in code (C), accessibility roles added. Not seen on a device. Not verified visually |
| Goals sheet, More sheet, themed dialog | Home, bottom bar, many | Visually verified (D; dialog also light and 1.6x). Goals and dialog unit tested |
| `delete-account` | profile | Read in code (C): type to confirm, no double submit, themed tokens. Not viewed. Not verified visually |
| `connect-to-tv`, `pay-on-tv` | tv-devices | Read in code (C), themed tokens. Not viewed. Not verified |
| `photographers`, `photographer/[id]`, `stream/[id]`, `map`, `find-my-photos`, `event/hybrid-wizard`, `wallet/movements` | other roles' flows, notification routing, or no entry point | Not photographer workspace screens (no photographer entry point found, or routing shims). Not changed. Not verified |
| `(public)/*` (help center, about, privacy policy, terms, trust and safety, contact, feedback, browse photos, explore events, event and scan pages, join, pay) | profile links (privacy, terms) and guest flows | Guest and legal pages shared by every role. Not part of this redesign. Not verified |
| `(auth)/*`, `(onboarding)/*` | signed out | Out of scope (not an internal photographer screen). Not verified |
| iOS | none | Not tested at all |

Light mode and 1.6x text were verified only for `event/[id]`, `payroll` and the themed dialog. Every other row is dark mode only.

## Not done, and why

- **Blocked by the host:** the emulator could not be kept alive this round, so there is no new device evidence for `collaborate/joined/[id]`, `collaborate/join/[token]`, the Sort sheet, the KYC capture steps, the Withdraw code step, or light mode and 1.6x text on the round four screens.
- **Flows never exercised against any backend:** event creation submit and failure, goal save and delete, photobook resubmit, accept and decline of a real booking, load older transactions, a real withdrawal. Only the fixture and fake-API tests above cover accept, decline, withdraw and join.
- **iOS** was not exercised, including a dialog opened over another native Modal.
- Fixture data only. No live account was used.
- The web dashboard also labels the series `Current V1/V2`. Not changed (separate repository).
- `wallet/movements` is an orphan route with no entry point. Left alone.

## Verification

- `npx tsc --noEmit`: exit 0.
- `npx jest`: 80 suites, 628 passed, 1 skipped (re-run after the final edits). New: `photographerChrome.test.tsx` (6), `dialog.test.tsx` (6), `Sheet.test.tsx` (3), `payrollView.test.ts` (5), `payroll.render.test.tsx` (5). Two existing tests (Goals, Events dashboard) needed their mocks extended for the dialog and Sheet; no assertion was weakened.
- `npm run lint`: 359 errors, the same files and counts as `main` before this branch (compared per file).
- Emulator: Pixel 5 API 34, dark mode, fixture backend with a temporary sign-in bypass. The harness and bypass are removed and absent from the diff.
