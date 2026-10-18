/**
 * The "From ..." line on a photographer card.
 *
 * The old card hard-coded a dollar sign over a package price whose currency it never read. The price now carries the
 * currency of its own package: formatted (and converted for display) when the API states it, shown as a bare number
 * when it does not, and "On request" when there is no price. A zero price is "On request", not "From 0".
 */
import { formatMoney, formatPrice } from '@/utils/format';

export function startingPriceText(p: { startingPrice?: number; startingPriceCurrency?: string }): string {
  if (typeof p.startingPrice !== 'number' || !Number.isFinite(p.startingPrice) || p.startingPrice <= 0) return 'On request';
  return `From ${p.startingPriceCurrency ? formatPrice(p.startingPrice, p.startingPriceCurrency) : formatMoney(p.startingPrice)}`;
}
