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

// The hook starts its lookup on a timer, so wait on real time rather than microtasks.
const settle = () => act(async () => { await new Promise((res) => setTimeout(res, 50)); });

async function mount() {
  const start = jest.fn();
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <CheckoutSheet visible onClose={() => {}} resetKey="k" start={start} title="Pay" />,
    );
  });
  await settle();
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
    expect(t).not.toContain('not available in this country');
  });

  it('a country with no mobile money (real backend shape, action 0 data): cards only, no Mobile Money tile', async () => {
    mockDetect.mockResolvedValue('NL');
    // What getPaymentOptions returns when the backend answers action 0: no supportsCard, no operators.
    mockOptions.mockResolvedValue({ country: 'NL', supportsCard: false, operators: [] });
    const { r } = await mount();
    const t = text(r.root);
    expect(t).toContain('Visa & Mastercard');
    expect(t).toContain('Mobile money is not available in this country');
    expect(t).not.toMatch(/MTN|Airtel/);
    expect(t).not.toContain('Choose your network');
    // No disabled Mobile Money tile is left on screen.
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Mobile Money')).toHaveLength(0);
  });

  it('United States, lookup rejected: cards only, no operator shown', async () => {
    mockDetect.mockResolvedValue('US');
    mockOptions.mockRejectedValue(new Error('No mobile-money operators registered for this country'));
    const { r } = await mount();
    const t = text(r.root);
    expect(t).toContain('Visa & Mastercard');
    expect(t).toContain('Mobile money is not available in this country');
    expect(t).not.toMatch(/MTN|Airtel/);
  });

  it('country detection failure: cards stay, Rwanda is never assumed', async () => {
    mockDetect.mockRejectedValue(new Error('offline'));
    const { r } = await mount();
    const t = text(r.root);
    expect(mockOptions).not.toHaveBeenCalled();
    expect(t).toContain('Visa & Mastercard');
    expect(t).toContain('could not confirm your country');
    expect(t).toContain('Choose your country');
    expect(t).not.toMatch(/MTN|Airtel|Rwanda/);
  });

  it('a failed lookup can be retried', async () => {
    mockDetect.mockResolvedValue('RW');
    mockOptions.mockRejectedValueOnce(new Error('timeout'));
    mockOptions.mockResolvedValue({ country: 'RW', supportsCard: true, operators: [MTN, AIRTEL] });
    const { r } = await mount();
    expect(text(r.root)).toContain('not available in this country');
    const retry = r.root.find((n) => n.props?.accessibilityLabel === 'Check mobile money for my country again');
    await act(async () => {
      retry.props.onPress();
    });
    await settle();
    expect(text(r.root)).toContain('Choose your network');
  });
});
