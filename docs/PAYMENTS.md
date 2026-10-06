# Payments in the mobile app

Updated 2026-09-30. Read this, and the backend's `docs/PAYMENTS.md`, before
changing anything that touches money. Every rule here cost a buyer real money on
web first.

## What the app does

Payments complete **in the app**. The app collects a mobile-money number or hands
a card to the gateway page, starts the charge, waits, and settles. There is one
shared sheet for the JWT-gated payments and one poller for all of them.

| Flow | Where | Server contract |
|---|---|---|
| Booking balance, photobook extras | `HandoffCheckoutSheet` (PayNowSheet, payment/[id], BookingBottomSheet, event/new, photobook/[id]) | `POST /payments/handoff`, then public `POST /payments/handoff/{token}/initiate` |
| Archive unlock | `HandoffCheckoutSheet` (album/[id]) | same, type `ARCHIVE` |
| Donations | `donate.tsx` | public `initiate-donation` |
| Stream ticket, pay-on-TV | `events/pay.tsx` (`?device=` binds access to the TV) | anonymous-viewer `initiate-payment` / `payment-status` |
| Gift, registered viewer | `GiftCheckoutSheet` | public `anonymous-viewer/{id}/gift` |
| Gift, signed-in account | `GiftCheckoutSheet` | `POST /payments/xentripay/initiate-gift` |
| Photos, free-album extras | `PhotoCheckoutSheet` | public `initiate-multi-album-purchase` |
| Withdrawals | `withdraw.tsx` | `withdraw/initiate` (never the payout endpoint) |

Still on the connekyt.com checkout: group stream packages, and a gift from a
viewer who has not registered yet (the web page registers one).

## Digital goods are OFF on native builds, except tickets to in-person events

`digitalPurchasesEnabled` (`src/features/payments/policy.ts`) is true only on web
or with `EXPO_PUBLIC_ENABLE_DIGITAL_PURCHASES=true`. Gifts, photo purchases,
archive unlock, photobook extras, pay-on-TV and stream-only tickets are built and
absent in store builds: no price, no button, no copy pointing elsewhere (Play
billing, App Store 3.1.1, anti-steering, no Play merchant registration in Rwanda,
dynamic prices). Bookings and donations are exempt and always on.

**One exception: a ticket to an in-person event.** Both stores exempt tickets
consumed outside the app (Apple 3.1.3(e), Google's physical goods and services
rule), so `canBuyEventTicket` allows the in-app XentriPay and PawaPay checkout
when `isInPersonEvent` is true. The live stream is one way to attend, not the
product, and the copy says so ("Event ticket (includes live stream)").

How an event is classified:
- The backend stores the organizer's attestation as `attendanceMode`
  (`IN_PERSON`, `HYBRID`, `STREAM_ONLY`) with `attendance_attested_at`, set by the
  "Guests can attend in person at this venue" checkbox on event creation.
- A physical claim with no real venue is saved as `STREAM_ONLY` by the server.
- Events with no stored claim get a mode derived from the venue text, so old
  events and old clients keep working. Online-sounding venues ("Online", "Zoom",
  "TBD") are never in person.
- The app trusts the server's `attendanceMode` first and only falls back to the
  venue text when it is absent.

Stream-only paid events stay gated on native: buyers use web, a group code, or
"Verify access". Do not widen `canBuyEventTicket` to cover them. No wording makes
this risk-free, so a lawyer should sign off on the Apple 3.1.3(e) and Google
readings and the store listing should use the same "event ticket" wording.

Do not loosen the flag to ship a feature. A `NODE_ENV !== 'test'` clause once made
it true in every shipped build and false only under jest, so the gate was open
while its own test passed. A test now pins it off for a production `NODE_ENV`.
If the merchant entity moves to a country both stores support, revisit the whole
model, not just the flag.

## Rules

**One poller.** Use `pollStatus` in `src/features/payments/nativeCheckout.ts`. It is
bounded (150 reads, 2 s apart), keeps going through a failed read, ignores a
card's early FAILED for 180 s, and ends in `unknown`, never `failed`, when it runs
out of time. From `unknown`, never offer a retry: the charge may have landed and a
retry charges again. Tell the buyer to check their phone and their payments.

**Never send an amount from the client** for a declaration or archive handoff; the
server derives it. Gifts are priced by `giftCode`. Photo purchases do send an
amount per album, which the server now checks against photo count times price and
refuses an underpayment (`PaidAlbumPurchaseService.assertAmountCoversPhotos`).

**Status reads are public.** Use `/public/payments/xentripay/status/{refid}`, or the
anonymous-viewer status where access must also unlock. A status read is not
privileged, and an authenticated-only poll is refused for anonymous buyers: the
identical mistake on web left the modal spinning for five minutes while a buyer's
money had already been taken.

**Check `action` on the envelope.** The backend returns HTTP 200 for failures, so a
200 with `action: 0` is a failure.

**Pass the operator id through untouched.** Guessing a provider charges the wrong
network. **Do not change gateway routing**: send no country or redirect the web
receiver does not send.

**Lock the form while a card page is open** so a second tap cannot start a second
charge.

**Only BOOKING and PHOTOBOOK_EXTRAS are owed** (`isOwedObligation`). The handoff
refuses every other declaration type with "This payment can't be completed here."
An unsettled STREAMING, GIFT or FACE_RECOGNITION declaration is a viewer's
unfinished purchase, not a bill. Summing them once produced a "$132,642 pending"
banner. The pending endpoint now filters server-side too.

**The in-app browser is a separate storage jar.** Anything the gateway page writes
to localStorage is invisible here. There is no return deep link, so delivery of
purchased photos relies on the emailed unlock code.

## Dead payment helpers

`features/photos/api.ts` (`initiateAlbumPurchase`, `recordAlbumPurchase`) and the
older helpers in `features/donations/api.ts` and `features/streams/api.ts` are
partly used and partly not. Check for callers before wiring one up, and read the
backend rules first.

## Android policy gate

Check `digitalPurchasesEnabled` before adding any paid surface. See above.
