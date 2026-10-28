# Live event page structure

One structure for the viewer's live page and the host's Go Live page, on the mobile app and the web (landing
viewer, dashboard host). The structure comes from the wireframe (`connekyt-live-event-structure.png`); the look stays each
platform's own (dark live stage, brand navy and pink, Broadcast Red for live). Each numbered section is one component
with the same name and props on both platforms.

| # | Section | Mobile (`src/features/live/sections`) | Web (`app/components/live`) |
|---|---|---|---|
| 1 | Header: back, event name, share | `EventHeader` | `EventHeader` |
| 2 | Player: LIVE badge, access chip, viewers, pause, live scrubber, volume, fullscreen | `LivePlayer`, `AccessChip`, `LiveScrubber` over the existing `LiveVideoSurface` and `LiveOverlay` | the page's own player and controls, plus `AccessChip` |
| 3 | Title, tagline, location, host | `EventInfo` | `EventInfo` |
| 4 | Tabs: Live, Wishes & Memories | `EventTabs` | `EventTabs` |
| 5 | Send your wishes (video, text) | `SendWishes`, `WishComposerSheet` | `SendWishes`, `WishComposer` |
| 6 | Invite others: share link, save QR | `InviteOthers` | `InviteOthers` |
| 7 | Privacy note | `PrivacyNote` | `PrivacyNote` |
| 8 | Wishes feed (viewer), moderation queue (host) | `WishesFeed`, `ModerationQueue` | `WishesFeed`, `ModerationQueue` |
| 9 | Live chat, reactions, gifts | the existing `LiveChat`, `ReactionRail`, `GiftTray` | the page's existing chat, reactions and gifts |
| 10 | Bottom tab bar | the app's own (these screens are full-screen routes and do not show it, as before) | not applicable |

Host page: section 2 is the camera preview with Go live / Pause / End and stream health, section 5 is hidden, section 6
is shown prominently, section 8 is the moderation queue (Approve, Hide). Mobile `HostEventPage` keeps every action of the
immersive `StreamerLiveScreen` (flip, mic, camera, source, settings, info, OBS, pause, resume, end, chat) as buttons;
that screen is kept in the repo. Web `HostLivePage` wraps `StreamPreview` in its new embedded mode.

## Layouts

- Mobile up to 767: one column in section order. The live tab shows the reactions and the existing collapsible chat; the
  Wishes & Memories tab shows sections 5, 6, 7 and the full feed.
- Tablet 768 to 1024: the same order. The sidebar sections sit in two columns.
- Web 1025 and up (the live page's own desktop breakpoint): player, info and tabs on the left two thirds, the chat under
  the Live tab, the full feed under Wishes & Memories. A sticky right sidebar holds sections 5, 6, 7 and a three item
  preview of the feed.

## Wishes (backend)

- Send: `POST /public/events/{id}/wishes` and `.../wishes/video`, with `visibility` (`public` or `private`; the sender
  chooses, there is no default in the UI, the server treats a missing value as private), a text cap of 500 characters and a
  video cap of 60 seconds. Accepted until the event ends.
- Read: `GET /public/events/{id}/wishes` returns only wishes that are public and approved. It never returns the sender's
  email or device. `mine` marks the caller's own wishes by device.
- Hide your own: `POST /public/events/{id}/wishes/{wishId}/hide` (matched by device).
- Host: `GET /photographer/events/{id}/wishes`, `PUT .../{wishId}/moderation` (`APPROVED` or `HIDDEN`). Creator or
  photographer of the event only. A private wish cannot be approved.
- Report: the existing chat report routes, since a wish is a chat row.
- Migration V329 adds `visibility`, `moderation_status` and `device_fingerprint` to `stream_chats`. Existing wishes stay
  private and pending, so none of them became public.

## Known gaps

- Video wishes have no server thumbnail yet, so the feed shows a play tile with the duration. Mobile and web both do.
- The live scrubber is a "go to live" control: a live stream has no timeline to seek.
- The wish link opens the public event page on its wishes card (`tab=wishes`). That card only shows before the event
  starts; for a live event the link opens the event page.
- The old pre-event wish card on the public event page still sends private wishes (no visibility choice there).
- A guest without an account can only report a wish on mobile when the live chat has a viewer id for them.
