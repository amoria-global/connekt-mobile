# Payments in the mobile app

## Update 2026-09-30: bookings and archive now pay in the app

Booking balances, photobook extras and the archive unlock are completed in the
app by `features/payments/HandoffCheckoutSheet`, using the same server contract
as the connekyt.com receiver (`nativeCheckout.ts`: mint handoff, public
`/handoff/{token}/initiate`, poll the public status endpoint). No amount is sent
from the client and no country or redirect is sent, so gateway routing is
unchanged. A timeout resolves to `unknown` and never offers a retry.
Anonymous stream/gift/photo/donation buyers were already native (see donate.tsx,
events/pay.tsx, PhotoCheckoutSheet). The text below predates this and is kept
for the invariants, not for the "no native flow" claim.

Only BOOKING and PHOTOBOOK_EXTRAS declarations are owed by the signed-in user
(`isOwedObligation`). Unsettled STREAMING/GIFT/FACE_RECOGNITION rows are viewers'
unfinished purchases and never count toward "pending payments".

## The app does not take payments

There is no native payment flow. No phone number collection, no MoMo/card
picker, no gateway polling, no settlement handling. Every flow that needs money
opens the connekyt.com web checkout in the in-app browser
(`src/features/payments/webCheckout.ts`):

| Flow | Opens |
|---|---|
| Find My Photos | `/user/find-my-photos?code=…` |
| Photo marketplace | `/user/browse-photos[/slug]` |
| Stream access | `/user/events/join-package?id=…` |
| Donations / gifts | `/user/donations`, `/user/events/live-stream` |
| Bookings, archive | `/user/complete-payment?ref=…` (minted handoff token) |

**Consequence: the web client owns payment correctness, and this app inherits
both its fixes and its bugs automatically.** When the web checkout was fixed on
2026-08-23, mobile buyers were fixed at the same moment with no app release —
they had been hitting the same defect, because `browsePhotosUrl` opens the very
page that carried it.

Nothing in this app needs an OTA update to benefit from a web payment fix.
Conversely, no fix made here can repair a web payment bug.

## Never send an amount from the client

`mintHandoffUrl` deliberately sends no amount. The server derives it (a
declaration's outstanding balance, the archive fee setting) so a tampered
client cannot name its own price. Keep it that way.

## The in-app browser is a separate storage jar

Anything the web checkout writes to `localStorage` — buyerId, cart contents,
the unlock code — is invisible to this app and gone when the sheet closes.
There is no return deep link, so the app cannot observe a purchase settle.

Delivery therefore depends on the **emailed unlock code** and on the buyer
being able to re-unlock by email on the web page. Do not build app UI that
assumes it can read purchase state back out of the checkout.

## Dead payment code you must not naively wire up

These are defined but never called:

- `features/photos/api.ts` — `initiateAlbumPurchase`,
  `initiateMultiAlbumPurchase`, `recordAlbumPurchase`, `getPublicPaymentStatus`
- `features/streams/api.ts` — `initiatePublicGift`
- `features/donations/api.ts` — the initiate helpers

A status poller against the **authenticated** endpoint used to sit in
`features/payments/api.ts` and was removed on 2026-08-23. It had no callers,
but it was a trap: photo and stream buyers are anonymous, so the authenticated
route is refused client-side. The identical mistake on web meant no request was
ever sent, the modal spun for five minutes, and a buyer whose money had already
been taken was told the payment failed — and offered a retry that would charge
them again.

If you ever do need a status read here:

- Use the **public** endpoint `/public/payments/xentripay/status/{refid}`.
  A status read is not privileged.
- Check `action` on the envelope. The backend returns HTTP 200 even for
  failures, so an HTTP 200 with `action: 0` is a failure.
- Give every path a terminal state. Never leave an unbounded spinner.
- Never offer a retry once a charge may have landed. Ask the buyer to check
  their phone instead.

## Android policy gate

Whether a purchase button may even appear is a separate question — digital
goods are gated behind `digitalPurchasesEnabled` in
`src/features/payments/policy.ts`. Check it before adding any new paid surface.

## Backend rules

The full set of payment invariants lives in the backend repo at
`docs/PAYMENTS.md`. Read it before changing anything that touches money, even
from here.
