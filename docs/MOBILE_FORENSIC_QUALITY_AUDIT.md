# Mobile forensic quality audit

Branch `fix/mobile-forensic-quality-audit`, started from `409782b` (the `fix/one-line-truncations` tip, itself on `main` `6559730`). Nothing here is merged, published or released.

## 1. Repository truth

| Fact | Evidence |
|---|---|
| `origin/main` = `6559730` (merge of `feat/home-support-streams-largetext`, includes the coordinator redesign `d332271`) | `git log`, `git branch -avv` |
| `origin/production` = `2154f99`, Android and iOS manifests for runtime 2.2.2 returned update ids `01a15d85-...` (Android) and `01a15d8d-...` (iOS) | manifest fetch, earlier in this session |
| `fix/one-line-truncations` (`409782b`) is NOT in `main` and NOT in `production` | `git merge-base --is-ancestor` both answered no |
| Its parent is `6559730`, so this branch contains it with no conflict | `git log --graph` |
| The deployed OTA therefore does not include the 74 two-line changes, nor anything on this branch | derived from the two lines above |

## 2. Inventory

- 95 route files under `src/app` (`scripts: inventory.py`, list in scratchpad `routes.txt`), 246 non-test `.tsx` files.
- Layout-risk counts now: `numberOfLines={1}` 103, `numberOfLines>=2` 197, `maxFontSizeMultiplier<1.6` 5 (all in the chrome allowlist of `largeText.rule.test.ts`), `adjustsFontSizeToFit` 27, `allowFontScaling={false}` 4 (allowlist).
- Earlier "177 one-line sites" was recounted: 177 before the truncation branch, 103 after it (74 changed, matches that commit).

## 3. Confirmed defects (each has a test that fails on the previous code)

| ID | Sev | Role | Where | Symptom and root cause | Fix, test |
|---|---|---|---|---|---|
| F1 | P1 | Client, Coordinator | `app/(app)/analytics.tsx` headline cards | A refused `/customer/analytics` or `/coordinator/analytics` drew "Total Spent $0.00", "Events 0" (`clientData?.x \|\| 0`); only the photographer path had an error state | Error notice with retry, N/A figures, charts hidden. `roleAnalytics.render.test.tsx` (2 fail on old code) |
| F2 | P1 | All | `analytics.tsx` TrendCurveChart and SaloPerformanceChart | Feed buckets were kept only if the label began with a weekday name, else an all-zero Sun to Sat was drawn. Backend labels verified in `CustomerAnalyticsController.getPerformanceChart`: Today = `12AM..8PM` (6 blocks), Month = `Week 1..4`. So Today and This month showed "0 activity recorded" over real money. A failed read also read as zero, an empty chart printed an invented 0..100 axis, and `slice(0,3)` would cut "Week 1" to "Wee" | `features/analytics/chartSeries.ts` keeps the feed as sent; `perfFailed` shows "Chart data is unavailable". `chartSeries.test.ts` (table-driven), 3 render tests fail on old code |
| F3 | P1 | Photographer | `profile.tsx` stats | Rating "5.0", Jobs 0, Reviews 0 for an account with no figures (client and coordinator were already fixed, photographer was missed) | `photographerStats` in `profile/clientStats.ts`; dash for missing, no rating unless > 0. `clientStats.test.ts` |
| F4 | P2 | Coordinator | `getCoordinatorPhotographers` | Missing `status` became "Active", missing event count 0 | Left undefined; row hides the badge and count. `api.test.ts` |
| F5 | P1 | All | `GlobalSearchModal` | A failed events or directory request showed "No results found"; a slow answer for an older term overwrote the newer one | Failure banner / full unavailable panel with retry; stale-answer guard. 5 of 6 `GlobalSearchModal.render.test.tsx` tests fail on old code |
| F6 | P1, strongly indicated (backend source, not reproduced) | Client | `app/(app)/streams.tsx` | `ClientStreamService.getCompletedStreams` unions created, paid and guest-email events, but the card opened `/stream/<id>`, whose `getStream` calls `GET /customer/events/{id}` and `EventRemoteController.getEvent` refuses anyone who is not creator or photographer. A paid-to-watch replay would open an error | Clients open `/(public)/events/live-stream?id=` (what ClientHome and ClientEventsDashboard already use); coordinators keep `/stream/<id>` (they are the creator, `CoordinatorController.getStreams` is by creator). `streams.render.test.tsx` |
| F7 | P3 | All | `event/[id].tsx` | Owner "Booking Progress" title hard-coded English | Uses `tr('b3_evdet_booking_progress')` |
| F8 | P2, potential | Client | `event/candidates.tsx` | Deposit `?? 0` could print a zero amount on a pay sheet | Amount label omitted unless a finite number |

## 4. Previous claims re-investigated

| Claim | Verdict |
|---|---|
| Stream mapping, event vs stream id, errors as errors, no coordinator-to-client fallback, replays not STANDBY | Present in source and covered by `streams.render.test.tsx` (field names copied from the backend). Not a defect. F6 above is a remaining navigation gap |
| Wallet coordinator rendering the client wallet | Not a defect now: `walletTab.render.test.tsx` "coordinators get Overview and Activity tabs..." asserts "Available balance" and no "Total spent" |
| Duplicate "Booking Progress" cards | Not a defect: `progressView()` returns exactly one of track, stepper or none, tested in `bookingTrack.test.ts` |
| "Duplicate imports / old code in CoordinatorHome" from the transcript | Not present: `tsc` passes (a duplicate declaration fails it), and `CoordinatorHome.tsx` has one of each section header |
| Fabricated chart waves, hard-coded axis, week missing Friday, month leading zero, USD labels | Fixed earlier in `PerformanceWaveCard` (ClientHome/CoordinatorHome); the Analytics screen had the same class of bug (F2) |

## 5. Potential risks (not demonstrated, not changed)

- Unreferenced components (no importer): `features/bookings/BookingsList.tsx`, `features/events/EventsList.tsx`, `features/dashboard/MultipleDonutOverviewCard.tsx` (defaults `currency='USD'`), `features/auth/ChooseRoleBottomSheet.tsx`, `components/ui/Rating.tsx`. Unreachable, so no user impact; removal is a separate decision.
- `wallet/api.ts` falls back to `'USD'` when the wallet carries no currency; `ClientHome` labels spend in the wallet currency, an assumption the trends feed does not confirm.
- `getCustomerAnalytics` fills missing fields from `defaultCustomerAnalytics()` (zeros) after a successful response.
- The performance endpoint ignores `from`/`to` (`CustomerAnalyticsController` only reads `period`), so "Custom" shows the week.
- `GiftOverlay`, `live-stream.tsx` overlay names and tab/pill labels remain one line by design.

## 6. Layout and large-text review of the 74 two-line changes

Source review only: each changed `Text` sits in a row whose siblings are fixed-size icons or `flexShrink` badges, so a second line grows the row rather than overlapping. Not device-verified.

## 7. Verification actually run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npx jest` | 122 suites passed, 965 passed, 1 skipped, 966 total |
| `git diff --check` | exit 0 |
| `npx expo lint` | 575 problems (319 errors, 256 warnings) on this branch, and the same 575 (319 errors) on `6559730` (baseline run in the same session), so no net change |
| Build / EAS / release | not run (release is out of scope for this pass) |

## 8. Runtime verification: BLOCKED, mostly not done

- Android emulator (Pixel 5 API 34) booted, the dev build loaded against the fixture backend after `adb reverse tcp:8081`, signed in as the fixture client, and rendered Home and Analytics (light, 1.0x).
- It then raised "Connekyt isn't responding" repeatedly while about 27 Chrome processes held the memory (about 0.9 to 1.9 GB free), so no further screenshot was usable. Chrome was not closed without permission.
- Screenshots captured and existing: `v_analytics.png`, `v_streams.png`, `f2.png` in the session scratchpad. `v_analytics.png` shows the new headline cards at $450.00 / $420.00 behind the ANR dialog; the dialog covers the charts, so the F2 chart fix is NOT device-verified. `v_streams.png` was not inspected.
- Not verified on device: F1 to F8 behaviour, 1.6x and dark for any changed screen, the 74 two-line rows, stream viewer or replay, payment sheets, booking wizard, keyboard states. iOS: not tested. Real backend: not used (fixture only).
