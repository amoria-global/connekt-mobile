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
import {
  budgetLabel,
  durationBetween,
  durationText,
  friendlyEventStatus,
  isOpenHybrid,
  MODE_META,
  modeOf,
} from '../hybrid/hybridUi';

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

  describe('duration from start and end', () => {
    it('derives the duration the wizard shows', () => {
      expect(durationBetween('18:00', '22:00')).toBe(240);
      expect(durationText(240)).toBe('4 hrs');
      expect(durationText(90)).toBe('1 hr 30 min');
      expect(durationText(45)).toBe('45 min');
    });

    it('treats an end at or before the start as the next day', () => {
      expect(durationBetween('22:00', '02:00')).toBe(240);
      expect(durationBetween('18:00', '18:00')).toBe(24 * 60);
    });
  });

  describe('telling the two ways to book apart', () => {
    it('names them the same as the web dashboard', () => {
      expect(MODE_META.DIRECT.label).toBe('Find a Photographer');
      expect(MODE_META.HYBRID.label).toBe('Post My Event');
      expect(modeOf('HYBRID')).toBe('HYBRID');
      expect(modeOf(undefined)).toBe('DIRECT');
    });

    it('shows plain words instead of internal statuses', () => {
      expect(friendlyEventStatus('PUBLISHED_PENDING_ASSIGNMENT')).toBe('Finding photographers');
      expect(friendlyEventStatus('HYBRID_TIMEOUT')).toBe('Matching ended');
      expect(friendlyEventStatus('COMPLETED')).toBe('Completed');
    });

    it('offers the answers screen only for a posted event without a photographer', () => {
      expect(isOpenHybrid('HYBRID', 'CANDIDATES_AVAILABLE', false)).toBe(true);
      expect(isOpenHybrid('DIRECT', 'UPCOMING', false)).toBe(false);
      expect(isOpenHybrid('HYBRID', 'BOOKED', true)).toBe(false);
    });

    it('formats budgets', () => {
      expect(budgetLabel(100000, 200000)).toBe('100,000 - 200,000 RWF');
      expect(budgetLabel(null, null)).toBeNull();
    });
  });
});
