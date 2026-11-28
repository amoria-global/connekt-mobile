import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { StyleSheet, Text } from 'react-native';

/**
 * The sign-in screen's guest cards: Find My Photos, Explore Events and Explore Photos & Clips, as wrapping blocks
 * (two a row, the rest below, nothing to scroll sideways), with the Explore card taking its cover from a live item. Rendered over fakes.
 */
import '@/test/autoUnmount';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: (...a: unknown[]) => mockPush(...a), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ loop: false, muted: true, play: jest.fn() }), VideoView: () => null }));
jest.mock('@/features/auth/AuthGlassLayout', () => ({ AuthGlassLayout: ({ bandFooter }: { bandFooter: React.ReactNode }) => bandFooter }));
jest.mock('@/features/auth/GoogleButton', () => ({ GoogleButton: () => null }));
jest.mock('@/features/auth/AppleButton', () => ({ AppleButton: () => null }));
jest.mock('@/features/auth/ChooseRoleBottomSheet', () => ({ ChooseRoleBottomSheet: () => null }));
jest.mock('@/components/FindPhotosBottomSheet', () => ({ FindPhotosBottomSheet: () => null }));
jest.mock('@/features/hybrid/ExploreChoiceSheet', () => ({ ExploreChoiceSheet: () => null }));
jest.mock('@/features/hybrid/postEventIntent', () => ({ pendingPostEvent: { has: () => false, clear: jest.fn() } }));
jest.mock('@/features/auth/api', () => ({ isNeedsPasswordChange: () => false, isNeedsTotp: () => false, isNeedsVerification: () => false }));
jest.mock('@/store/language', () => ({ useLanguage: () => ({ language: 'en', t: (k: string) => k }) }));
jest.mock('@/store/auth', () => ({
  isApiError: () => false,
  useAuth: Object.assign((sel: (s: unknown) => unknown) => sel({ login: jest.fn(), applySession: jest.fn(), user: null }), { getState: () => ({ user: {} }) }),
}));
jest.mock('@/services/storage', () => ({ storage: { get: async () => null, set: async () => undefined, remove: async () => undefined } }));
const mockFeed = jest.fn();
jest.mock('@/features/explore/api', () => ({ fetchFeed: (...a: unknown[]) => mockFeed(...a) }));

import LoginScreen from '@/app/(auth)/login';

const text = (n: ReactTestInstance) => n.findAllByType(Text).map((t) => [t.props.children].flat().join('')).filter(Boolean);

async function mount() {
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<LoginScreen />); });
  await act(async () => {});
  return r;
}

beforeEach(() => { mockPush.mockReset(); mockFeed.mockReset(); });

describe('guest cards on the sign-in screen', () => {
  it('shows three cards as wrapping blocks, two a row, Explore Photos & Clips last, with a live cover', async () => {
    mockFeed.mockResolvedValue({ items: [{ id: 'i1', previewUrl: 'https://e.test/i1-v.jpg' }], nextCursor: null });
    const r = await mount();
    const row = r.root.findByProps({ accessibilityLabel: 'explore_cardsList' });
    expect(row.props.horizontal).toBeUndefined();
    expect(StyleSheet.flatten(row.props.style)).toMatchObject({ flexDirection: 'row', flexWrap: 'wrap' });
    const titles = text(row).filter((x) => /^(findMyPhotos|exploreEvents|explore_cardTitle)$/.test(x));
    expect(titles).toEqual(['findMyPhotos', 'exploreEvents', 'explore_cardTitle']);
    expect(text(row)).toContain('explore_cardSub');
    expect(row.findAll((n) => n.props?.source?.uri === 'https://e.test/i1-v.jpg').length).toBeGreaterThan(0);
  });

  it('opens Explore with one tap, and still shows the card when the feed is down', async () => {
    mockFeed.mockRejectedValue(new Error('offline'));
    const r = await mount();
    const card = r.root.findAll((n) => typeof n.props?.onPress === 'function' && n.props.accessibilityLabel?.startsWith('explore_cardTitle'))[0];
    act(() => card.props.onPress());
    expect(mockPush).toHaveBeenCalledWith('/explore');
  });
});
