import { flagCountryFor } from './flagCountry';
import { FLAG_SVG } from '@/theme/flags/flagSvgs';

describe('currency flags', () => {
  it('maps the production currencies to a flag that is bundled', () => {
    for (const code of ['CDF', 'ETB', 'EUR', 'GHS', 'KES', 'LSL', 'MWK', 'MZN', 'NGN', 'RWF', 'SLE', 'TZS', 'UGX', 'USD', 'XAF', 'XOF', 'ZMW']) {
      const country = flagCountryFor(code);
      expect(country).not.toBeNull();
      expect(FLAG_SVG[country as string]).toContain('<svg');
    }
  });
  it('is case-insensitive and null for an unknown currency', () => {
    expect(flagCountryFor('rwf')).toBe('rw');
    expect(flagCountryFor('ZZZ')).toBeNull();
    expect(flagCountryFor(undefined)).toBeNull();
  });
});
