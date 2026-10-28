import { validPublishPrice } from './PublishPriceSheet';

describe('validPublishPrice', () => {
  it('needs a whole price of at least 1 and a currency', () => {
    expect(validPublishPrice('2000', 'c1')).toBe(true);
    expect(validPublishPrice('1', 'c1')).toBe(true);
  });
  it('refuses an empty, zero or non-numeric price, or no currency', () => {
    expect(validPublishPrice('', 'c1')).toBe(false);
    expect(validPublishPrice('0', 'c1')).toBe(false);
    expect(validPublishPrice('12.5', 'c1')).toBe(false);
    expect(validPublishPrice('2000', '')).toBe(false);
  });
});
