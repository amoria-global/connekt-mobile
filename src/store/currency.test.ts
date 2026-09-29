import { convertAndFormat, DEFAULT_CURRENCIES } from './currency';

// Expected strings are what web's CurrencyContext.formatPrice produces for the same inputs.
describe('convertAndFormat (parity with web formatPrice)', () => {
  it('treats an omitted source as USD and formats USD with a $ prefix', () => {
    expect(convertAndFormat(1234.5, undefined, 'USD', DEFAULT_CURRENCIES)).toBe('$1,234.50');
  });

  it('converts USD to RWF with no decimals and a symbol prefix', () => {
    expect(convertAndFormat(10, 'USD', 'RWF', DEFAULT_CURRENCIES)).toBe('RF 14,600');
  });

  it('converts through USD between two non-USD currencies', () => {
    expect(convertAndFormat(1460, 'RWF', 'USD', DEFAULT_CURRENCIES)).toBe('$1.00');
    expect(convertAndFormat(1460, 'RWF', 'EUR', DEFAULT_CURRENCIES)).toBe('€0.84');
  });

  it('returns null for a source currency with no known rate, so callers keep the original label', () => {
    expect(convertAndFormat(50, 'GBP', 'USD', DEFAULT_CURRENCIES)).toBeNull();
  });
});
