/**
 * Help Center content, in English. One file so the index, the search and the category pages read the same words.
 * Facts here must match what the app does today. Where a number or a timing is decided by the server or the
 * provider (fees, review times, limits) the article says it is shown on screen instead of quoting a figure that can go stale.
 * Do not point people to the website to buy digital goods: the store rules for native builds forbid steering.
 */
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'steps'; title?: string; items: string[] }
  | { type: 'list'; title?: string; items: string[] }
  | { type: 'tip'; text: string }
  | { type: 'warn'; text: string };

export type HelpArticle = {
  id: string;
  title: string;
  /** One line shown under the title in lists and in search results. */
  summary: string;
  blocks: HelpBlock[];
};

export type HelpCategory = {
  /** Also the route: /help-center/<id>. The first six keep the ids older links used. */
  id: string;
  title: string;
  blurb: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  tone: 'primary' | 'success' | 'error' | 'pending' | 'accent' | 'live';
  articles: HelpArticle[];
};

const p = (text: string): HelpBlock => ({ type: 'p', text });
const steps = (items: string[], title?: string): HelpBlock => ({ type: 'steps', title, items });
const list = (items: string[], title?: string): HelpBlock => ({ type: 'list', title, items });
const tip = (text: string): HelpBlock => ({ type: 'tip', text });
const warn = (text: string): HelpBlock => ({ type: 'warn', text });

export const HELP_CATEGORIES: HelpCategory[] = [
  // ───────────────────────────── Getting started ─────────────────────────────
  {
    id: 'getting-started',
    title: 'Getting started',
    blurb: 'What Connekyt is, who it is for and where everything lives in the app.',
    icon: 'rocket-outline',
    tone: 'primary',
    articles: [
      {
        id: 'what-is-connekyt',
        title: 'What Connekyt is',
        summary: 'Photographers, events, live streams and your photos in one app.',
        blocks: [
          p('Connekyt connects people who want photos and live coverage of an event with the photographers and hosts who deliver it. You can book a photographer, put on an event that people watch live or attend in person, find the photos you appear in, and send wishes to a celebration you cannot be at.'),
          list([
            'Clients book photographers, create events, share them with guests and pay for what they order.',
            'Photographers receive bookings, deliver albums, stream events live and withdraw their earnings.',
            'Event coordinators plan events for clients, manage the photographers on them and track the money.',
            'Guests and viewers do not need an account to look up their photos, watch a shared event or send a wish.',
          ], 'Who uses the app'),
          tip('You can look around, find your photos and open shared events before you sign up. An account is needed to book, create events and handle money.'),
        ],
      },
      {
        id: 'account-types',
        title: 'Choosing an account type',
        summary: 'Client, photographer or event coordinator, and what each can do.',
        blocks: [
          p('When you create an account the app asks what you will mainly do. The choice decides which screens and tools you see, so pick the closest match.'),
          list([
            'Client: book photographers, create and share events, watch and pay for streams, receive photos, send wishes and gifts.',
            'Photographer: show your work, accept bookings, deliver albums, host live streams and withdraw your earnings after identity verification.',
            'Event coordinator: create events for other people, assign photographers, set the stream fee and follow the payments of each event.',
          ]),
          p('If you chose the wrong type, contact us from Help Center, Contact us, and tell us which account and what you need. Do not create a second account with the same email, because every account needs its own email address.'),
        ],
      },
      {
        id: 'finding-your-way',
        title: 'Finding your way around the app',
        summary: 'The bottom tabs, the Help button and the language button.',
        blocks: [
          p('After you sign in, the bar at the bottom of the screen holds the main areas. Their names and order depend a little on your account type.'),
          list([
            'Home: what needs your attention today, your next event and quick actions.',
            'Events: the events you created, were invited to or are hosting, with a calendar and filters.',
            'Inbox: messages with photographers, clients and hosts, and your notifications.',
            'Wallet: your balance, activity, payments due and withdrawals.',
            'Profile: your details, verification, security, preferences and sign out.',
            'More: everything else, such as albums, packages, TV devices and settings.',
          ], 'The bottom bar'),
          p('The round question-mark button at the top of most screens opens this Help Center. The language button (for example EN) at the top of the sign-in screen changes the app language.'),
        ],
      },
      {
        id: 'before-you-start',
        title: 'Before you start: a quick checklist',
        summary: 'Five minutes of setup that avoids most problems later.',
        blocks: [
          steps([
            'Use an email address you can open now, because we send the verification and password reset links to it.',
            'Add a clear profile photo and a short description so people trust the account.',
            'Allow notifications so you hear about bookings, messages and payments straight away.',
            'If you will receive money (photographers and coordinators), complete identity verification early. Withdrawals wait for it.',
            'Turn on two-factor authentication under Profile, Security.',
          ]),
        ],
      },
    ],
  },

  // ───────────────────────────── My account ─────────────────────────────
  {
    id: 'my-account',
    title: 'My account',
    blurb: 'Sign up, sign in, your profile, verification, notifications and deleting your account.',
    icon: 'person-outline',
    tone: 'primary',
    articles: [
      {
        id: 'create-account',
        title: 'Create your account',
        summary: 'Sign up with email, Google or Apple.',
        blocks: [
          steps([
            'Open the app and tap Create an account on the sign-in screen.',
            'Choose your account type: client, photographer or event coordinator.',
            'Enter your name, email and a password, or continue with Google or Apple.',
            'Accept the terms and privacy policy after reading them.',
            'Open the verification email we send and tap the link. Check your spam folder if it is not in the inbox.',
            'Finish your profile with a photo and a short description.',
          ]),
          tip('Signing in with Google or Apple on the sign-in screen never creates an account by accident. If we do not recognise the profile, the app asks which account type you want first and carries your name and email over.'),
        ],
      },
      {
        id: 'sign-in-problems',
        title: 'Sign in and password problems',
        summary: 'Reset a forgotten password and fix common sign-in errors.',
        blocks: [
          steps([
            'On the sign-in screen tap Forgot your password.',
            'Enter the email you registered with and request the link.',
            'Open the email, tap the link and choose a new password.',
            'Return to the app and sign in with the new password.',
          ], 'Reset a forgotten password'),
          list([
            'Check the email for typing mistakes and extra spaces.',
            'Passwords are case sensitive. Make sure caps lock is off.',
            'If you signed up with Google or Apple, use the same button to sign in. There may be no password on that account.',
            'If the reset email does not arrive in a few minutes, check spam, then request it again once.',
            'If two-factor authentication is on, enter the code from your authenticator app or the one we send you.',
          ], 'If sign-in fails'),
          warn('Never share your password or a verification code with anyone, including people who say they work for Connekyt. We will never ask for it.'),
        ],
      },
      {
        id: 'edit-profile',
        title: 'Edit your profile',
        summary: 'Change your photo, name, description and contact details.',
        blocks: [
          steps([
            'Open the Profile tab and tap Edit profile.',
            'Change your name, location, description or contact details.',
            'Tap the photo to replace it. A clear, well lit headshot works best.',
            'Save. The change shows to other people straight away.',
          ]),
          p('Photographers: your profile is how clients choose you. Keep your description specific, such as the kinds of events you cover and the areas you travel to, and keep your packages and portfolio up to date.'),
        ],
      },
      {
        id: 'identity-verification',
        title: 'Verify your identity (KYC)',
        summary: 'Required before you can withdraw earnings.',
        blocks: [
          p('Roles that receive money, such as photographers and event coordinators, must verify their identity. This protects you and your clients from fraud. Verification is done in the app, where a banner or your profile prompts you to start it, and takes four steps.'),
          steps([
            'Details: confirm your legal name and basic information.',
            'Selfie: take a live selfie. The app checks on your phone that a real person is in front of the camera, and those frames are not kept.',
            'ID photo: photograph the front and back of your government issued ID in good light, with all four corners visible.',
            'Review: check everything and submit.',
          ]),
          list([
            'The app asks for your consent before it uses the camera for verification.',
            'Your ID and selfie are stored in private storage and used by our team to review your request. They are deleted when you resubmit or when you delete your account.',
            'Your status shows as Pending while we review and Verified when approved. You are notified either way.',
            'If a request is declined, the message says why. Retake the photos, avoiding glare, blur and cut off edges, and submit again.',
          ], 'What to know'),
          tip('Use the same name on your ID as on your payout account. A mismatch is the most common reason a withdrawal is held.'),
        ],
      },
      {
        id: 'notifications',
        title: 'Notifications',
        summary: 'Choose what you are alerted about and fix missing alerts.',
        blocks: [
          p('Connekyt tells you about bookings, messages, payments, event reminders and live streams starting. You see them as push alerts on your phone and in the notifications list inside the app.'),
          steps([
            'Open Preferences from your profile to see the alert options available to you.',
            'Allow notifications for Connekyt in your phone settings if you declined the first prompt.',
            'On Android, also check that battery saving is not stopping the app in the background.',
          ], 'Turn alerts on'),
          list([
            'Check Do Not Disturb and focus modes on your phone.',
            'Make sure you are signed in. Alerts stop after you sign out.',
            'Update the app to the latest version.',
            'Sign out and in again to refresh the connection with your phone.',
          ], 'If alerts do not arrive'),
        ],
      },
      {
        id: 'preferences-privacy',
        title: 'Preferences, blocking and privacy',
        summary: 'Appearance, blocked accounts and what others can see.',
        blocks: [
          list([
            'Appearance: the app follows a dark theme by default. You can switch between light and dark from your profile.',
            'Language: change it with the language button on the sign-in screen or in your preferences.',
            'Blocked accounts: if someone bothers you, block them from their profile or a conversation. Manage the list under Profile, Blocked accounts, where you can unblock.',
            'Your public profile shows your name, photo and description.',
          ]),
          p('See the Privacy policy in the app menu for the full details of what we collect and why.'),
        ],
      },
      {
        id: 'delete-account',
        title: 'Delete your account',
        summary: 'What deleting removes, and what to do first.',
        blocks: [
          p('You can delete your account from Profile, Delete account. This is permanent: your profile, messages and verification documents are removed, and you will not be able to sign in again.'),
          steps([
            'Withdraw any money left in your wallet and finish open bookings first.',
            'Download or share any albums or photos you want to keep.',
            'Open Profile, Delete account, read the warning and confirm.',
          ]),
          warn('Deleting cannot be undone. If you only want a break, sign out or turn off notifications instead.'),
        ],
      },
    ],
  },

  // ───────────────────────────── Booking ─────────────────────────────
  {
    id: 'booking',
    title: 'Booking and bookings',
    blurb: 'Find a photographer, book, message them, and manage or cancel a booking.',
    icon: 'calendar-outline',
    tone: 'accent',
    articles: [
      {
        id: 'find-photographer',
        title: 'Find the right photographer',
        summary: 'Search, compare and read profiles before you book.',
        blocks: [
          steps([
            'Open the photographers list from Home or the More tab.',
            'Search by name, or filter by where you need them and the kind of event.',
            'Open a profile to see their description, packages, reviews and past work.',
            'Compare two or three photographers before you decide.',
          ]),
          list([
            'Location: someone near the venue is easier to arrange than someone who must travel.',
            'Style: look at the portfolio, not only the description.',
            'Reviews: read what other clients said about reliability and delivery time.',
            'Packages: compare what is included, such as hours, photos delivered and live streaming.',
            'Availability: check the date before you message them.',
          ], 'What to look at'),
        ],
      },
      {
        id: 'make-booking',
        title: 'Make a booking',
        summary: 'From the profile to a confirmed request.',
        blocks: [
          steps([
            'Open the photographer and choose a package.',
            'Tap Book and pick the date, start time and place.',
            'Describe the event and add anything special, such as must-have shots or a schedule.',
            'Check the price shown. Fees and taxes that apply are listed before you confirm.',
            'Send the booking. The photographer is notified and accepts or declines.',
            'Pay when the app asks you to. Your booking and what you owe are listed under Bookings and in your Wallet.',
          ]),
          tip('A booking is only confirmed when the photographer accepts it. Until then, you are not charged for the shoot and you can still change your mind.'),
        ],
      },
      {
        id: 'track-bookings',
        title: 'Track and change a booking',
        summary: 'Statuses, messages, rescheduling and the calendar.',
        blocks: [
          p('Every booking is listed under Bookings with a status. Open it to see the details, the payment status and the conversation with the other person.'),
          list([
            'Pending: sent and waiting for the photographer.',
            'Accepted or confirmed: both sides agreed.',
            'Declined or cancelled: it will not go ahead.',
            'Completed: the shoot is done. You can leave a review.',
          ], 'Statuses'),
          steps([
            'Open the booking and tap Message to agree a change of time or place.',
            'The photographer updates the booking. You are notified of the change.',
          ], 'To change something'),
          p('The Calendar shows your confirmed work and events by day so you can spot clashes before you accept something new.'),
        ],
      },
      {
        id: 'messages',
        title: 'Messaging',
        summary: 'Agree details in the app so there is a record.',
        blocks: [
          p('Use the Inbox to talk to photographers, clients and hosts. Keep the details you agree on, such as time, place, shot list and delivery, in the conversation so both sides can find them later.'),
          list([
            'Be specific about the start time, the address and who to call on the day.',
            'Agree how and when photos will be delivered.',
            'Report abusive messages from the conversation menu, and block the person if needed.',
          ]),
          warn('Keep payments inside Connekyt. Paying outside the app removes the protections and records described in the Payments articles.'),
        ],
      },
      {
        id: 'cancellations',
        title: 'Cancel a booking',
        summary: 'How cancelling works and what happens to a payment.',
        blocks: [
          steps([
            'Open Bookings and choose the booking.',
            'Tap Cancel and give a short reason.',
            'The other person is notified.',
          ]),
          p('If you already paid, what is returned depends on the booking status, how close the date is and the photographer\'s response. The refund outcome is shown on the booking and in your Wallet activity. If you disagree with it, contact us from Help Center with the booking details.'),
          tip('Cancel as early as you can. Photographers keep the date free for you and may have turned other work down.'),
        ],
      },
      {
        id: 'coordinators',
        title: 'For event coordinators',
        summary: 'Plan an event for a client and manage its photographers.',
        blocks: [
          list([
            'Create the event for your client, choose whether it is public or private and set the details.',
            'Assign or invite photographers and agree the package with them.',
            'Set the stream fee when viewers pay to watch. Use plain amounts in the currency you picked.',
            'Follow each event\'s payments from the coordinator dashboard and your Wallet.',
            'If you stream a private event yourself, choose that you stream it yourself instead of assigning a photographer.',
          ]),
        ],
      },
    ],
  },

  // ───────────────────────────── Events and live ─────────────────────────────
  {
    id: 'events-and-live',
    title: 'Events and live streams',
    blurb: 'Create an event, share it, go live, watch, send wishes and use a TV.',
    icon: 'radio-outline',
    tone: 'live',
    articles: [
      {
        id: 'create-event',
        title: 'Create an event',
        summary: 'Details, visibility, who covers it and the stream fee.',
        blocks: [
          steps([
            'Open the Events tab and tap Create event.',
            'Enter the name, date, time, place and a short description.',
            'Choose Public or Private. Public events can be found by anyone. Private events are shared only by link or QR code.',
            'Choose who covers it: a photographer you assign, or you stream it yourself (private events).',
            'If viewers will pay to watch, set the stream fee in the currency you pick.',
            'Check the summary and save.',
          ]),
          list([
            'Tick that guests can attend in person only when the event really has a venue people can go to.',
            'A private event you stream yourself has no photographer, and viewers pay the fee you set.',
            'You can edit the event details later.',
          ], 'Good to know'),
        ],
      },
      {
        id: 'share-event',
        title: 'Share an event with a link or QR code',
        summary: 'Invite guests who may not have the app.',
        blocks: [
          steps([
            'Open your event and tap Share or the QR code button.',
            'Send the link on WhatsApp, SMS or email, or save the QR code to print or show on a screen.',
            'Guests open the link or scan the code and land on the event page.',
          ]),
          p('If a guest does not have the app yet, the link first offers to install it. After they install and sign up, the app takes them to the same event, so they do not have to search for it.'),
          tip('Share the link a day before and again an hour before the start. Most guests lose the first message.'),
        ],
      },
      {
        id: 'watch-live',
        title: 'Watch a live event',
        summary: 'Join, pay if there is a fee, and use chat and reactions.',
        blocks: [
          steps([
            'Open the shared link or find the event in Events.',
            'If the event is free, tap Watch. If it has a fee, you are shown the price before you continue.',
            'Complete the payment if asked. Access starts as soon as the payment is confirmed.',
            'Use the chat, reactions and wishes while you watch.',
          ]),
          list([
            'A countdown shows how long until the event starts. The stream opens when the host goes live.',
            'If the picture freezes, check your connection, then close and reopen the event. The stream resumes where it is live.',
            'Use headphones or turn the volume up if you hear nothing.',
            'A paid ticket cannot be shared. Each viewer pays for their own access.',
          ]),
          p('If you paid and still cannot watch, open the event and use Verify access. If that does not work, contact us with the payment reference.'),
        ],
      },
      {
        id: 'wishes',
        title: 'Send a wish to the celebration',
        summary: 'Text or a short video, public or private.',
        blocks: [
          p('You can send a message to the celebrant even if you cannot be there. Open the event link, go to Wishes and Memories and tap Send your wishes.'),
          steps([
            'Enter your name. An email is not needed.',
            'Write a message of up to 500 characters, or record a video of up to 60 seconds.',
            'Choose whether your wish is public or private. Public wishes appear on the wishes wall after the host approves them. Private wishes go only to the host.',
            'Send it. Wishes are accepted until the event ends.',
          ]),
          list([
            'You can hide your own wish later from the same device.',
            'Hosts approve or hide public wishes before they are shown.',
            'Report a wish that is abusive from its menu.',
          ]),
        ],
      },
      {
        id: 'go-live',
        title: 'Go live as a host',
        summary: 'Stream with your phone camera or with OBS.',
        blocks: [
          p('Hosts and photographers can stream an event from the event page. Who may stream an event is decided by the server: the assigned photographer, a photographer who has accepted the booking, or the owner of a private event that they stream themselves.'),
          steps([
            'Open your event and tap Go live.',
            'Allow the camera and microphone. Check your picture and sound in the preview.',
            'Tap Go live when you are ready. Viewers see the LIVE badge straight away.',
            'Use Pause for a short break and End when you are finished. An ended stream cannot be restarted.',
          ], 'Stream from your phone'),
          steps([
            'Open the OBS option on the host page to see your stream address.',
            'Copy it into OBS or any encoder that supports WHIP and start streaming.',
            'Tap Go live in the app when the encoder is connected.',
          ], 'Stream with OBS or another encoder'),
          warn('Your stream address is private. Do not share it. Use Reset stream if you think it leaked, which gives you a new address.'),
          list([
            'Use a stable connection: Wi-Fi or a strong mobile signal. The host page shows stream health and upload speed.',
            'Plug the phone in for long events and turn off notifications that could interrupt the camera.',
            'Moderate wishes in the host page: approve the good ones and hide the rest.',
          ], 'Tips'),
        ],
      },
      {
        id: 'tv',
        title: 'Watch on a TV',
        summary: 'Connect the app to a smart TV.',
        blocks: [
          steps([
            'Open the Connekyt app on your TV and note the code it shows.',
            'In the phone app open More, Connect to TV and enter the code or scan it.',
            'Pick the event to show. It plays on the TV and you control it from the phone.',
          ]),
          p('Manage your connected TVs under TV devices. Remove a TV you no longer use. If an event has a fee, the access is tied to the TV that paid.'),
        ],
      },
    ],
  },

  // ───────────────────────────── Photos ─────────────────────────────
  {
    id: 'photos-and-albums',
    title: 'Photos and albums',
    blurb: 'Find your photos with a selfie, share albums and make a photobook.',
    icon: 'images-outline',
    tone: 'accent',
    articles: [
      {
        id: 'find-my-photos',
        title: 'Find My Photos with a selfie',
        summary: 'Search event albums for the photos you appear in.',
        blocks: [
          steps([
            'Tap Find My Photos on the sign-in screen or Home.',
            'Read and accept the consent message. It explains what is processed and what is kept.',
            'Take a clear, front facing selfie in good light, without sunglasses or a mask.',
            'Choose the event if asked and wait for the matches.',
            'Open a result to view it, then save or share it where the album allows.',
          ]),
          list([
            'Your selfie is used for the search only. It is processed by Amazon Web Services face matching and is not stored.',
            'Matches only come from albums where the photographer or host turned face search on.',
            'The results are suggestions, so check them. A person who looks like you can appear.',
            'If you get no matches, the album may not be published yet or face search may be off for that event. Try again later.',
          ], 'How it works'),
          p('You do not need an account to search. Your privacy rights, including deleting data, are in the Privacy policy.'),
        ],
      },
      {
        id: 'albums',
        title: 'Create and manage albums (photographers)',
        summary: 'Upload, organise, publish and share.',
        blocks: [
          steps([
            'Open Albums from More or the event and tap New album.',
            'Name it, link it to the event and choose who can see it.',
            'Add photos from your phone. Uploads continue if you leave the screen.',
            'Choose cover photos and the order, then publish.',
            'Share the album link or QR code with the client and guests.',
          ]),
          list([
            'Turn face search on if you want guests to find their own photos with a selfie.',
            'Upload in good connectivity. Large albums take time on mobile data.',
            'Only upload photos you have the right to share. Remove a photo from the album menu if someone asks.',
            'Albums can be shared with a collaborator photographer using a share link.',
          ]),
        ],
      },
      {
        id: 'receive-photos',
        title: 'Receive and share your photos',
        summary: 'Open an album link and save what you need.',
        blocks: [
          steps([
            'Open the album link or QR code you were sent, or find it in your Events.',
            'Browse the photos and open any to see it in full size.',
            'Save or share the ones you want, where the album allows it.',
          ]),
          p('What you can do with an album, such as viewing, downloading or ordering, is set by the photographer and by your app version. If something you expect is missing, ask the photographer in a message.'),
        ],
      },
      {
        id: 'photobooks',
        title: 'Photobooks',
        summary: 'Turn an album into a keepsake.',
        blocks: [
          p('Photobooks bring your favourite photos together in a book. Open Photobooks, choose or start one for an event, pick the photos, arrange the pages and review before you confirm.'),
          list([
            'Extras and their prices are shown before you confirm.',
            'Track the order from the photobook screen.',
            'Contact us with the order details if something arrives wrong.',
          ]),
        ],
      },
    ],
  },

  // ───────────────────────────── Payments ─────────────────────────────
  {
    id: 'payment',
    title: 'Payments',
    blurb: 'What you pay, when, and how to see your receipts and what you owe.',
    icon: 'card-outline',
    tone: 'success',
    articles: [
      {
        id: 'how-paying-works',
        title: 'How paying works',
        summary: 'Prices, fees and the confirmation you get.',
        blocks: [
          steps([
            'Choose what you are paying for, for example a booking balance, an event ticket, a gift or a donation.',
            'The price and any fees are shown before you confirm. The amount comes from our server, not from the screen, so it cannot be changed on your phone.',
            'Choose how you want to pay and enter the details.',
            'Approve the payment on your phone if your mobile money operator asks, or finish the card page.',
            'Wait on the screen until it says the payment is confirmed. Do not close the app or tap pay again while it is working.',
          ]),
          warn('If the screen says we are still checking, do not pay again. The charge may already have gone through. Wait a few minutes, then look at your Payments or Transactions list before trying again.'),
        ],
      },
      {
        id: 'what-you-owe',
        title: 'What you owe and your history',
        summary: 'Payments due, receipts and transactions.',
        blocks: [
          list([
            'Payments due lists bookings with a balance to pay, such as a deposit or the rest of a shoot.',
            'Transactions lists everything that moved: payments, refunds, payouts and tips.',
            'Open a transaction to see its date, amount, source and notes. Keep the reference if you need to contact us.',
            'Your Wallet shows your balance and activity in the currency of your account.',
          ]),
          p('Unfinished purchases of things like tickets or gifts are not bills. They only appear if you started them.'),
        ],
      },
      {
        id: 'refunds',
        title: 'Refunds and disputes',
        summary: 'What to do when something went wrong.',
        blocks: [
          p('If a shoot is cancelled, a stream did not work, or you were charged twice, you can ask for a review.'),
          steps([
            'Open the booking or transaction and note the reference.',
            'Message the other person first. Many problems are solved that way.',
            'If it is not solved, go to Help Center, Contact us, and send the reference and what happened.',
            'We review the payment and the conversation and tell you the outcome in the app.',
          ]),
          p('Refunds go back to the method you used. The time it takes to appear depends on your bank or mobile money operator.'),
        ],
      },
      {
        id: 'currency',
        title: 'Currencies and amounts',
        summary: 'Why a price may show in another currency.',
        blocks: [
          p('Prices are set in a currency chosen by the photographer or host. Where we show your own currency it is a guide. The amount that is charged is the one on the confirmation screen.'),
          list([
            'Your wallet keeps its balance in your account currency.',
            'The country you pay from decides which payment methods are offered.',
            'The currency flag next to an amount tells you which currency it is.',
          ]),
        ],
      },
    ],
  },

  // ───────────────────────────── Payment methods ─────────────────────────────
  {
    id: 'payment-methods',
    title: 'Payment methods',
    blurb: 'Mobile money and cards, and how to fix a failed payment.',
    icon: 'wallet-outline',
    tone: 'pending',
    articles: [
      {
        id: 'mobile-money',
        title: 'Pay with mobile money',
        summary: 'Enter your number, approve on your phone.',
        blocks: [
          steps([
            'Choose Mobile money as the method.',
            'Pick your country and your operator from the list. Choosing the wrong operator sends the request to the wrong network.',
            'Enter the phone number registered for mobile money, in the format shown.',
            'Confirm. A prompt appears on that phone asking for your PIN. Enter it to approve.',
            'Return to the app and wait for the confirmation.',
          ]),
          list([
            'Make sure the wallet has enough balance, including any fee your operator charges.',
            'Keep the phone on and with signal. The prompt expires after a short time.',
            'If you do not get a prompt, dial your operator\'s menu to approve a pending payment, then wait.',
          ], 'If no prompt appears'),
        ],
      },
      {
        id: 'cards',
        title: 'Pay with a card',
        summary: 'A secure card page opens, then you return to the app.',
        blocks: [
          steps([
            'Choose Card as the method.',
            'A secure card page from our payment partner opens. Enter the card details there.',
            'Complete the extra check your bank asks for, such as a one time code.',
            'Return to the app when the page finishes. The app confirms the result.',
          ]),
          list([
            'The app does not see or store your full card number. It is handled by the payment partner.',
            'Do not close the card page until it says it is done, and do not tap pay twice.',
            'Cards are available where your account country and the event allow them. If you do not see the card option, use mobile money.',
          ]),
        ],
      },
      {
        id: 'failed-payment',
        title: 'My payment failed or is pending',
        summary: 'What each outcome means and what to do.',
        blocks: [
          list([
            'Declined by the bank or operator: check the balance and limits, try another method or contact your bank.',
            'Wrong PIN or the prompt expired: start the payment again and approve faster.',
            'Cancelled: you or the operator stopped it. Nothing is charged.',
            'Still pending: wait. Some operators take a few minutes. Do not pay again until the status says failed.',
            'Money left your account but we show nothing: open Transactions, wait a few minutes, then contact us with the time, amount and phone number.',
          ]),
          tip('Screenshots of the operator\'s message help us trace a payment quickly.'),
        ],
      },
      {
        id: 'payout-accounts',
        title: 'Payout accounts for withdrawals',
        summary: 'Where your earnings are sent.',
        blocks: [
          steps([
            'Open Profile, Payment accounts, and tap Add.',
            'Choose mobile money or a bank account and enter the details exactly.',
            'Save. You can keep more than one and choose when you withdraw.',
          ]),
          p('Check the name and number twice. A payout to a wrong number cannot be pulled back by us.'),
        ],
      },
    ],
  },

  // ───────────────────────────── Wallet ─────────────────────────────
  {
    id: 'wallet-and-payouts',
    title: 'Wallet and payouts',
    blurb: 'Your balance, earnings, and how to withdraw safely.',
    icon: 'cash-outline',
    tone: 'success',
    articles: [
      {
        id: 'wallet-basics',
        title: 'Understand your wallet',
        summary: 'Balance, activity and breakdowns.',
        blocks: [
          list([
            'Balance: what is available to you now.',
            'Activity: every movement with its date, direction (credit or debit), source and notes.',
            'Breakdowns: earnings, spending and balance charts so you can see where money comes from and goes.',
            'Search: look up a movement by its title or description.',
          ]),
          p('If the history will not load, pull down to refresh. Your balance at the top stays current.'),
          p('If your wallet shows Suspended, contact us. A suspended wallet cannot withdraw until it is reviewed.'),
        ],
      },
      {
        id: 'earnings',
        title: 'When earnings arrive',
        summary: 'How money gets into your wallet.',
        blocks: [
          list([
            'Bookings: money for a booking reaches your wallet as the payment is recorded, and every entry is listed in Activity.',
            'Stream fees: what viewers pay to watch is credited to the owner of the event.',
            'Tips and gifts: credited as they arrive during a live event.',
          ]),
          p('Open any entry in Activity to see its amount, source and notes. If an amount is not what you expected, contact us with the reference.'),
        ],
      },
      {
        id: 'withdraw',
        title: 'Withdraw your money',
        summary: 'Step by step, including the face confirmation.',
        blocks: [
          p('Before your first withdrawal your identity must be verified and you need a payout account.'),
          steps([
            'Open Wallet and tap Withdraw.',
            'Choose the payout account and enter the amount. Any fee and the amount you will receive are shown before you confirm.',
            'Confirm with a quick selfie. We compare it with the selfie from your verification to make sure it is you. The comparison is not stored.',
            'Wait for the status to change. You are notified when it is paid or if there is a problem.',
          ]),
          list([
            'Withdrawals appear in the Withdrawals list with their status.',
            'A withdrawal may be held if the name does not match, the account is wrong or your verification is not approved.',
            'Mobile money and bank payouts take as long as the operator or bank takes.',
          ]),
          warn('Never withdraw to an account because someone asked you to. Scammers ask for payments "to unlock" or "verify" a wallet. We never do that.'),
        ],
      },
    ],
  },

  // ───────────────────────────── Security ─────────────────────────────
  {
    id: 'security',
    title: 'Security and safety',
    blurb: 'Protect your account, your face data and your money.',
    icon: 'shield-checkmark-outline',
    tone: 'error',
    articles: [
      {
        id: 'two-factor',
        title: 'Turn on two-factor authentication',
        summary: 'A second check when you sign in.',
        blocks: [
          steps([
            'Open Two-factor authentication from your profile settings.',
            'Follow the steps to link your authenticator app or choose the code method offered.',
            'Enter the code to confirm.',
            'Save the backup codes somewhere safe and offline.',
          ]),
          p('When it is on, someone who guesses your password still cannot sign in without your phone.'),
        ],
      },
      {
        id: 'strong-password',
        title: 'Keep your account secure',
        summary: 'Habits that prevent most account theft.',
        blocks: [
          list([
            'Use a long, unique password that you do not use on other sites.',
            'Never share your password, codes or the link in a reset email.',
            'Be careful with links in messages. Connekyt will not ask you to sign in through a link in a chat.',
            'Sign out on shared phones.',
            'Keep the app and your phone updated.',
            'Check Transactions regularly and report anything you do not recognise.',
          ]),
        ],
      },
      {
        id: 'scams',
        title: 'Avoid scams',
        summary: 'Warning signs and what to do.',
        blocks: [
          list([
            'Someone asks you to pay outside the app or to move the chat to another platform.',
            'A "client" overpays and asks for the difference back.',
            'A message claims your account or wallet will be closed unless you pay or send a code.',
            'A photographer asks for the full amount well before the event with no booking in the app.',
            'You are asked for your PIN. No genuine request ever needs your mobile money PIN outside your own phone prompt.',
          ], 'Warning signs'),
          steps([
            'Stop and do not pay or share any code.',
            'Report the user from their profile or the conversation.',
            'Contact us from Help Center with screenshots.',
          ], 'If you think it is a scam'),
        ],
      },
      {
        id: 'face-data',
        title: 'How we handle face data',
        summary: 'What we use your face for, and what we keep.',
        blocks: [
          list([
            'Find My Photos: your selfie is matched against albums with Amazon Web Services and is not stored.',
            'Event albums with face search on: faces in published photos are indexed so guests can find themselves. This is removed when the event or album is deleted.',
            'Identity verification: your selfie and ID are held in private storage for review, and removed on resubmission or account deletion. The liveness check runs on your phone and the frames are not kept.',
            'Withdrawal confirmation: your selfie is compared with your verification selfie and not stored.',
          ]),
          p('We ask for your consent before each of these uses the camera. Face data is never used for advertising, never sold and never used to train models. See the Privacy policy, section on face data, for the full text.'),
        ],
      },
      {
        id: 'report-block',
        title: 'Report content or block someone',
        summary: 'Keep yourself and your events safe.',
        blocks: [
          steps([
            'Open the profile, message, wish or chat line.',
            'Tap the menu and choose Report, then give a reason.',
            'To stop contact, choose Block.',
          ]),
          p('Reports are reviewed by our team. Hosts can also hide wishes shown on their event.'),
        ],
      },
    ],
  },

  // ───────────────────────────── Technical support ─────────────────────────────
  {
    id: 'technical-support',
    title: 'Technical support',
    blurb: 'Updates, permissions, slow video, and how to reach us.',
    icon: 'construct-outline',
    tone: 'primary',
    articles: [
      {
        id: 'app-updates',
        title: 'Keep the app up to date',
        summary: 'How updates reach you and what to do if one is stuck.',
        blocks: [
          p('Small improvements arrive automatically. When one is ready the app shows what is new and asks you to tap Update now. Bigger changes come from the App Store or Google Play.'),
          list([
            'Open the app on a good connection and accept the update prompt.',
            'If the app keeps asking, close it fully and reopen.',
            'Install the latest version from the store if features are missing.',
          ]),
        ],
      },
      {
        id: 'permissions',
        title: 'Camera, microphone, photos and location',
        summary: 'Why we ask and how to turn them on.',
        blocks: [
          list([
            'Camera: selfies for Find My Photos and verification, scanning QR codes and going live.',
            'Microphone: going live and recording a video wish.',
            'Photos: uploading to albums and choosing a profile photo.',
            'Location: showing events and photographers near you.',
            'Notifications: bookings, messages, payments and live alerts.',
          ], 'What each permission is for'),
          p('If you said no by mistake, open your phone Settings, find Connekyt and switch the permission on. Then return to the app.'),
        ],
      },
      {
        id: 'stream-problems',
        title: 'Live stream problems',
        summary: 'Fixes for freezing, no sound and a stream that will not start.',
        blocks: [
          list([
            'Viewers: check your connection, close other apps that use data, then reopen the event.',
            'No sound: check the phone volume and the volume in the player.',
            'Host cannot start: check the camera and microphone permissions, and that you are the person allowed to stream this event.',
            'Host stream drops: move closer to the router or use a stronger signal. The host page shows stream health and upload speed.',
            'OBS shows connected but viewers see nothing: tap Go live in the app after the encoder connects.',
            'The stream was ended: an ended stream cannot be restarted. Create a new event for the next session.',
          ]),
        ],
      },
      {
        id: 'app-problems',
        title: 'App is slow, crashes or shows a blank screen',
        summary: 'Steps that fix most problems.',
        blocks: [
          steps([
            'Close the app fully and open it again.',
            'Check you are online and try another network.',
            'Update the app from the store.',
            'Restart your phone and free up storage space.',
            'Sign out and back in.',
            'If it still fails, contact us with your phone model, the app version and what you were doing.',
          ]),
        ],
      },
      {
        id: 'contact-us',
        title: 'Contact us',
        summary: 'What to include so we can help quickly.',
        blocks: [
          p('From Help Center tap Contact us to send a message to our team. Use Send feedback for ideas and things you would like improved.'),
          list([
            'Describe what happened and what you expected.',
            'Include the booking, event or payment reference.',
            'Add screenshots, the time it happened and the phone number used for a payment.',
            'Tell us your phone model and the app version.',
          ], 'Please include'),
          p('We answer in the app and by email, so check both.'),
        ],
      },
    ],
  },
];

export const HELP_ARTICLE_COUNT = HELP_CATEGORIES.reduce((n, c) => n + c.articles.length, 0);

export function findCategory(id: string | undefined): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.id === id);
}

export type HelpHit = { category: HelpCategory; article: HelpArticle };

function blockText(b: HelpBlock): string {
  if (b.type === 'p' || b.type === 'tip' || b.type === 'warn') return b.text;
  return `${b.title ?? ''} ${b.items.join(' ')}`;
}

/** Articles whose title, summary or body contains every word of the query, title matches first. */
export function searchHelp(query: string): HelpHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const hits: (HelpHit & { score: number })[] = [];
  for (const category of HELP_CATEGORIES) {
    for (const article of category.articles) {
      const title = article.title.toLowerCase();
      const summary = article.summary.toLowerCase();
      const body = article.blocks.map(blockText).join(' ').toLowerCase();
      if (!words.every((w) => title.includes(w) || summary.includes(w) || body.includes(w))) continue;
      const score = words.reduce((n, w) => n + (title.includes(w) ? 3 : 0) + (title.startsWith(w) ? 2 : 0) + (summary.includes(w) ? 1 : 0), 0);
      hits.push({ category, article, score });
    }
  }
  return hits.sort((a, b) => b.score - a.score);
}
