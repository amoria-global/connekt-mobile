import { isWholeNumberCurrency, priceError, priceHint, priceOk, sanitizePriceInput, type PaymentLimit } from './paymentLimits';

const usd: PaymentLimit = { currency: 'USD', minimum: '0.08', decimals: 2, wholeNumbersOnly: false };
const rwf: PaymentLimit = { currency: 'RWF', minimum: '100', decimals: 0, wholeNumbersOnly: true };
const ugx: PaymentLimit = { currency: 'UGX', minimum: '291', decimals: 0, wholeNumbersOnly: true };

describe('price against the currency minimum', () => {
  it('accepts USD 4 and refuses USD 0.05 with the field message', () => {
    expect(priceOk('4', 'USD', usd)).toBe(true);
    expect(priceError('0.05', 'USD', usd)).toBe(
      "The minimum price in USD is 0.08. Mobile Money can't process smaller payments.",
    );
    expect(priceOk('0.05', 'USD', usd)).toBe(false);
  });

  it('judges whole-number currencies in their own unit', () => {
    expect(priceOk('100', 'RWF', rwf)).toBe(true);
    expect(priceError('50', 'RWF', rwf)).toContain('The minimum price in RWF is 100.');
    expect(priceError('200', 'UGX', ugx)).toContain('minimum price in UGX is 291');
    expect(priceOk('500', 'UGX', ugx)).toBe(true);
  });

  it('leaves the server to judge when the minimum is unknown', () => {
    expect(priceOk('4', 'USD', null)).toBe(true);
    expect(priceError('abc', 'USD', null)).toBe('Enter a valid price.');
  });

  it('stays quiet on an empty field but keeps Create off', () => {
    expect(priceError('', 'USD', usd)).toBeNull();
    expect(priceOk('', 'USD', usd)).toBe(false);
    expect(priceError('0', 'USD', usd)).toBe('Enter a price above zero.');
  });

  it('refuses a third decimal place', () => {
    expect(priceError('1.234', 'USD', usd)).toBe('Enter a valid price.');
  });
});

describe('typing', () => {
  it('allows decimals only where the currency has cents', () => {
    expect(sanitizePriceInput('4.55', 'USD', usd)).toBe('4.55');
    expect(sanitizePriceInput('4.559', 'USD', usd)).toBe('4.55');
    expect(sanitizePriceInput('4,5', 'EUR')).toBe('4.5');
    expect(sanitizePriceInput('500.5', 'UGX', ugx)).toBe('5005');
    expect(sanitizePriceInput('12.3', 'RWF')).toBe('123');
  });

  it('falls back to the built-in whole-number list before the backend answers', () => {
    ['RWF', 'UGX', 'XAF', 'XOF'].forEach((c) => expect(isWholeNumberCurrency(c)).toBe(true));
    expect(isWholeNumberCurrency('USD')).toBe(false);
  });

  it('shows the minimum as helper text once known', () => {
    expect(priceHint(usd)).toBe('Minimum USD 0.08');
    expect(priceHint(null)).toBeNull();
  });
});
