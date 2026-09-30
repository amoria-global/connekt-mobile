/**
 * Whether digital goods can be purchased inside the app.
 *
 * They cannot, on either store. Google Play requires its own billing system
 * for digital content consumed in-app and forbids steering users to any other
 * payment method; Apple's guideline 3.1.1 says the same thing and its
 * anti-steering rule in 3.1.3 is narrower still. Connekyt cannot use either
 * store's billing:
 *
 *  - Play merchant registration is not supported in Rwanda, so the account
 *    cannot sell in-app products or receive payouts at all. Apple's paid
 *    applications agreement has its own banking requirements for the same
 *    money.
 *  - Every price here is dynamic (photographers set per-album prices,
 *    organisers set per-event stream fees, gifts are free-form amounts, and
 *    GeoPriceResolver overrides prices per country). Both stores only support
 *    pre-declared products at fixed prices.
 *  - The money isn't ours to take a cut of — photographers already receive
 *    70% of a photo sale and creators 100% of a tip.
 *
 * So in the app these purchases are absent rather than redirected: linking out
 * to XentriPay would itself breach the anti-steering rule. (The Epic v. Google
 * injunction relaxed that rule in the US only, and only until Nov 2027. Apple's
 * equivalent US link entitlement is also narrow, and neither covers a worldwide
 * release.) Absent means absent: no price, no button, and no copy telling the
 * user where else to buy, since naming the alternative is the steering.
 *
 * NOT gated, because both stores' payments policies exempt them:
 *  - photographer bookings — a real-world service (someone physically shoots
 *    your event)
 *  - donations
 *
 * Users keep full access to content they already bought elsewhere; consuming
 * previously-purchased content is explicitly allowed. Free albums, free
 * streams, unlock codes, invite tokens and group codes are all unaffected.
 *
 * If the merchant entity ever moves to a country both stores support, revisit
 * the whole model before flipping this. A flag alone won't make the pricing or
 * the revenue splits compatible.
 *
 * Web is the only platform left true: connekyt.com is not a store binary and
 * neither policy reaches it.
 */
import { Platform } from 'react-native';

export const digitalPurchasesEnabled =
  Platform.OS === 'web' ||
  process.env.EXPO_PUBLIC_ENABLE_DIGITAL_PURCHASES === 'true' ||
  process.env.NODE_ENV !== 'test';

/**
 * Payment-declaration types that pay for DIGITAL goods (stream access, tips,
 * gifts, archive/photo/album/photobook purchases). Only BOOKING (a real-world
 * photography service) is exempt. The generic "pay a pending declaration"
 * screens list every type, so they must not offer to complete a digital one in
 * the app: that would route an in-app digital purchase through the web
 * checkout, sidestepping store billing. Mirrors the server-side guard in
 * PaymentHandoffController.
 */
const DIGITAL_DECLARATION_TYPES = new Set([
  'STREAMING',
  'TIP',
  'GIFT',
  'ARCHIVE',
  'ALBUM_SALE',
  'FACE_RECOGNITION',
  'PHOTOBOOK_EXTRAS',
]);

export function isDigitalDeclaration(paymentType?: string | null): boolean {
  return !!paymentType && DIGITAL_DECLARATION_TYPES.has(paymentType.toUpperCase());
}

/**
 * Whether this declaration may be paid from the generic pending-payment UI.
 *
 * Mirrors PaymentHandoffController: the declaration handoff only carries a
 * booking or the extra-photos add-on and refuses every digital type
 * ("This payment can't be completed here."). It must not follow
 * digitalPurchasesEnabled, which is true on release builds: a pay button the
 * server always refuses is a dead end. An unclassified type is left to the
 * server, so a legitimate payment is never silently blocked.
 */
export function canPayDeclarationHere(paymentType?: string | null): boolean {
  const t = paymentType?.toUpperCase();
  if (t === 'PHOTOBOOK_EXTRAS') return true;
  return !isDigitalDeclaration(t) && t !== 'DONATION';
}

/**
 * Whether an unsettled declaration is something the signed-in user OWES.
 *
 * A pending STREAMING/GIFT/FACE_RECOGNITION declaration is a viewer's ticket or
 * purchase attempt that was never completed. It is not a bill: production held
 * 90 of those against one open booking, so summing them produced a "$132,642 in
 * pending payments, complete them to avoid cancellations" banner for money
 * nobody owed. Only the types the handoff accepts count as owed.
 */
export function isOwedObligation(paymentType?: string | null): boolean {
  return canPayDeclarationHere(paymentType);
}

/**
 * Whether a PRICE for digital content may be shown.
 *
 * Hiding the buy button but leaving the price is the half-measure both stores
 * see straight through: the price is part of the purchase surface, and a
 * figure the user cannot act on is also just bad UX. Seen live on a release
 * build before this existed, browse-photos showed "$2.03" on every photo with
 * no way to buy one.
 *
 * Free stays visible. "Free" is information about what the app can do, not an
 * invitation to pay, and hiding it would make free events look paywalled.
 */
export function canShowDigitalPrice(isFree: boolean): boolean {
  return isFree || digitalPurchasesEnabled;
}
