# Streams: web dashboard trace and mobile parity

Reference: `connekt-dashboard/app/pages/client/streams.tsx` (served at `/user/client/streams` and
`/user/event-coordinator/streams`, one component with a role prop) at `origin/main` `f4b9f86`. The photographer
and viewer roles have no Streams page on the web.

## 1. What the web page does

| Feature | Web behavior | Backend it calls |
|---|---|---|
| List | Reads the role feed, then for every stream reads its chats and the public event in parallel | `GET /coordinator/streams` or `GET /customer/streams` |
| Enrichment | Cover, photographer name and picture, description from the public event when the feed lacks them | `GET /public/events/{eventId}` |
| Headline cards | Total streams, total viewers, chat messages, video messages | computed from the above |
| Search | Matches event title, stream title, event type, case-insensitive | client side |
| Type filter | All, Wedding, Birthday, Corporate, Baby Shower (hard-coded) | client side |
| Card | Cover, type chip, duration, "N new" for unopened videos, delete, title, date and time, photographer, viewer, message and video counts, View chats, Videos | |
| Chats modal | Each message with avatar, @username, time; empty text | coordinator `GET /coordinator/streams/{eventId}/chats?page=0&size=500`, client `GET /customer/events/{eventId}/chats?page=0&size=500` |
| Videos modal | Total, max duration 1 minute, player, grid with NEW or viewed marks | same chat endpoints (`videoUrl` marks a video row) |
| Mark viewed | Marks a video viewed | `PATCH /{role}/streams/{streamId}/videos/{videoId}/viewed` |
| Delete | Confirm, then delete by stream record id, retry with the event id | `DELETE /{role}/streams/{id}` |
| Order | Newest `streamDate` first | client side |

## 2. Backend facts that decide what is possible

- `GET /coordinator/streams` returns every `EventStream` the account created, any status, with no cover, title,
  duration or replay. `GET /customer/streams` returns events the account streamed, paid to watch, or bought as a
  guest by email; `duration` is always `0:00:00`, `replayUrl` empty, `totalVideoMessages` 0 and `videoMessages` empty.
  Video messages therefore only exist in the chat endpoints.
- The chat DTO (`StreamChatMessageDTO`) has no `viewed` field.
- `DELETE /customer/streams/{id}` is authorized for the stream or event creator only. `DELETE /coordinator/streams/{id}`
  does not check the caller at all.

## 3. Defects found in the web page or backend (not changed here)

1. **Client covers point at the wrong folder.** `ClientStreamService` builds `/uploads/event/media/<file>` but event
   photos are saved under `/uploads/event/photos/` (verified: `photos/<file>` 200, `media/<file>` 404). The web rewrites
   the path; the mobile list did not, so client covers were broken. Fixed on mobile with the same rewrite.
2. **"Viewed" never persists.** The chat rows carry no `viewed`, and the `PATCH` takes an `EventMedia` id plus an event
   id while the web sends a chat id plus the stream record id, so it cannot succeed; the web swallows the error and keeps
   the state in memory. The coordinator `PATCH` route does not exist. Mobile keeps the viewed state in memory only, as
   the web does, and does not call the endpoint.
3. **Coordinator titles are blank on the web.** The card title reads `streamTitle`, which the coordinator feed does not
   send. Mobile falls back to the event title.
4. **Coordinator delete has no ownership check** (security, backend).
5. **The page is called "Completed streams" but lists every stream the coordinator feed returns.** Mobile keeps live and
   upcoming streams visible with a phase filter instead of hiding them.

## 4. Mobile status after this change

| Web feature | Mobile |
|---|---|
| Headline cards | Done. Messages and videos show an ellipsis until every history is read, never a partial sum |
| Search | Done (title and type) |
| Type filter | Done, built from the types present, so no category is hidden |
| Enrichment | Done, a few streams at a time |
| Cover fix | Done |
| Counts and "N new" | Done |
| View chats, Videos (player, NEW, viewed) | Done, as bottom sheets |
| Delete | Done with the web wording; a refusal is shown, not swallowed |
| Delete id order | Stream record id, then event id |
| Phase filter, live and upcoming rows, open viewer, Manage event | Kept (mobile only) |

Not verified on a device (the emulator would not stay up) or against the live backend with a signed-in account.
Video playback in the sheet is untested beyond rendering with the player mocked.
