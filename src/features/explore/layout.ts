import type { ExploreItem } from './api';

/** Splits the feed into blocks so the list virtualises per block while each block is laid out as two columns. */
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Pinterest-style columns: each item goes to the currently shorter column, so a tall picture does not leave a hole
 * beside it. Height follows the picture's own aspect ratio at the column width.
 */
export function distribute(items: ExploreItem[], columns: number, colWidth: number, gap = 8): ExploreItem[][] {
  const cols: ExploreItem[][] = Array.from({ length: columns }, () => []);
  const heights = new Array(columns).fill(0);
  for (const it of items) {
    let target = 0;
    for (let c = 1; c < columns; c++) if (heights[c] < heights[target]) target = c;
    cols[target].push(it);
    heights[target] += colWidth / (it.aspectRatio || 1) + gap;
  }
  return cols;
}

/**
 * What a build may show. Store builds (digitalPurchasesEnabled false) never show a price, a Buy or cart control, or
 * any wording about buying elsewhere: viewers browse, watch previews, save and open what they already bought.
 */
export function capabilities(digitalPurchasesEnabled: boolean) {
  return {
    showPrices: digitalPurchasesEnabled,
    canBuy: digitalPurchasesEnabled,
    showLicence: digitalPurchasesEnabled,
    subtitleKey: digitalPurchasesEnabled ? ('explore_subtitle' as const) : ('explore_subtitleStore' as const),
  };
}

export function clock(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '';
  return `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, '0')}`;
}
