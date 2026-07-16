/**
 * Whether digital goods can be purchased inside the app.
 *
 * Google Play requires its own billing system for digital content consumed
 * in-app, and forbids steering users to any other payment method. Connekyt
 * cannot use Play Billing:
 *
 *  - Play merchant registration is not supported in Rwanda, so the account
 *    cannot sell in-app products or receive payouts at all.
 *  - Every price here is dynamic (photographers set per-album prices,
 *    organisers set per-event stream fees, gifts are free-form amounts, and
 *    GeoPriceResolver overrides prices per country). Play only supports
 *    pre-declared products at fixed prices.
 *  - The money isn't ours to take a cut of — photographers already receive
 *    70% of a photo sale and creators 100% of a tip.
 *
 * So on Android these purchases are absent rather than redirected: linking out
 * to XentriPay would itself breach the anti-steering rule. (The Epic v. Google
 * injunction relaxed that rule in the US only, and only until Nov 2027.)
 *
 * NOT gated, because Play's payments policy exempts them:
 *  - photographer bookings — a real-world service (someone physically shoots
 *    your event)
 *  - donations
 *
 * Users keep full access to content they already bought elsewhere; consuming
 * previously-purchased content is explicitly allowed. Free albums, free
 * streams, unlock codes, invite tokens and group codes are all unaffected.
 *
 * If the merchant entity ever moves to a Play-supported country, revisit the
 * whole model before flipping this — a flag alone won't make the pricing or
 * the revenue splits compatible.
 */
import { Platform } from 'react-native';

export const digitalPurchasesEnabled = Platform.OS !== 'android';
