import { DEFAULT_CURRENCIES, useCurrency } from '@/store/currency';
import { startingPriceText } from './pricing';

beforeEach(() => useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES }));

describe('startingPriceText', () => {
  it('no price, a zero price or a bad number is On request, never From 0', () => {
    expect(startingPriceText({})).toBe('On request');
    expect(startingPriceText({ startingPrice: 0 })).toBe('On request');
    expect(startingPriceText({ startingPrice: Number.NaN })).toBe('On request');
  });
  it('a USD package reads as dollars', () => {
    expect(startingPriceText({ startingPrice: 150, startingPriceCurrency: 'USD' })).toBe('From $150.00');
  });
  it('a RWF package keeps RWF when there is no live rate, and is not called dollars', () => {
    const t = startingPriceText({ startingPrice: 150000, startingPriceCurrency: 'RWF' });
    expect(t).toContain('RWF');
    expect(t).not.toContain('$');
  });
  it('a price with no stated currency is a bare number, never a guessed dollar sign', () => {
    const t = startingPriceText({ startingPrice: 150 });
    expect(t).toBe('From 150');
    expect(t).not.toContain('$');
  });
});
