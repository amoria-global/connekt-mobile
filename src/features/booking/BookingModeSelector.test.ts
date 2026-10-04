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

import { BookingModeSelector } from './BookingModeSelector';

describe('BookingModeSelector', () => {
  it('exports BookingModeSelector component function', () => {
    expect(typeof BookingModeSelector).toBe('function');
  });
});
