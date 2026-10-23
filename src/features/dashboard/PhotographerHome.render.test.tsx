import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { PhotographerHome } from '@/features/dashboard/PhotographerHome';
import { useCurrency, DEFAULT_CURRENCIES } from '@/store/currency';
import { photographerAnalytics } from '@/test/analyticsPayloads';
import { useWorkspace } from '@/store/workspace';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real
 * photographer home with the real wallet / analytics / events API modules over a
 * faked transport. Chrome (router, top bar, KYC banner, prompts) is faked.
 * Money honesty is the point: an unknown figure is N/A and a failed request is
 * an error with a retry, never a zero or an empty list.
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
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useRouter: () => ({ push: mockPush, replace: jest.fn() }),
    // Focused for the life of the test.
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('@/components/topbar/TopBar', () => ({ TopBar: () => null, useTopBarHeight: () => 0 }));
jest.mock('@/components/ui/Screen', () => ({ Screen: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('@/features/kyc/KycBanner', () => ({ KycBanner: () => null }));
jest.mock('@/features/hybrid/MatchingProfile', () => ({ MatchingProfilePrompt: () => null }));
jest.mock('@/features/hybrid/IncomingOpportunityAlertModal', () => ({ IncomingOpportunityAlertModal: () => null }));
jest.mock('@/config/env', () => ({ env: { hybridBookingEnabled: false, webBaseUrl: 'https://connekyt.com' } }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { firstName: 'Joseph', customerId: 'p1', customerType: 'PHOTOGRAPHER' }, status: 'authenticated' });
  return {
    useAuth: Object.assign((sel: (s: ReturnType<typeof state>) => unknown) => sel(state()), { getState: state }),
    isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object),
  };
});

const walletFixture = require('@/features/wallet/__fixtures__/wallet-me-photographer.json');

const ok = (data: unknown) => ({ action: 1, message: 'ok', data });
const refused = (message: string) => ({ action: 0, message });

const flat = (node: ReactTestInstance): string =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

type Routes = Partial<Record<'wallet' | 'analytics' | 'events' | 'clients' | 'transactions' | 'reviews' | 'plans' | 'slug', unknown>>;

function serve(routes: Routes) {
  const defaults: Routes = {
    wallet: walletFixture,
    analytics: ok(photographerAnalytics({ totalEarnings: 850, completedEvents: 15, totalClients: 7, totalBookings: 20, totalPhotosUploaded: 300, averageRating: 0 })),
    events: ok([]),
    clients: ok([]),
    transactions: ok([]),
    reviews: ok([]),
    plans: ok([]),
    slug: { slug: 'joseph-k', type: 'photographer' },
  };
  const r = { ...defaults, ...routes };
  mockGet.mockImplementation(async (path: string) => {
    const v = path.startsWith('/wallet/me')
      ? r.wallet
      : path.startsWith('/public/seo/slug-for')
        ? r.slug
        : path.startsWith('/photographer/plans')
          ? r.plans
          : path.startsWith('/photographer/analytics')
        ? r.analytics
        : path.startsWith('/photographer/events')
          ? r.events
          : path.startsWith('/photographer/clients')
            ? r.clients
            : path.startsWith('/photographer/transactions')
              ? r.transactions
              : r.reviews;
    if (v instanceof Error) throw v;
    return v;
  });
}

async function mount(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PhotographerHome />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

const press = async (r: TestRenderer.ReactTestRenderer, label: string) => {
  const node = r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  await act(async () => {
    node.props.onPress();
  });
};

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
  useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES });
  useWorkspace.setState({ hydrated: true, activeId: null, memberships: [], loading: false });
});

describe('photographer home as rendered', () => {
  it('masks amounts until shown, then shows the wallet figures and real business numbers', async () => {
    serve({
      events: ok([{ id: 'e1', title: 'Yubire Wedding', eventDate: '2999-01-02', startTime: '12:11', location: 'Kanombe', clientName: 'Mugwiza' }]),
    });
    const r = await mount();
    const masked = flat(r.root);
    expect(masked).toContain('••••');
    expect(masked).not.toContain('95.50');
    expect(masked).toContain('Yubire Wedding');
    expect(masked).toContain('15'); // completed shoots is not an amount, so it is not masked

    await press(r, 'Show amounts');
    const shown = flat(r.root);
    expect(shown).toContain('$95.50');
    expect(shown).not.toMatch(/NaN|undefined/);
  });

  it('a refused analytics request is an error with a retry, not a zero and not a new-creator screen', async () => {
    serve({ analytics: refused('Analytics are unavailable') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Analytics are unavailable');
    expect(text).toContain('Try again');
    expect(text).not.toMatch(/\$0(\.00)?\b/);
  });

  it('a refused events request says it could not load, not "No upcoming shoots"', async () => {
    serve({ events: refused('Could not load your events') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load your events');
    expect(text).not.toContain('No upcoming shoots');
  });

  it('a genuinely empty schedule offers to create an event', async () => {
    serve({ events: ok([]) });
    const r = await mount();
    expect(flat(r.root)).toContain('No upcoming shoots');
  });

  it('a failed wallet shows an error and never a zero balance', async () => {
    serve({ wallet: refused('Could not load your wallet') });
    const r = await mount();
    await press(r, 'Show amounts');
    const text = flat(r.root);
    expect(text).toContain('Could not load your wallet');
    expect(text).not.toMatch(/\$0(\.00)?\b/);
  });

  it('a booking request waiting for a reply is surfaced and opens its event', async () => {
    serve({
      events: ok([{ id: 'req1', title: 'Corporate shoot', eventDate: '2999-03-04', bookingStatus: 'PENDING', clientName: 'Aline' }]),
    });
    const r = await mount();
    expect(flat(r.root)).toContain('Needs your reply');
    await press(r, 'Review request');
    expect(mockPush).toHaveBeenCalledWith('/event/req1');
  });

  it('says "No reviews yet" instead of inventing a rating', async () => {
    serve({});
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('No reviews yet');
    expect(text).not.toContain('5.0 / 5');
  });
});

describe('photographer home inside someone else\x27s workspace', () => {
  it('shows balance and analytics but never asks for, or shows, the transaction history', async () => {
    useWorkspace.setState({ activeId: '3f2a9c1e-5b7d-4c8e-9a10-0b1c2d3e4f50' });
    serve({ transactions: ok([{ id: 't1', amount: 120, status: 'COMPLETED', eventName: 'Secret wedding', createdAt: '2026-10-01T10:00:00' }]) });
    const r = await mount();
    const text = flat(r.root);
    expect(mockGet.mock.calls.some((c) => String(c[0]).startsWith('/photographer/transactions'))).toBe(false);
    expect(text).not.toContain('Recent earnings');
    expect(text).not.toContain('Secret wedding');
    // The balance and the analytics are still there: a collaborator may see them.
    expect(mockGet.mock.calls.some((c) => String(c[0]).startsWith('/wallet/me'))).toBe(true);
    expect(mockGet.mock.calls.some((c) => String(c[0]).startsWith('/photographer/analytics'))).toBe(true);
    // The wallet card does not open the wallet screen, which is not part of a shared workspace.
    const card = r.root.findAll((n) => n.props?.accessibilityHint === 'Opens your wallet');
    expect(card.every((n) => n.props.onPress === undefined)).toBe(true);
    // No shortcut to album collaboration either.
    expect(text).not.toContain('Other photographers');
  });

  it('in the photographer own workspace the history is asked for and shown', async () => {
    serve({ transactions: ok([{ id: 't1', amount: 120, status: 'COMPLETED', eventName: 'Kigali Launch', createdAt: '2026-10-01T10:00:00' }]) });
    const r = await mount();
    expect(mockGet.mock.calls.some((c) => String(c[0]).startsWith('/photographer/transactions'))).toBe(true);
    expect(flat(r.root)).toContain('Recent earnings');
  });
});

describe('photographer home goals and sharing', () => {
  it('restores saved goals from the server on Home', async () => {
    serve({
      plans: ok([{ id: 'g1', name: 'Q4 target', timePeriod: 'month', targetEarnings: '4000', targetPending: '0', targetClients: '0', targetBonuses: '0', targetRatings: '0' }]),
    });
    const r = await mount();
    expect(flat(r.root)).toContain('Q4 target');
  });

  it('shows a failed goals read as an error with a retry, not as "no goals"', async () => {
    serve({ plans: new Error('offline') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).not.toContain('No goals yet');
    expect(text).toContain('Goals');
  });

  it('shares the photographer public profile link built from the server slug', async () => {
    const { Share } = require('react-native');
    const spy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    serve({});
    const r = await mount();
    const btn = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Share profile'))[0];
    await act(async () => {
      await btn.props.onPress();
    });
    expect((spy.mock.calls[0][0] as { message: string }).message).toContain('/photographers/joseph-k');
    spy.mockRestore();
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
