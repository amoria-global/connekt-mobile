/**
 * Pure helpers for the My packages list: what the screen shows, decided in one place so the card and the tests agree.
 * No React, no store, no network.
 */
import { formatMoney } from '@/features/hybrid/offerPresentation';
import type { Package } from './api';

export type SessionFilter = 'ALL' | 'STUDIO' | 'OUTDOOR';

export const isIndoor = (p: Pick<Package, 'serviceType'>): boolean => p.serviceType === 'STUDIO';

const byPriceDesc = (a: Package, b: Package) => (b.price ?? 0) - (a.price ?? 0);

/** Indoor first, then outdoor, each from the highest price down: the order the tier naming policy ranks them in. */
export function splitBySession(all: Package[]): { indoor: Package[]; outdoor: Package[]; ordered: Package[] } {
  const indoor = all.filter(isIndoor).sort(byPriceDesc);
  const outdoor = all.filter((p) => !isIndoor(p)).sort(byPriceDesc);
  return { indoor, outdoor, ordered: [...indoor, ...outdoor] };
}

export function filterBySession(all: Package[], filter: SessionFilter): Package[] {
  const { indoor, outdoor, ordered } = splitBySession(all);
  return filter === 'STUDIO' ? indoor : filter === 'OUTDOOR' ? outdoor : ordered;
}

/**
 * The ids that carry the "Top tier" badge: the single highest-priced package of a session type, when there are at least
 * two and it is strictly dearer than the next. Decided by price rank (the same ranking the tier naming policy uses),
 * never by what the package is called, so a tie or a lone package gets no badge.
 */
export function topTierIds(all: Package[]): Set<string> {
  const { indoor, outdoor } = splitBySession(all);
  const ids = new Set<string>();
  for (const group of [indoor, outdoor]) {
    if (group.length >= 2 && (group[0].price ?? 0) > (group[1].price ?? 0)) ids.add(group[0].id);
  }
  return ids;
}

/** The package's own stored currency and amount, with the ISO code: "RWF 100,000". No conversion. */
export function packagePrice(p: Pick<Package, 'price' | 'currency'>): string | null {
  return p.price == null || Number.isNaN(p.price) ? null : formatMoney(p.price, p.currency);
}

export type CardRow = { key: string; label: string; price?: string };

/** Priced add-ons as label and price rows, then free-text feature rows as plain rows. Policies are left to the detail page. */
export function cardRows(p: Package): CardRow[] {
  const priced: CardRow[] = (p.addons ?? [])
    .filter((a) => a.enabled && a.price > 0)
    .map((a) => ({ key: `addon-${a.key}`, label: a.name, price: formatMoney(a.price, a.currencyCode || p.currency) }));
  const plain: CardRow[] = (p.features ?? [])
    .filter((f) => f.isIncluded !== false)
    .map((f, i) => ({ key: `feat-${i}`, label: cleanFeatureLabel(f.featureName) }))
    .filter((r) => r.label.length > 0);
  return [...priced, ...plain];
}

/** "Photos.............100K / Per Hour" reads "Photos 100K / Per Hour": runs of dots or ellipses are only leader fill. */
export function cleanFeatureLabel(raw: string): string {
  return raw
    .replace(/[.…]{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export type StatPart = { key: 'hours' | 'photos' | 'videos' | 'days'; count: number };

/** The quiet stats line, as counts; the screen words them with real plural forms. */
export function statParts(p: Package): StatPart[] {
  const parts: StatPart[] = [];
  if (p.durationHours) parts.push({ key: 'hours', count: p.durationHours });
  if (p.includedPhotos) parts.push({ key: 'photos', count: p.includedPhotos });
  if (p.includedVideos) parts.push({ key: 'videos', count: p.includedVideos });
  if (p.deliveryDays) parts.push({ key: 'days', count: p.deliveryDays });
  return parts;
}
