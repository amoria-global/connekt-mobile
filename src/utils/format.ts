import { convertAndFormat, useCurrency } from '@/store/currency';

/** Small formatting helpers. */

/** Format an ISO date string as e.g. "Mon, 3 Jun 2026". Returns '' on bad input. */
export function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format relative time matching salo-run: "Just now", "5 minutes ago", "Yesterday", etc. */
export function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Format a numeric amount with a currency code, e.g. "RWF 12,500". */
export function formatMoney(amount?: number, currency = ''): string {
  // A missing amount is not zero. Showing "0" for it reads as an empty balance.
  if (amount == null || Number.isNaN(amount)) return 'N/A';
  // The amount in the currency it is denominated in, which is what convertAndFormat
  // leaves to this function when no live rate exists. USD reads as it does everywhere else.
  if (currency === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${currency} ${formatted}`.trim();
}

/**
 * Like formatMoney, but shown in the currency picked in the top-bar selector,
 * the way web's formatPrice does. `from` is the currency `amount` is
 * denominated in (omitted means USD). An unknown `from` falls back to
 * formatMoney so the amount is never relabelled. Screens that must stay
 * reactive call useCurrency() so they re-render when the selection changes.
 */
export function formatPrice(amount?: number, from?: string): string {
  if (amount == null || Number.isNaN(amount)) return formatMoney(amount, from);
  const { currency, currencies } = useCurrency.getState();
  return convertAndFormat(amount, from, currency, currencies) ?? formatMoney(amount, from);
}
