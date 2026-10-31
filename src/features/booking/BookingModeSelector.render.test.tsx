import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text } from 'react-native';

import { BookingModeSelector } from './BookingModeSelector';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-modal-datetime-picker', () => () => null);
jest.mock('@/features/events/api', () => ({ createEvent: jest.fn() }));
jest.mock('@/features/hybrid/api', () => ({
  getHybridOptions: jest.fn().mockResolvedValue({
    enabled: true,
    country: 'Rwanda',
    timezone: 'Africa/Kigali',
    currency: 'RWF',
    eventTypes: [{ id: 'wedding', name: 'Wedding' }],
    photographerSpecialties: [],
    cities: [{ name: 'Kigali', latitude: -1.95, longitude: 30.06 }],
    photographerTypes: [],
    coverageOptions: [],
    budgetPresets: [],
    timeStepMinutes: 30,
    matchWindowHours: [24],
    defaultMatchWindowHours: 24,
    inviteWindowMinutes: 120,
    firstBatchSize: 9,
    escrowOptions: [50, 70, 100],
    instagramRequired: false,
  }),
  getHybridDraft: jest.fn().mockResolvedValue(null),
  getMatchPreview: jest.fn().mockResolvedValue({ matchCount: 3 }),
  saveHybridDraft: jest.fn().mockResolvedValue({}),
  deleteHybridDraft: jest.fn().mockResolvedValue({}),
  createMatchRequest: jest.fn(),
}));

async function open(initialStep: 1 | 2 | 3 | 4 | 5) {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<BookingModeSelector visible initialStep={initialStep} onClose={jest.fn()} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  const all = r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(4).filter((c) => typeof c === 'string' || typeof c === 'number').join(''))
    .join('\n');
  return { r, all };
}

describe('booking flow pages', () => {
  it('step 2 offers the new quantities, with a paper picture on the photo book and wall portrait cards', async () => {
    const { r, all } = await open(2);
    expect(all).toContain('PHOTO BOOKS');
    expect(all).toContain('Number of photos');
    expect(all).not.toMatch(/Page count/);
    for (const n of ['300', '400', '600']) expect(all).toContain(n);
    expect(all).toContain('500');
    // A4 for the photo book and 60×90 for the wall portrait, drawn beside their cards.
    const papers = r.root.findAll((n) => typeof n.props.accessibilityLabel === 'string' && /paper$/.test(n.props.accessibilityLabel));
    const labels = papers.map((n) => n.props.accessibilityLabel);
    expect(labels.some((l: string) => l.startsWith('A4'))).toBe(true);
    expect(labels.some((l: string) => l.startsWith('60'))).toBe(true);
  });

  it('step 3 is delivery and budget only; the recommended pricing has its own page', async () => {
    const three = await open(3);
    expect(three.all).toContain('DELIVERY & BUDGET');
    expect(three.all).not.toMatch(/Use recommended pricing/);
    const four = await open(4);
    expect(four.all).toContain('RECOMMENDED PRICING');
    expect(four.all).toContain('Use recommended pricing');
    expect(four.all).toContain('4 of 5');
  });
});
