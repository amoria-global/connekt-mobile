# Backend verification — Connekyt mobile ↔ amoria-connect

Live probe of `https://backend.connekyt.com/api/remote` on **2026-06-03**.
Method: unauthenticated `curl` (read-only GETs + one dummy login). `401` on a
protected path = the path exists and just needs auth; `404` = wrong path.

## ✅ Confirmed (no change needed)

**Base URL & envelope**
- Base `https://backend.connekyt.com/api/remote` is correct (default in `config/env.ts`).
- Data endpoints wrap results as `{ "action": 1, "message"?, "data": ... }`.
  Verified via `/cities` and `/public/currencies`. Our `ApiEnvelope<T>` mappers match.
- `action: 1` = success, `0` = failure. Matches our code everywhere.

**Auth** (`features/auth/api.ts`)
- `POST /auth/login` returns a **flat** body (no `data` wrapper), HTTP **200 even on failure**:
  `{"action":0,"message":"Invalid credentials","otpVerified":false,"accountLocked":false,"customerId":null}`.
  Our `login()` checks `action !== 1` and surfaces `message` — correct.
- `POST /auth/check-email` → `{"action":1,"message":"Email available"}`.

**All wired paths exist (returned 401, not 404):**
`/customer/events`, `/wallet/me`, `/customer/photographers`, `/bookings`,
`/photographer/packages`, `/chat/conversations`, `/customer/notifications`,
`/photographer/notifications`, `/customer/kyc`, `/withdrawals`,
`/photographer/withdrawal-methods`, `/customer/galleries`, `/photographer/albums`,
`/coordinator/events`, `/payments/xentripay/initiate`, `/payments/xentripay/status/{ref}`,
`/streams/{id}/tip`, `/customer/streams/{id}/join`.

## ⚠️ Found & notes

- `GET /public/photographer-categories` → **404** (dead path). We don't use it
  (discovery does client-side search), so no code impact.
- `401` body shape is `{"action":0,"message":"Authentication required","data":null}`.

## 🔑 Needs a real login token to finalize (can't verify unsigned)

These work structurally (paths + envelope confirmed) but the exact **item field
names** inside `data` are still mapped defensively. Log in once and check these:

1. **Item field names** for: events, wallet pots (`balanceBooking`, …, `totalBalance`),
   bookings, packages, conversations/messages, notifications, KYC status, withdrawals,
   photographer detail. If a card shows a fallback label, tweak the mapper in that
   feature's `api.ts`.
2. **Currency on writes.** `/public/currencies` shows currencies have a **UUID `id`**
   plus `code`/`symbol`. Create/withdraw/pay payloads very likely need **`currencyId`
   (the UUID)**, not a code string. Today:
   - `createEvent` / `createPackage` send `price` with **no currency** → may be rejected.
   - `requestWithdrawal` sends no currency.
   Use `features/reference/api.ts → listCurrencies()` to add a currency picker.
3. **Payments (XentriPay) — the real shape.** Verified public helpers:
   - `GET /public/payments/country` → `{ data: { country:"RW", supported:true } }`
   - `GET /public/payments/options?country=RW` →
     `{ data: { supportsCard:true, operators:[{id:"MTN",name:"MTN Mobile Money",type:"MOBILE_MONEY"},{id:"AIRTEL",…}] } }`
   So a real mobile-money payment needs: **detect country → pick operator → collect
   phone number → initiate**. Our current `initiatePayment` only sends `amount/currency`.
   `features/reference/api.ts` now exposes `detectPaymentCountry()` + `getPaymentOptions()`
   to build that picker; the exact `/payments/xentripay/initiate` body needs confirming
   from a logged-in flow (or the salo-run web code).

## How to finish locking shapes
Log in on a device with `EXPO_PUBLIC_API_BASE_URL` pointed at the backend, open each
screen, and compare the rendered fields to the JSON (React Native debugger / network
log). Adjust the relevant `features/<x>/api.ts` mapper. Paths and envelope are solid —
only inner field names and the payment body remain.
