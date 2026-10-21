import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import AnalyticsScreen from '@/app/(app)/analytics';
import { useCurrency, DEFAULT_CURRENCIES } from '@/store/currency';
import { coordinatorAnalytics, customerAnalytics } from '@/test/analyticsPayloads';

/**
 * Client and coordinator analytics over a faked transport. Before the fix a refused headline request drew
 * "Total Spent $0.00" / "Events 0" (`clientData?.totalSpent || 0`); a failure must be an error with a retry and N/A,
 * while a real zero stays a zero.
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
let mockRole: 'CLIENT' | 'COORDINATOR' = 'CLIENT';
jest.mock('@/features/auth/role', () => ({
  useRole: () => ({ isClient: mockRole === 'CLIENT', isCoordinator: mockRole === 'COORDINATOR', isPhotographer: false, role: mockRole }),
}));
jest.mock('@/store/auth', () => ({
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ user: { customerType: 'CLIENT' } }), {
    getState: () => ({ user: { customerType: 'CLIENT' } }),
  }),
  isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
}));

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });
const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

function serve(prefix: string, headline: unknown) {
  mockGet.mockImplementation(async (path: string) => {
    if (path === prefix) return headline;
    if (path.startsWith(`${prefix}/trends`)) return ok({});
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

describe.each([
  ['CLIENT', '/customer/analytics', customerAnalytics(), 'Total Spent'],
  ['COORDINATOR', '/coordinator/analytics', coordinatorAnalytics(), 'Total Revenue'],
] as const)('%s analytics as rendered', (role, prefix, zeros, headlineTitle) => {
  beforeEach(() => {
    mockRole = role;
  });

  it('a refused headline request is an error with a retry and N/A, never zeros', async () => {
    serve(prefix, { action: 0, message: 'Analytics are unavailable' });
    const text = flat((await mount()).root);
    expect(text).toContain('Analytics are unavailable');
    expect(text).toContain('Try again');
    expect(text).toContain('N/A');
    expect(text).not.toMatch(/\$0(\.00)?/);
  });

  it('a genuine zero is still shown as a zero', async () => {
    serve(prefix, ok(zeros));
    const text = flat((await mount()).root);
    expect(text).toContain(headlineTitle);
    expect(text).not.toContain('Try again');
    expect(text).not.toContain('N/A');
  });
});

describe('performance charts plot the feed they were given', () => {
  const headline = ok(customerAnalytics({ totalEvents: 3, totalSpent: 500, pendingAmount: 0, gifts: 0, totalBookings: 3, bookmarkedPhotographers: 1 }));
  function servePerf(perf: unknown) {
    mockGet.mockImplementation(async (path: string) => {
      if (path === '/customer/analytics') return headline;
      if (path.startsWith('/customer/analytics/performance')) return perf;
      if (path.startsWith('/customer/analytics/trends')) return ok({});
      if (path.startsWith('/wallet/me')) return ok({});
      return ok([]);
    });
  }
  beforeEach(() => {
    mockRole = 'CLIENT';
  });

  it("today's 4-hour blocks keep their own labels instead of being replaced by an all-zero Sun to Sat", async () => {
    servePerf(ok(['12AM', '4AM', '8AM', '12PM', '4PM', '8PM'].map((day, i) => ({ day, value1: i === 3 ? 250 : 0, value2: i === 3 ? 1 : 0 }))));
    const text = flat((await mount()).root);
    expect(text).toContain('12AM');
    expect(text).toContain('8PM');
    expect(text).not.toContain('Sun');
    expect(text).not.toContain('0 activity recorded');
  });

  it("a month's four weeks keep 'Week 1'..'Week 4'", async () => {
    servePerf(ok(['Week 1', 'Week 2', 'Week 3', 'Week 4'].map((day, i) => ({ day, value1: i * 100, value2: i }))));
    const text = flat((await mount()).root);
    expect(text).toContain('Week 1');
    expect(text).toContain('Week 4');
    expect(text).not.toContain('Mon');
  });

  it('a refused performance read says the chart is unavailable, not zero activity', async () => {
    servePerf({ action: 0, message: 'nope' });
    const text = flat((await mount()).root);
    expect(text).toContain('Chart data is unavailable');
    expect(text).toContain('Payment and event charts are unavailable.');
    expect(text).not.toContain('No activity yet');
    expect(text).not.toContain('0 activity recorded');
    expect(text).not.toContain('No payments in this period');
    expect(text).not.toContain('No events in this period');
  });
});
