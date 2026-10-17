import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import PaymentsScreen from '@/app/(app)/payments';
import { useCurrency, DEFAULT_CURRENCIES } from '@/store/currency';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real client
 * Payments screen over a faked transport. The totals were the defect: every amount was
 * added together and labelled with the first payment's currency, and the card was drawn
 * as a zero while loading or after a failed read.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetOk = jest.fn();
jest.mock('@/api/client', () => ({
  api: { getOk: async (...a: unknown[]) => jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)) },
}));
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  Redirect: () => null,
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/payments/access', () => ({ canUsePaymentsScreen: () => true }));
jest.mock('@/features/payments/PayNowSheet', () => ({ PayNowSheet: () => null }));
jest.mock('@/features/auth/role', () => ({
  useRole: () => ({ role: 'Client', isClient: true, isPhotographer: false, isCoordinator: false }),
}));

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

async function mount(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PaymentsScreen />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

beforeEach(() => {
  mockGetOk.mockReset();
  // No live rate: amounts stay in their own currency.
  useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES });
});

describe('client payments summary as rendered', () => {
  it('one currency keeps the single total with paid and pending', async () => {
    mockGetOk.mockResolvedValue(
      ok({ content: [
        { id: 'a', eventName: 'Wedding', amount: 100, currency: 'USD', status: 'PAID', paymentType: 'BOOKING' },
        { id: 'b', eventName: 'Shoot', amount: 40, currency: 'USD', status: 'PENDING', paymentType: 'BOOKING' },
      ] }),
    );
    const text = flat((await mount()).root);
    expect(text).toContain('TOTAL SPENDING');
    expect(text).toContain('$140.00');
    expect(text).not.toContain('Several currencies');
  });

  it('two currencies are never added into one figure', async () => {
    mockGetOk.mockResolvedValue(
      ok({ content: [
        { id: 'a', eventName: 'Wedding', amount: 50000, currency: 'RWF', status: 'PAID', paymentType: 'BOOKING' },
        { id: 'b', eventName: 'Shoot', amount: 40, currency: 'USD', status: 'PAID', paymentType: 'BOOKING' },
      ] }),
    );
    const text = flat((await mount()).root);
    expect(text).toContain('Several currencies');
    expect(text).toContain('RWF 50,000');
    expect(text).toContain('$40.00');
    expect(text).not.toContain('50,040');
  });

  it('a failed read shows the error and no zero total', async () => {
    mockGetOk.mockResolvedValue({ action: 0, message: 'Payments unavailable' });
    const text = flat((await mount()).root);
    expect(text).not.toContain('TOTAL SPENDING');
    expect(text).not.toMatch(/\$0(\.00)?\b/);
    expect(text).toContain("Couldn't load payments");
  });

  it('an account with no payments shows the empty state, not a zero total', async () => {
    mockGetOk.mockResolvedValue(ok({ content: [] }));
    const text = flat((await mount()).root);
    expect(text).not.toContain('TOTAL SPENDING');
    expect(text).not.toMatch(/\$0(\.00)?\b/);
  });

  it('says so when a payment has no currency instead of guessing one', async () => {
    mockGetOk.mockResolvedValue(
      ok({ content: [
        { id: 'a', eventName: 'Wedding', amount: 100, currency: 'USD', status: 'PAID', paymentType: 'BOOKING' },
        { id: 'b', eventName: 'Mystery', amount: 70, status: 'PAID', paymentType: 'BOOKING' },
      ] }),
    );
    const text = flat((await mount()).root);
    expect(text).toContain('$100.00');
    expect(text).toContain('1 payment without an amount or currency not included.');
  });
});
