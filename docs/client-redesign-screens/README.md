# Client dashboard redesign: screenshot gallery

One light and one dark screenshot of every client screen, for reviewing the redesign against the prototype in one place.

## How these were captured

- Device: Pixel 5 emulator (API 34, software rendering), dev client, system font scale 1.0. No physical phone, no iOS.
- Data: a throwaway local fixture backend with synthetic data (Aline as the client; photographers Eric Mugisha, Grace Uwase and Jean Habimana; three albums, three photobooks, a 120-row ledger, three blocked accounts, three donations). Nothing here is real user data. The fixture lives outside the repo.
- The round grey gear and the small "Tools" chip in some frames are the Expo dev client's floating tools button. They are not part of the app.
- Files are 540px wide JPEGs. Pairs share a name: `light/<name>.jpg` and `dark/<name>.jpg`.
- The 1.6x font scale and loading and error states were checked separately; results are in `docs/CLIENT_DASHBOARD_REDESIGN_AUDIT.md`, not in this gallery.

## Index

| # | Screen | Route | Light | Dark | State shown |
|---|---|---|---|---|---|
| 01 | Home | `/` | [light](light/01-home.jpg) | [dark](dark/01-home.jpg) | KYC prompt, two hero actions, live event |
| 02 | Events | `/events` | [light](light/02-events.jpg) | [dark](dark/02-events.jpg) | Overview chart, filters, event card |
| 03 | Wallet | `/wallet` | [light](light/03-wallet.jpg) | [dark](dark/03-wallet.jpg) | Hidden balance, payments due |
| 04 | Inbox | `/inbox` | [light](light/04-inbox.jpg) | [dark](dark/04-inbox.jpg) | Three conversations, one unread |
| 05 | More sheet | bottom bar, More | [light](light/05-more.jpg) | [dark](dark/05-more.jpg) | Sheet opened from the tab bar |
| 06 | Profile | `/profile` | [light](light/06-profile.jpg) | [dark](dark/06-profile.jpg) | No join date, so no "Member since" line |
| 07 | Photographers | `/photographers` | [light](light/07-photographers.jpg) | [dark](dark/07-photographers.jpg) | Directory list |
| 08 | Photographer profile | `/photographer/ph1` | [light](light/08-photographer-profile.jpg) | [dark](dark/08-photographer-profile.jpg) | Cover, availability, sticky Book now |
| 09 | Booking wizard | `/event/hybrid-wizard` | [light](light/09-booking-wizard.jpg) | [dark](dark/09-booking-wizard.jpg) | Step 1 of 3 only |
| 10 | Direct booking form | `/event/new?photographerId=ph1&...` | [light](light/10-direct-booking-form.jpg) | [dark](dark/10-direct-booking-form.jpg) | Booking banner, sticky "Book & pay" bar |
| 11 | Event detail | `/event/e1` | [light](light/11-event-detail.jpg) | [dark](dark/11-event-detail.jpg) | Booking progress track |
| 12 | Bookings | `/bookings` | [light](light/12-bookings.jpg) | [dark](dark/12-bookings.jpg) | Empty state (the fixture has no requests) |
| 13 | Payments | `/payments` | [light](light/13-payments.jpg) | [dark](dark/13-payments.jpg) | Per-currency summary, pending alert, activity |
| 14 | Transactions | `/transactions` | [light](light/14-transactions.jpg) | [dark](dark/14-transactions.jpg) | Codes shown as words, 1/7 pages and Load older |
| 15 | Gallery | `/gallery` | [light](light/15-gallery.jpg) | [dark](dark/15-gallery.jpg) | Latest delivery hero, album cards |
| 16 | Album | `/album/a1` | [light](light/16-album.jpg) | [dark](dark/16-album.jpg) | 240 photos in a three-column grid |
| 17 | Photobooks | `/photobooks` | [light](light/17-photobooks.jpg) | [dark](dark/17-photobooks.jpg) | Status chips, spine cover cards |
| 18 | Photobook | `/photobook/pb1` | [light](light/18-photobook.jpg) | [dark](dark/18-photobook.jpg) | 30 photos |
| 19 | Notifications | `/notifications` | [light](light/19-notifications.jpg) | [dark](dark/19-notifications.jpg) | Grouped by day |
| 20 | Conversation | `/conversation/conv1` | [light](light/20-conversation.jpg) | [dark](dark/20-conversation.jpg) | Two messages |
| 21 | Edit profile | `/edit-profile` | [light](light/21-edit-profile.jpg) | [dark](dark/21-edit-profile.jpg) | Header card, sticky Save |
| 22 | Preferences | `/preferences` | [light](light/22-preferences.jpg) | [dark](dark/22-preferences.jpg) | App and alert types |
| 23 | Two-factor | `/two-factor` | [light](light/23-two-factor.jpg) | [dark](dark/23-two-factor.jpg) | Off state |
| 24 | Blocked accounts | `/blocked-accounts` | [light](light/24-blocked-accounts.jpg) | [dark](dark/24-blocked-accounts.jpg) | Three blocked accounts, one with a long name |
| 25 | Delete account | `/delete-account` | [light](light/25-delete-account.jpg) | [dark](dark/25-delete-account.jpg) | Consequences and danger zone |
| 26 | Donate | `/donations` | [light](light/26-donate.jpg) | [dark](dark/26-donate.jpg) | Hero action, amounts, history |
| 27 | Find my photos | `/find-my-photos` | [light](light/27-find-my-photos.jpg) | [dark](dark/27-find-my-photos.jpg) | Not part of the redesign passes |

## Not in the gallery

- Photographer-only screens (Content albums, packages, payroll, analytics) and coordinator screens.
- Wizard steps 2 and 3, payment sheets, KYC, TV screens, streams, the map view.
- The two-factor QR and enabled states, and the empty Blocked accounts and Donate states. These are in the audit doc.
- Anything from the prototype itself: no prototype file is in the repo, so this gallery is the "after" side only.

## Screens not restyled in the redesign passes

Find my photos (27) is unchanged. Event detail (11), the booking wizard (09) and Home (01) got targeted fixes rather than a full restyle; see the audit table for what changed on each.
