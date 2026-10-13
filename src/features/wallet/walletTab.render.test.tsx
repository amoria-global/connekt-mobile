import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import WalletScreen from '@/app/(app)/(tabs)/wallet';
import { useCurrency, DEFAULT_CURRENCIES } from '@/store/currency';

/**
 * RENDERED screen (react-test-renderer under jest-expo, NOT a device or
 * simulator): the real wallet tab with the real getWallet / listWalletMovements /
 * selectWalletStats / formatPrice, fed the real /wallet/me payloads exported by
 * the backend integration test for a SYNTHETIC 100,000 RWF booking
 * (photographer 95.50, client 100.00 USD). Navigation chrome and the transport
 * are faked; getOk keeps the production requireOk.
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetOk = jest.fn();
jest.mock('@/api/client', () => ({
  api: {
    getOk: async (...a: unknown[]) => jest.requireActual('@/api/client').requireOk(await mockGetOk(...a)),
  },
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/topbar/TopBar', () => ({ TopBar: () => null, useTopBarHeight: () => 0 }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/payments/access', () => ({ canUsePaymentsScreen: () => false }));

let mockRole = 'PHOTOGRAPHER';
jest.mock('@/features/auth/role', () => ({
  useRole: () => ({
    isPhotographer: mockRole === 'PHOTOGRAPHER',
    isCoordinator: false,
    role: mockRole,
  }),
}));
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { customerType: mockRole }, status: 'authenticated' });
  return {
    useAuth: Object.assign((sel: (s: ReturnType<typeof state>) => unknown) => sel(state()), { getState: state }),
    isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  };
});

const fixture = (name: string) => require(`@/features/wallet/__fixtures__/${name}`);

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

async function mount(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<WalletScreen />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

async function reveal(r: TestRenderer.ReactTestRenderer) {
  const toggle = r.root.findAll((n) => n.props?.accessibilityLabel === 'Show balances')[0];
  await act(async () => {
    toggle.props.onPress();
  });
}

function serve(walletFile: string, movementsFile: string | Error) {
  mockGetOk.mockImplementation(async (path: string) => {
    if (path.startsWith('/wallet/me/movements')) {
      if (movementsFile instanceof Error) throw movementsFile;
      return fixture(movementsFile);
    }
    return fixture(walletFile);
  });
}

beforeEach(() => {
  mockGetOk.mockReset();
  mockRole = 'PHOTOGRAPHER';
  useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES });
});

describe('mobile wallet tab as rendered', () => {
  it('photographer: balances are masked until shown, then the hero is $95.50', async () => {
    serve('wallet-me-photographer.json', 'wallet-movements-photographer.json');
    const r = await mount();
    const masked = flat(r.root);
    expect(masked).toContain('••••');
    expect(masked).not.toContain('95.50');

    await reveal(r);
    const shown = flat(r.root);
    expect(shown).toContain('$95.50');
    expect(shown).not.toMatch(/NaN|undefined/);
  });

  it('client: the hero is the $100.00 spent', async () => {
    mockRole = 'CLIENT';
    serve('wallet-me-client.json', 'wallet-movements-client.json');
    const r = await mount();
    await reveal(r);
    expect(flat(r.root)).toContain('$100.00');
  });

  it('RWF display converts only with a live rate: RF 124,150 with one, $95.50 without', async () => {
    serve('wallet-me-photographer.json', 'wallet-movements-photographer.json');

    useCurrency.setState({
      currency: 'RWF',
      currencies: DEFAULT_CURRENCIES.map((c) => (c.code === 'RWF' ? { ...c, rate: 1300 } : c)),
    });
    let r = await mount();
    await reveal(r);
    expect(flat(r.root)).toContain('RF 124,150');
    await act(async () => r.unmount());

    useCurrency.setState({ currency: 'RWF', currencies: DEFAULT_CURRENCIES }); // backend rate never arrived
    r = await mount();
    await reveal(r);
    const text = flat(r.root);
    expect(text).toContain('$95.50');
    expect(text).not.toContain('RF ');
  });

  it('an HTTP 200 carrying action 0 shows an error and a retry, never a zero balance', async () => {
    mockGetOk.mockResolvedValue({ action: 0, message: 'Wallet unavailable' });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Wallet unavailable');
    expect(text).toContain('Retry');
    expect(text).not.toContain('$0.00');
  });

  it('a wallet response without data is an error, not a $0 wallet', async () => {
    mockGetOk.mockResolvedValue({ action: 1, message: 'ok', data: null });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('incomplete');
    expect(text).not.toContain('$0.00');
  });

  it('a failed history read is reported, while the wallet still shows', async () => {
    serve('wallet-me-photographer.json', new Error('boom'));
    const r = await mount();
    await reveal(r);
    const text = flat(r.root);
    expect(text).toContain('$95.50');
    expect(text.toLowerCase()).toMatch(/couldn|could not|unable|failed|try again/);
  });
});
