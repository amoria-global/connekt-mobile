# Store listing and review wording

Mobile only. Web is unchanged. The rule behind all of this is in `docs/PAYMENTS.md`
("Digital goods are OFF on native builds, except tickets to in-person events").

The wording below must stay true to what the app does. Reviewers compare the
listing, the review notes and the screens, so a claim that the app does not back
up is worse than no claim. Do not describe an event as in person in the listing
unless the app only sells in-app tickets for in-person events, which it does.

Build, submission and publishing on EAS and the stores are done by the owner.
Nothing here is submitted automatically.

## In-app copy (already in the app)

| Where | Copy |
|---|---|
| Event screen, button | Buy event ticket |
| Event screen, fee card label | Event ticket (includes live stream) |
| Event screen, stream-only event | Ticket required. Verify below if you have one |
| Pay screen, step 1 title | Your Event Ticket |
| Pay screen, step 1 text | Your ticket admits you to the event, and includes the live stream if you cannot attend in person. |
| Pay screen, amount banner | Event ticket |
| Pay screen, success title | Event Ticket Confirmed! |
| Pay screen, success text | Your event ticket for {event} is confirmed. The live stream is included. |
| Event form, checkbox | Guests can attend in person at this venue |
| Event form, checkbox hint | Untick if this is a stream-only event. Viewers then get the live stream as a ticket. |

Stream-only events are never sold in the native app. Buyers use the website, a
group code, or "Verify access".

## App Store (Apple) description paragraph

> Connekyt connects event organizers, photographers and guests. Book a
> photographer, host an event, and buy tickets to events you attend in person.
> Each event ticket admits you to the venue, and also includes the live stream so
> you can follow along if you cannot be there. Tickets are for real-world events
> and are used outside the app.

## Google Play description paragraph

> Buy tickets to in-person events, book photographers for your event, and follow
> live streams that come with your ticket. Event tickets admit you to a real venue.
> Photographer bookings and donations are services delivered outside the app.

## What's New (release note)

> Event tickets now show clearly what you are buying: entry to the event, with the
> live stream included.

## App Review notes (paste into App Store Connect and Play Console)

> Connekyt sells tickets to in-person events and books photographers, both of which
> are consumed outside the app (Guideline 3.1.3(e), and Google Play's policy on
> physical goods and services). The app does not sell digital content or
> stream-only access: events without a physical venue cannot be bought in the app.
> The live stream is included with the ticket for events that have a venue.
>
> To review the flow: sign in with the demo account below, open the event named
> "{demo in-person event}" (it has a venue), and tap "Buy event ticket". The same
> screen for a stream-only event shows no price and no purchase button.
>
> Demo account: {email} / {password}. Payments use mobile money and cards through
> our own gateway.

Fill the braces before submitting. Create the demo in-person event on production
or a reviewer-visible account, and keep it available for the whole review.

## Checklist before each store submission

- The demo in-person event exists, has a real venue, and is visible to the demo
  account.
- Screenshots show "Buy event ticket" and the "Event ticket (includes live stream)"
  label, not "Stream entry".
- The listing text matches this file. No claim of stream-only purchases.
- A lawyer has reviewed the Apple 3.1.3(e) and Google physical-services reading
  for the markets you ship in.
- Releases follow the OTA rules in the repo CLAUDE.md: publish only from a branch
  whose JavaScript matches the installed build's natives.
