/**
 * What is printed before an amount: the ISO code ("RWF 5,000", "KES 1,200"), except USD and EUR, whose signs
 * ($ and €) are unambiguous. A local symbol such as "RF" or "TSh" is never used: it is not a code, so it reads
 * differently from the code shown in packages, bookings and receipts.
 */
export function currencyPrefix(code: string): string {
  const c = (code || '').trim().toUpperCase();
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  return c;
}

/** Letter codes are spaced from the amount ("RWF 5,000"), sign symbols are tight ("$25.00"). */
export function withCurrencyPrefix(code: string, formattedAmount: string): string {
  const prefix = currencyPrefix(code);
  return `${prefix}${/^[A-Za-z]+$/.test(prefix) ? ' ' : ''}${formattedAmount}`;
}
