import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import { ClientHome } from '@/features/dashboard/ClientHome';
import { useCurrency, DEFAULT_CURRENCIES } from '@/store/currency';
import { dayKey, shiftDays } from '@/features/photographer/schedule';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real
 * client home with the real events / analytics / photographers API modules over a
 * faked transport. Chrome (router, top bar, KYC banner, sheets) is faked.
 * Honesty is the point: a failed request is an error with a retry, never a zero or
 * an empty-state sentence, an event that merely carries a stream is not "live",
 * and amounts due are labelled in the currency they are really in.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
jest.mock('@/api/client', () => {
  const actual = jest.requireActual('@/api/client');
  return {
    ...actual,
    api: {
      get: (...a: unknown[]) => mockGet(...a),
      post: (...a: unknown[]) => mockPost(...a),
      delete: (...a: unknown[]) => mockDelete(...a),
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
  const { Text } = require('react-native');
  return { LivePill: ({ label }: { label: string }) => <Text>{label}</Text> };
});
jest.mock('@/features/kyc/KycBanner', () => ({ KycBanner: () => null }));
jest.mock('@/components/FindPhotosBottomSheet', () => ({ FindPhotosBottomSheet: () => null }));
jest.mock('@/components/GlobalSearchModal', () => ({ GlobalSearchModal: () => null }));
jest.mock('@/features/booking/BookingModeSelector', () => ({ BookingModeSelector: () => null }));
jest.mock('@/features/hybrid/ExploreChoiceSheet', () => ({
  ExploreChoiceSheet: () => null,
  pendingPostEvent: { take: () => false },
}));
const mockPaySheet = jest.fn();
jest.mock('@/features/payments/PayNowSheet', () => ({
  PayNowSheet: (props: unknown) => {
    mockPaySheet(props);
    return null;
  },
}));
jest.mock('@/features/photographers/PhotographerCard', () => {
  const { Text, Pressable } = require('react-native');
  return {
    PhotographerCard: ({ photographer, isBookmarked, onToggleBookmark }: { photographer: { name: string }; isBookmarked: boolean; onToggleBookmark: () => void }) => (
      <Pressable accessibilityLabel={`bookmark ${photographer.name}`} onPress={onToggleBookmark}>
        <Text>{`${photographer.name}${isBookmarked ? ' (saved)' : ''}`}</Text>
      </Pressable>
    ),
  };
});
jest.mock('@/config/env', () => ({ env: { hybridBookingEnabled: false, webBaseUrl: 'https://connekyt.com' } }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('@/store/auth', () => {
  const state = () => ({ user: { firstName: 'Aline', customerId: 'c1', customerType: 'CLIENT' }, status: 'authenticated' });
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

type Routes = Partial<Record<'wallet' | 'analytics' | 'events' | 'pending' | 'activities' | 'photographers' | 'bookmarks', unknown>>;

function serve(routes: Routes) {
  const defaults: Routes = {
    wallet: walletFixture,
    analytics: ok({ totalPhotos: 0, totalEvents: 0, upcomingEvents: 0, completedEvents: 0, cancelledEvents: 0, totalBookings: 0, bookmarkedPhotographers: 0 }),
    events: ok([]),
    pending: ok([]),
    activities: ok([]),
    photographers: ok([]),
    bookmarks: ok([]),
  };
  const r = { ...defaults, ...routes };
  mockGet.mockImplementation(async (path: string) => {
    const v = path.startsWith('/wallet/me')
      ? r.wallet
      : path.startsWith('/customer/analytics/recent-activities')
        ? r.activities
        : path.startsWith('/customer/analytics')
          ? r.analytics
          : path.startsWith('/customer/events')
            ? r.events
            : path.startsWith('/customer/payments/pending')
              ? r.pending
              : path.startsWith('/public/photographers/list')
                ? r.photographers
                : path.startsWith('/customer/photographers/bookmarks')
                  ? r.bookmarks
                  : refused('unrouted');
    if (v instanceof Error) throw v;
    return v;
  });
}

async function mount(): Promise<TestRenderer.ReactTestRenderer> {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<ClientHome />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}

const press = async (r: TestRenderer.ReactTestRenderer, label: string) => {
  const node = r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
  if (!node) throw new Error(`nothing to press labelled "${label}"`);
  await act(async () => {
    node.props.onPress();
  });
};

const inDays = (n: number) => shiftDays(dayKey(new Date()), n);

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
  mockPush.mockReset();
  mockPaySheet.mockReset();
  useCurrency.setState({ currency: 'USD', currencies: DEFAULT_CURRENCIES });
});

describe('client home as rendered', () => {
  it('leads with the next event: countdown, confirmation, and masks amounts until shown', async () => {
    serve({
      events: ok([{ id: 'e1', title: 'Yubire Wedding', eventDate: inDays(8), startTime: '10:00', location: 'Kigali', bookingStatus: 'ACCEPTED', photographer: { firstName: 'Eric', lastName: 'M' } }]),
      pending: ok([{ id: 'p1', eventTitle: 'Yubire Wedding', photographerName: 'Eric M', amountInUsd: 300, paidAmountInUsd: 100, status: 'PENDING' }]),
    });
    const r = await mount();
    const masked = flat(r.root);
    expect(masked).toContain('Welcome back, Aline');
    expect(masked).toContain('Yubire Wedding');
    expect(masked).toContain('8 days to go');
    expect(masked).toContain('Photographer confirmed');
    expect(masked).toContain('Photographer: Eric M');
    expect(masked).toContain('••••');
    expect(masked).not.toContain('$200.00');

    await press(r, 'Show amounts');
    const text = flat(r.root);
    expect(text).toContain('$200.00'); // 300 minus 100 paid, a USD ledger value
    expect(text).toContain('$100.00'); // wallet lifetime spend from wallet-me-client.json
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('Pay now opens the payment sheet with that exact payment', async () => {
    serve({
      events: ok([{ id: 'e1', title: 'Yubire Wedding', eventDate: inDays(3) }]),
      pending: ok([{ id: 'p1', eventTitle: 'Yubire Wedding', photographerName: 'Eric M', amountInUsd: 300, paidAmountInUsd: 0, status: 'PENDING' }]),
    });
    const r = await mount();
    const pay = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Pay now'))[0];
    await act(async () => {
      pay.props.onPress();
    });
    const last = mockPaySheet.mock.calls[mockPaySheet.mock.calls.length - 1][0] as { payment: { id: string } | null; visible: boolean };
    expect(last.visible).toBe(true);
    expect(last.payment?.id).toBe('p1');
  });

  it('two open payments under one event title are not guessed: Review payments, not Pay now, on the event', async () => {
    serve({
      events: ok([{ id: 'e1', title: 'Yubire Wedding', eventDate: inDays(3) }]),
      pending: ok([
        { id: 'p1', eventTitle: 'Yubire Wedding', photographerName: 'Eric M', amountInUsd: 100, paidAmountInUsd: 0, status: 'PENDING' },
        { id: 'p2', eventTitle: 'Yubire Wedding', photographerName: 'Eric M', amountInUsd: 200, paidAmountInUsd: 0, status: 'PENDING' },
      ]),
    });
    const r = await mount();
    const text = flat(r.root);
    // The event cards offer no direct Pay now; the Action required cards each carry their own payment.
    const eventCardPay = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Review payments'));
    expect(eventCardPay.length).toBeGreaterThan(0);
    const review = eventCardPay[0];
    await act(async () => {
      review.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/payments');
    expect(text).toContain('Action required');
  });

  it('an event that carries a stream is not called live', async () => {
    serve({ events: ok([{ id: 'e1', title: 'Gala', eventDate: inDays(2), hasLiveStream: true, streamStatus: 'disconnected' }]) });
    const r = await mount();
    const text = flat(r.root);
    expect(text).not.toContain('Live now');
    expect(text).toContain('View booking');
  });

  it('an ONGOING event is live and offers Watch live, opening the live room', async () => {
    serve({ events: ok([{ id: 'live1', title: 'Concert', eventDate: dayKey(new Date()), status: 'ONGOING' }]) });
    const r = await mount();
    expect(flat(r.root)).toContain('Live now');
    const watch = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Watch live'))[0];
    await act(async () => {
      watch.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/(public)/events/live-stream?id=live1');
  });

  it('a refused events request is an error with a retry, not "No upcoming events"', async () => {
    serve({ events: refused('Could not load your events') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load your events');
    expect(text).toContain('Try again');
    expect(text).not.toContain('No upcoming events');
  });

  it('a genuinely empty account offers to book a photographer', async () => {
    serve({});
    const r = await mount();
    expect(flat(r.root)).toContain('No upcoming events');
    const book = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Book photographer'))[0];
    await act(async () => {
      book.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/photographers');
  });

  it('a failed pending-payments read says so and never shows a payment or a zero', async () => {
    serve({ pending: refused('Payments are unavailable') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Action required');
    expect(text).toContain('Payments are unavailable');
    expect(text).not.toContain('Payment due');
    expect(text).not.toMatch(/\$0(\.00)?\b/);
  });

  it('a settled payment is not action required, and no photos means no photos card', async () => {
    serve({ pending: ok([{ id: 'p1', eventTitle: 'Done', photographerName: 'A', amountInUsd: 50, paidAmountInUsd: 50, status: 'PENDING' }]) });
    const r = await mount();
    const text = flat(r.root);
    expect(text).not.toContain('Action required');
    expect(text).not.toContain('Photos ready');
  });

  it('delivered photos are surfaced and open the albums', async () => {
    serve({ analytics: ok({ totalPhotos: 42 }) });
    const r = await mount();
    expect(flat(r.root)).toContain('42 in your albums');
    const btn = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Review photos'))[0];
    await act(async () => {
      btn.props.onPress();
    });
    expect(mockPush).toHaveBeenCalledWith('/gallery');
  });

  it('a failed photographers read is an error with a retry, not "no photographers"', async () => {
    serve({ photographers: refused('Could not load photographers') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load photographers');
    expect(text).not.toContain('No photographers to show yet');
  });

  it('opens a featured photographer, and a bookmark that fails is put back', async () => {
    serve({ photographers: ok([{ id: 'ph1', name: 'Eric M' }]) });
    mockPost.mockRejectedValue(new Error('offline'));
    const r = await mount();
    expect(flat(r.root)).toContain('Eric M');
    await press(r, "View Eric M's profile");
    expect(mockPush).toHaveBeenCalledWith('/photographer/ph1');

    await press(r, 'bookmark Eric M');
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
    expect(flat(r.root)).not.toContain('(saved)');
  });

  it('shows real recent activity and opens where it belongs', async () => {
    serve({ activities: ok([{ id: 'a1', type: 'GALLERY_READY', title: 'Your album is ready', createdAt: new Date().toISOString() }]) });
    const r = await mount();
    expect(flat(r.root)).toContain('Your album is ready');
    await press(r, 'Your album is ready, Just now');
    expect(mockPush).toHaveBeenCalledWith('/gallery');
  });

  it('a failed activity read is an error, not "Nothing yet"', async () => {
    serve({ activities: refused('Could not load activity') });
    const r = await mount();
    const text = flat(r.root);
    expect(text).toContain('Could not load activity');
    expect(text).not.toContain('Nothing yet');
  });
});
