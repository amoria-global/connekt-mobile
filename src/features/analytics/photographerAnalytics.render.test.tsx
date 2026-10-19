import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import AnalyticsScreen from '@/app/(app)/analytics';
import { useCurrency, DEFAULT_CURRENCIES } from '@/store/currency';

/**
 * Rendered photographer analytics screen over a faked transport: a refused
 * analytics request must show an error and N/A, never zeros, and a photographer
 * with no reviews must not be shown a rating.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    api: {
      get: (...a: unknown[]) => mockGet(...a),
      getOk: async (...a: unknown[]) => actual.requireOk(await mockGet(...a)),
    },
  };
});
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn() }), Stack: { Screen: () => null } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/features/payments/PayNowSheet', () => ({ PayNowSheet: () => null }));
jest.mock('@/features/auth/role', () => ({
  useRole: () => ({ isClient: false, isCoordinator: false, isPhotographer: true, role: 'PHOTOGRAPHER' }),
}));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'PHOTOGRAPHER' } }), {
    getState: () => ({ user: { customerType: 'PHOTOGRAPHER' } }),
  }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });
const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

function serve(analytics: unknown) {
  mockGet.mockImplementation(async (path: string) => {
    if (path.startsWith('/photographer/analytics/trends')) return ok({});
    if (path.startsWith('/photographer/analytics')) return analytics;
    if (path.startsWith('/wallet/me')) return ok({});
    return ok([]);
  });
}

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<AnalyticsScreen />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

beforeEach(() => {
  mockGet.mockReset();
  useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES });
});

describe('photographer analytics screen as rendered', () => {
  it('a refused analytics request shows an error with a retry and N/A, not zeros', async () => {
    serve({ action: 0, message: 'Analytics are unavailable' });
    const text = flat((await mount()).root);
    expect(text).toContain('Analytics are unavailable');
    expect(text).toContain('Try again');
    expect(text).toContain('N/A');
    expect(text).not.toMatch(/\$0(\.00)?\b/);
  });

  it('no reviews is "No reviews yet", never an invented 5.0', async () => {
    serve(ok({ totalEarnings: 100, pendingPayments: 10, totalClients: 2, bonuses: 0, averageRating: 0 }));
    const text = flat((await mount()).root);
    expect(text).toContain('No reviews yet');
    expect(text).not.toContain('5.0/5');
  });

  it('a real rating is shown as is', async () => {
    serve(ok({ totalEarnings: 100, pendingPayments: 10, totalClients: 2, bonuses: 0, averageRating: 4.6 }));
    expect(flat((await mount()).root)).toContain('4.6/5');
  });

  it('does not present lifetime totals as period figures under the period tabs', async () => {
    serve(ok({ totalEarnings: 4820, pendingPayments: 300, totalClients: 11, bonuses: 0, averageRating: 4.6 }));
    const text = flat((await mount()).root);
    expect(text).toContain('Lifetime earnings');
    expect(text).toContain('Pending release');
    expect(text).toContain('Clients served');
    expect(text).toContain('Totals are all time.');
    expect(text).not.toContain('Total Earnings');
  });
});
