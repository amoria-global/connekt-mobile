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
const mockPaySheet = jest.fn();
jest.mock('@/features/payments/PayNowSheet', () => ({
  PayNowSheet: (props: unknown) => {
    mockPaySheet(props);
    return null;
  },
}));
const mockAlert = jest.fn();
jest.mock('@/components/ui/dialog', () => ({ Alert: { alert: (...a: unknown[]) => mockAlert(...a) } }));
jest.mock('@/store/auth', () => ({ isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object) }));
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
  mockPaySheet.mockReset();
  mockAlert.mockReset();
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

describe('client Pay now takes what is owed from the pending feed', () => {
  const history = ok({ content: [{ id: 'rec1', declarationId: 'd1', eventName: 'Yubire Wedding', amount: 50000, currency: 'RWF', status: 'PENDING', paymentType: 'BOOKING' }] });
  const serve = (pending: unknown) =>
    mockGetOk.mockImplementation(async (path: string) => (path.startsWith('/customer/payments/pending') ? pending : history));
  const payNow = (r: TestRenderer.ReactTestRenderer) =>
    r.root.findAll((n) => n.props?.accessibilityLabel === 'Pay now, Yubire Wedding' && typeof n.props.onPress === 'function')[0];
  const lastSheet = () => mockPaySheet.mock.calls[mockPaySheet.mock.calls.length - 1][0] as { payment: { id: string; amount: number; paidAmount: number } | null; visible: boolean };

  it('opens the sheet with the feed payment: its USD balance and its real paid amount, not the RWF record as dollars', async () => {
    serve(ok([{ id: 'd1', eventTitle: 'Yubire Wedding', photographerName: 'Eric M', amountInUsd: 300, paidAmountInUsd: 100, status: 'PENDING', paymentType: 'BOOKING' }]));
    const r = await mount();
    await act(async () => {
      await payNow(r).props.onPress({ stopPropagation: () => {} });
    });
    const sheet = lastSheet();
    expect(sheet.visible).toBe(true);
    expect(sheet.payment).toMatchObject({ id: 'd1', amount: 300, paidAmount: 100 });
  });

  it('when the feed does not have it, says so and does not open the sheet with an invented balance', async () => {
    serve(ok([]));
    const r = await mount();
    await act(async () => {
      await payNow(r).props.onPress({ stopPropagation: () => {} });
    });
    expect(mockAlert).toHaveBeenCalledWith('Could not confirm the balance', expect.stringContaining('could not confirm what is still owed'));
    expect(lastSheet().visible).toBe(false);
  });

  it('a failed feed read is reported with its message and opens nothing', async () => {
    serve({ action: 0, message: 'Payments unavailable' });
    const r = await mount();
    await act(async () => {
      await payNow(r).props.onPress({ stopPropagation: () => {} });
    });
    expect(mockAlert).toHaveBeenCalledWith('Could not open payment', 'Payments unavailable');
    expect(lastSheet().visible).toBe(false);
  });

  it('a second tap while the balance is being checked does not ask again', async () => {
    let release!: (v: unknown) => void;
    mockGetOk.mockImplementation((path: string) => (path.startsWith('/customer/payments/pending') ? new Promise((res) => (release = res)) : Promise.resolve(history)));
    const r = await mount();
    await act(async () => {
      payNow(r).props.onPress({ stopPropagation: () => {} });
    });
    await act(async () => {
      payNow(r).props.onPress({ stopPropagation: () => {} });
    });
    const pendingCalls = mockGetOk.mock.calls.filter((c) => String(c[0]).startsWith('/customer/payments/pending')).length;
    expect(pendingCalls).toBe(1);
    await act(async () => release(ok([])));
  });
});
