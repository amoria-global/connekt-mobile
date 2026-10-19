import { formatMoney } from './format';

describe('formatMoney (the amount in its own currency)', () => {
  it('shows USD as it is shown everywhere else', () => {
    expect(formatMoney(95.5, 'USD')).toBe('$95.50');
    expect(formatMoney(0, 'USD')).toBe('$0.00'); // a genuine zero is still zero
  });

  it('keeps the currency code for other currencies', () => {
    expect(formatMoney(12500, 'RWF')).toMatch(/^RWF 12.500$/);
  });

  it('never turns a missing amount into a zero balance', () => {
    expect(formatMoney(undefined, 'USD')).toBe('N/A');
    expect(formatMoney(Number.NaN, 'RWF')).toBe('N/A');
    expect(formatMoney(undefined)).toBe('N/A');
  });
});
