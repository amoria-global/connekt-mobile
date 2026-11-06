import { parseOpportunityOfferBrief } from './offerBrief';
import { cardLines, deliverableRows, deliveryRows, formatMoney, matchChips, normalizeCurrency, packageDifference, titleCasePlace } from './offerPresentation';
import type { PhotographerOpportunity } from './types';

// The exact line serializeOfferBrief writes: pipe-delimited, Photos not EditedPhotos.
const scope =
  '[OFFER_SCOPE] | Mode: Photography + video | Client: Individual | Coverage: 6 hours | Photos: 100 | ShortVideos: 2 × 30 seconds | LongVideos: None | LiveStream: Not requested | InstantWishes: Not requested | PhotoBook: None | PhotoAlbum: None | WallPortraits: None | InstantUpdates: Not requested | DigitalDelivery: Within 7 days after the event | PrintDelivery: None | PackageTier: Recommended | PricingDecision: MY_OFFER_ANYWAY';
const opp = (instructions?: string): PhotographerOpportunity => ({ instructions, city: 'kigali', eventDate: '2026-11-07' }) as PhotographerOpportunity;

describe('money and places', () => {
  it('always writes RWF, never RF', () => {
    expect(normalizeCurrency('RF')).toBe('RWF');
    expect(normalizeCurrency('rwf')).toBe('RWF');
    expect(normalizeCurrency(undefined)).toBe('RWF');
    expect(normalizeCurrency('usd')).toBe('USD');
    expect(formatMoney(970000, 'RF')).toBe('RWF 970,000');
  });
  it('shows place names in title case', () => {
    expect(titleCasePlace('kigali')).toBe('Kigali');
    expect(titleCasePlace('bk arena, kigali')).toBe('Bk Arena, Kigali');
  });
});

describe('packageDifference: worded from the photographer side', () => {
  it('an offer above the package is positive news', () => {
    expect(packageDifference(970000, 89997)).toEqual({ tone: 'positive', text: 'Client offers RWF 880,003 more than your package' });
  });
  it('an offer below the package is a warning, not red and not "below the client\'s offer"', () => {
    const d = packageDifference(80000, 100000)!;
    expect(d.tone).toBe('warning');
    expect(d.text).toBe("Client's offer is RWF 20,000 below your package");
  });
  it('matches within RWF 500, and says nothing without a package', () => {
    expect(packageDifference(100200, 100000)?.tone).toBe('neutral');
    expect(packageDifference(100000, null)).toBeNull();
  });
});

describe('Offer details and the card read the same saved offer', () => {
  it('reads the pipe-delimited line the writer produces, so print products are None only when they really are', () => {
    const brief = parseOpportunityOfferBrief(opp(scope.replace('PhotoBook: None', 'PhotoBook: 1 • A4 • 300 photos').replace('WallPortraits: None', 'WallPortraits: 2 • 60 × 90 cm • Framed')));
    const rows = deliverableRows(brief);
    expect(rows.find((r) => r.label === 'Photo book')?.value).toBe('1 • A4 • 300 photos');
    expect(rows.find((r) => r.label === 'Wall portraits')?.value).toBe('2 • 60 × 90 cm • Framed');
  });

  it('merges every "None" into one Not included line, and writes Instant updates as Not required', () => {
    const rows = deliverableRows(parseOpportunityOfferBrief(opp(scope)));
    expect(rows.map((r) => r.label)).toEqual(['Coverage', 'Edited photos', 'Short videos', 'Instant updates', 'Not included']);
    expect(rows.find((r) => r.label === 'Instant updates')?.value).toBe('Not required');
    expect(rows.at(-1)?.value).toBe('Long video, book, album, portraits');
  });

  it('an offer with no scope invents no print products', () => {
    const brief = parseOpportunityOfferBrief(opp(undefined));
    expect(brief.photoBookLabel).toBe('None');
    expect(brief.wallPortraitsLabel).toBe('None');
    expect(deliveryRows(brief)[1]).toEqual({ label: 'Print products', value: 'No print products' });
  });

  it('words print delivery for the photographer', () => {
    const withPrints = scope.replace('PhotoBook: None', 'PhotoBook: 1').replace('PrintDelivery: None', 'PrintDelivery: Propose production & handover date');
    expect(deliveryRows(parseOpportunityOfferBrief(opp(withPrints)))[1].value).toBe('You propose the date');
    expect(deliveryRows(parseOpportunityOfferBrief(opp(scope)))[0].value).toBe('Within 7 days after the event');
  });
});

describe('card', () => {
  it('has three compact lines with the city in title case', () => {
    const lines = cardLines(opp(scope), parseOpportunityOfferBrief(opp(scope)), 'Sat, 7 Nov');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ left: 'Sat, 7 Nov · 6 hours', right: 'Kigali' });
    expect(lines[2].right).toBe('7 days after');
  });
  it('shows up to three match chips and counts the rest', () => {
    expect(matchChips(['a', 'b', 'c', 'd', 'e'])).toEqual({ chips: ['a', 'b', 'c'], more: 2 });
    expect(matchChips(undefined)).toEqual({ chips: [], more: 0 });
  });
});
