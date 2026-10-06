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
  CATEGORY_SUGGESTIONS,
  POPULAR_CATEGORIES,
  filterCategorySuggestions,
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

  describe('category suggestions typeahead', () => {
    it('returns popular categories when query is empty', () => {
      const results = filterCategorySuggestions('');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((c) => c.popular)).toBe(true);
    });

    it('filters categories matching label substring', () => {
      const results = filterCategorySuggestions('wed');
      expect(results.some((c) => c.label === 'Wedding')).toBe(true);
    });

    it('filters categories matching keyword synonyms', () => {
      const results = filterCategorySuggestions('bride');
      expect(results.some((c) => c.label === 'Wedding')).toBe(true);

      const birthdayResults = filterCategorySuggestions('anniversary');
      expect(birthdayResults.some((c) => c.label === 'Birthday Party')).toBe(true);
    });

    it('returns empty array when no category or keyword matches', () => {
      const results = filterCategorySuggestions('xyzunrealnomatch123');
      expect(results).toEqual([]);
    });
  });
});
