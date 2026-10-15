import { goalProgress, HIDDEN_AMOUNT, moneyText, percentOf, signedMoneyText } from './money';

jest.mock('@/utils/format', () => ({
  formatPrice: (n: number, c: string) => `${c} ${n.toLocaleString('en-US')}`,
}));

describe('photographer money text', () => {
  it('keeps a real zero apart from an unknown amount', () => {
    expect(moneyText(0, 'RWF')).toBe('RWF 0');
    expect(moneyText(null, 'RWF')).toBe('N/A');
    expect(moneyText(undefined, 'RWF')).toBe('N/A');
    expect(moneyText(Number.NaN, 'RWF')).toBe('N/A');
  });

  it('refuses to guess a currency', () => {
    expect(moneyText(1000, undefined)).toBe('N/A');
    expect(moneyText(1000, '')).toBe('N/A');
  });

  it('hides amounts, known or not, behind the privacy toggle', () => {
    expect(moneyText(1000, 'RWF', true)).toBe(HIDDEN_AMOUNT);
    expect(moneyText(null, 'RWF', true)).toBe(HIDDEN_AMOUNT);
  });

  it('signs movements so direction does not rely on colour', () => {
    expect(signedMoneyText(25000, 'RWF')).toBe('+RWF 25,000');
    expect(signedMoneyText(-4000, 'RWF')).toBe('-RWF 4,000');
    expect(signedMoneyText(0, 'RWF')).toBe('RWF 0');
    expect(signedMoneyText(null, 'RWF')).toBe('N/A');
  });

  it('computes shares and goal progress only from real figures', () => {
    expect(percentOf(600, 850)).toBe(71);
    expect(percentOf(1, 0)).toBeNull();
    expect(percentOf(null, 100)).toBeNull();
    expect(goalProgress(850, 1250)).toBe(68);
    expect(goalProgress(2000, 1000)).toBe(100);
    expect(goalProgress(100, null)).toBeNull();
  });
});
