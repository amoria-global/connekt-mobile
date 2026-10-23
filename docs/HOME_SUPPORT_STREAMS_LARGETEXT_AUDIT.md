# Home chart, Get help, Streams and large text: audit and verification record

Branch `feat/home-support-streams-largetext`, from `main` at `d332271`. Frontend only. Nothing merged, pushed to main or published.

## Verified how

Android emulator (Pixel 5, API 34), dev client, over a throwaway local fixture backend with synthetic data (outside the repo). Light, dark and 1.6x system text were checked on the screens named below. No physical phone, no iOS. The fixture's stream and trends payloads were written to match the backend's real shapes (CoordinatorController.getStreams, CompletedStreamResponseDTO, CustomerAnalyticsController), but real accounts were not used, so real data may still surprise.

## 1. Chart on the client Home

The coordinator's trend card is now on the client Home with the client's own metrics: Spent (performance `value1`, trends `totalSpent`) and Events (`value2`, trends `events`), period tabs, amounts masked until shown, a named error with retry, money N/A until the wallet currency is known.
The card was generalised and made truer: a week keeps all seven days (Friday was dropped), a four week month has four points (a leading zero and a repeated last value were invented), money without a known currency is N/A (was labelled USD), the beacon needle is hidden when there is no series. Seen on the emulator for client (light) and coordinator (light, 1.6x). Not seen: client chart in dark or at 1.6x. Spend is labelled in the wallet currency; the trends feed sums spend server side without telling us its currency, so that label is an assumption carried over from the old Home.

## 2. Get help on every role's Home

Client, Photographer, Coordinator and the viewer Home end with a "Need help?" card: Get help opens `/help-center`, Contact support opens `/contact_us`. Both already existed, signed in or out. No new screen, no endpoint, no response-time claim; EN, FR, ES. Seen on emulator for client and coordinator; photographer and viewer Homes by render test only.

## 3. Streams (client and coordinator)

Defects found against the backend source:
- The list feeds put the stream record in `id` and the event in `eventId`, the title in `streamTitle` or `eventTitle`, the photographer as a string and the audience in `peakViewers` or `totalViewers`. The app read `title`, `photographer{}` and `viewerCount`: every card said "Live stream", with no photographer or audience.
- Tapping a card opened `/stream/<stream record id>`, which the viewer resolves as an event id (not found).
- A refused read showed "No live streams"; a failed coordinator read fell back to the customer feed.
- Completed replays were badged STANDBY.
Fixed: mapping, routing on the event id, live / upcoming / replay phases, requireOk with no cross-role fallback, a night-studio list with filters, skeletons, error with retry, a Manage event action for coordinators. Verified on the emulator as coordinator (light, dark, 1.6x) and client (light, 1.6x with replays). Not verified: opening the viewer or the replay from a card (not tapped), real stream data, the live viewer and control screens (camera).

## 4. Large text (1.6x)

Cause: 62 content text nodes capped `maxFontSizeMultiplier` at 1.1 to 1.4, so at the 1.6x setting they grew 1.1 to 1.4x; many titles were also `numberOfLines={1}`. Fixed: caps lifted to 1.6 in the shared kit and content screens, long titles and meta wrap (wallet, photographers, events, inbox, gallery, photobooks, Contact us, Profile), Analytics period tabs wrap instead of overlapping, Find my photos tiles stack, photobook status badge fits. A source scan test fails the build if a content component caps text below 1.6 or disables font scaling (named chrome exceptions: tab bar, brand pill, live pill, photo viewer controls, chat input, flag glyphs, gift send chip).

Swept at 1.6x on the emulator as client: Home, Streams, Events, Event page, Wallet, Gallery, Photobooks, Album, Profile, Analytics, Payments, Notifications, Inbox, Conversation, Bookings, Contact us, Help Center, Feedback, About, Trust and Safety, Explore events (search placeholder shortened), Find my photos, Manage TVs, Connect to TV, KYC step 1, Payment accounts. Fixed what clipped; the remaining one-line truncations in lower-traffic screens (about 170 `numberOfLines={1}` sites) were not individually reviewed. Not swept at 1.6x: photographer and coordinator-only screens, booking wizard steps 2 and 3, payment sheets, streams viewer, settings screens (checked in batch 3).

## Checks

`tsc` exit 0. Full Jest 119 suites, 938 passed, 1 skipped.

## Emulator housekeeping

An earlier tap sequence landed in Android's own Settings (Display over other apps) after the app was reset; I backed out and did not intentionally change a setting there, but the Phone app's overlay switch was on when I saw it and I did not record whether it was on before. The emulator is disposable and stopped.
