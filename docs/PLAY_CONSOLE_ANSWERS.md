# Play Console — exact answers to paste

Everything here is derived from the shipped code, not assumed. Where a value
depends on your Google accounts, it is marked **[YOU]** — those are the only
items that cannot be answered from the repo.

---

## 1. App Access

**Answer:** "All or some functionality is restricted."

**Add one instruction set:**

| Field | Value |
|---|---|
| Name | Demo account (all features) |
| Username | `play.review@amoriaglobal.com` |
| Password | `Connekyt#Play2026rev` |
| Any other info | See notes below |

Seeded by `backend/src/main/resources/db/migration/V285__seed_play_review_account.sql`
(renumbered from V282 to clear a collision with the TV-pairing migrations that
landed on `main`). Validated by running the full Flyway chain to v285 against a
throwaway Postgres 18 database.
**The migration must be deployed to the production backend before you submit** —
`backend.connekyt.com` is what the Android build talks to (`eas.json` →
`EXPO_PUBLIC_API_BASE_URL`).

**Notes to paste into "Any other info":**

> The account is pre-verified — no SMS code is required. Sign in with the email
> and password above (do not use "Continue with Google").
>
> 1. On first launch, accept the Terms, then tap through the intro (or tap to skip).
> 2. On the Login screen, enter the email and password above and tap Sign in.
> 3. Home tab: browse events and photographers.
> 4. Photographers tab (More → Photographers): open any photographer to view
>    profile, packages and reviews, and to start a booking.
> 5. Find My Photos: take or upload a selfie to search event photos by face.
>    A consent dialog is shown before the camera opens.
> 6. Explore Events → any live event → watch the stream and use live chat.
>    Long-press any chat message to report it or block/hide the sender.
> 7. Profile tab → Blocked accounts, Privacy policy, Terms, and Delete account.
>
> Note on purchases: buying event photos and paid live-stream access is not
> available in the Android app; those flows are disabled on this platform.
> Photographer bookings and donations remain available.

**Verified about this account:** `otp_verified = TRUE` (no OTP screen),
`two_factor_enabled = FALSE` (no TOTP prompt), `account_locked = FALSE`,
`is_password_changed = TRUE` (no forced password change), and
`customer_type = 'User'` — deliberately **not** `Viewer`, because Viewer is
excluded from `ownsEvents` and would show a permanently empty Events tab.

---

## 2. Ads

**Does your app contain ads?** → **Yes.**

`src/features/streams/StreamAdOverlay.tsx` renders first-party sponsor ads over
live streams. No third-party ad SDK and **no Advertising ID** is collected, so
this does not trigger Families Ads requirements or an ad-ID data disclosure.

---

## 3. Content rating (IARC questionnaire)

Category: **Social / Communication** (the app has user-to-user chat and UGC).

| Question | Answer |
|---|---|
| Violence, sexual content, profanity, controlled substances, gambling, horror | **No** to all (no first-party content of this kind) |
| Users can interact / communicate with each other | **Yes** — live stream chat and direct messages |
| Users can share user-generated content | **Yes** — photos, live video, chat |
| Can users share their physical location with others? | **No** — no location is collected |
| Does the app allow purchase of digital goods? | **No** on Android — digital purchases are disabled on this platform (`src/features/payments/policy.ts`). Bookings (a real-world service) and donations remain. |
| Does the app contain or promote user-generated content that is unmoderated? | **No** — in-app reporting and blocking ship on every UGC surface |

Expected outcome: **Teen / PEGI 12**-equivalent, driven by online interaction
and UGC. Answer honestly; a misrating is itself a policy violation.

---

## 4. Target audience and content

- **Target age group:** **18 and over** only.
- **Appeals to children?** **No.** Branding and screenshots are not child-directed.
- **Result:** Designed for Families = **Not applicable.**

Rationale: the app has payments, KYC/identity verification, and user-generated
content — none of it appropriate to target minors.

---

## 5. Data Safety

**Is all user data encrypted in transit?** **Yes** — all traffic is HTTPS to
`backend.connekyt.com`.

**Can users request that their data be deleted?** **Yes.**
- In-app path: **Profile → Delete account** (`src/app/(app)/delete-account.tsx`),
  which calls `DELETE /customer/profile`. The account is anonymised and disabled;
  financial records are retained where legally required.
- **[YOU]** Play also wants a **web deletion-request URL** reachable without
  installing the app. Add a page under `connekyt.com` and enter it here.

> ⚠️ If you filled this form from an earlier draft of
> `PLAY_STORE_SUBMISSION.md`, it told you deletion was missing. **It is built.**
> Make sure this answer says Yes.

### Data collected / shared

"Shared" = sent to a third party. Cloudflare (media + streaming) and XentriPay
(payments) are processors.

| Data type | Collected | Shared | Purpose | Notes |
|---|---|---|---|---|
| Name | Yes | No | Account management, App functionality | signup |
| Email address | Yes | No | Account management, Communications | signup |
| Phone number | Yes | Yes (XentriPay) | Account, App functionality | phone signup + Mobile Money |
| User IDs | Yes | No | Account management, App functionality | customer id |
| Photos | Yes | Yes (Cloudflare) | App functionality | uploads, **face-search selfie**, **KYC ID images** |
| Videos | Yes | Yes (Cloudflare Stream) | App functionality | live broadcast, video messages |
| Voice or sound recordings | Yes | Yes (Cloudflare Stream) | App functionality | live broadcast audio |
| Other personal info | Yes | No | App functionality, Identity verification | KYC ID type + number |
| Purchase history | Yes | No | App functionality | bookings, donations |
| In-app messages | Yes | No | App functionality | live chat, direct messages |
| Device or other IDs | Yes | No | App functionality | Expo push token |
| App interactions | Yes | No | App functionality | navigation, photo search |

For every row above: collection is **required** (not optional), and none of it
is used for advertising or marketing.

### Declare as NOT collected

Location (precise and approximate), Contacts, Calendar, Web browsing history,
Health and fitness, SMS or call logs, Installed apps, Financial info other than
purchase history, **Advertising ID**, Crash logs / diagnostics / analytics
(there is no analytics or crash-reporting SDK in `package.json`).

### Sensitive call-outs

- **Face recognition:** the selfie used to find a user's photos is matched
  server-side. Play's Data Safety has no biometric category — declare it under
  **Photos**, purpose *App functionality*. It is described in the privacy policy,
  and an explicit consent dialog is shown before capture
  (`src/features/privacy/consent.ts`). Never claim it is used for ads.
- **KYC:** government ID images (Photos) + ID number (Other personal info),
  purpose *Identity verification*, with consent shown before submission.

---

## 6. Store listing

| Field | Value |
|---|---|
| App name | `Connekyt` |
| Short description | `Book photographers, buy your event photos & watch events live.` |
| App icon | `assets/images/play-store-icon-512.png` (512×512, 32-bit) |
| Privacy Policy URL | `https://connekyt.com/user/privacy-policy` (live, HTTP 200) |
| Contact email | **[YOU]** confirm `info@connekyt.com` is monitored |
| Feature graphic 1024×500 | **[YOU]** |
| Phone screenshots (2–8) | **[YOU]** — see below |

⚠️ The short description mentions buying photos and watching events live. Both
are true of the product overall (web/iOS), but **photo purchase is disabled on
Android**. Consider softening it for the Play listing to avoid a metadata
mismatch with what the reviewer can actually do — e.g.
`Book photographers, find your event photos & watch events live.`

**Screenshots — capture these six** (real UI, no invented device frames):
Home dashboard · Photographers list (filters now work) · Photographer profile ·
Live stream with chat · Find My Photos · Profile/settings.

---

## 7. **[YOU]** Play service account key (blocks `eas submit`)

`eas.json` → `submit.production.android.serviceAccountKeyPath` points at
`./google-play-service-account.json`, **which does not exist**, so
`eas submit --profile production` fails immediately.

Either place that file at the repo root (it is now covered by `.gitignore` —
**never commit it**), or skip `eas submit` and upload the `.aab` by hand in
Play Console.

To create it:
1. Play Console → Setup → **API access** → link/choose a Google Cloud project.
2. In Google Cloud → IAM & Admin → **Service Accounts** → create one → **Keys**
   → Add key → **JSON** → download.
3. Back in Play Console → API access → grant that service account
   **Release apps to testing tracks** (and Production when you go live).
4. Save the JSON as `connekt-mobile/google-play-service-account.json`.

Alternatively upload the key to EAS once (`eas credentials`) and drop
`serviceAccountKeyPath` from `eas.json`.

---

## 8. **[YOU]** Google Sign-In will fail unless you do this

Android OAuth clients are validated against the **signing certificate SHA-1**.
With Play App Signing, Google **re-signs** your app, so the cert users run is
*not* your EAS upload key.

In **Play Console → Setup → App integrity**, copy the **App signing key
certificate** SHA-1, and add it as an Android OAuth client for package
`com.amoria.connekyt.app` in Google Cloud Console (keep the EAS upload SHA-1
registered too, for internal builds).

If you skip this, the "Continue with Google" button fails for everyone who
installs from Play — including the reviewer. The demo account above uses
email/password and is unaffected.
