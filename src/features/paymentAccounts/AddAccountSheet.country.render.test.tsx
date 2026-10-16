import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { AddAccountSheet } from './AddAccountSheet';

/**
 * The Add payment account sheet over a FAKE reference API, once per country.
 * Mobile Money payouts use Rwandan networks, so they are offered for Rwanda only.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockDetect = jest.fn();
const mockOptions = jest.fn();
jest.mock('@/features/reference/api', () => ({
  detectPaymentCountry: (...a: unknown[]) => mockDetect(...a),
  getPaymentOptions: (...a: unknown[]) => mockOptions(...a),
}));
jest.mock('./api', () => ({
  addPaymentAccount: jest.fn(),
  listBanks: jest.fn().mockResolvedValue([]),
  validateMobileAccount: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const text = (n: ReactTestInstance) =>
  n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).join(' | ');
const settle = () => act(async () => { await new Promise((res) => setTimeout(res, 50)); });

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <AddAccountSheet visible role="Photographer" hasAccounts={false} onClose={() => {}} onSaved={() => {}} />,
    );
  });
  await settle();
  return r;
}

beforeEach(() => {
  mockDetect.mockReset();
  mockOptions.mockReset();
});

describe('add payment account by country', () => {
  it('Rwanda: Mobile Money and Bank', async () => {
    mockDetect.mockResolvedValue('RW');
    mockOptions.mockResolvedValue({ country: 'RW', supportsCard: true, operators: [{ id: 'MTN', name: 'MTN', type: 'MOBILE_MONEY' }] });
    const t = text((await mount()).root);
    expect(t).toContain('Mobile Money');
    expect(t).toContain('MTN MoMo');
    expect(t).toContain('Bank');
  });

  it('another country: no Mobile Money, Bank only, with a plain note', async () => {
    mockDetect.mockResolvedValue('NL');
    mockOptions.mockResolvedValue({ country: 'NL', supportsCard: false, operators: [] });
    const t = text((await mount()).root);
    expect(t).not.toContain('Mobile Money');
    expect(t).not.toContain('MTN MoMo');
    expect(t).not.toContain('Airtel Money');
    expect(t).toContain('Bank');
    expect(t).toContain('Mobile money payouts are not available');
  });

  it('unknown country: no Mobile Money until the country is chosen', async () => {
    mockDetect.mockRejectedValue(new Error('offline'));
    const t = text((await mount()).root);
    expect(t).not.toContain('Mobile Money');
    expect(t).toContain('could not confirm your country');
  });
});
