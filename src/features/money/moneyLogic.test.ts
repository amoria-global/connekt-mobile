import {
  EMPTY_USAGE,
  approxLabel,
  convertAmount,
  defaultCurrencyCode,
  displayAmount,
  filterCurrencies,
  formatMoney,
  minimumLabel,
  parseUsage,
  quickPickCodes,
  rawFromInput,
  recordUse,
  sortAtoZ,
  suggestedCodes,
} from './moneyLogic';

const ALL = ['CDF', 'ETB', 'EUR', 'GHS', 'KES', 'RWF', 'UGX', 'USD'];
const rates = { RWF: { rateToUsd: 1478.5 }, KES: { rateToUsd: 130 }, EUR: { rateToUsd: 0.89 }, UGX: { rateToUsd: 4092 } };

describe('typing', () => {
  it('keeps decimals only where the currency has cents', () => {
    expect(rawFromInput('4.55', 'USD')).toBe('4.55');
    expect(rawFromInput('4.559', 'USD')).toBe('4.55');
    expect(rawFromInput('500.5', 'UGX')).toBe('5005');
    expect(rawFromInput('12.3', 'RWF')).toBe('123');
  });

  it('is paste-safe for grouped and mixed formats', () => {
    expect(rawFromInput('1,234.50', 'USD')).toBe('1234.50');
    expect(rawFromInput('1.234,50', 'EUR')).toBe('1234.50');
    expect(rawFromInput('4,5', 'EUR')).toBe('4.5');
    expect(rawFromInput('1,234', 'USD')).toBe('1234');
    expect(rawFromInput('USD 1 234', 'USD')).toBe('1234');
    expect(rawFromInput('5,914', 'RWF')).toBe('5914');
  });

  it('shows thousands separators and keeps the raw value clean', () => {
    expect(displayAmount('1234567.5')).toBe('1,234,567.5');
    expect(displayAmount('4.')).toBe('4.');
    expect(displayAmount('')).toBe('');
  });
});

describe('currency suggestions', () => {
  it('defaults to the last used, else the account currency, else RWF', () => {
    expect(defaultCurrencyCode(ALL, { last: 'KES', counts: {} }, 'EUR')).toBe('KES');
    expect(defaultCurrencyCode(ALL, EMPTY_USAGE, 'EUR')).toBe('EUR');
    expect(defaultCurrencyCode(ALL, EMPTY_USAGE, 'XYZ')).toBe('RWF');
    expect(defaultCurrencyCode(['KES'], EMPTY_USAGE, undefined)).toBe('KES');
  });

  it('suggests last used, then the account currency, then the most used, only from the server list', () => {
    let u = recordUse(recordUse(EMPTY_USAGE, 'GHS'), 'GHS');
    u = recordUse(recordUse(u, 'USD'), 'ZZZ');
    // last used is ZZZ, which the server does not list, so it is skipped.
    expect(suggestedCodes(ALL, u, 'RWF')).toEqual(['RWF', 'GHS', 'USD']);
  });

  it('fills the quick pick with the three most used, and always shows the selected one', () => {
    let u = EMPTY_USAGE;
    for (const c of ['USD', 'USD', 'USD', 'RWF', 'RWF', 'EUR', 'KES']) u = recordUse(u, c);
    expect(quickPickCodes(ALL, u, 'RWF', 'USD')).toEqual(['USD', 'RWF', 'EUR']);
    expect(quickPickCodes(ALL, u, 'RWF', 'GHS')).toEqual(['USD', 'RWF', 'GHS']);
    expect(quickPickCodes(ALL, EMPTY_USAGE, 'RWF', 'USD')).toEqual(['RWF', 'USD']);
  });

  it('round-trips and survives bad stored data', () => {
    const u = recordUse(EMPTY_USAGE, 'usd');
    expect(parseUsage(JSON.stringify(u))).toEqual({ last: 'USD', counts: { USD: 1 } });
    expect(parseUsage('not json')).toEqual(EMPTY_USAGE);
    expect(parseUsage(null)).toEqual(EMPTY_USAGE);
  });
});

describe('picker search', () => {
  const list = sortAtoZ([
    { id: '1', code: 'RWF', name: 'Rwandan franc' },
    { id: '2', code: 'CDF', name: 'Congolese franc' },
    { id: '3', code: 'USD', name: 'US dollar' },
  ]);

  it('sorts A to Z and searches code, name and country', () => {
    expect(list.map((c) => c.code)).toEqual(['CDF', 'RWF', 'USD']);
    expect(filterCurrencies(list, 'franc').map((c) => c.code)).toEqual(['CDF', 'RWF']);
    expect(filterCurrencies(list, 'usd').map((c) => c.code)).toEqual(['USD']);
    expect(filterCurrencies(list, 'rwanda', (c) => (c === 'RWF' ? 'Rwanda' : undefined)).map((c) => c.code)).toEqual(['RWF']);
    expect(filterCurrencies(list, '')).toHaveLength(3);
  });
});

describe('helper line', () => {
  it('converts to the display currency and says nothing without a rate', () => {
    expect(approxLabel('4', 'USD', 'RWF', rates)).toBe('≈ RWF 5,914');
    expect(approxLabel('50', 'KES', 'RWF', rates)).toBe('≈ RWF 569');
    expect(approxLabel('4', 'USD', 'USD', rates)).toBeNull();
    expect(approxLabel('', 'USD', 'RWF', rates)).toBeNull();
    expect(approxLabel('4', 'USD', 'TZS', rates)).toBeNull();
    expect(convertAmount(1, 'XYZ', 'USD', rates)).toBeNull();
    expect(formatMoney(5914.2, 'RWF')).toBe('RWF 5,914');
    expect(formatMoney(3.5, 'USD')).toBe('USD 3.50');
  });

  it('shows the minimum before anything is typed', () => {
    expect(minimumLabel({ currency: 'RWF', minimum: '100', wholeNumbersOnly: true })).toBe('Minimum RWF 100 · whole numbers only');
    expect(minimumLabel({ currency: 'USD', minimum: '0.07', wholeNumbersOnly: false })).toBe('Minimum USD 0.07');
    expect(minimumLabel(null)).toBeNull();
  });
});
