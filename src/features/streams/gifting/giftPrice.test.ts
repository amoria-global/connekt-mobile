import { formatGiftUsd, formatGiftUsdBase } from './GiftOverlay';
import { useCurrency } from '@/store/currency';

jest.mock('@/api/client', () => ({ api: { post: jest.fn(), get: jest.fn() } }));

const rwf = () => useCurrency.getState().currencies.find((c) => c.code === 'RWF')!;

afterEach(() => useCurrency.setState({ currency: 'USD' }));

describe('gift prices follow the one display currency', () => {
  it('shows the exact USD price in USD', () => {
    useCurrency.setState({ currency: 'USD' });
    expect(formatGiftUsd(5)).toBe('$5');
    expect(formatGiftUsd(2.5)).toBe('$2.50');
  });

  it('converts to the selected currency, whole units for RWF', () => {
    const withRate = useCurrency.getState().currencies.map((c) => (c.code === 'RWF' ? { ...c, rate: 1300 } : c));
    useCurrency.setState({ currency: 'RWF', currencies: withRate });
    expect(formatGiftUsd(5)).toBe('RF 6,500');
  });

  it('shows the USD price, not a guess, when the backend gave no rate for the chosen currency', () => {
    const noRate = useCurrency.getState().currencies.map((c) => (c.code === 'RWF' ? { ...c, rate: 0 } : c));
    useCurrency.setState({ currency: 'RWF', currencies: noRate });
    expect(formatGiftUsd(5)).toBe('$5.00');
  });

  it('keeps the base USD line unconverted so it is never mislabelled', () => {
    useCurrency.setState({ currency: 'RWF' });
    expect(formatGiftUsdBase(5)).toBe('$5');
    expect(formatGiftUsdBase(2.5)).toBe('$2.50');
  });
});
