import { api } from '@/api/client';
import { useAuth } from '@/store/auth';
import { convertAndFormat, DEFAULT_CURRENCIES, useCurrency } from './currency';

jest.mock('@/api/client', () => ({ api: { get: jest.fn(), put: jest.fn() } }));
jest.mock('@/services/storage', () => ({
  storage: { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) },
  StorageKeys: { displayCurrency: 'display.currency' },
}));
jest.mock('@/store/auth', () => ({ useAuth: { getState: jest.fn() } }));

const get = api.get as jest.Mock;
const put = api.put as jest.Mock;
const signedIn = (yes: boolean) =>
  (useAuth.getState as jest.Mock).mockReturnValue({ status: yes ? 'authenticated' : 'unauthenticated' });

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

describe('account sync (shared with the web dashboard)', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset().mockResolvedValue({ action: 1 });
    signedIn(true);
    useCurrency.setState({ currency: 'USD' });
  });

  it('adopts the currency saved on the account', async () => {
    get.mockResolvedValue({ action: 1, data: { currency: 'RWF' } });
    await useCurrency.getState().syncWithAccount();
    expect(useCurrency.getState().currency).toBe('RWF');
    expect(put).not.toHaveBeenCalled();
  });

  it('saves the device choice when the account has none yet', async () => {
    useCurrency.setState({ currency: 'KES' });
    get.mockResolvedValue({ action: 1, data: { currency: null } });
    await useCurrency.getState().syncWithAccount();
    expect(put).toHaveBeenCalledWith('/customer/profile/display-currency', { currency: 'KES' });
  });

  it('keeps the device choice when the API answers action 0', async () => {
    useCurrency.setState({ currency: 'EUR' });
    get.mockResolvedValue({ action: 0, message: 'nope' });
    await useCurrency.getState().syncWithAccount();
    expect(useCurrency.getState().currency).toBe('EUR');
    expect(put).not.toHaveBeenCalled();
  });

  it('saves a pick to the account only when signed in', () => {
    useCurrency.getState().setCurrency('UGX');
    expect(put).toHaveBeenCalledWith('/customer/profile/display-currency', { currency: 'UGX' });
    put.mockClear();
    signedIn(false);
    useCurrency.getState().setCurrency('TZS');
    expect(put).not.toHaveBeenCalled();
  });
});
