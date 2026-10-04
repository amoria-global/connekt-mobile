jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

import {
  BookingModeSelector,
  formatAmountWithCommas,
  parseAmountNumber,
} from './BookingModeSelector';

describe('BookingModeSelector', () => {
  it('exports BookingModeSelector component function', () => {
    expect(typeof BookingModeSelector).toBe('function');
  });

  describe('currency comma formatting', () => {
    it('formats plain numbers into comma-separated thousands', () => {
      expect(formatAmountWithCommas('1000')).toBe('1,000');
      expect(formatAmountWithCommas('50000')).toBe('50,000');
      expect(formatAmountWithCommas('1000000')).toBe('1,000,000');
      expect(formatAmountWithCommas('10000000')).toBe('10,000,000');
    });

    it('handles non-numeric or empty input gracefully', () => {
      expect(formatAmountWithCommas('')).toBe('');
      expect(formatAmountWithCommas('abc')).toBe('');
      expect(formatAmountWithCommas('RWF 25,000')).toBe('25,000');
    });

    it('parses comma-formatted amount string into an integer number', () => {
      expect(parseAmountNumber('1,000,000')).toBe(1000000);
      expect(parseAmountNumber('50,000')).toBe(50000);
      expect(parseAmountNumber('')).toBe(0);
      expect(parseAmountNumber('invalid')).toBe(0);
    });
  });
});
