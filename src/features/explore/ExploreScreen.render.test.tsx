import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { Text } from 'react-native';

/**
 * RENDERED Explore screen (react-test-renderer under jest-expo, not a device) over a faked feed. It proves the screen
 * mounts without a crash, lists photos and clips, has loading, empty, offline and error states, and, above all, that a
 * store build renders no price, no Buy and no cart while a web build does.
 */
import '@/test/autoUnmount';
import Screen from './ExploreScreen';
import { useSaves } from './saves';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mockDigital = false;
jest.mock('@/features/payments/policy', () => ({ get digitalPurchasesEnabled() { return mockDigital; }, giftsEnabled: true }));
const mockFeed = jest.fn();
const mockFacets = jest.fn();
const mockItem = jest.fn();
jest.mock('./api', () => ({
  ...jest.requireActual('./api'),
  fetchFeed: (...a: unknown[]) => mockFeed(...a),
  fetchFacets: (...a: unknown[]) => mockFacets(...a),
  fetchItem: (...a: unknown[]) => mockItem(...a),
  fetchSavedIds: async () => [],
  putSave: async () => undefined,
  deleteSave: async () => undefined,
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }), Redirect: () => null }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-video', () => ({ useVideoPlayer: () => ({ addListener: () => ({ remove: () => {} }), play: () => {}, muted: true }), VideoView: () => null }));
jest.mock('@/features/photos/PhotoCheckoutSheet', () => ({ PhotoCheckoutSheet: () => null }));
jest.mock('@/store/auth', () => ({ useAuth: (sel: (s: { user: null }) => unknown) => sel({ user: null }), isApiError: () => false }));
jest.mock('@/services/storage', () => ({ storage: { get: async () => null, set: async () => undefined, remove: async () => undefined } }));

const item = (id: string, over: Record<string, unknown> = {}) => ({
  id, albumId: 'a1', mediaType: 'PHOTO', title: `Item ${id}`, categoryLabel: 'Nature', creatorName: 'Aline Uwase',
  creatorLogo: null, thumbnailUrl: `https://e.test/${id}.jpg`, previewUrl: `https://e.test/${id}-v.jpg`, previewVideoUrl: null,
  durationSeconds: null, aspectRatio: 1.3, priceAmount: 5, priceCurrency: 'USD', tags: [], ...over,
});

const flat = (node: ReactTestInstance): string =>
  node.findAllByType(Text).map((t) => (Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children ?? ''))).join(' | ');

async function mount(digital: boolean): Promise<TestRenderer.ReactTestRenderer> {
  mockDigital = digital;
  let r!: TestRenderer.ReactTestRenderer;
  await act(async () => { r = TestRenderer.create(<Screen />); });
  await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
  return r;
}

beforeEach(() => {
  mockFeed.mockReset();
  mockFacets.mockReset();
  mockFacets.mockResolvedValue({ categories: [{ name: 'NATURE', label: 'Nature', count: 3 }], tags: [], clips: 1, total: 3 });
});

describe('Explore screen as rendered', () => {
  it('lists photos and a clip with its duration', async () => {
    mockFeed.mockResolvedValue({ items: [item('p1'), item('p2'), item('c1', { mediaType: 'VIDEO', durationSeconds: 30, previewVideoUrl: 'https://e.test/c1.m3u8' })], nextCursor: null });
    const r = await mount(false);
    const text = flat(r.root);
    expect(text).toContain('0:30');
    expect(r.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && /Item p1/.test(n.props.accessibilityLabel)).length).toBeGreaterThan(0);
  });

  it('a store build shows no price, no buy and no cart anywhere', async () => {
    mockFeed.mockResolvedValue({ items: [item('p1'), item('p2')], nextCursor: null });
    const r = await mount(false);
    const text = flat(r.root);
    expect(text).not.toMatch(/\$|USD|5\.00|price|Buy|cart|checkout|licen/i);
    // price sorting is a price feature too
    expect(text).not.toMatch(/low to high|high to low/i);
  });

  it('a web build shows the price and the price sorts', async () => {
    mockFeed.mockResolvedValue({ items: [item('p1')], nextCursor: null });
    const r = await mount(true);
    const text = flat(r.root);
    expect(text).toMatch(/\$5|5\.00|USD/);
    expect(text).toMatch(/low to high/i);
  });

  it('shows the empty state when nothing matches', async () => {
    mockFeed.mockResolvedValue({ items: [], nextCursor: null });
    const r = await mount(false);
    expect(flat(r.root)).toMatch(/Nothing matches yet/);
  });

  it('shows the offline state with a retry when the network is down', async () => {
    mockFeed.mockRejectedValue(new Error('Network request failed'));
    const r = await mount(false);
    const text = flat(r.root);
    expect(text).toMatch(/offline/i);
    expect(text).toMatch(/Try again/);
  });

  it('shows the error state when the server fails', async () => {
    mockFeed.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));
    const r = await mount(false);
    expect(flat(r.root)).toMatch(/could not load Explore/i);
  });

  it('offers "I already bought this" in a store build', async () => {
    mockFeed.mockResolvedValue({ items: [item('p1')], nextCursor: null });
    const r = await mount(false);
    expect(flat(r.root)).toMatch(/I already bought this/);
  });

  async function openSaved(r: TestRenderer.ReactTestRenderer) {
    const chip = r.root.findAll(n => n.props.accessibilityRole === 'tab' && /^Saved/.test(flat(n))).find(n => typeof n.props.onPress === 'function');
    expect(chip).toBeTruthy();
    await act(async () => { chip!.props.onPress(); });
    await act(async () => { await new Promise((res) => setTimeout(res, 0)); });
  }

  it('the Saved view lists the hearted items', async () => {
    mockFeed.mockResolvedValue({ items: [item('p1'), item('p2')], nextCursor: null });
    mockItem.mockImplementation(async (id: string) => item(id));
    const r = await mount(false);
    await act(async () => { useSaves.setState({ ids: ['p2'], ready: true }); });
    await openSaved(r);
    expect(mockItem).toHaveBeenCalledWith('p2');
    expect(r.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && /Item p2/.test(n.props.accessibilityLabel)).length).toBeGreaterThan(0);
    expect(r.root.findAll(n => typeof n.props.accessibilityLabel === 'string' && /Item p1/.test(n.props.accessibilityLabel)).length).toBe(0);
  });

  it('the Saved view says what to do when nothing is saved', async () => {
    mockFeed.mockResolvedValue({ items: [item('p1')], nextCursor: null });
    useSaves.setState({ ids: [], ready: true });
    const r = await mount(false);
    await openSaved(r);
    expect(flat(r.root)).toMatch(/Tap the heart/);
    expect(flat(r.root)).toMatch(/See all/);
  });
});
