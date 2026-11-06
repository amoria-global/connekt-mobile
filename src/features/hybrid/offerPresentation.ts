/**
 * How an opportunity is worded on the card and on Offer details: one set of rules, so the two screens cannot disagree.
 * Pure functions over the parsed brief (`parseOpportunityOfferBrief`, the reader that matches `serializeOfferBrief`).
 */
import type { ParsedOfferBrief } from './offerBrief';
import type { PhotographerOpportunity } from './types';

/** The code as the app writes it: "RF", "Rwf" and "rwf" all read RWF, and a missing code is RWF. */
export function normalizeCurrency(code?: string | null): string {
  const c = (code ?? '').trim().toUpperCase();
  if (!c || c === 'RF' || c === 'RWF') return 'RWF';
  return c;
}

/** "RWF 970,000": the code, then the amount. */
export function formatMoney(amount: number, currency?: string | null): string {
  return `${normalizeCurrency(currency)} ${Math.round(amount).toLocaleString('en-US')}`;
}

/** "kigali" reads "Kigali": a capital at the start of each word. */
export function titleCasePlace(text: string): string {
  return text.replace(/(^|[\s·•,-]+)([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

export type DifferenceTone = 'positive' | 'warning' | 'neutral';

/**
 * The client's offer against the photographer's matching package, written from the photographer's side. An offer above
 * the package is good news (positive); an offer below it means a lower fee than the package (warning, never red, because
 * the photographer may still accept). Within RWF 500 they match.
 */
export function packageDifference(
  offer: number | null,
  packagePrice: number | null,
  currency?: string | null,
): { tone: DifferenceTone; text: string } | null {
  if (packagePrice == null) return null;
  if (offer == null) return { tone: 'neutral', text: `${formatMoney(packagePrice, currency)} package rate` };
  const diff = Math.round(offer - packagePrice);
  if (Math.abs(diff) < 500) return { tone: 'neutral', text: "Client's offer matches your package" };
  if (diff > 0) {
    return { tone: 'positive', text: `Client offers ${formatMoney(diff, currency)} more than your package` };
  }
  return { tone: 'warning', text: `Client's offer is ${formatMoney(Math.abs(diff), currency)} below your package` };
}

export type LabelValue = { label: string; value: string };

const isNone = (v: string) => /^(none|no|0|not requested|not required|n\/a|-)?$/i.test(v.trim());
const isNoneStrict = (v: string) => /^(none|no|0|n\/a|-)?$/i.test(v.trim());

/**
 * The requested deliverables as full-width label / value rows. Everything the client did not ask for is merged into one
 * "Not included" line, so there is no run of "None" rows. Nothing is shortened: a long value wraps.
 */
export function deliverableRows(brief: ParsedOfferBrief, opts: { liveStream?: boolean; wishes?: boolean } = {}): LabelValue[] {
  const rows: LabelValue[] = [];
  const missing: string[] = [];
  const add = (label: string, value: string, missingName: string) => {
    if (isNoneStrict(value)) missing.push(missingName);
    else rows.push({ label, value });
  };
  rows.push({ label: 'Coverage', value: brief.coverageHoursLabel });
  add('Edited photos', brief.editedPhotosLabel, 'photos');
  add('Short videos', brief.shortVideosLabel, 'short videos');
  add('Long videos', brief.longVideosLabel, 'long video');
  add('Photo book', brief.photoBookLabel, 'book');
  add('Photo album', brief.photoAlbumLabel, 'album');
  add('Wall portraits', brief.wallPortraitsLabel, 'portraits');
  rows.push({ label: 'Instant updates', value: isNone(brief.instantUpdatesLabel) ? 'Not required' : brief.instantUpdatesLabel });
  if (opts.liveStream || !isNone(brief.liveStreamLabel)) {
    rows.push({ label: 'Live stream', value: isNone(brief.liveStreamLabel) ? 'Requested' : brief.liveStreamLabel });
  }
  if (opts.wishes || !isNone(brief.instantWishesLabel)) {
    rows.push({ label: 'Wishes & memories', value: isNone(brief.instantWishesLabel) ? 'Enabled' : brief.instantWishesLabel });
  }
  if (missing.length) {
    const list = missing.join(', ');
    rows.push({ label: 'Not included', value: list.charAt(0).toUpperCase() + list.slice(1) });
  }
  return rows;
}

/** Digital and print delivery as label / value rows, worded for the photographer. */
export function deliveryRows(brief: ParsedOfferBrief): LabelValue[] {
  const hasPrints = ![brief.photoBookLabel, brief.photoAlbumLabel, brief.wallPortraitsLabel].every(isNoneStrict);
  const print = !hasPrints
    ? 'No print products'
    : /^propose/i.test(brief.printDeliveryLabel) || isNoneStrict(brief.printDeliveryLabel)
      ? 'You propose the date'
      : brief.printDeliveryLabel;
  return [
    { label: 'Digital', value: brief.digitalDeliveryLabel },
    { label: 'Print products', value: print },
  ];
}

/** "Within 7 days after the event" reads "7 days after" on the card. */
function shortDigital(v: string): string {
  const m = v.match(/within\s+(.+?)\s+after/i);
  return m ? `${m[1]} after` : v;
}

/** What the print products come to, in a few words for the card: "Book, album" or "No prints". */
function printSummary(brief: ParsedOfferBrief): string {
  const parts: string[] = [];
  if (!isNoneStrict(brief.photoBookLabel)) parts.push('Book');
  if (!isNoneStrict(brief.photoAlbumLabel)) parts.push('Album');
  if (!isNoneStrict(brief.wallPortraitsLabel)) parts.push('Portraits');
  return parts.length ? parts.join(', ') : 'No prints';
}

export type CardLine = { icon: 'calendar-outline' | 'videocam-outline' | 'cloud-outline'; left: string; right?: string };

/** The three compact detail lines on the opportunity card. */
export function cardLines(opp: PhotographerOpportunity, brief: ParsedOfferBrief, dateText: string): CardLine[] {
  const city = opp.city || opp.venue || '';
  const photos = isNoneStrict(brief.editedPhotosLabel) ? null : `${brief.editedPhotosLabel} photos`;
  const clipCount = (v: string) => (isNoneStrict(v) ? 0 : Number(v.match(/^\s*(\d+)/)?.[1] ?? 1));
  const clipsTotal = clipCount(brief.shortVideosLabel) + clipCount(brief.longVideosLabel);
  const deliverables = [photos, clipsTotal ? `${clipsTotal} clip${clipsTotal === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
  return [
    { icon: 'calendar-outline', left: `${dateText} · ${brief.coverageHoursLabel}`, right: city ? titleCasePlace(city) : undefined },
    { icon: 'videocam-outline', left: brief.coverageModeLabel, right: [deliverables, printSummary(brief) === 'No prints' ? '' : printSummary(brief)].filter(Boolean).join(' · ') || undefined },
    { icon: 'cloud-outline', left: 'Digital delivery', right: shortDigital(brief.digitalDeliveryLabel) },
  ];
}

/** The server's long reasons, shortened for a chip: "Available for the full event (6 hrs)" reads "Available 6 hrs". */
function shortReason(reason: string, city?: string | null): string {
  let m = reason.match(/^Available for the full event \((.+)\)$/i);
  if (m) return `Available ${m[1]}`;
  m = reason.match(/^(.+?) specialty fits this event$/i);
  if (m) return `${m[1]} specialty`;
  m = reason.match(/^(.+?) specialist requested$/i);
  if (m) return `${m[1]} specialist`;
  if (/^in the event's city$/i.test(reason) && city) return `In ${titleCasePlace(city)}`;
  if (/^freelancer requested$/i.test(reason)) return 'Freelancer';
  if (/^company\s*\/\s*studio requested$/i.test(reason)) return 'Studio';
  return reason;
}

/** Up to three match reasons for the card, and how many more there are. */
export function matchChips(reasons: string[] | undefined, max = 3, city?: string | null): { chips: string[]; more: number } {
  const clean = (reasons ?? []).map((r) => r.trim()).filter(Boolean).map((r) => shortReason(r, city));
  return { chips: clean.slice(0, max), more: Math.max(0, clean.length - max) };
}
