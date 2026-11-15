import { currencyPrefix, withCurrencyPrefix } from './currencyPrefix';
import { convertAndFormat, DEFAULT_CURRENCIES } from '@/store/currency';

describe('currency prefix: the ISO code, never a local symbol', () => {
  it('uses the code for RWF and every other currency without an unambiguous sign', () => {
    expect(currencyPrefix('RWF')).toBe('RWF');
    expect(currencyPrefix('kes')).toBe('KES');
    expect(currencyPrefix('UGX')).toBe('UGX');
    expect(currencyPrefix('TZS')).toBe('TZS');
  });

  it('keeps $ and € for USD and EUR', () => {
    expect(currencyPrefix('USD')).toBe('$');
    expect(currencyPrefix('EUR')).toBe('€');
  });

  it('spaces a code from the amount and keeps a sign tight', () => {
    expect(withCurrencyPrefix('RWF', '5,000')).toBe('RWF 5,000');
    expect(withCurrencyPrefix('USD', '25.00')).toBe('$25.00');
    expect(withCurrencyPrefix('EUR', '9.50')).toBe('€9.50');
  });

  it('formatPrice output has no RF, KSh, USh or TSh for any known currency', () => {
    const live = DEFAULT_CURRENCIES.map((c) => ({ ...c, rate: c.code === 'USD' ? 1 : 1000 }));
    for (const c of DEFAULT_CURRENCIES) {
      const text = convertAndFormat(10, 'USD', c.code, live) ?? '';
      expect(text).not.toMatch(/\b(RF|KSh|USh|TSh)\b/);
      expect(text.length).toBeGreaterThan(0);
    }
    expect(convertAndFormat(10, 'USD', 'RWF', live)).toBe('RWF 10,000');
  });
});
