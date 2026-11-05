import { validPublishPrice } from './PublishPriceSheet';

describe('validPublishPrice', () => {
  it('needs a positive price and a currency', () => {
    expect(validPublishPrice('2000', 'c1')).toBe(true);
    expect(validPublishPrice('1', 'c1')).toBe(true);
    expect(validPublishPrice('4.5', 'c1')).toBe(true);
  });
  it('refuses an empty, zero or non-numeric price, or no currency', () => {
    expect(validPublishPrice('', 'c1')).toBe(false);
    expect(validPublishPrice('0', 'c1')).toBe(false);
    expect(validPublishPrice('abc', 'c1')).toBe(false);
    expect(validPublishPrice('2000', '')).toBe(false);
  });
  it('judges the price against the minimum of the chosen currency', () => {
    const usd = { currency: 'USD', minimum: '0.08', decimals: 2, wholeNumbersOnly: false };
    const rwf = { currency: 'RWF', minimum: '100', decimals: 0, wholeNumbersOnly: true };
    expect(validPublishPrice('4', 'c1', usd, 'USD')).toBe(true);
    expect(validPublishPrice('0.05', 'c1', usd, 'USD')).toBe(false);
    expect(validPublishPrice('50', 'c2', rwf, 'RWF')).toBe(false);
    expect(validPublishPrice('100', 'c2', rwf, 'RWF')).toBe(true);
  });
});
