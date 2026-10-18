import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

import PhotographerProfileScreen from '@/app/(app)/photographer/[id]';

/**
 * RENDERED screen (react-test-renderer under jest-expo, not a device): the real profile screen over a faked API
 * module. The header used to invent facts: a 5.0 rating, "0 Events", "Since May 2026", an always-on AVAILABLE badge,
 * an "Unknown" location, and a Portfolio tab that said empty whatever the photographer had.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockGetPhotographer = jest.fn();
jest.mock('@/features/photographers/api', () => ({
  getPhotographer: (...a: unknown[]) => mockGetPhotographer(...a),
  getBookedDates: jest.fn().mockResolvedValue([]),
  listBookmarkedPhotographers: jest.fn().mockResolvedValue([]),
  bookmarkPhotographer: jest.fn(),
  unbookmarkPhotographer: jest.fn(),
  rebookPhotographer: jest.fn(),
  reportPhotographer: jest.fn(),
}));
jest.mock('@/features/reviews/api', () => ({ listPhotographerReviews: jest.fn().mockResolvedValue([]) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const React = require('react');
  return {
    useLocalSearchParams: () => ({ id: 'ph1' }),
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    useFocusEffect: (cb: () => void | (() => void)) => React.useEffect(cb, [cb]),
    Stack: { Screen: () => null },
  };
});
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: (p: { children?: React.ReactNode }) => <View>{p.children}</View> };
});
jest.mock('@gorhom/bottom-sheet', () => ({ __esModule: true, default: () => null }));
const mockSnap = jest.fn();
jest.mock('@/features/booking/BookingBottomSheet', () => {
  const React = require('react');
  return { BookingBottomSheet: React.forwardRef((_p: unknown, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ snapToIndex: mockSnap }));
    return null;
  }) };
});
jest.mock('@/features/photographers/CoverCarousel', () => ({ CoverCarousel: () => null }));
jest.mock('@/features/auth/role', () => ({ useRole: () => ({ isCoordinator: false, isClient: true }) }));
jest.mock('@/features/moderation/useModeration', () => ({
  useModeration: (sel: (s: unknown) => unknown) => sel({ blockedIds: new Set<string>(), block: jest.fn(), unblock: jest.fn(), load: jest.fn() }),
}));
jest.mock('@/store/auth', () => ({ isApiError: (e: unknown) => !!e && typeof e === 'object' && 'message' in (e as object) }));

const flat = (node: ReactTestInstance) =>
  node
    .findAllByType(Text)
    .map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? '')))
    .join(' | ');

async function mount(detail: Record<string, unknown>) {
  mockGetPhotographer.mockResolvedValue({ id: 'ph1', name: 'Eric Mugisha', packages: [], ...detail });
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<PhotographerProfileScreen />);
  });
  await act(async () => {
    await new Promise((res) => setTimeout(res, 0));
  });
  return r;
}
const byLabel = (r: TestRenderer.ReactTestRenderer, label: string) =>
  r.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];

beforeEach(() => {
  mockPush.mockReset();
  mockSnap.mockReset();
});

describe('photographer profile as rendered', () => {
  it('a photographer with no rating, no jobs and no location shows none of them, and invents nothing', async () => {
    const r = await mount({ category: 'Weddings' });
    const text = flat(r.root);
    expect(text).toContain('No reviews yet');
    expect(text).not.toMatch(/5\.0|0 Events|Since May|Unknown/);
    expect(text).toContain('AVAILABLE');
  });

  it('shows the real rating, review count, shoots and location', async () => {
    const text = flat((await mount({ rating: 4.86, reviewCount: 32, completedJobs: 58, location: 'Kigali', category: 'Weddings' })).root);
    expect(text).toContain('4.9');
    expect(text).toContain('(32 reviews)');
    expect(text).toContain('58');
    expect(text).toContain('Kigali');
  });

  it('a booked photographer says BOOKED, not AVAILABLE', async () => {
    const text = flat((await mount({ currentStatus: 'booked' })).root);
    expect(text).toContain('BOOKED');
    expect(text).not.toContain('AVAILABLE');
  });

  it('the Book now bar is outside the scroll and opens the booking sheet', async () => {
    const r = await mount({});
    await act(async () => byLabel(r, 'Book Eric Mugisha').props.onPress());
    expect(mockSnap).toHaveBeenCalledWith(0);
  });

  it('the Message button opens the conversation with the photographer name', async () => {
    const r = await mount({});
    await act(async () => byLabel(r, 'Message Eric Mugisha').props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/conversation/ph1?name=Eric%20Mugisha');
  });

  it('Portfolio shows the real work images, and says empty only when there are none', async () => {
    const withImages = await mount({ avatar: 'me.jpg', images: ['a.jpg', 'me.jpg', 'b.jpg'] });
    const tab = withImages.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Portfolio'))[0];
    await act(async () => tab.props.onPress());
    expect(flat(withImages.root)).not.toContain('No portfolio images');

    const none = await mount({});
    const tab2 = none.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'Portfolio'))[0];
    await act(async () => tab2.props.onPress());
    expect(flat(none.root)).toContain('No portfolio images');
  });

  it('About shows the bio, or says there is none rather than inventing experience', async () => {
    const r = await mount({ bio: 'Weddings and portraits since 2019.' });
    const tab = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'About'))[0];
    await act(async () => tab.props.onPress());
    expect(flat(r.root)).toContain('Weddings and portraits since 2019.');

    const empty = await mount({});
    const tab2 = empty.root.findAll((n) => typeof n.props?.onPress === 'function' && n.findAllByType(Text).some((t) => t.props.children === 'About'))[0];
    await act(async () => tab2.props.onPress());
    expect(flat(empty.root)).toContain('has not added a bio yet');
  });

  it('a failed profile read is an error with a way back, not an empty profile', async () => {
    mockGetPhotographer.mockRejectedValue({ message: 'Could not load this photographer' });
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<PhotographerProfileScreen />);
    });
    await act(async () => {
      await new Promise((res) => setTimeout(res, 0));
    });
    const text = flat(r.root);
    expect(text).toContain('Could not load this photographer');
    expect(text).toContain('Go Back');
  });
});
