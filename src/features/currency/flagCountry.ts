/**
 * Which flag stands for a currency. A currency used by one country takes that country's flag; the euro takes the EU flag.
 * The two CFA francs belong to several countries and have no flag of their own, so each takes its largest economy
 * (XAF: Cameroon, XOF: Cote d'Ivoire). A code that is not listed has no flag and the picker shows the code alone.
 */
const CURRENCY_COUNTRY: Record<string, string> = {
  RWF: 'rw', USD: 'us', EUR: 'eu', KES: 'ke', UGX: 'ug', TZS: 'tz', CDF: 'cd', ETB: 'et', GHS: 'gh', LSL: 'ls',
  MWK: 'mw', MZN: 'mz', NGN: 'ng', SLE: 'sl', ZMW: 'zm', XAF: 'cm', XOF: 'ci', GBP: 'gb', ZAR: 'za', BIF: 'bi',
};

/** The lower-case country code whose flag stands for the currency, or null. */
export function flagCountryFor(currencyCode: string | null | undefined): string | null {
  return CURRENCY_COUNTRY[(currencyCode ?? '').trim().toUpperCase()] ?? null;
}
