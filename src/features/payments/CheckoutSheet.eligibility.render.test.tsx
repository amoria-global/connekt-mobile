import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { CheckoutSheet } from './CheckoutSheet';

/**
 * The shared checkout sheet rendered over a FAKE reference API, once per market.
 * Verifies what a buyer is offered, never a real country lookup or a charge.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockDetect = jest.fn();
const mockOptions = jest.fn();
jest.mock('@/features/reference/api', () => ({
  detectPaymentCountry: (...a: unknown[]) => mockDetect(...a),
  getPaymentOptions: (...a: unknown[]) => mockOptions(...a),
}));

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const MTN = { id: 'MTN', name: 'MTN Mobile Money', type: 'MOBILE_MONEY' };
const AIRTEL = { id: 'AIRTEL', name: 'Airtel Money', type: 'MOBILE_MONEY' };
const text = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');

async function mount() {
  const start = jest.fn();
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <CheckoutSheet visible onClose={() => {}} resetKey="k" start={start} title="Pay" />,
    );
  });
  await act(async () => {});
  return { r, start };
}

beforeEach(() => {
  mockDetect.mockReset();
  mockOptions.mockReset();
});

describe('checkout sheet by buyer country', () => {
  it('Rwanda: mobile money and cards', async () => {
    mockDetect.mockResolvedValue('RW');
    mockOptions.mockResolvedValue({ country: 'RW', supportsCard: true, operators: [MTN, AIRTEL] });
    const { r } = await mount();
    const t = text(r.root);
    expect(t).toContain('Choose your network');
    expect(t).toContain('Visa & Mastercard');
    expect(t).not.toContain('Not available in your country');
  });

  it('United States: cards only, mobile money marked unavailable, no operator shown', async () => {
    mockDetect.mockResolvedValue('US');
    mockOptions.mockRejectedValue(new Error('No mobile-money operators registered for this country'));
    const { r } = await mount();
    const t = text(r.root);
    expect(t).toContain('Not available in your country');
    expect(t).toContain('Visa & Mastercard');
    expect(t).not.toMatch(/MTN|Airtel/);
  });

  it('country detection failure: cards stay, Rwanda is never assumed', async () => {
    mockDetect.mockRejectedValue(new Error('offline'));
    const { r } = await mount();
    const t = text(r.root);
    expect(mockOptions).not.toHaveBeenCalled();
    expect(t).toContain('Visa & Mastercard');
    expect(t).toContain('Not available in your country');
    expect(t).toContain('Choose your country');
    expect(t).not.toMatch(/MTN|Airtel|Rwanda/);
  });

  it('a failed lookup can be retried', async () => {
    mockDetect.mockResolvedValue('RW');
    mockOptions.mockRejectedValueOnce(new Error('timeout'));
    mockOptions.mockResolvedValue({ country: 'RW', supportsCard: true, operators: [MTN, AIRTEL] });
    const { r } = await mount();
    expect(text(r.root)).toContain('Not available in your country');
    const retry = r.root.find((n) => n.props?.accessibilityLabel === 'Check mobile money for my country again');
    await act(async () => {
      retry.props.onPress();
    });
    await act(async () => {});
    expect(text(r.root)).toContain('Choose your network');
  });
});
