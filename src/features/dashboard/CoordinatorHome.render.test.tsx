import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { CoordinatorHome } from '@/features/dashboard/CoordinatorHome';
import { useCurrency, DEFAULT_CURRENCIES } from '@/store/currency';
import { dayKey, shiftDays } from '@/features/photographer/schedule';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real coordinator
 * home with the real events / analytics / wallet API modules over a faked transport. Chrome
 * (router, top bar, KYC banner, pay sheet, trend card) is faked.
 * Honesty is the point: a failed read is an error with a retry, never a zero; revenue is "N/A"
 * until it is known; amounts due are USD ledger values and are masked until shown; an event
 * that merely carries a stream is not "live".
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
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/topbar/TopBar', () => ({ TopBar: () => null, useTopBarHeight: () => 0 }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/components/ui/live', () => {
  const { Text, Pressable, View } = require('react-native');
  return {
    LivePill: ({ label = 'LIVE' }: { label?: string }) => <Text>{label}</Text>,
    LiveButton: ({ label, onPress }: { label: string; onPress?: () => void }) => (
      <Pressable onPress={onPress} accessibilityLabel={label}>
        <Text>{label}</Text>
      </Pressable>
    ),
    LiveTwinkle: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
  };
});
jest.mock('@/features/kyc/KycBanner', () => ({ KycBanner: () => null }));
jest.mock('@/features/dashboard/PerformanceWaveCard', () => {
  const { Text } = require('react-native');
  return { PerformanceWaveCard: ({ emptyText }: { emptyText?: string }) => <Text>{`wave:${emptyText ?? 'default'}`}</Text> };
});
const mockPaySheet = jest.fn();
jest.mock('@/features/payments/PayNowSheet', () => ({
  PayNowSheet: (props: unknown) => {
    mockPaySheet(props);
    return null;
  },
}));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { firstName: 'Marie', customerId: 'k1', customerType: 'Coordinator' }, status: 'authenticated' });
  return {
    useAuth: Object.assign((sel: (s: ReturnType<typeof state>) => unknown) => sel(state()), { getState: state }),
    isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  };
});

const walletFixture = require('@/features/wallet/__fixtures__/wallet-me-client.json');

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });
const refused = (message: string) => ({ action: 0, message });

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

type Routes = Partial<Record<'wallet' | 'analytics' | 'events' | 'pending', unknown>>;

const analyticsOk = ok({ totalCustomers: 4, totalPhotographers: 3, totalEvents: 7, totalRevenue: 1500, activeStreams: 1 });

function serve(routes: Routes) {
  const r: Routes = { wallet: walletFixture, analytics: analyticsOk, events: ok([]), pending: ok([]), ...routes };
  mockGet.mockImplementation(async (path: string) => {
    const v = path.startsWith('/wallet/me')
      ? r.wallet
      : path.startsWith('/coordinator/analytics/trends') || path.startsWith('/coordinator/analytics/performance')
        ? ok([])
        : path.startsWith('/coordinator/analytics')
          ? r.analytics
          : path.startsWith('/coordinator/events')
            ? r.events
            : path.startsWith('/coordinator/payments')
              ? r.pending
              : refused('unrouted');
    if (v instanceof Error) throw v;
    return v;
  });
}

async function mount(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<CoordinatorHome />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

const tap = async (r: TestRenderer.ReactTestRenderer, text: string) => {
  const node = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === text))[0];
  if (!node) throw new Error(`nothing to press with text "${text}"`);
  await act(async () => {
    node.props.onPress();
  });
};

const pressLabel = async (r: TestRenderer.ReactTestRenderer, label: string) => {
  const node = r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`nothing to press labelled "${label}"`);
  await act(async () => {
    node.props.onPress();
  });
};

const inDays = (n: number) => shiftDays(dayKey(new Date()), n);

const pressText = async (r: TestRenderer.ReactTestRenderer, text: string) => {
  const node = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === text))[0];
  if (!node) throw new Error(`nothing to press with text "${text}"`);
  await act(async () => {
    node.props.onPress();
  });
};

beforeEach(() => {
  mockGet.mockReset();
  mockPush.mockReset();
  mockPaySheet.mockReset();
  useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES });
});

describe('coordinator home as rendered', () => {
  it('shows the overview figures, masks amounts until shown, and lists upcoming productions', async () => {
    serve({
      events: ok([{ id: 'e1', title: 'Yubire Wedding', eventDate: inDays(8), startTime: '10:00', location: 'Kigali', bookingStatus: 'ACCEPTED' }]),
      pending: ok([{ id: 'p1', eventTitle: 'Yubire Wedding', photographerName: 'Eric M', amountInUsd: 300, paidAmountInUsd: 100, status: 'PENDING' }]),
    });
    const r = await mount();
    const masked = flat(r.root);
    const heading = r.root.findAll((x) => x.props.accessibilityRole === 'header' && /, Marie$/.test(String(x.props.accessibilityLabel ?? '')));
    expect(heading.length).toBeGreaterThan(0);
    expect(masked).toContain('Your dashboard');
    expect(masked).toContain('Yubire Wedding');
    expect(masked).toContain('Action required');
    expect(masked).toContain('••••');
    expect(masked).not.toContain('$200.00');
    // Plain counts are not money, so they are not masked.
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Events, 7').length).toBeGreaterThan(0);

    await pressLabel(r, 'Show amounts');
    const text = flat(r.root);
    expect(text).toContain('$200.00'); // 300 minus 100 paid, a USD ledger value
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('a refused analytics read is an error with a retry and N/A figures, not zeros', async () => {
    serve({ analytics: refused('Could not load your figures') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load your figures');
    expect(text).toContain('Try again');
    expect(text).toContain('N/A');
  });

  it('a refused wallet read leaves revenue N/A and offers a retry, while the counts still show', async () => {
    serve({ wallet: refused('Could not load your wallet') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load your wallet');
    expect(text).toContain('Try again');
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Revenue, N/A').length).toBeGreaterThan(0);
    expect(r.root.findAll((n) => n.props?.accessibilityLabel === 'Events, 7').length).toBeGreaterThan(0);
  });

  it('a refused events read is an error with a retry, not "No upcoming events"', async () => {
    serve({ events: refused('Could not load your events') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load your events');
    expect(text).not.toContain('No upcoming events');
  });

  it('a refused payments read is shown as an error, not hidden as "nothing due"', async () => {
    serve({ pending: refused('Could not load payments') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Action required');
    expect(text).toContain('Could not load payments');
  });

  it('a refused trends read is an error with a retry, and the chart does not claim there is no data', async () => {
    mockGet.mockImplementation(async (path: string) =>
      path.startsWith('/coordinator/analytics/trends') ? refused('Could not load trends') : path.startsWith('/coordinator/analytics/performance') ? ok([]) : path.startsWith('/wallet/me') ? walletFixture : path.startsWith('/coordinator/analytics') ? analyticsOk : path.startsWith('/coordinator/events') ? ok([]) : ok([]),
    );
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load trends');
    expect(text).toContain('wave:Trend data could not be loaded');
  });

  it('a genuinely empty account offers to create an event', async () => {
    serve({});
    const r = await mount();
    expect(flat(r.root)).toContain('No upcoming events');
    await tap(r, 'Create event');
    expect(mockPush).toHaveBeenCalledWith('/event/new');
  });

  it('Pay now opens the payment sheet with that exact payment', async () => {
    serve({ pending: ok([{ id: 'p1', eventTitle: 'Yubire Wedding', photographerName: 'Eric M', amountInUsd: 300, paidAmountInUsd: 0, status: 'PENDING' }]) });
    const r = await mount();
    await tap(r, 'Pay now');
    const last = mockPaySheet.mock.calls[mockPaySheet.mock.calls.length - 1][0] as { payment: { id: string } | null; visible: boolean };
    expect(last.visible).toBe(true);
    expect(last.payment?.id).toBe('p1');
  });

  it('an event that carries a stream is not live; an ONGOING one is', async () => {
    serve({ events: ok([{ id: 'e1', title: 'Gala', eventDate: inDays(2), hasLiveStream: true, streamStatus: 'disconnected' }]) });
    const quiet = await mount();
    expect(flat(quiet.root)).not.toContain('Control live');
    expect(flat(quiet.root)).toContain('Manage');

    serve({ events: ok([{ id: 'live1', title: 'Concert', eventDate: dayKey(new Date()), status: 'ONGOING' }]) });
    const live = await mount();
    expect(flat(live.root)).toContain('Control live');
    await tap(live, 'Control live');
    expect(mockPush).toHaveBeenCalledWith('/event/live1');
  });

  it('opens the right destination from each overview figure', async () => {
    serve({});
    const r = await mount();
    for (const [label, to] of [
      ['Photographers', '/photographers'],
      ['Clients', '/clients'],
    ] as const) {
      const node = r.root.findAll((n) => typeof n.props?.accessibilityLabel === 'string' && n.props.accessibilityLabel.startsWith(`${label},`) && typeof n.props.onPress === 'function')[0];
      await act(async () => {
        node.props.onPress();
      });
      expect(mockPush).toHaveBeenLastCalledWith(to);
    }
  });
});

describe('get help on the home', () => {
  it('offers the existing Help Center and the Contact us form', async () => {
    serve({});
    const r = await mount();
    expect(flat(r.root)).toContain('Need help?');
    await pressText(r, 'Get help');
    expect(mockPush).toHaveBeenLastCalledWith('/help-center');
    await pressText(r, 'Contact support');
    expect(mockPush).toHaveBeenLastCalledWith('/contact_us');
  });
});
