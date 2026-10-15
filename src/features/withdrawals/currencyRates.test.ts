import {
  applyRates,
  displayToUsd,
  donationPresets,
  FALLBACK_CURRENCIES,
  KNOWN_CURRENCIES,
  usdToDisplay,
} from './model';
import { convertAndFormat, DEFAULT_CURRENCIES } from '@/store/currency';

// A withdrawal or donation typed in the display currency is divided by its rate and
// submitted in USD, so a rate that the backend did not supply must never be invented.
// The backend serves rateToUsd as "1 USD = X units" (RWF 1300 means 1 USD = 1300 RWF).

describe('withdrawal display currencies', () => {
  it('offer only USD before, or without, backend rates', () => {
    expect(FALLBACK_CURRENCIES.map((c) => c.code)).toEqual(['USD']);
    expect(applyRates(KNOWN_CURRENCIES, null).map((c) => c.code)).toEqual(['USD']);
    expect(applyRates(KNOWN_CURRENCIES, {}).map((c) => c.code)).toEqual(['USD']);
  });

  it('add RWF only from a usable rate', () => {
    const list = applyRates(KNOWN_CURRENCIES, { RWF: { rateToUsd: '1300', symbol: 'RF' } });
    expect(list.map((c) => c.code).sort()).toEqual(['RWF', 'USD']);
    expect(list.find((c) => c.code === 'RWF')!.rate).toBe(1300);
  });

  it.each([['text', 'abc'], ['zero', 0], ['negative', -1], ['null', null], ['missing', undefined], ['NaN', NaN]])(
    'a malformed RWF rate (%s) leaves RWF out instead of defaulting it',
    (_n, bad) => {
      const list = applyRates(KNOWN_CURRENCIES, { RWF: { rateToUsd: bad } });
      expect(list.map((c) => c.code)).toEqual(['USD']);
    },
  );

  it('converts a typed amount at the supplied rate and never at a built-in one', () => {
    const rwf = applyRates(KNOWN_CURRENCIES, { RWF: { rateToUsd: 1300 } }).find((c) => c.code === 'RWF')!;
    expect(displayToUsd(130000, rwf)).toBeCloseTo(100, 6);
    expect(usdToDisplay(95.5, rwf)).toBeCloseTo(124150, 6);
  });

  it('a currency with no rate cannot produce a submitted amount', () => {
    const noRate = { code: 'RWF', symbol: 'RF', rate: 0, decimals: 0 };
    expect(displayToUsd(1000, noRate)).toBe(0); // zero is rejected by amountError, never a converted figure
  });
});

describe('donation presets', () => {
  const rwf = { code: 'RWF', symbol: 'RF', rate: 1300, decimals: 0 };
  const usd = { code: 'USD', symbol: '$', rate: 1, decimals: 2 };

  it('are offered only with a live RWF rate', () => {
    expect(donationPresets(0, usd)).toEqual([]);
    expect(donationPresets(-5, usd)).toEqual([]);
  });

  it('are the fixed RWF amounts converted at that rate', () => {
    expect(donationPresets(1300, rwf)).toEqual([500, 1000, 2500, 5000]);
    expect(donationPresets(1300, usd)).toEqual([0.38, 0.77, 1.92, 3.85]);
  });
});

describe('display currency store', () => {
  it('has no built-in rate for any currency but USD', () => {
    for (const c of DEFAULT_CURRENCIES) expect(c.rate).toBe(c.code === 'USD' ? 1 : 0);
  });

  it('shows an amount untouched (null) when the display or source currency has no live rate', () => {
    expect(convertAndFormat(95.5, 'USD', 'RWF', DEFAULT_CURRENCIES)).toBeNull();
    expect(convertAndFormat(130000, 'RWF', 'USD', DEFAULT_CURRENCIES)).toBeNull();
  });

  it('converts between live currencies and formats at the currency precision', () => {
    const live = DEFAULT_CURRENCIES.map((c) => (c.code === 'RWF' ? { ...c, rate: 1300 } : c));
    expect(convertAndFormat(95.5, 'USD', 'RWF', live)).toBe('RF 124,150');
    expect(convertAndFormat(130000, 'RWF', 'USD', live)).toBe('$100.00');
    expect(convertAndFormat(0, 'USD', 'USD', live)).toBe('$0.00'); // a genuine zero still shows as zero
  });
});
