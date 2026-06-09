/** Small, dependency-free formatting helpers. */

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

/** Format a numeric amount with a currency code, e.g. "RWF 12,500". */
export function formatMoney(amount?: number, currency = ''): string {
  if (amount == null || Number.isNaN(amount)) return `${currency} 0`.trim();
  const formatted = amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${currency} ${formatted}`.trim();
}
